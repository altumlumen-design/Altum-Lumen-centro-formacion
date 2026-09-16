(function () {
  'use strict';

  const CATALOG_VERSION = '3.2';
  let filterState = 'active';
  let searchValue = '';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function showMessage(element, message) {
    element.textContent = message;
    element.hidden = false;
  }

  function clearFastBoot() {
    document.querySelectorAll('style[data-altum-fast-boot]').forEach((node) => node.remove());
  }

  function runInBackground(task) {
    const runner = () => Promise.resolve().then(task).catch(() => {});
    if ('requestIdleCallback' in window) window.requestIdleCallback(runner, { timeout: 1100 });
    else window.setTimeout(runner, 180);
  }

  function loadPortalUxStyles() {
    document.body.classList.add('portal-ux-ready');
    if (document.querySelector('link[data-altum-portal-ux]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'aula-portal-ux.css?v=20260915-aula32';
    link.dataset.altumPortalUx = '20260915-aula32';
    document.head.appendChild(link);
  }

  function addLoginEnhancements() {
    const dni = document.getElementById('studentDni');
    const password = document.getElementById('studentPassword');
    if (!dni || !password || dni.dataset.portalUxReady === '1') return;
    dni.dataset.portalUxReady = '1';

    [dni, password].forEach((input) => input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 8);
      if (input.value !== digits) input.value = digits;
    }));

    const intro = document.querySelector('.portal-login-card > h2 + p');
    if (intro) intro.textContent = 'Ingresa tu usuario y contraseña para acceder a los cursos asociados a tu matrícula.';
    const help = document.getElementById('loginHelp');
    if (help) help.textContent = 'Tu usuario es tu DNI.';

    const field = password.closest('.portal-field');
    if (field && !field.querySelector('.portal-password-input-wrap')) {
      field.classList.add('portal-password-field');
      const wrap = document.createElement('div');
      wrap.className = 'portal-password-input-wrap';
      password.parentNode.insertBefore(wrap, password);
      wrap.appendChild(password);
      const toggle = document.createElement('button');
      toggle.type = 'button'; toggle.className = 'portal-password-toggle'; toggle.textContent = 'Mostrar';
      toggle.setAttribute('aria-label', 'Mostrar contraseña');
      toggle.addEventListener('click', () => {
        const show = password.type === 'password';
        password.type = show ? 'text' : 'password';
        toggle.textContent = show ? 'Ocultar' : 'Mostrar';
        toggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
      wrap.appendChild(toggle);
    }

    const card = document.querySelector('.portal-login-card');
    if (card && !document.getElementById('portalNetworkStatus')) {
      const network = document.createElement('p');
      network.id = 'portalNetworkStatus'; network.className = 'portal-network-status'; network.setAttribute('role', 'status');
      network.hidden = navigator.onLine; network.textContent = 'Sin conexión. El acceso requiere conexión a internet.';
      card.insertAdjacentElement('afterbegin', network);
      const updateNetwork = () => { network.hidden = navigator.onLine; };
      window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork);
    }
  }

  function courseCatalog(session) {
    return window.AltumAuth.getCourseCatalog(session);
  }

  function courseState(course) {
    const explicit = String(course?.statusGroup || '').toLowerCase();
    if (explicit === 'archive' || explicit === 'active') return explicit;
    return normalize(course?.statusLabel || course?.status).includes('cerrad') || normalize(course?.statusLabel || course?.status).includes('finaliz') ? 'archive' : 'active';
  }

  function statusLabel(course) {
    return String(course?.statusLabel || course?.status || (courseState(course) === 'archive' ? 'Finalizado' : 'En curso'));
  }

  function clampPercent(value) {
    const n = Number(value || 0);
    return Math.max(0, Math.min(100, Number.isFinite(n) ? Math.round(n) : 0));
  }

  function asDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatNextDate(value) {
    const d = asDate(value); if (!d) return '';
    return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' }).format(d);
  }

  function relativeNext(value) {
    const d = asDate(value); if (!d) return '';
    const diff = d.getTime() - Date.now();
    const mins = Math.ceil(diff / 60000);
    if (mins <= 0 && mins > -180) return 'Hoy · sesión en curso o por iniciar';
    if (mins < 60 && mins > 0) return `Empieza en ${mins} min`;
    if (mins < 1440 && mins > 0) return `Empieza en ${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}`;
    const days = Math.ceil(mins / 1440);
    if (days === 1) return 'Mañana';
    if (days > 1 && days <= 7) return `En ${days} días`;
    return formatNextDate(value);
  }

  function getRequestedCourse(session) {
    const params = new URLSearchParams(window.location.search);
    const nextCourse = params.get('nextCourse');
    const catalog = courseCatalog(session);
    if (nextCourse && window.AltumAuth.hasCourse(session, nextCourse)) return catalog.find((item) => item.id === nextCourse) || null;
    const next = params.get('next');
    if (!next || !/^[a-z0-9-]+\.html$/i.test(next)) return null;
    const course = catalog.find((item) => item.file === next);
    if (!course || !window.AltumAuth.hasCourse(session, course.id)) return null;
    return course;
  }

  function renderProgress(course) {
    const total = Math.max(0, Number(course.totalSessions || 0));
    if (!total) return '';
    const completed = Math.min(total, Math.max(0, Number(course.completedSessions || 0)));
    const percent = clampPercent(course.progressPercent);
    const state = courseState(course);
    const detail = state === 'archive' && percent === 100
      ? 'Programa culminado · recursos disponibles'
      : `${completed} de ${total} sesiones realizadas`;
    const next = state === 'active' && course.nextSessionStart
      ? `<small>${escapeHtml(relativeNext(course.nextSessionStart))}${course.nextSessionTitle ? ` · ${escapeHtml(course.nextSessionTitle)}` : ''}</small>`
      : `<small>${escapeHtml(detail)}</small>`;
    return `<div class="portal-ux-schedule">
      <div class="portal-ux-schedule-head"><span>${escapeHtml(statusLabel(course))}</span><b>${percent}%</b></div>
      <div class="portal-ux-progress" aria-label="Avance ${percent}%"><span style="width:${percent}%"></span></div>
      ${next}
    </div>`;
  }

  function renderCourses(session) {
    const grid = document.getElementById('courseGrid');
    const empty = document.getElementById('courseEmpty');
    const assigned = courseCatalog(session);
    document.getElementById('courseCount').textContent = `${assigned.length} ${assigned.length === 1 ? 'curso asignado' : 'cursos asignados'}`;

    grid.innerHTML = assigned.map((course) => {
      const state = courseState(course), archived = state === 'archive';
      const description = course.description || 'Aula académica disponible para participantes matriculados.';
      const area = course.area || 'Formación especializada';
      const duration = course.duration || 'Consultar programa';
      return `<article class="portal-course-card ${archived ? 'portal-course-archive' : ''}" data-course-id="${escapeHtml(course.id)}" data-course-state="${state}" data-search="${escapeHtml(normalize(`${course.title} ${course.shortTitle} ${course.area} ${course.type}`))}">
        <div class="portal-course-image">
          <img src="${escapeHtml(course.flyer || 'logo-centro-formacion.jpg')}" alt="Portada de ${escapeHtml(course.shortTitle || course.title)}" loading="lazy">
          <span class="portal-status ${archived ? 'is-closed' : 'is-active'}">${escapeHtml(statusLabel(course))}</span>
        </div>
        <div class="portal-course-body">
          <span class="portal-course-type">${escapeHtml(course.type || 'Programa')}</span>
          <h3>${escapeHtml(course.shortTitle || course.title)}</h3>
          <p>${escapeHtml(description)}</p>
          ${renderProgress(course)}
          <dl class="portal-course-meta"><div><dt>Área</dt><dd>${escapeHtml(area)}</dd></div><div><dt>Duración</dt><dd>${escapeHtml(duration)}</dd></div></dl>
          <a class="portal-course-link" href="${escapeHtml(course.file)}">${archived ? 'Abrir archivo académico' : 'Continuar curso'}<span aria-hidden="true">→</span></a>
        </div>
      </article>`;
    }).join('');

    empty.hidden = assigned.length !== 0;
    renderToolbar(assigned);
    renderNextBanner(assigned);
    applyFilters();
  }

  function renderToolbar(courses) {
    const grid = document.getElementById('courseGrid'); if (!grid) return;
    let toolbar = document.getElementById('portalUxToolbar');
    const active = courses.filter(c => courseState(c) === 'active').length;
    const archive = courses.filter(c => courseState(c) === 'archive').length;
    if (!toolbar) {
      toolbar = document.createElement('div'); toolbar.id = 'portalUxToolbar'; toolbar.className = 'portal-ux-toolbar';
      toolbar.innerHTML = `<div class="portal-ux-filter" role="group" aria-label="Filtrar cursos">
        <button type="button" data-filter="active">Vigentes <span></span></button>
        <button type="button" data-filter="archive">Anteriores <span></span></button>
        <button type="button" data-filter="all">Todos <span></span></button>
      </div><label class="portal-ux-search"><span class="aula-sr-only">Buscar entre mis cursos</span><input type="search" placeholder="Buscar curso" autocomplete="off"></label>`;
      grid.insertAdjacentElement('beforebegin', toolbar);
      toolbar.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
        filterState = button.dataset.filter;
        try { sessionStorage.setItem('altum_portal_filter', filterState); } catch (_error) {}
        applyFilters();
      }));
      toolbar.querySelector('input').addEventListener('input', event => { searchValue = normalize(event.target.value); applyFilters(); });
      try { const saved = sessionStorage.getItem('altum_portal_filter'); if (['active', 'archive', 'all'].includes(saved)) filterState = saved; } catch (_error) {}
    }
    if (filterState === 'active' && !active) filterState = archive ? 'archive' : 'all';
    if (filterState === 'archive' && !archive) filterState = active ? 'active' : 'all';
    toolbar.querySelector('[data-filter="active"] span').textContent = active;
    toolbar.querySelector('[data-filter="archive"] span').textContent = archive;
    toolbar.querySelector('[data-filter="all"] span').textContent = courses.length;
    toolbar.hidden = courses.length <= 1;
  }

  function applyFilters() {
    const grid = document.getElementById('courseGrid'); if (!grid) return;
    const cards = [...grid.querySelectorAll('.portal-course-card')];
    const toolbar = document.getElementById('portalUxToolbar');
    toolbar?.querySelectorAll('[data-filter]').forEach(button => {
      const selected = button.dataset.filter === filterState;
      button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    let visible = 0;
    cards.forEach(card => {
      const stateMatch = filterState === 'all' || card.dataset.courseState === filterState;
      const searchMatch = !searchValue || String(card.dataset.search || '').includes(searchValue);
      const show = stateMatch && searchMatch; card.hidden = !show; if (show) visible += 1;
    });
    let filterEmpty = document.getElementById('portalUxFilterEmpty');
    if (!filterEmpty) {
      filterEmpty = document.createElement('p'); filterEmpty.id = 'portalUxFilterEmpty'; filterEmpty.className = 'portal-ux-filter-empty';
      grid.insertAdjacentElement('afterend', filterEmpty);
    }
    filterEmpty.hidden = visible !== 0 || cards.length === 0;
    if (!filterEmpty.hidden) filterEmpty.textContent = searchValue ? 'No encontramos un curso que coincida con esa búsqueda.' : 'No tienes cursos en esta categoría.';
  }

  function renderNextBanner(courses) {
    const active = courses.filter(c => courseState(c) === 'active' && asDate(c.nextSessionStart));
    active.sort((a, b) => asDate(a.nextSessionStart) - asDate(b.nextSessionStart));
    const course = active[0] || null;
    let banner = document.getElementById('portalUxNextClass');
    if (!course) { if (banner) banner.hidden = true; return; }
    if (!banner) {
      banner = document.createElement('section'); banner.id = 'portalUxNextClass'; banner.className = 'portal-ux-next-class';
      document.querySelector('.portal-dashboard-hero')?.insertAdjacentElement('afterend', banner);
    }
    const rel = relativeNext(course.nextSessionStart), isToday = /^Hoy|^Empieza en/.test(rel) && asDate(course.nextSessionStart).toLocaleDateString('en-CA', { timeZone: 'America/Lima' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    banner.hidden = false; banner.classList.toggle('is-live', isToday);
    banner.innerHTML = `<div class="portal-ux-next-icon" aria-hidden="true">${isToday ? '●' : '↗'}</div>
      <div class="portal-ux-next-copy"><small>${isToday ? 'Tu clase de hoy' : 'Tu próxima clase'}</small><strong>${escapeHtml(course.shortTitle || course.title)}</strong><span>${escapeHtml(rel)}${course.nextSessionTitle ? ` · ${escapeHtml(course.nextSessionTitle)}` : ''}</span></div>
      <div class="portal-ux-next-actions"><a href="${escapeHtml(course.file)}">Abrir curso</a></div>`;
  }

  function updateDashboardData(session) {
    document.getElementById('welcomeName').textContent = session.role === 'master' ? 'Usuario maestro' : session.displayName;
    renderCourses(session);
  }

  function showDashboard(session) {
    document.getElementById('loginView').hidden = true;
    document.getElementById('dashboardView').hidden = false;
    document.body.classList.add('portal-is-authenticated');
    clearFastBoot(); updateDashboardData(session);
    window.AltumAuth.mountUserMenu(document.getElementById('portalUserArea'), session);
    const params = new URLSearchParams(window.location.search), notice = document.getElementById('dashboardNotice');
    if (params.get('error') === 'sin-acceso') showMessage(notice, 'Ese curso no se encuentra asignado a tu matrícula.');
    else if (params.get('error') === 'sesion') showMessage(notice, 'Tu sesión anterior venció o el acceso cambió. Inicia sesión nuevamente.');
  }

  function showLogin(message) {
    document.getElementById('dashboardView').hidden = true; document.getElementById('loginView').hidden = false;
    document.body.classList.remove('portal-is-authenticated'); clearFastBoot();
    if (message) showMessage(document.getElementById('loginError'), message);
    window.setTimeout(() => document.getElementById('studentDni').focus(), 60);
  }

  function sessionNeedsCatalog32(session) {
    const summaries = Array.isArray(session?.courseSummaries) ? session.courseSummaries : [];
    return summaries.some(item => item?.dynamic && String(item.catalogVersion || '') !== CATALOG_VERSION);
  }

  async function initPortal() {
    loadPortalUxStyles(); addLoginEnhancements();
    const form = document.getElementById('loginForm'), error = document.getElementById('loginError'), submit = document.getElementById('loginSubmit');
    const stored = window.AltumAuth.getSession();
    if (stored) {
      showDashboard(stored);
      if (!window.AltumAuth.isSessionFresh(stored) || sessionNeedsCatalog32(stored)) {
        runInBackground(async () => {
          const refreshed = await window.AltumAuth.refreshSession(stored, { force: true });
          if (refreshed.ok) updateDashboardData(refreshed.session);
          else if (window.AltumAuth.isDefinitiveSessionFailure(refreshed)) { window.AltumAuth.clearSession(); showLogin(refreshed.message || 'Tu sesión venció. Inicia sesión nuevamente.'); }
        });
      }
    } else showLogin();

    form.addEventListener('submit', async (event) => {
      event.preventDefault(); error.hidden = true; submit.disabled = true; submit.setAttribute('aria-busy', 'true'); submit.textContent = 'Iniciando sesión...';
      const result = await window.AltumAuth.authenticate(document.getElementById('studentDni').value, document.getElementById('studentPassword').value);
      submit.disabled = false; submit.removeAttribute('aria-busy'); submit.textContent = 'Ingresar al aula';
      if (!result.ok) { showMessage(error, result.message || 'No fue posible iniciar sesión.'); document.getElementById('studentPassword').select(); return; }
      const requestedCourse = getRequestedCourse(result.session);
      if (requestedCourse) { window.location.replace(requestedCourse.file); return; }
      window.history.replaceState({}, '', 'aula-virtual.html'); showDashboard(result.session);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPortal, { once: true });
  else initPortal();
})();
