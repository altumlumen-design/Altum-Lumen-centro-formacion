(function () {
  'use strict';

  const VERSION = '20260810-final-r3';
  const courses = Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : [];
  const scheduleApi = window.AltumSchedule || null;
  let observer = null;
  let enhancing = false;
  let filterState = 'active';
  let searchValue = '';

  function loadStyles() {
    if (document.querySelector('link[data-altum-portal-ux]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `aula-portal-ux.css?v=${VERSION}`;
    link.dataset.altumPortalUx = VERSION;
    document.head.appendChild(link);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function courseForCard(card) {
    const storedId = card.dataset.courseId || '';
    if (storedId) {
      const stored = courses.find((course) => course.id === storedId);
      if (stored) return stored;
    }

    const anchor = card.querySelector('.portal-course-link');
    const href = anchor?.getAttribute('href') || '';
    if (!href) return null;

    let url;
    try { url = new URL(href, document.baseURI); } catch (_error) { return null; }

    const filename = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
    const byLegacyFile = courses.find((course) => course.file === filename || url.pathname.endsWith(`/${course.file}`));
    if (byLegacyFile) return byLegacyFile;

    const routes = window.AltumCleanRoutes?.routes || {};
    const normalizedPath = url.pathname.replace(/\/+$/, '/') ;
    return courses.find((course) => {
      const cleanRoute = routes[course.file];
      if (!cleanRoute) return false;
      const cleanPath = new URL(cleanRoute, window.AltumCleanRoutes.root || document.baseURI).pathname.replace(/\/+$/, '/');
      return normalizedPath === cleanPath;
    }) || null;
  }

  function scheduleInfo(course) {
    return scheduleApi && course?.schedule ? scheduleApi.getInfo(course) : null;
  }

  function currentSortValue(course) {
    const info = scheduleInfo(course);
    if (info?.current) return info.current.start.getTime() - 1;
    if (info?.upcoming) return info.upcoming.start.getTime();
    return Number.MAX_SAFE_INTEGER;
  }

  function activeCourses(cards) {
    return cards
      .map((card) => ({ card, course: courseForCard(card) }))
      .filter((item) => item.course && item.course.status !== 'Cerrado');
  }

  function archiveCourses(cards) {
    return cards
      .map((card) => ({ card, course: courseForCard(card) }))
      .filter((item) => item.course && item.course.status === 'Cerrado');
  }

  function addLoginEnhancements() {
    const dni = document.getElementById('studentDni');
    const password = document.getElementById('studentPassword');
    if (!dni || !password || dni.dataset.portalUxReady === '1') return;
    dni.dataset.portalUxReady = '1';

    [dni, password].forEach((input) => {
      input.addEventListener('input', () => {
        const digits = input.value.replace(/\D/g, '').slice(0, 8);
        if (input.value !== digits) input.value = digits;
      });
    });

    const intro = document.querySelector('.portal-login-card > h2 + p');
    if (intro) intro.textContent = 'Ingresa tu usuario y contraseña para acceder a los cursos asociados a tu matrícula.';
    const help = document.getElementById('loginHelp');
    if (help) help.textContent = 'Tu usuario es tu DNI.';

    const field = password.closest('.portal-field');
    if (field) {
      field.classList.add('portal-password-field');

      const wrap = document.createElement('div');
      wrap.className = 'portal-password-input-wrap';
      password.parentNode.insertBefore(wrap, password);
      wrap.appendChild(password);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'portal-password-toggle';
      toggle.textContent = 'Mostrar';
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
      network.id = 'portalNetworkStatus';
      network.className = 'portal-network-status';
      network.setAttribute('role', 'status');
      network.hidden = navigator.onLine;
      network.textContent = 'Sin conexión. El acceso requiere conexión a internet.';
      card.insertAdjacentElement('afterbegin', network);
      const updateNetwork = () => { network.hidden = navigator.onLine; };
      window.addEventListener('online', updateNetwork);
      window.addEventListener('offline', updateNetwork);
    }
  }

  function createScheduleMini(card, course) {
    if (!course?.schedule || !scheduleApi) return;
    let mini = card.querySelector('.portal-ux-schedule');
    if (!mini) {
      mini = document.createElement('div');
      mini.className = 'portal-ux-schedule';
      const meta = card.querySelector('.portal-course-meta');
      if (meta) meta.insertAdjacentElement('beforebegin', mini);
      else card.querySelector('.portal-course-body')?.appendChild(mini);
    }
    const info = scheduleApi.getInfo(course);
    const target = info.current || info.upcoming;
    const state = info.current ? 'En vivo ahora' : target ? scheduleApi.relativeLabel(target, course, info.now) : 'Clases programadas finalizadas';
    mini.innerHTML = `
      <div class="portal-ux-schedule-head">
        <span>${escapeHtml(state)}</span>
        <b>${info.completedCount}/${info.total}</b>
      </div>
      <div class="portal-ux-progress" aria-label="${info.completedCount} de ${info.total} sesiones realizadas"><span style="width:${info.percent}%"></span></div>
      ${target ? `<small>${escapeHtml(target.label)} · ${escapeHtml(scheduleApi.formatDate(target.start, info.timeZone, { weekday: false }))}</small>` : '<small>Los recursos del curso continúan disponibles.</small>'}`;
    card.classList.toggle('portal-course-is-live', Boolean(info.current));
  }

  function enhanceCard(card) {
    const course = courseForCard(card);
    if (!course) return;
    card.dataset.courseId = course.id;
    card.dataset.courseState = course.status === 'Cerrado' ? 'archive' : 'active';
    card.dataset.search = normalize(`${course.title} ${course.shortTitle} ${course.area} ${course.type}`);

    const link = card.querySelector('.portal-course-link');
    if (link) {
      const arrow = '<span aria-hidden="true">→</span>';
      link.innerHTML = `${course.status === 'Cerrado' ? 'Abrir archivo académico' : 'Continuar curso'}${arrow}`;
    }

    createScheduleMini(card, course);
    if (course.status === 'Cerrado') card.classList.add('portal-course-archive');
  }

  function sortCards(grid, cards) {
    const sorted = [...cards].sort((a, b) => {
      const ca = courseForCard(a);
      const cb = courseForCard(b);
      if (!ca || !cb) return 0;
      const aClosed = ca.status === 'Cerrado';
      const bClosed = cb.status === 'Cerrado';
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      if (!aClosed) {
        const delta = currentSortValue(ca) - currentSortValue(cb);
        if (delta !== 0) return delta;
      }
      return String(ca.shortTitle || ca.title).localeCompare(String(cb.shortTitle || cb.title), 'es');
    });
    const current = [...grid.querySelectorAll(':scope > .portal-course-card')];
    const changed = sorted.some((card, index) => current[index] !== card);
    if (changed) sorted.forEach((card) => grid.appendChild(card));
  }

  function getToolbar() {
    return document.getElementById('portalUxToolbar');
  }

  function createToolbar(cards) {
    let toolbar = getToolbar();
    const active = activeCourses(cards).length;
    const archive = archiveCourses(cards).length;
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'portalUxToolbar';
      toolbar.className = 'portal-ux-toolbar';
      toolbar.innerHTML = `
        <div class="portal-ux-filter" role="group" aria-label="Filtrar cursos">
          <button type="button" data-filter="active">Vigentes <span></span></button>
          <button type="button" data-filter="archive">Anteriores <span></span></button>
          <button type="button" data-filter="all">Todos <span></span></button>
        </div>
        <label class="portal-ux-search">
          <span class="aula-sr-only">Buscar entre mis cursos</span>
          <input type="search" placeholder="Buscar curso" autocomplete="off">
        </label>`;
      const grid = document.getElementById('courseGrid');
      grid?.insertAdjacentElement('beforebegin', toolbar);
      toolbar.querySelectorAll('[data-filter]').forEach((button) => {
        button.addEventListener('click', () => {
          filterState = button.dataset.filter;
          try { sessionStorage.setItem('altum_portal_filter', filterState); } catch (_error) {}
          applyFilters();
        });
      });
      toolbar.querySelector('input').addEventListener('input', (event) => {
        searchValue = normalize(event.target.value);
        applyFilters();
      });
      try {
        const saved = sessionStorage.getItem('altum_portal_filter');
        if (['active', 'archive', 'all'].includes(saved)) filterState = saved;
      } catch (_error) {}
    }

    if (filterState === 'active' && !active) filterState = archive ? 'archive' : 'all';
    if (filterState === 'archive' && !archive) filterState = active ? 'active' : 'all';
    toolbar.querySelector('[data-filter="active"] span').textContent = active;
    toolbar.querySelector('[data-filter="archive"] span').textContent = archive;
    toolbar.querySelector('[data-filter="all"] span').textContent = cards.length;
    toolbar.hidden = cards.length <= 1;
  }

  function createFilterEmpty() {
    let empty = document.getElementById('portalUxFilterEmpty');
    if (empty) return empty;
    empty = document.createElement('p');
    empty.id = 'portalUxFilterEmpty';
    empty.className = 'portal-ux-filter-empty';
    empty.hidden = true;
    document.getElementById('courseGrid')?.insertAdjacentElement('afterend', empty);
    return empty;
  }

  function applyFilters() {
    const grid = document.getElementById('courseGrid');
    if (!grid) return;
    const cards = [...grid.querySelectorAll('.portal-course-card')];
    const toolbar = getToolbar();
    toolbar?.querySelectorAll('[data-filter]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.filter === filterState);
      button.setAttribute('aria-pressed', String(button.dataset.filter === filterState));
    });

    let visible = 0;
    cards.forEach((card) => {
      const course = courseForCard(card);
      const stateMatch = filterState === 'all'
        || (filterState === 'active' && course?.status !== 'Cerrado')
        || (filterState === 'archive' && course?.status === 'Cerrado');
      const searchMatch = !searchValue || card.dataset.search?.includes(searchValue);
      const show = stateMatch && searchMatch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    const filterEmpty = createFilterEmpty();
    filterEmpty.hidden = visible !== 0 || cards.length === 0;
    if (!filterEmpty.hidden) filterEmpty.textContent = searchValue
      ? 'No encontramos un curso que coincida con esa búsqueda.'
      : 'No tienes cursos en esta categoría.';
  }

  function bannerTarget(items) {
    const withSchedule = items.filter((item) => item.course?.schedule && scheduleApi);
    const live = withSchedule.find((item) => scheduleApi.getInfo(item.course).current);
    if (live) return live;
    const upcoming = withSchedule
      .map((item) => ({ ...item, info: scheduleApi.getInfo(item.course) }))
      .filter((item) => item.info.upcoming)
      .sort((a, b) => a.info.upcoming.start.getTime() - b.info.upcoming.start.getTime());
    return upcoming[0] || null;
  }

  function createOrUpdateBanner(cards) {
    const items = activeCourses(cards);
    const target = bannerTarget(items);
    let banner = document.getElementById('portalUxNextClass');
    if (!target) {
      if (banner) banner.hidden = true;
      return;
    }
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'portalUxNextClass';
      banner.className = 'portal-ux-next-class';
      const hero = document.querySelector('.portal-dashboard-hero');
      hero?.insertAdjacentElement('afterend', banner);
    }
    banner.hidden = false;
    const info = target.info || scheduleApi.getInfo(target.course);
    const session = info.current || info.upcoming;
    const live = Boolean(info.current);
    banner.classList.toggle('is-live', live);
    banner.innerHTML = `
      <div class="portal-ux-next-icon" aria-hidden="true">${live ? '●' : '↗'}</div>
      <div class="portal-ux-next-copy">
        <small>${live ? 'Sesión en curso' : 'Tu próxima clase'}</small>
        <strong>${escapeHtml(target.course.shortTitle || target.course.title)}</strong>
        <span>${escapeHtml(live ? 'En vivo ahora' : scheduleApi.relativeLabel(session, target.course, info.now))} · ${escapeHtml(session.label)}</span>
      </div>
      <div class="portal-ux-next-actions">
        <a href="${escapeHtml(target.course.file)}">${live ? 'Ir al curso' : 'Abrir curso'}</a>
      </div>`;
  }

  function refreshSchedule(cards) {
    cards.forEach((card) => {
      const course = courseForCard(card);
      if (course?.schedule) createScheduleMini(card, course);
    });
    createOrUpdateBanner(cards);
  }

  function enhanceDashboard() {
    if (enhancing) return;
    const dashboard = document.getElementById('dashboardView');
    const grid = document.getElementById('courseGrid');
    if (!dashboard || dashboard.hidden || !grid) return;
    const cards = [...grid.querySelectorAll('.portal-course-card')];
    if (!cards.length) return;
    enhancing = true;
    cards.forEach(enhanceCard);
    sortCards(grid, cards);
    createToolbar(cards);
    createOrUpdateBanner(cards);
    applyFilters();
    enhancing = false;
  }

  function observeDashboard() {
    const dashboard = document.getElementById('dashboardView');
    const grid = document.getElementById('courseGrid');
    if (!dashboard || !grid || observer) return;
    let timer = null;
    observer = new MutationObserver(() => {
      if (enhancing) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(enhanceDashboard, 40);
    });
    observer.observe(grid, { childList: true });
    observer.observe(dashboard, { attributes: true, attributeFilter: ['hidden'] });
  }

  function init() {
    if (!document.body.classList.contains('aula-portal')) return;
    loadStyles();
    document.body.classList.add('portal-ux-ready');
    addLoginEnhancements();
    observeDashboard();
    enhanceDashboard();
    window.setInterval(() => {
      const cards = [...document.querySelectorAll('#courseGrid .portal-course-card')];
      if (cards.length) refreshSchedule(cards);
    }, 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
