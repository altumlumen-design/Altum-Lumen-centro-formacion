/*
 * ALTUM LUMEN · Verificación pública conectada a SIRA/PEDA
 * Versión: 2026-09-21 · SIRA 3.6.3
 *
 * IMPORTANTE:
 * - Este archivo NO contiene la base de registros académicos.
 * - Mantiene intacta la interfaz de verificacion.html.
 * - Las búsquedas se resuelven dentro de SIRA/PEDA mediante un puente oculto.
 */
(() => {
  'use strict';

  const VERSION = '20260921-sira-363-bridge-fast';
  const SIRA_BRIDGE_URL = 'https://script.google.com/macros/s/AKfycbysdGK_9D_nDDrhj6pa53_4H6eOT0U3k_KBqZ1iX_Co7oTCvdEAqnE5Sac1ZRAugfZo/exec?action=registroBridge&v=363';
  const BRIDGE_TIMEOUT_MS = 12000;
  const GOOGLE_ORIGIN_RE = /^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+\.)*googleusercontent\.com)$/i;

  /*
   * verificacion.html todavía comprueba que REGISTROS_PUBLICOS sea un arreglo
   * antes de registrar sus manejadores históricos. Se deja un marcador inocuo
   * para conservar compatibilidad sin volver a descargar ningún padrón.
   */
  window.REGISTROS_PUBLICOS = Object.freeze([{ __sira_bridge_fast__: true }]);
  window.REGISTROS_PUBLICOS_META = Object.freeze({
    version: VERSION,
    mode: 'SIRA_PEDA_PRIVATE_BRIDGE_FAST',
    baseHistorica: 0,
    actualizacion: 0,
    total: 0
  });

  let bridgeFrame = null;
  let bridgeReady = false;
  let bridgeOrigin = '';
  let requestSeq = 0;
  let busy = false;
  const pending = new Map();
  const queued = [];

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
  function digits(value){ return (value ?? '').toString().replace(/\D/g,''); }
  function htmlSafe(value){
    return (value ?? '').toString()
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;');
  }
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
    return {ok:true, criteria:{dni:rawDni, name:rawName, code:rawCode}};
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
  function validBridgeMessage(event){
    if(!bridgeFrame || event.source !== bridgeFrame.contentWindow) return false;
    return GOOGLE_ORIGIN_RE.test(event.origin || '');
  }
  function sendQueued(){
    if(!bridgeReady || !bridgeFrame || !bridgeOrigin) return;
    while(queued.length){
      const message = queued.shift();
      bridgeFrame.contentWindow.postMessage(message, bridgeOrigin);
    }
  }
  function ensureBridge(){
    if(bridgeFrame) return bridgeFrame;
    window.addEventListener('message', event => {
      if(!validBridgeMessage(event)) return;
      const data = event.data || {};
      if(data.type === 'ALTUM_REGISTRY_READY'){
        bridgeReady = true;
        bridgeOrigin = event.origin;
        sendQueued();
        return;
      }
      if(data.type !== 'ALTUM_REGISTRY_RESULT' && data.type !== 'ALTUM_REGISTRY_ERROR') return;
      const id = String(data.id || '');
      const job = pending.get(id);
      if(!job) return;
      pending.delete(id);
      clearTimeout(job.timer);
      if(data.type === 'ALTUM_REGISTRY_ERROR') job.reject(new Error(data.message || 'No se pudo consultar SIRA.'));
      else job.resolve(data.result || {ok:true,matches:[]});
    });

    bridgeFrame = document.createElement('iframe');
    bridgeFrame.src = SIRA_BRIDGE_URL;
    bridgeFrame.title = 'Conexión segura SIRA';
    bridgeFrame.setAttribute('aria-hidden','true');
    bridgeFrame.tabIndex = -1;
    bridgeFrame.style.cssText = 'position:fixed!important;width:1px!important;height:1px!important;left:-9999px!important;top:-9999px!important;border:0!important;opacity:0!important;pointer-events:none!important;';
    bridgeFrame.addEventListener('load',()=>{try{bridgeFrame?.contentWindow?.postMessage({type:'ALTUM_REGISTRY_PING'},'*');}catch(_e){}});
    document.body.appendChild(bridgeFrame);
    return bridgeFrame;
  }
  function bridgeSearch(criteria){
    ensureBridge();
    return new Promise((resolve,reject) => {
      const id = `${Date.now().toString(36)}-${(++requestSeq).toString(36)}`;
      const message = {type:'ALTUM_REGISTRY_SEARCH', id, criteria};
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('La consulta está tardando más de lo esperado. Intente nuevamente.'));
      }, BRIDGE_TIMEOUT_MS);
      pending.set(id,{resolve,reject,timer});
      if(bridgeReady && bridgeOrigin && bridgeFrame?.contentWindow){
        bridgeFrame.contentWindow.postMessage(message, bridgeOrigin);
      }else{
        queued.push(message);
        try{ bridgeFrame?.contentWindow?.postMessage({type:'ALTUM_REGISTRY_PING'}, '*'); }catch(_e){}
      }
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
      const response = await bridgeSearch(criteriaCheck.criteria);
      const matches = Array.isArray(response?.matches) ? response.matches : [];
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
   * Captura en fase "capture" para que el manejador histórico de verificacion.html
   * no llegue a ejecutar su antigua búsqueda local sobre el JSON. El resto de la
   * página (limpiar, imprimir, pestañas, CAPTCHA visual, estilos y responsive)
   * continúa funcionando con su código original.
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

  ensureBridge();
})();
