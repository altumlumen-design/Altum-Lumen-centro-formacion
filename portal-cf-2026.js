
(()=>{
const body=document.body,toggle=document.querySelector('.menu-toggle'),overlay=document.querySelector('.mobile-overlay'),drawer=document.querySelector('.mobile-drawer');
function setMenu(open){body.classList.toggle('menu-open',open);toggle?.setAttribute('aria-expanded',String(open));drawer?.setAttribute('aria-hidden',String(!open))}toggle?.addEventListener('click',()=>setMenu(!body.classList.contains('menu-open')));overlay?.addEventListener('click',()=>setMenu(false));drawer?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setMenu(false);document.querySelectorAll('dialog[open]').forEach(d=>d.close())}});
// Progressive reveal. Content is visible by default, so animation failure can never leave a blank page.
const reveal=[...document.querySelectorAll('[data-reveal]')];
const reduceMotion=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const compactMotion=!!(window.matchMedia&&window.matchMedia('(max-width: 900px)').matches);
if(!reduceMotion&&!compactMotion&&'IntersectionObserver' in window){
  document.documentElement.classList.add('reveal-ready');
  const io=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}}},{threshold:.05,rootMargin:'0px 0px -2%'});
  reveal.forEach(el=>io.observe(el));
  window.setTimeout(()=>reveal.forEach(el=>el.classList.add('is-visible')),1400);
}else{reveal.forEach(el=>el.classList.add('is-visible'))}
// Fixed academic services dock: aligned to the content grid and consistent across every portal page.
const dock=document.createElement('nav');dock.className='academic-dock';dock.setAttribute('aria-label','Accesos académicos rápidos');dock.innerHTML=`<a class="dock-item aula" href="aula-virtual.html" aria-label="Aula Virtual" title="Aula Virtual"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h6"/></svg><span>Aula</span></a><a class="dock-item verify" href="verificacion.html" aria-label="Verificación académica" title="Verificación académica"><svg viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8.1-8 9-4.6-.9-8-4-8-9V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg><span>Verificar</span></a><a class="dock-item tariff" href="tarifario.html" aria-label="Tarifario 2026" title="Tarifario 2026"><svg viewBox="0 0 24 24"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg><span>Tarifario</span></a><a class="dock-item whatsapp" href="https://wa.me/51928928767?text=Hola%20ALTUM%20LUMEN%2C%20deseo%20informaci%C3%B3n%20acad%C3%A9mica." target="_blank" rel="noopener" aria-label="WhatsApp académico" title="WhatsApp académico"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9 9 0 0 1-3.7-.8L3 21l1.7-5A8.7 8.7 0 1 1 21 11.5Z"/><path d="M8.2 8.2c.3 3.6 3 6.3 6.6 6.6"/></svg><span>WhatsApp</span></a>`;body.appendChild(dock);
// Legacy anchors.
const legacy={'#oferta':'oferta-academica.html','#docentes':'docentes.html','#convenios':'convenios.html','#publicaciones':'publicaciones.html','#areas':'oferta-academica.html#areas-formativas','#autoridades':'institucion.html?tab=autoridades','#verificacion':'institucion.html?tab=verificacion','#contacto':'institucion.html?tab=contacto'};if(body.dataset.page==='inicio'&&legacy[location.hash])location.replace(legacy[location.hash]);
// Offer level explorer.
let pdata=[];const pnode=document.getElementById('programData');if(pnode){try{pdata=JSON.parse(pnode.textContent)}catch(_){}}const pbuttons=[...document.querySelectorAll('[data-program]')],detail=document.getElementById('programDetail');function showProgram(i){const d=pdata[i];if(!d||!detail)return;pbuttons.forEach((b,n)=>b.setAttribute('aria-selected',String(n===i)));detail.querySelector('[data-detail-level]').textContent=d.level;detail.querySelector('[data-detail-title]').textContent=d.title;detail.querySelector('[data-detail-hours]').textContent=d.hours;detail.querySelector('[data-detail-copy]').textContent=d.copy;const wa=detail.querySelector('[data-detail-wa]');wa.href='https://wa.me/51928928767?text='+encodeURIComponent('Hola ALTUM LUMEN, deseo información sobre '+d.title+'.')}pbuttons.forEach((b,i)=>b.addEventListener('click',()=>showProgram(i)));if(pbuttons.length)showProgram(0);
// Area explorer.
const areaButtons=[...document.querySelectorAll('.area-menu button[data-area]')],areaPanel=document.querySelector('.area-panel'),areas={gestion:{title:'Gestión Pública',copy:'Formación orientada a la conducción de organizaciones públicas, sistemas administrativos, presupuesto, servicio civil y mejora de la gestión.',tags:['Gestión pública','Servicio civil','Presupuesto','Administración pública','Fiscalización']},derecho:{title:'Derecho',copy:'Programas para fortalecer el análisis jurídico aplicado a procedimientos, función pública, contratación y toma de decisiones institucionales.',tags:['Derecho administrativo','PAD','Contrataciones','Procedimiento administrativo','Responsabilidad funcional']},proyectos:{title:'Gestión de Proyectos',copy:'Contenidos aplicados a inversión pública, formulación, evaluación, ejecución, dirección y seguimiento de proyectos.',tags:['Invierte.pe','Formulación','Evaluación','Dirección de proyectos','Obras']},salud:{title:'Salud Pública',copy:'Capacitación especializada en gestión sanitaria, intervención pública, prevención y articulación territorial.',tags:['Salud pública','Gestión sanitaria','Prevención','Desarrollo social']},otras:{title:'Otras áreas',copy:'Líneas complementarias para responder a necesidades de actualización profesional y desarrollo de capacidades.',tags:['Economía','Seguridad ciudadana','Administración','Tecnología','Investigación']}};function showArea(k){const d=areas[k];if(!d||!areaPanel)return;areaButtons.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.area===k)));areaPanel.innerHTML=`<span class="eyebrow">Área formativa</span><h3>${d.title}</h3><p>${d.copy}</p><div class="area-tags">${d.tags.map(t=>`<span>${t}</span>`).join('')}</div><a class="button button-outline" style="margin-top:24px" href="https://wa.me/51928928767?text=${encodeURIComponent('Hola ALTUM LUMEN, deseo información sobre programas del área de '+d.title+'.')}" target="_blank" rel="noopener">Consultar programas</a>`}areaButtons.forEach(b=>b.addEventListener('click',()=>showArea(b.dataset.area)));if(areaButtons.length)showArea(areaButtons[0].dataset.area);
// One-time academic counters. They animate once per page load when first visible, then remain fixed.
const counterEls=[...document.querySelectorAll('[data-count-to]')];
function counterText(el,n){const grouped=el.dataset.countGroup==='true';const rounded=Math.round(n);const value=grouped?rounded.toLocaleString('en-US'):String(rounded);return `${el.dataset.countPrefix||''}${value}${el.dataset.countSuffix||''}`}
function setCounter(el,n){el.textContent=counterText(el,n)}
function finishCounter(el,target){setCounter(el,target);el.dataset.countAnimated='true';el.classList.remove('is-counting');el.classList.add('count-finished');window.setTimeout(()=>el.classList.remove('count-finished'),520)}
function animateCounter(el){
  if(!el||el.dataset.countAnimated==='true'||el.dataset.countRunning==='true')return;
  const target=Number(el.dataset.countTo||0);
  const from=Number(el.dataset.countFrom||0);
  if(!Number.isFinite(target)){return}
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){finishCounter(el,target);return}
  el.dataset.countRunning='true';
  el.classList.add('is-counting');
  setCounter(el,from);
  const duration=Math.max(900,Number(el.dataset.countDuration||1500));
  let started;
  const tick=(now)=>{
    if(started===undefined)started=now;
    const progress=Math.min(1,(now-started)/duration);
    const eased=1-Math.pow(1-progress,4);
    setCounter(el,from+(target-from)*eased);
    if(progress<1){requestAnimationFrame(tick)}else{delete el.dataset.countRunning;finishCounter(el,target)}
  };
  requestAnimationFrame(tick);
}
function queueCounter(el){
  if(!el||el.dataset.countAnimated==='true'||el.dataset.countQueued==='true'||el.dataset.countRunning==='true')return;
  el.dataset.countQueued='true';
  const delay=Math.max(80,Number(el.dataset.countDelay||180));
  window.setTimeout(()=>{delete el.dataset.countQueued;animateCounter(el)},delay);
}
function isCounterVisible(el){const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<(window.innerHeight||document.documentElement.clientHeight)&&r.left<(window.innerWidth||document.documentElement.clientWidth)}
let counterObserver=null;
if('IntersectionObserver' in window){
  counterObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting&&entry.intersectionRatio>0){queueCounter(entry.target);counterObserver.unobserve(entry.target)}}},{threshold:[0,.05,.15],rootMargin:'0px 0px -2% 0px'});
  counterEls.forEach(el=>counterObserver.observe(el));
}else{counterEls.forEach(queueCounter)}
// Fallback for browsers/embeds where IntersectionObserver fires late. Only counters actually on screen are triggered.
const counterFallback=()=>counterEls.forEach(el=>{if(el.dataset.countAnimated!=='true'&&isCounterVisible(el)){queueCounter(el);counterObserver?.unobserve(el)}});
window.addEventListener('load',()=>setTimeout(counterFallback,180),{once:true});
window.addEventListener('pageshow',()=>setTimeout(counterFallback,220),{once:true});
window.addEventListener('scroll',counterFallback,{passive:true});
window.addEventListener('resize',counterFallback,{passive:true});
setTimeout(counterFallback,650);
const ffilters=[...document.querySelectorAll('.faculty-filter[data-specialty]')],slides=[...document.querySelectorAll('.profile-slide')],track=document.querySelector('.profile-track'),prevBtn=document.querySelector('[data-carousel-prev]'),nextBtn=document.querySelector('[data-carousel-next]');
function visibleSlides(){return slides.filter(s=>!s.hidden)}
function carouselMax(){return track?Math.max(0,track.scrollWidth-track.clientWidth):0}
function updateCarousel(){
  if(!track)return;
  const max=carouselMax(),x=track.scrollLeft;
  if(prevBtn)prevBtn.hidden=x<=4;
  if(nextBtn)nextBtn.hidden=max<=4||x>=max-4;
}
function currentFacultyIndex(v){
  if(!track||!v.length)return 0;
  let best=0,dist=Infinity;
  v.forEach((slide,i)=>{const d=Math.abs(slide.offsetLeft-track.scrollLeft);if(d<dist){dist=d;best=i}});
  return best;
}
function scrollFaculty(dir){
  const v=visibleSlides();if(!track||!v.length)return;
  const idx=currentFacultyIndex(v),max=carouselMax();
  const targetIndex=Math.max(0,Math.min(v.length-1,idx+dir));
  const left=Math.max(0,Math.min(max,v[targetIndex].offsetLeft));
  if(dir>0&&track.scrollLeft>=max-4)return;
  if(dir<0&&track.scrollLeft<=4)return;
  track.scrollTo({left,behavior:reduceMotion?'auto':'smooth'});
  window.setTimeout(updateCarousel,reduceMotion?30:360);
}
if(prevBtn)prevBtn.addEventListener('click',()=>scrollFaculty(-1));
if(nextBtn)nextBtn.addEventListener('click',()=>scrollFaculty(1));
let carouselRAF=0;
if(track){
  track.addEventListener('scroll',()=>{cancelAnimationFrame(carouselRAF);carouselRAF=requestAnimationFrame(updateCarousel)},{passive:true});
  track.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();scrollFaculty(-1)}else if(e.key==='ArrowRight'){e.preventDefault();scrollFaculty(1)}});
}
ffilters.forEach(b=>b.addEventListener('click',()=>{
  ffilters.forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');
  const specialty=b.dataset.specialty;
  slides.forEach(sl=>{if(sl.querySelector('[data-network-open]'))sl.hidden=false;else sl.hidden=!(specialty==='all'||(sl.dataset.specialty||'').includes(specialty))});
  if(track)track.scrollTo({left:0,behavior:'auto'});
  requestAnimationFrame(()=>requestAnimationFrame(updateCarousel));
}));
if('ResizeObserver' in window&&track){new ResizeObserver(updateCarousel).observe(track)}else window.addEventListener('resize',updateCarousel,{passive:true});
window.addEventListener('pageshow',()=>requestAnimationFrame(updateCarousel),{once:true});
requestAnimationFrame(()=>requestAnimationFrame(updateCarousel));
// Profile modal.
const pm=document.getElementById('profileModal');document.querySelectorAll('[data-profile-open]').forEach(btn=>btn.addEventListener('click',()=>{if(!pm)return;pm.querySelector('[data-modal-photo]').src=btn.dataset.photo;pm.querySelector('[data-modal-photo]').alt=btn.dataset.name;pm.querySelector('[data-modal-role]').textContent=btn.dataset.role;pm.querySelector('[data-modal-name]').textContent=btn.dataset.name;pm.querySelector('[data-modal-bio]').textContent=btn.dataset.bio;pm.querySelector('[data-modal-extra]').textContent=btn.dataset.extra||'';pm.querySelector('[data-modal-tags]').innerHTML=(btn.dataset.tags||'').split('|').filter(Boolean).map(t=>`<span>${t}</span>`).join('');pm.showModal()}));pm?.querySelector('[data-modal-close]')?.addEventListener('click',()=>pm.close());pm?.addEventListener('click',e=>{if(e.target===pm)pm.close()});
const nm=document.getElementById('networkModal');document.querySelector('[data-network-open]')?.addEventListener('click',()=>{if(nm)nm.showModal()});nm?.querySelector('[data-network-close]')?.addEventListener('click',()=>nm.close());nm?.addEventListener('click',e=>{if(e.target===nm)nm.close()});
// Institution workspace.
const tabs=[...document.querySelectorAll('.workspace-nav button[data-tab]')],panels=[...document.querySelectorAll('.workspace-panel[data-panel]')];function activate(k,write=true){if(!tabs.length)return;if(!tabs.some(b=>b.dataset.tab===k))k=tabs[0].dataset.tab;tabs.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===k)));panels.forEach(p=>p.classList.toggle('is-active',p.dataset.panel===k));if(write){const u=new URL(location.href);u.searchParams.set('tab',k);history.replaceState(null,'',u)}}tabs.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.tab)));if(tabs.length)activate(new URLSearchParams(location.search).get('tab')||'identidad',false);
// Authority modal.
const am=document.getElementById('authorityModal');document.querySelectorAll('[data-authority-open]').forEach(btn=>btn.addEventListener('click',()=>{if(!am)return;const im=am.querySelector('[data-authority-photo]');im.src=btn.dataset.photo;im.alt=btn.dataset.name;am.querySelector('[data-authority-name]').textContent=btn.dataset.name;am.querySelector('[data-authority-role]').textContent=btn.dataset.role;am.querySelector('[data-authority-bio]').textContent=btn.dataset.bio;am.querySelector('[data-authority-resolution]').textContent=btn.dataset.resolution;const mail=am.querySelector('[data-authority-email]');mail.textContent=btn.dataset.email;mail.href='mailto:'+btn.dataset.email;am.showModal()}));am?.querySelector('[data-authority-close]')?.addEventListener('click',()=>am.close());am?.addEventListener('click',e=>{if(e.target===am)am.close()});
// Year.
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
})();
