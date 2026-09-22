/*
 * ALTUM LUMEN · Verificación pública conectada a SIRA/PEDA
 * Versión: 2026-09-21 · SIRA 3.6.7
 *
 * Transporte probado: el mismo POST + iframe + postMessage usado por el Aula Virtual.
 * No contiene ni descarga el padrón completo.
 */
(() => {
  'use strict';

  const VERSION = '20260922-sira-367-dual-fast';
  const SIRA_API_URL = 'https://script.google.com/macros/s/AKfycbysdGK_9D_nDDrhj6pa53_4H6eOT0U3k_KBqZ1iX_Co7oTCvdEAqnE5Sac1ZRAugfZo/exec';
  const REQUEST_TIMEOUT_MS = 12000;
  const FALLBACK_DELAY_MS = 1800;
  const EXPECTED_SOURCE = 'SIRA_REGISTRO_PUBLICO';

  window.REGISTROS_PUBLICOS = Object.freeze([{ __sira_dual_fast__: true }]);
  window.REGISTROS_PUBLICOS_META = Object.freeze({version:VERSION,mode:'SIRA_PEDA_PRIVATE_DUAL_FAST',baseHistorica:0,actualizacion:0,total:0});

  let busy=false;
  const pageCache=new Map();

  ['https://script.google.com','https://script.googleusercontent.com'].forEach(href=>{
    try{
      if(document.querySelector(`link[rel="preconnect"][href="${href}"]`))return;
      const link=document.createElement('link');link.rel='preconnect';link.href=href;link.crossOrigin='anonymous';document.head.appendChild(link);
    }catch(_e){}
  });

  function byId(id){return document.getElementById(id);}
  function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
  function htmlSafe(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
  function sessionId(){
    const key='altum_registry_sid_v366';
    try{
      let value=sessionStorage.getItem(key)||'';if(/^[a-z0-9_-]{16,96}$/i.test(value))return value;
      const bytes=new Uint8Array(18);if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
      value='web-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');sessionStorage.setItem(key,value);return value;
    }catch(_e){return 'web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,20);}
  }
  const SESSION_ID=sessionId();

  function setStatus(message,isError=false){const el=byId('statusLine');if(!el)return;el.textContent=message;el.classList.add('visible');el.style.color=isError?'#b42318':'#20406c';}
  function hideResults(){byId('resultsPanel')?.classList.remove('visible');byId('contactNote')?.classList.remove('visible');const r=byId('resultsContainer');if(r)r.innerHTML='';}
  function makeCaptcha(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('');const box=byId('captchaCode');if(box)box.textContent=code;return code;}
  function validateCriteria(){
    const dni=byId('dniInput')?.value.trim()||'',name=byId('nameInput')?.value.trim()||'',code=byId('codeInput')?.value.trim()||'';
    const filled=[dni,name,code].filter(Boolean);if(!filled.length)return {ok:false,msg:'Ingrese un criterio de búsqueda.'};if(filled.length>1)return {ok:false,msg:'Use solo un criterio: DNI o nombre o código de emisión.'};
    if(dni&&!/^\d{8}$/.test(dni))return {ok:false,msg:'El DNI debe contener exactamente 8 dígitos.'};
    if(name&&normalize(name).split(' ').filter(Boolean).length<2)return {ok:false,msg:'Para buscar por nombre, ingrese al menos un nombre y un apellido.'};
    if(dni)return {ok:true,type:'dni',value:dni};if(name)return {ok:true,type:'nombre',value:name};return {ok:true,type:'codigo',value:code};
  }
  function renderRecord(r){
    const doc=[r.tipo_doc_identidad,r.numero_documento].filter(Boolean).join(' ');
    return `<div class="record"><div class="record-head"><div class="record-label">Participante:</div><div class="record-value">${htmlSafe(r.nombre_completo||'')}<br>${htmlSafe(doc)}</div></div><div class="record-head"><div class="record-label">Tipo de documento:</div><div class="record-value light">${htmlSafe(r.tipo_documento||'')}</div></div><div class="record-body"><div class="meta-line"><strong>Condición obtenida:</strong> <span>${htmlSafe(r.condicion_obtenida||'')}</span></div><div class="meta-line"><strong>Denominación del programa:</strong> <span>${htmlSafe(r.denominacion_programa||'')}</span></div><div class="meta-line"><strong>Tipo de programa:</strong> <span>${htmlSafe(r.tipo_programa||'')}</span></div><div class="meta-line"><strong>Fecha de emisión:</strong> <span>${htmlSafe(r.fecha_emision||'')}</span></div><div class="meta-line"><strong>Horas académicas:</strong> <span>${htmlSafe(r.horas_academicas||'')}</span></div><div class="meta-line"><strong>Código de emisión:</strong> <span>${htmlSafe(r.codigo_emision||'')}</span></div><div class="meta-row"><div><strong>Estado:</strong> ${htmlSafe(r.estado||'VÁLIDO')}</div></div></div></div>`;
  }
  function cacheKey(type,value){return type+':'+normalize(value);}
  function addHidden(form,name,value){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value??'');form.appendChild(input);}

  function requestSira(type,value){
    const key=cacheKey(type,value);if(pageCache.has(key))return Promise.resolve(pageCache.get(key));
    return new Promise(resolve=>{
      const requestId=`reg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let done=false,postFrame=null,postForm=null,jsonpScript=null,jsonpCallback='',mainTimer=0,fallbackTimer=0;
      const cleanup=()=>{
        window.removeEventListener('message',onMessage);
        window.clearTimeout(mainTimer);window.clearTimeout(fallbackTimer);
        try{postForm?.remove();}catch(_e){};try{postFrame?.remove();}catch(_e){};
        if(jsonpCallback){try{delete window[jsonpCallback];}catch(_e){window[jsonpCallback]=undefined;}}
        try{jsonpScript?.remove();}catch(_e){}
      };
      const finish=result=>{
        if(done)return;done=true;cleanup();
        if(result?.ok)pageCache.set(key,result);
        resolve(result||{ok:false,message:'No fue posible completar la consulta.'});
      };
      const onMessage=event=>{
        const data=event.data||{};
        // requestId es aleatorio por consulta y el backend firma lógicamente el
        // mensaje con source. No dependemos del origen que Google asigne a su wrapper.
        if(data.source!==EXPECTED_SOURCE||data.requestId!==requestId)return;
        finish(data.payload);
      };
      const launchPost=()=>{
        const frame=document.createElement('iframe'),frameName=`sira_reg_${requestId.replace(/[^a-z0-9_]/gi,'')}`;
        frame.name=frameName;frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px';
        const form=document.createElement('form');form.method='POST';form.action=SIRA_API_URL;form.target=frameName;form.style.display='none';
        addHidden(form,'action','registroConsultaPublica');addHidden(form,'requestId',requestId);addHidden(form,'tipo',type);addHidden(form,'valor',value);addHidden(form,'sid',SESSION_ID);addHidden(form,'v',VERSION);
        postFrame=frame;postForm=form;document.body.append(frame,form);form.submit();
      };
      const launchJsonp=()=>{
        if(done||jsonpScript)return;
        jsonpCallback=`__altumRegistryCB_${Date.now()}_${Math.random().toString(36).slice(2).replace(/[^a-z0-9_]/gi,'')}`;
        window[jsonpCallback]=payload=>finish(payload);
        const params=new URLSearchParams({action:'registroConsulta',callback:jsonpCallback,tipo:type,valor:value,sid:SESSION_ID,v:VERSION,_:String(Date.now())});
        const script=document.createElement('script');script.async=true;script.src=`${SIRA_API_URL}?${params.toString()}`;
        script.onerror=()=>{try{script.remove();}catch(_e){}};jsonpScript=script;document.head.appendChild(script);
      };
      window.addEventListener('message',onMessage);
      launchPost();
      fallbackTimer=window.setTimeout(launchJsonp,FALLBACK_DELAY_MS);
      mainTimer=window.setTimeout(()=>finish({ok:false,message:'No fue posible obtener respuesta de SIRA. Confirme que la implementación web existente fue actualizada a la versión 3.6.7.'}),REQUEST_TIMEOUT_MS);
    });
  }

  async function searchRemote(){
    if(busy)return;const c=validateCriteria();if(!c.ok){setStatus(c.msg,true);hideResults();return;}
    const ci=byId('captchaInput'),shown=(byId('captchaCode')?.textContent||'').trim().toUpperCase(),typed=(ci?.value||'').trim().toUpperCase();
    if(!typed){setStatus('Ingrese el código de validación visual.',true);return;}if(!shown||typed!==shown){setStatus('El código de validación no coincide. Genere uno nuevo o intente nuevamente.',true);hideResults();makeCaptcha();if(ci)ci.value='';return;}
    busy=true;const btn=byId('searchBtn');if(btn)btn.disabled=true;setStatus('Consultando Registro Académico…');
    try{
      const response=await requestSira(c.type,c.value);if(!response?.ok)throw new Error(response?.message||'No se pudo consultar SIRA.');
      const matches=Array.isArray(response.matches)?response.matches:[],panel=byId('resultsPanel'),container=byId('resultsContainer'),note=byId('contactNote');
      if(!matches.length){setStatus('No se encontraron registros con los datos ingresados.',true);panel?.classList.add('visible');note?.classList.add('visible');if(container)container.innerHTML='<div class="record"><div class="record-head"><div class="record-label">Resultado:</div><div class="record-value" style="text-align:left;color:#10457f;">No se encontró ningún registro con los datos ingresados.</div></div></div>';}
      else{setStatus(`Se encontraron ${matches.length} registro(s).`);panel?.classList.add('visible');note?.classList.remove('visible');if(container)container.innerHTML=matches.map(renderRecord).join('');}
      makeCaptcha();if(ci)ci.value='';
    }catch(err){hideResults();setStatus(err?.message||'No se pudo consultar el Registro Académico en este momento. Intente nuevamente.',true);}
    finally{busy=false;if(btn)btn.disabled=false;}
  }

  document.addEventListener('click',event=>{const target=event.target;if(!(target instanceof Element))return;const btn=target.closest('#searchBtn');if(!btn)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();searchRemote();},true);
  document.addEventListener('keydown',event=>{if(event.key!=='Enter')return;const id=event.target&&event.target.id;if(!['dniInput','nameInput','codeInput','captchaInput'].includes(id))return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();searchRemote();},true);
})();
