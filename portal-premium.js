(()=>{
  const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const overlay=$('.mobile-overlay'), panel=$('.mobile-panel'), menu=$('.menu-btn'), close=$('.mobile-close');
  const setMenu=open=>{panel?.classList.toggle('open',open);overlay?.classList.toggle('open',open);document.body.style.overflow=open?'hidden':'';menu?.setAttribute('aria-expanded',String(open));};
  menu?.addEventListener('click',()=>setMenu(true)); close?.addEventListener('click',()=>setMenu(false)); overlay?.addEventListener('click',()=>setMenu(false));
  $$('.mobile-nav a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));

  const transition=$('.page-transition');
  $$('a[data-transition]').forEach(a=>a.addEventListener('click',e=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank') return;
    const href=a.getAttribute('href'); if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('http')) return;
    e.preventDefault(); document.body.classList.add('is-leaving'); transition?.classList.add('show'); setTimeout(()=>location.href=href,360);
  }));

  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.12});
    $$('[data-reveal]').forEach(el=>io.observe(el));
  } else $$('[data-reveal]').forEach(el=>el.classList.add('visible'));

  const academicData=[
    {name:'Conferencias Magistrales',duration:'4 horas académicas',tag:'Actualización puntual',items:['Certificación por 4 horas académicas','Material académico disponible 24/7','Acceso a grabaciones','Formato intensivo para actualización profesional'],msg:'Deseo información sobre conferencias magistrales disponibles.'},
    {name:'Talleres de Alta Especialización',duration:'8 a 24 horas académicas',tag:'Aprendizaje aplicado',items:['Certificación entre 8 y 24 horas','Enfoque práctico y especializado','Material académico disponible 24/7','Acceso a grabaciones'],msg:'Deseo información sobre talleres de alta especialización disponibles.'},
    {name:'Cursos Especializados',duration:'48 a 60 horas académicas',tag:'Especialización',items:['Certificación entre 48 y 60 horas','Clases orientadas a aplicación profesional','Material académico disponible 24/7','Acceso a grabaciones'],msg:'Deseo información sobre cursos especializados disponibles.'},
    {name:'Programas Ejecutivos',duration:'90 a 180 horas académicas',tag:'Formación ejecutiva',items:['Certificación entre 90 y 180 horas','Ruta formativa estructurada','Material académico disponible 24/7','Acceso a grabaciones'],msg:'Deseo información sobre programas ejecutivos disponibles.'},
    {name:'Diplomados Especializados',duration:'240 horas · 15 créditos',tag:'Diplomado',items:['Diploma de Especialista por 240 horas y 15 créditos','Reconocimiento mediante Resolución Directoral','Material académico disponible 24/7','Acceso a grabaciones'],msg:'Deseo información sobre diplomados especializados disponibles.'},
    {name:'Programas de Alta Especialización (PAE)',duration:'384 horas · 24 créditos',tag:'Alta especialización',items:['Especialización Profesional por 384 horas y 24 créditos','Reconocimiento mediante Resolución Directoral','Material académico disponible 24/7','Acceso a grabaciones'],msg:'Deseo información sobre Programas de Alta Especialización disponibles.'}
  ];
  const tabs=$$('.academic-tab'), detail=$('.academic-detail');
  function renderAcademic(i){ if(!detail||!tabs.length)return; const d=academicData[i]; tabs.forEach((t,j)=>t.setAttribute('aria-selected',String(i===j))); detail.innerHTML=`<div class="academic-orb"></div><div class="academic-detail-inner"><small>${d.tag}</small><h2>${d.name}</h2><span class="duration">${d.duration}</span><div class="academic-list">${d.items.map(x=>`<div>${x}</div>`).join('')}</div><a class="btn red" target="_blank" rel="noopener" href="https://wa.me/51928928767?text=${encodeURIComponent('Hola ALTUM LUMEN, '+d.msg)}">Solicitar información</a></div>`; }
  tabs.forEach((t,i)=>{t.addEventListener('click',()=>renderAcademic(i));t.addEventListener('keydown',e=>{let n=null;if(['ArrowRight','ArrowDown'].includes(e.key))n=(i+1)%tabs.length;if(['ArrowLeft','ArrowUp'].includes(e.key))n=(i-1+tabs.length)%tabs.length;if(n!==null){e.preventDefault();tabs[n].focus();renderAcademic(n)}})}); if(tabs.length)renderAcademic(0);

  const faculty=[
    {name:'Jeanfranco M. Vargas Luque',area:'Gestión Pública',exp:'+6 años',bio:'Abogado, Contador Público y egresado de la Maestría en Ingeniería Civil con mención en Gerencia de la Construcción, con experiencia en Contrataciones Públicas, Derecho Administrativo, Gestión de Inversiones y Obras, entre otros.'},
    {name:'Miguel F. Lostaunau Fuentes',area:'Seguridad Ciudadana',exp:'+30 años',bio:'Teniente General PNP (R), Maestro en Administración y Ciencias Policiales con mención en Gestión Pública. Ha ejercido funciones de alta dirección vinculadas a seguridad ciudadana en el Ministerio del Interior.'},
    {name:'Martín R. Vargas Castañeda',area:'Gerencia Pública',exp:'+10 años',bio:'Profesional con amplia experiencia como directivo público en los tres niveles de gobierno, liderando gerencia municipal, administración y finanzas, abastecimiento, planeamiento y presupuesto.'},
    {name:'Oscar F. Moreno Túpia',area:'Seguridad Ciudadana',exp:'+45 años',bio:'Oficial PNP con más de 30 años de servicio, Abogado, Licenciado en Educación y egresado de la Maestría en Gestión Pública, con experiencia directiva en el sector público y seguridad ciudadana.'},
    {name:'Carlo B. Catter Vergara',area:'Seguridad Ciudadana',exp:'+8 años',bio:'Especialista en seguridad ciudadana, con experiencia en planes, programas y proyectos de prevención del delito y articulación interinstitucional de actores locales, públicos y privados.'},
    {name:'María C. Luque Medina',area:'Defensa Civil y Salud',exp:'+20 años',bio:'Licenciada en Obstetricia, con estudios de Maestría en Administración y Gestión Pública con mención en Defensa Nacional, especialista en Gestión del Riesgo de Desastres, Desarrollo Social y Salud Pública.'}
  ];
  const bubbles=$$('.faculty-bubble[data-index]'), profile=$('.faculty-profile');
  function renderFaculty(i){if(!profile||!bubbles.length)return;const f=faculty[i];bubbles.forEach((b,j)=>b.classList.toggle('active',i===j));profile.innerHTML=`<small>Especialista ALTUM LUMEN</small><h2>${f.name}</h2><p>${f.bio}</p><div class="faculty-chips"><span>${f.area}</span><span>Experiencia ${f.exp}</span><span>Formación profesional aplicada</span></div>`}
  bubbles.forEach((b,i)=>b.addEventListener('click',()=>renderFaculty(i)));if(bubbles.length)renderFaculty(0);

  const stage=$('.hero-stage');
  if(stage && matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches){
    stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;$('.hero-board',stage)?.style.setProperty('transform',`translate(${x*8}px,${y*8}px)`)});
    stage.addEventListener('pointerleave',()=>$('.hero-board',stage)?.style.removeProperty('transform'));
  }
})();
