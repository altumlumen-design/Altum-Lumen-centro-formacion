/*
 * ALTUM LUMEN · Verificación pública conectada a SIRA/PEDA
 * Versión: 2026-09-21 · SIRA 3.6.2
 *
 * IMPORTANTE:
 * - Este archivo NO contiene la base de registros académicos.
 * - Mantiene intacta la interfaz de verificacion.html.
 * - Las búsquedas se resuelven dentro de SIRA/PEDA mediante consulta puntual JSONP.
 */
(() => {
  'use strict';

  const VERSION = '20260921-sira-362-fast';
  const SIRA_API_URL = 'https://script.google.com/macros/s/AKfycbysdGK_9D_nDDrhj6pa53_4H6eOT0U3k_KBqZ1iX_Co7oTCvdEAqnE5Sac1ZRAugfZo/exec';
  const REQUEST_TIMEOUT_MS = 8000;
  const PING_TIMEOUT_MS = 5000;

  /*
   * verificacion.html comprueba que REGISTROS_PUBLICOS sea un arreglo antes de
   * registrar sus manejadores históricos. Este marcador conserva compatibilidad
   * sin volver a descargar ningún padrón ni dato personal.
   */
  window.REGISTROS_PUBLICOS = Object.freeze([{ __sira_live__: true }]);
  window.REGISTROS_PUBLICOS_META = Object.freeze({
    version: VERSION,
    mode: 'SIRA_PEDA_PRIVATE_DIRECT',
    baseHistorica: 0,
    actualizacion: 0,
    total: 0
  });

  let requestSeq = 0;
  let busy = false;

  function byId(id){ return document.getElementById(id); }
  function normalize(value){
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }
  function htmlSafe(value){
    return (value ?? '').toString()
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;');
  }
  function sessionId(){
    const key='altum_registry_sid_v362';
    try{
      let value=sessionStorage.getItem(key)||'';
      if(/^[a-z0-9_-]{16,96}$/i.test(value))return value;
      const bytes=new Uint8Array(18);
      if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);
      else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
      value='web-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      sessionStorage.setItem(key,value);
      return value;
    }catch(_e){
      return 'web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,20);
    }
  }
  const SESSION_ID=sessionId();

  function setStatus(message, isError=false){
    const statusLine = byId('statusLine');
    if(!statusLine) return;
    statusLine.textContent = message;
    statusLine.classList.add('visible');
    statusLine.style.color = isError ? '#b42318' : '#20406c';
  }
  function hideResults(){
    byId('resultsPanel')?.classList.remove('visible');
    byId('contactNote')?.classList.remove('visible');
    const results = byId('resultsContainer');
    if(results) results.innerHTML = '';
  }
  function makeCaptcha(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({length:5}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    const box = byId('captchaCode');
    if(box) box.textContent = code;
    return code;
  }
  function validateCriteria(){
    const rawDni = byId('dniInput')?.value.trim() || '';
    const rawName = byId('nameInput')?.value.trim() || '';
    const rawCode = byId('codeInput')?.value.trim() || '';
    const filled = [rawDni, rawName, rawCode].filter(Boolean);

    if(filled.length === 0) return {ok:false, msg:'Ingrese un criterio de búsqueda.'};
    if(filled.length > 1) return {ok:false, msg:'Use solo un criterio: DNI o nombre o código de emisión.'};
    if(rawDni && !/^\d{8}$/.test(rawDni)) return {ok:false, msg:'El DNI debe contener exactamente 8 dígitos.'};
    if(rawName && normalize(rawName).split(' ').filter(Boolean).length < 2){
      return {ok:false, msg:'Para buscar por nombre, ingrese al menos un nombre y un apellido.'};
    }
    if(rawDni) return {ok:true, type:'dni', value:rawDni};
    if(rawName) return {ok:true, type:'nombre', value:rawName};
    return {ok:true, type:'codigo', value:rawCode};
  }
  function renderRecord(record){
    const docFull = [record.tipo_doc_identidad, record.numero_documento].filter(Boolean).join(' ');
    return `
      <div class="record">
        <div class="record-head">
          <div class="record-label">Participante:</div>
          <div class="record-value">${htmlSafe(record.nombre_completo || '')}<br>${htmlSafe(docFull || '')}</div>
        </div>
        <div class="record-head">
          <div class="record-label">Tipo de documento:</div>
          <div class="record-value light">${htmlSafe(record.tipo_documento || '')}</div>
        </div>
        <div class="record-body">
          <div class="meta-line"><strong>Condición obtenida:</strong> <span>${htmlSafe(record.condicion_obtenida || '')}</span></div>
          <div class="meta-line"><strong>Denominación del programa:</strong> <span>${htmlSafe(record.denominacion_programa || '')}</span></div>
          <div class="meta-line"><strong>Tipo de programa:</strong> <span>${htmlSafe(record.tipo_programa || '')}</span></div>
          <div class="meta-line"><strong>Fecha de emisión:</strong> <span>${htmlSafe(record.fecha_emision || '')}</span></div>
          <div class="meta-line"><strong>Horas académicas:</strong> <span>${htmlSafe(record.horas_academicas || '')}</span></div>
          <div class="meta-line"><strong>Código de emisión:</strong> <span>${htmlSafe(record.codigo_emision || '')}</span></div>
          <div class="meta-row">
            <div><strong>Estado:</strong> ${htmlSafe(record.estado || 'VÁLIDO')}</div>
          </div>
        </div>
      </div>
    `;
  }
  function jsonp(action, params={}, timeoutMs=REQUEST_TIMEOUT_MS){
    return new Promise((resolve,reject) => {
      const id=`${Date.now().toString(36)}_${(++requestSeq).toString(36)}_${Math.random().toString(36).slice(2,8)}`;
      const callback=`__altumRegistryCB_${id.replace(/[^A-Za-z0-9_]/g,'_')}`;
      const script=document.createElement('script');
      let settled=false;
      let timer=null;
      const cleanup=()=>{
        if(timer)clearTimeout(timer);
        try{delete window[callback];}catch(_e){window[callback]=undefined;}
        script.remove();
      };
      const finish=(fn,value)=>{
        if(settled)return;settled=true;cleanup();fn(value);
      };
      window[callback]=payload=>finish(resolve,payload||{});
      script.async=true;
      script.referrerPolicy='no-referrer';
      script.onerror=()=>finish(reject,new Error('No se pudo conectar con SIRA. Verifique que la implementación web esté actualizada.'));
      const query=new URLSearchParams({
        action,
        callback,
        sid:SESSION_ID,
        _:String(Date.now()),
        ...params
      });
      script.src=`${SIRA_API_URL}?${query.toString()}`;
      timer=setTimeout(()=>finish(reject,new Error('La consulta a SIRA no respondió a tiempo. Verifique la implementación web e intente nuevamente.')),timeoutMs);
      document.head.appendChild(script);
    });
  }
  async function searchRemote(){
    if(busy) return;
    const criteriaCheck = validateCriteria();
    if(!criteriaCheck.ok){
      setStatus(criteriaCheck.msg, true);
      hideResults();
      return;
    }

    const captchaInput = byId('captchaInput');
    const captchaShown = (byId('captchaCode')?.textContent || '').trim().toUpperCase();
    const captchaTyped = (captchaInput?.value || '').trim().toUpperCase();
    if(!captchaTyped){
      setStatus('Ingrese el código de validación visual.', true);
      return;
    }
    if(!captchaShown || captchaTyped !== captchaShown){
      setStatus('El código de validación no coincide. Genere uno nuevo o intente nuevamente.', true);
      hideResults();
      makeCaptcha();
      if(captchaInput) captchaInput.value = '';
      return;
    }

    busy = true;
    const searchBtn = byId('searchBtn');
    if(searchBtn) searchBtn.disabled = true;
    setStatus('Consultando Registro Académico…');
    try{
      const response = await jsonp('registroConsulta',{tipo:criteriaCheck.type,valor:criteriaCheck.value});
      if(!response?.ok) throw new Error(response?.message || 'No se pudo consultar SIRA.');
      const matches = Array.isArray(response.matches) ? response.matches : [];
      const resultsPanel = byId('resultsPanel');
      const resultsContainer = byId('resultsContainer');
      const contactNote = byId('contactNote');

      if(!matches.length){
        setStatus('No se encontraron registros con los datos ingresados.', true);
        resultsPanel?.classList.add('visible');
        contactNote?.classList.add('visible');
        if(resultsContainer){
          resultsContainer.innerHTML = `
            <div class="record">
              <div class="record-head">
                <div class="record-label">Resultado:</div>
                <div class="record-value" style="text-align:left;color:#10457f;">No se encontró ningún registro con los datos ingresados.</div>
              </div>
            </div>
          `;
        }
      }else{
        setStatus(`Se encontraron ${matches.length} registro(s).`);
        resultsPanel?.classList.add('visible');
        contactNote?.classList.remove('visible');
        if(resultsContainer) resultsContainer.innerHTML = matches.map(renderRecord).join('');
      }
      makeCaptcha();
      if(captchaInput) captchaInput.value = '';
    }catch(error){
      hideResults();
      setStatus(error?.message || 'No se pudo consultar el Registro Académico en este momento. Intente nuevamente.', true);
    }finally{
      busy = false;
      if(searchBtn) searchBtn.disabled = false;
    }
  }

  /*
   * Captura en fase "capture" para impedir que verificacion.html ejecute su
   * antigua búsqueda local. No se modifica ningún HTML/CSS ni su diseño visual.
   */
  document.addEventListener('click', event => {
    const target = event.target;
    if(!(target instanceof Element)) return;
    const searchBtn = target.closest('#searchBtn');
    if(!searchBtn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    searchRemote();
  }, true);

  document.addEventListener('keydown', event => {
    if(event.key !== 'Enter') return;
    const id = event.target && event.target.id;
    if(!['dniInput','nameInput','codeInput','captchaInput'].includes(id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    searchRemote();
  }, true);

  // Calienta la instancia de Apps Script al abrir la página. No descarga datos.
  const warm=()=>jsonp('registroPing',{},PING_TIMEOUT_MS).catch(()=>{});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',warm,{once:true});
  else warm();
})();
