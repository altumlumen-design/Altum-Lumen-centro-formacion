(() => {
  document.documentElement.classList.add('js');
  const views = [...document.querySelectorAll('[data-view]')];
  const routeLinks = [...document.querySelectorAll('[data-route]')];
  const validRoutes = new Set(views.map(v => v.dataset.view));

  const routeAliases = {
    publicaciones: 'actualidad', convenios: 'institucion', autoridades: 'institucion', verificacion: 'institucion', contacto: 'institucion', areas: 'oferta'
  };
  const instAlias = { convenios:'alianzas', autoridades:'autoridades', verificacion:'verificacion', contacto:'contacto' };

  function normalizeRoute(hash = location.hash) {
    const raw = (hash || '#inicio').replace('#','').trim() || 'inicio';
    return validRoutes.has(raw) ? raw : (routeAliases[raw] || 'inicio');
  }

  function showRoute(route, { scroll = true } = {}) {
    route = validRoutes.has(route) ? route : 'inicio';
    views.forEach(v => {
      const active = v.dataset.view === route;
      v.hidden = !active;
      v.classList.toggle('is-active', active);
    });
    routeLinks.forEach(a => a.setAttribute('aria-current', a.dataset.route === route ? 'page' : 'false'));
    if (scroll) window.scrollTo({ top:0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth' });
    closeMenu();
    requestAnimationFrame(observeReveal);
  }

  function go(route, extraTab) {
    if (location.hash !== `#${route}`) history.pushState(null,'',`#${route}`);
    showRoute(route);
    if (extraTab) requestAnimationFrame(() => selectInstitutionTab(extraTab));
  }

  routeLinks.forEach(link => link.addEventListener('click', e => {
    const route = link.dataset.route;
    if (!route) return;
    e.preventDefault();
    go(route, link.dataset.institutionTab);
  }));

  window.addEventListener('popstate', () => {
    const raw = (location.hash || '#inicio').replace('#','');
    showRoute(normalizeRoute(), {scroll:false});
    if (instAlias[raw]) selectInstitutionTab(instAlias[raw]);
  });

  const menuBtn = document.querySelector('.menu-button');
  const menu = document.querySelector('.mobile-menu');
  const overlay = document.querySelector('.menu-overlay');
  const closeBtn = document.querySelector('.menu-close');
  function openMenu(){ document.body.classList.add('menu-open'); menu.classList.add('is-open'); menu.setAttribute('aria-hidden','false'); overlay.hidden=false; menuBtn?.setAttribute('aria-expanded','true'); }
  function closeMenu(){ document.body.classList.remove('menu-open'); menu.classList.remove('is-open'); menu.setAttribute('aria-hidden','true'); overlay.hidden=true; menuBtn?.setAttribute('aria-expanded','false'); }
  menuBtn?.addEventListener('click',openMenu); closeBtn?.addEventListener('click',closeMenu); overlay?.addEventListener('click',closeMenu);
  document.addEventListener('keydown',e => { if(e.key==='Escape') closeMenu(); });

  const programs = [
    {title:'Conferencias Magistrales',duration:'4 horas académicas',lead:'Actualización puntual para revisar una materia, cambio normativo o enfoque profesional específico.',items:['Certificación por 4 horas académicas','Acceso al material académico 24/7','Acceso a grabaciones cuando corresponda'],msg:'Deseo información sobre conferencias magistrales disponibles.'},
    {title:'Talleres de Alta Especialización',duration:'8 a 24 horas académicas',lead:'Experiencias concentradas para trabajar herramientas, procedimientos y casos de aplicación profesional.',items:['Certificación entre 8 y 24 horas','Metodología práctica y aplicada','Acceso al material y grabaciones 24/7'],msg:'Deseo información sobre talleres de alta especialización disponibles.'},
    {title:'Cursos Especializados',duration:'48 a 60 horas académicas',lead:'Desarrollo estructurado de una materia para fortalecer competencias concretas y actualizadas.',items:['Certificación entre 48 y 60 horas','Clases especializadas y recursos digitales','Acceso al material y grabaciones 24/7'],msg:'Deseo información sobre cursos especializados disponibles.'},
    {title:'Programas Ejecutivos',duration:'90 a 180 horas académicas',lead:'Formación orientada a profesionales que necesitan ampliar capacidades de dirección, gestión y toma de decisiones.',items:['Certificación entre 90 y 180 horas académicas','Profundización por módulos o sesiones','Acceso al material y grabaciones 24/7'],msg:'Deseo información sobre Programas Ejecutivos disponibles.'},
    {title:'Diplomados Especializados',duration:'240 horas · 15 créditos',lead:'Trayectoria académica de mayor profundidad para consolidar conocimientos especializados en un campo profesional.',items:['Diploma de Especialista por 240 horas y 15 créditos','Reconocimiento mediante Resolución Directoral','Acceso al material y grabaciones 24/7'],msg:'Deseo información sobre diplomados especializados disponibles.'},
    {title:'Programas de Alta Especialización (PAE)',duration:'384 horas · 24 créditos',lead:'Especialización profesional avanzada para fortalecer un perfil de alto nivel en un área de desempeño.',items:['Especialización Profesional por 384 horas y 24 créditos','Reconocimiento mediante Resolución Directoral','Acceso al material y grabaciones 24/7'],msg:'Deseo información sobre Programas de Alta Especialización (PAE) disponibles.'}
  ];
  const tabs = document.getElementById('program-tabs');
  const detail = document.getElementById('program-detail');
  const waLink = txt => `https://wa.me/51928928767?text=${encodeURIComponent('Hola ALTUM LUMEN, '+txt)}`;
  function renderProgram(index=2){
    if(!tabs || !detail) return;
    tabs.innerHTML = programs.map((p,i)=>`<button class="program-tab" type="button" role="tab" aria-selected="${i===index}" data-p="${i}"><span class="program-tab-num">${String(i+1).padStart(2,'0')}</span><span class="program-tab-copy"><b>${p.title}</b><span>${p.duration}</span></span><span class="program-tab-arrow">→</span></button>`).join('');
    const p=programs[index];
    detail.innerHTML=`<div class="program-detail-inner"><div class="detail-top"><span class="detail-label">Programa académico</span><span class="detail-duration">${p.duration}</span></div><h3>${p.title}</h3><p class="detail-lead">${p.lead}</p><div class="deliverables">${p.items.map(x=>`<div class="deliverable">${x}</div>`).join('')}</div><div class="detail-actions"><a class="button button-red" href="${waLink(p.msg)}" target="_blank" rel="noopener">Consultar próxima edición →</a><a class="button button-outline" href="aula-virtual.html" target="_blank" rel="noopener">Ingresar al Aula Virtual</a></div></div>`;
    tabs.querySelectorAll('[data-p]').forEach(btn=>btn.addEventListener('click',()=>renderProgram(Number(btn.dataset.p))));
  }
  renderProgram(2);
  document.querySelectorAll('[data-program]').forEach(btn=>btn.addEventListener('click',()=>{ const i=Number(btn.dataset.program); go('oferta'); setTimeout(()=>renderProgram(i),80); }));

  const faculty = [
    {name:'Jeanfranco M. Vargas Luque',area:'Gestión Pública · Derecho · Proyectos',photo:'assets-especialista-1.png',bio:'Abogado, Contador Público y egresado de la Maestría en Ingeniería Civil con mención en Gerencia de la Construcción, con experiencia en Contrataciones Públicas, Derecho Administrativo, Gestión de Inversiones y Obras, entre otros.',tags:['Gestión Pública','Contrataciones Públicas','Derecho Administrativo','Proyectos']},
    {name:'Miguel F. Lostaunau Fuentes',area:'Seguridad Ciudadana · Gestión Pública',photo:'assets-especialista-2.png',bio:'Teniente General PNP (R), Maestro en Administración y Ciencias Policiales con mención en Gestión Pública. Ha ejercido funciones de alta dirección vinculadas a seguridad ciudadana en el Ministerio del Interior.',tags:['Seguridad Ciudadana','Gestión Pública','Alta Dirección']},
    {name:'Martín R. Vargas Castañeda',area:'Gerencia Pública · Administración',photo:'assets-especialista-3.png',bio:'Profesional con amplia experiencia como directivo público en los tres niveles de gobierno, liderando áreas como Gerencia Municipal, Administración y Finanzas, Abastecimiento, Planeamiento y Presupuesto.',tags:['Gerencia Pública','Administración','Abastecimiento','Planeamiento']},
    {name:'Oscar F. Moreno Túpia',area:'Seguridad Ciudadana · Derecho',photo:'assets-especialista-4.png',bio:'Oficial PNP con más de 30 años de servicio, abogado, licenciado en Educación y egresado de la Maestría en Gestión Pública, con amplia experiencia como directivo en el sector público y seguridad ciudadana.',tags:['Seguridad Ciudadana','Derecho','Gestión Pública']},
    {name:'Carlo B. Catter Vergara',area:'Seguridad Ciudadana · Prevención',photo:'assets-especialista-5.png',bio:'Especialista en seguridad ciudadana, con experiencia en la creación de planes, programas y proyectos orientados a la prevención del delito y articulación interinstitucional entre actores públicos y privados.',tags:['Seguridad Ciudadana','Prevención','Articulación']},
    {name:'María C. Luque Medina',area:'Salud Pública · Gestión del Riesgo',photo:'assets-especialista-6.png',bio:'Licenciada en Obstetricia, con estudios de Maestría en Administración y Gestión Pública con mención en Defensa Nacional. Especialista en Gestión del Riesgo de Desastres, Desarrollo Social y Salud Pública.',tags:['Salud Pública','Gestión del Riesgo','Desarrollo Social']}
  ];
  const facultyGrid=document.getElementById('faculty-grid');
  function facultyCard(f,i){ return `<button class="faculty-card" type="button" data-faculty="${i}"><img src="${f.photo}" alt="${f.name}" loading="lazy"><span class="faculty-card-copy"><small>${f.area}</small><h3>${f.name}</h3><p>${f.bio}</p><span class="faculty-chips">${f.tags.slice(0,2).map(t=>`<span>${t}</span>`).join('')}</span></span></button>`; }
  if(facultyGrid) facultyGrid.innerHTML=faculty.map(facultyCard).join('');
  const modal=document.getElementById('faculty-modal');
  function openFaculty(i){ const f=faculty[i]; if(!f||!modal)return; document.getElementById('modal-photo').src=f.photo; document.getElementById('modal-photo').alt=f.name; document.getElementById('modal-area').textContent=f.area; document.getElementById('modal-name').textContent=f.name; document.getElementById('modal-bio').textContent=f.bio; document.getElementById('modal-tags').innerHTML=f.tags.map(t=>`<span>${t}</span>`).join(''); modal.showModal(); }
  document.addEventListener('click',e=>{ const btn=e.target.closest('[data-faculty]'); if(btn) openFaculty(Number(btn.dataset.faculty)); });
  modal?.querySelector('.modal-close')?.addEventListener('click',()=>modal.close());
  modal?.addEventListener('click',e=>{ if(e.target===modal) modal.close(); });

  const instTabs=[...document.querySelectorAll('[data-inst-tab]')];
  const instPanels=[...document.querySelectorAll('[data-inst-panel]')];
  function selectInstitutionTab(name){ if(!name)return; instTabs.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.instTab===name))); instPanels.forEach(p=>{p.hidden=p.dataset.instPanel!==name; p.classList.toggle('is-active',p.dataset.instPanel===name);}); }
  instTabs.forEach(b=>b.addEventListener('click',()=>selectInstitutionTab(b.dataset.instTab)));
  document.querySelectorAll('[data-institution-tab]').forEach(a=>a.addEventListener('click',()=>setTimeout(()=>selectInstitutionTab(a.dataset.institutionTab),80)));

  const supportToggle=document.querySelector('.support-toggle');
  const supportMenu=document.querySelector('.support-menu');
  supportToggle?.addEventListener('click',()=>{ const open=supportToggle.getAttribute('aria-expanded')==='true'; supportToggle.setAttribute('aria-expanded',String(!open)); supportMenu.hidden=open; });
  document.addEventListener('click',e=>{ if(!e.target.closest('.floating-support')&&supportMenu&&!supportMenu.hidden){supportMenu.hidden=true;supportToggle.setAttribute('aria-expanded','false');} });

  let observer;
  function observeReveal(){
    document.documentElement.classList.add('reveal-ready');
    observer?.disconnect();
    observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -20px'});
    document.querySelectorAll('.portal-view:not([hidden]) [data-reveal]').forEach(el=>observer.observe(el));
  }

  const raw=(location.hash||'#inicio').replace('#','');
  showRoute(normalizeRoute(),{scroll:false});
  if(instAlias[raw]) selectInstitutionTab(instAlias[raw]);
  document.getElementById('year').textContent=new Date().getFullYear();
  observeReveal();
})();
