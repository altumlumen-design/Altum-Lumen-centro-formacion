(() => {
  const body = document.body;
  const toggle = document.querySelector('.menu-toggle');
  const overlay = document.querySelector('.mobile-overlay');
  const drawer = document.querySelector('.mobile-drawer');
  function setMenu(open){
    body.classList.toggle('menu-open', open);
    if(toggle) toggle.setAttribute('aria-expanded', String(open));
    if(drawer) drawer.setAttribute('aria-hidden', String(!open));
  }
  toggle?.addEventListener('click',()=>setMenu(!body.classList.contains('menu-open')));
  overlay?.addEventListener('click',()=>setMenu(false));
  drawer?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){setMenu(false);document.querySelectorAll('dialog[open]').forEach(d=>d.close())}});

  // Soft reveal: opacity only. No vertical carousel-like movement.
  document.documentElement.classList.add('reveal-ready');
  const reveal=[...document.querySelectorAll('[data-reveal]')];
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -4%'});
    reveal.forEach(el=>io.observe(el));
  }else reveal.forEach(el=>el.classList.add('is-visible'));

  // Old hash compatibility from the original single-page portal.
  const legacy={
    '#oferta':'oferta-academica.html', '#docentes':'docentes.html', '#convenios':'convenios.html',
    '#publicaciones':'publicaciones.html', '#areas':'oferta-academica.html#areas-formativas',
    '#autoridades':'institucion.html?tab=autoridades', '#verificacion':'institucion.html?tab=verificacion',
    '#contacto':'institucion.html?tab=contacto'
  };
  if(body.dataset.page==='inicio' && legacy[location.hash]) location.replace(legacy[location.hash]);

  // Academic offer filters.
  const offerFilters=[...document.querySelectorAll('.filter-button[data-filter]')];
  const programs=[...document.querySelectorAll('.program-card[data-level]')];
  offerFilters.forEach(btn=>btn.addEventListener('click',()=>{
    offerFilters.forEach(b=>b.setAttribute('aria-pressed','false'));btn.setAttribute('aria-pressed','true');
    const value=btn.dataset.filter;
    programs.forEach(card=>card.hidden=!(value==='all'||card.dataset.level===value));
  }));

  // Area explorer.
  const areaButtons=[...document.querySelectorAll('.area-menu button[data-area]')];
  const areaPanel=document.querySelector('.area-panel');
  const areaContent={
    gestion:{title:'Gestión Pública',copy:'Formación orientada a la conducción de organizaciones públicas, sistemas administrativos, presupuesto, servicio civil y mejora de la gestión.',tags:['Gestión pública','Servicio civil','Presupuesto','Administración pública','Fiscalización']},
    derecho:{title:'Derecho',copy:'Programas para fortalecer el análisis jurídico aplicado a procedimientos, función pública, contratación y toma de decisiones institucionales.',tags:['Derecho administrativo','PAD','Contrataciones','Procedimiento administrativo','Responsabilidad funcional']},
    proyectos:{title:'Gestión de Proyectos',copy:'Contenidos aplicados a inversión pública, formulación, evaluación, ejecución, dirección y seguimiento de proyectos.',tags:['Invierte.pe','Formulación','Evaluación','Dirección de proyectos','Obras']},
    salud:{title:'Salud Pública',copy:'Capacitación especializada en gestión sanitaria, intervención pública, prevención y articulación territorial.',tags:['Salud pública','Gestión sanitaria','Prevención','Desarrollo social']},
    otras:{title:'Otras áreas',copy:'Líneas complementarias para responder a necesidades de actualización profesional y desarrollo de capacidades.',tags:['Economía','Seguridad ciudadana','Administración','Tecnología','Investigación']}
  };
  function showArea(key){
    const d=areaContent[key]; if(!d||!areaPanel) return;
    areaButtons.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.area===key)));
    areaPanel.innerHTML=`<span class="eyebrow">Área formativa</span><h3>${d.title}</h3><p>${d.copy}</p><div class="area-tags">${d.tags.map(t=>`<span>${t}</span>`).join('')}</div><a class="button button-outline" style="margin-top:24px" href="https://wa.me/51928928767?text=${encodeURIComponent('Hola ALTUM LUMEN, deseo información sobre programas del área de '+d.title+'.')}" target="_blank" rel="noopener">Consultar programas</a>`;
  }
  areaButtons.forEach(b=>b.addEventListener('click',()=>showArea(b.dataset.area)));
  if(areaButtons.length) showArea(areaButtons[0].dataset.area);

  // Faculty filters.
  const facultyFilters=[...document.querySelectorAll('.faculty-filter[data-specialty]')];
  const facultyCards=[...document.querySelectorAll('.faculty-card[data-specialty]')];
  facultyFilters.forEach(btn=>btn.addEventListener('click',()=>{
    facultyFilters.forEach(b=>b.setAttribute('aria-pressed','false'));btn.setAttribute('aria-pressed','true');
    const s=btn.dataset.specialty;
    facultyCards.forEach(card=>card.hidden=!(s==='all'||card.dataset.specialty.includes(s)));
  }));

  // Faculty modal.
  const modal=document.getElementById('facultyModal');
  if(modal){
    const img=modal.querySelector('[data-modal-photo]'), role=modal.querySelector('[data-modal-role]'), name=modal.querySelector('[data-modal-name]'), bio=modal.querySelector('[data-modal-bio]'), tags=modal.querySelector('[data-modal-tags]');
    document.querySelectorAll('[data-faculty-open]').forEach(btn=>btn.addEventListener('click',()=>{
      const card=btn.closest('.faculty-card');
      if(!card) return;
      img.src=card.dataset.photo; img.alt=card.dataset.name;
      role.textContent=card.dataset.label; name.textContent=card.dataset.name; bio.textContent=card.dataset.bio;
      tags.innerHTML=(card.dataset.tags||'').split('|').filter(Boolean).map(t=>`<span>${t}</span>`).join('');
      modal.showModal();
    }));
    modal.querySelector('[data-modal-close]')?.addEventListener('click',()=>modal.close());
    modal.addEventListener('click',e=>{if(e.target===modal) modal.close()});
  }

  // Institution workspace tabs.
  const workspaceButtons=[...document.querySelectorAll('.workspace-nav button[data-tab]')];
  const panels=[...document.querySelectorAll('.workspace-panel[data-panel]')];
  function activateTab(key, updateUrl=true){
    if(!workspaceButtons.length) return;
    if(!workspaceButtons.some(b=>b.dataset.tab===key)) key=workspaceButtons[0].dataset.tab;
    workspaceButtons.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===key)));
    panels.forEach(p=>p.classList.toggle('is-active',p.dataset.panel===key));
    if(updateUrl){const u=new URL(location.href);u.searchParams.set('tab',key);history.replaceState(null,'',u)}
  }
  workspaceButtons.forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
  if(workspaceButtons.length) activateTab(new URLSearchParams(location.search).get('tab')||'identidad',false);

  // Copy verification email.
  document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{
    const text=btn.dataset.copy;
    try{await navigator.clipboard.writeText(text);const old=btn.textContent;btn.textContent='Copiado';setTimeout(()=>btn.textContent=old,1400)}catch(_){location.href='mailto:'+text}
  }));

  // Footer year.
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
})();
