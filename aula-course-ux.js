(function () {
  'use strict';

  const VERSION = '20260810-final-r2';
  const MOBILE = window.matchMedia('(max-width: 760px)');
  const courses = Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : [];
  const scheduleApi = window.AltumSchedule || null;
  let course = null;
  let sessionNodes = [];
  let overview = null;
  let dock = null;
  let liveCard = null;

  function loadStyles() {
    if (document.querySelector('link[data-altum-course-ux]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `aula-course-ux.css?v=${VERSION}`;
    link.dataset.altumCourseUx = VERSION;
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

  function getCourse() {
    const id = document.body.dataset.courseId;
    return courses.find((item) => item.id === id) || null;
  }

  function validHref(link) {
    if (!link || link.tagName !== 'A') return false;
    const raw = String(link.getAttribute('href') || '').trim();
    return Boolean(raw && raw !== '#' && !raw.toLowerCase().startsWith('javascript:'));
  }

  function enhanceExternalLinks() {
    document.querySelectorAll('body.aula-course a[target="_blank"]').forEach((link) => {
      const rel = new Set(String(link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.setAttribute('rel', [...rel].join(' '));
    });
  }

  function ensureToast() {
    let toast = document.getElementById('courseUxToast');
    if (toast) return toast;
    toast = document.createElement('div');
    toast.id = 'courseUxToast';
    toast.className = 'course-ux-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.hidden = true;
    document.body.appendChild(toast);
    return toast;
  }

  function notify(message) {
    const toast = ensureToast();
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => { toast.hidden = true; }, 2400);
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        textarea.remove();
        return ok;
      } catch (_fallbackError) {
        return false;
      }
    }
  }

  function setHeaderOffset() {
    const header = document.querySelector('.aula-site-header, body.aula-course > header');
    const height = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--course-ux-header-offset', `${height}px`);
  }

  function observeHeader() {
    setHeaderOffset();
    const header = document.querySelector('.aula-site-header, body.aula-course > header');
    if (header && 'ResizeObserver' in window) {
      const observer = new ResizeObserver(setHeaderOffset);
      observer.observe(header);
    }
    window.addEventListener('resize', setHeaderOffset, { passive: true });
  }

  function scrollToTarget(target) {
    if (!target) return;
    const nav = document.querySelector('.course-ux-nav');
    const offset = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--course-ux-header-offset')) || 0)
      + (nav ? nav.getBoundingClientRect().height : 0) + 12;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function heroElement() {
    return document.querySelector('.course-hero, .hero, .archive-program-hero');
  }

  function sessionsPanel() {
    const sessions = document.querySelector('.course-session, .session');
    return sessions ? sessions.closest('.course-panel, .panel, .module-sessions')?.closest('.course-panel, .panel') || sessions.closest('.panel') : null;
  }

  function infoPanel() {
    return document.querySelector('.course-grid aside, .grid aside, .archive-program-panel');
  }

  function createQuickNav() {
    if (document.querySelector('.course-ux-nav')) return;
    const hero = heroElement();
    const live = document.querySelector('.live-class-wrap, .live-class-card');
    const sessions = sessionsPanel();
    const info = infoPanel();
    const targets = [
      { label: 'Resumen', icon: '⌂', target: hero },
      { label: 'En vivo', icon: '●', target: live },
      { label: 'Sesiones', icon: '▤', target: sessions },
      { label: 'Información', icon: 'ⓘ', target: info }
    ].filter((item, index, array) => item.target && array.findIndex((other) => other.target === item.target) === index);
    if (targets.length < 2) return;

    const nav = document.createElement('nav');
    nav.className = 'course-ux-nav';
    nav.setAttribute('aria-label', 'Navegación rápida del curso');
    const inner = document.createElement('div');
    inner.className = 'course-ux-nav-inner';

    targets.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'course-ux-nav-button';
      button.innerHTML = `<span aria-hidden="true">${item.icon}</span><b>${item.label}</b>`;
      button.addEventListener('click', () => scrollToTarget(item.target));
      inner.appendChild(button);
    });

    nav.appendChild(inner);
    const header = document.querySelector('.aula-site-header, body.aula-course > header');
    if (header) header.insertAdjacentElement('afterend', nav);
    else document.body.insertAdjacentElement('afterbegin', nav);
  }

  function createOverview() {
    if (!course?.schedule || !scheduleApi || document.querySelector('.course-ux-overview')) return;
    const hero = heroElement();
    if (!hero) return;

    overview = document.createElement('section');
    overview.className = 'course-ux-overview';
    overview.setAttribute('aria-label', 'Resumen del cronograma');
    overview.innerHTML = `
      <div class="course-ux-overview-inner">
        <div class="course-ux-progress-block">
          <div class="course-ux-overview-label">Avance del cronograma</div>
          <div class="course-ux-progress-row">
            <strong id="courseUxProgressText">0 de 0 sesiones realizadas</strong>
            <span id="courseUxProgressPercent">0%</span>
          </div>
          <div class="course-ux-progress-track" aria-hidden="true"><span id="courseUxProgressBar"></span></div>
        </div>
        <div class="course-ux-next-block">
          <div class="course-ux-overview-label" id="courseUxNextKicker">Próxima clase</div>
          <strong id="courseUxNextText">Cronograma disponible</strong>
          <span id="courseUxNextDetail"></span>
        </div>
        <div class="course-ux-overview-actions">
          <a class="course-ux-primary-button" id="courseUxOverviewJoin" href="#" target="_blank" rel="noopener noreferrer">Ingresar a Zoom</a>
        </div>
      </div>`;
    hero.insertAdjacentElement('afterend', overview);
  }

  function sessionKey(index) {
    return `altum_course_ux_${document.body.dataset.courseId || 'curso'}_${index}`;
  }

  function setSessionOpen(node, open, toggle, index, persist) {
    node.classList.toggle('course-ux-collapsed', !open);
    node.classList.toggle('course-ux-expanded', open);
    toggle.setAttribute('aria-expanded', String(open));
    const icon = toggle.querySelector('.course-ux-toggle-icon');
    if (icon) icon.textContent = open ? '−' : '+';
    toggle.setAttribute('aria-label', open ? 'Contraer sesión' : 'Abrir sesión');
    if (persist) {
      try { sessionStorage.setItem(sessionKey(index), open ? '1' : '0'); } catch (_error) {}
    }
  }

  function resourceLinks(node) {
    return [...node.querySelectorAll('a[href]')].filter(validHref);
  }

  function defaultOpenIndex(nodes) {
    if (!nodes.length) return -1;
    if (course?.schedule && scheduleApi) {
      const info = scheduleApi.getInfo(course);
      if (info.current) return info.current.index;
      const completedWithResources = info.sessions
        .filter((session) => session.isCompleted && resourceLinks(nodes[session.index] || document.createElement('div')).length)
        .at(-1);
      if (completedWithResources) return completedWithResources.index;
      if (info.upcoming) return info.upcoming.index;
    }
    const firstUseful = nodes.findIndex((node) => resourceLinks(node).length > 0);
    return firstUseful >= 0 ? firstUseful : 0;
  }

  function labelResource(link) {
    const text = (link.textContent || '').trim().toLowerCase();
    if (text.includes('grabación') || text.includes('video')) {
      link.classList.add('course-ux-resource', 'course-ux-resource-video');
      link.dataset.resourceType = 'video';
    } else if (text.includes('material') || text.includes('lectura') || text.includes('archivo')) {
      link.classList.add('course-ux-resource', 'course-ux-resource-material');
      link.dataset.resourceType = 'material';
    } else if (text.includes('evaluación') || text.includes('examen') || text.includes('rendir')) {
      link.classList.add('course-ux-resource', 'course-ux-resource-evaluation');
      link.dataset.resourceType = 'evaluation';
    } else {
      link.classList.add('course-ux-resource');
    }
  }

  function enhanceSessions() {
    sessionNodes = [...document.querySelectorAll('.course-session, .session')];
    if (!sessionNodes.length) return;
    const defaultIndex = defaultOpenIndex(sessionNodes);

    sessionNodes.forEach((node, index) => {
      if (node.dataset.courseUxReady === '1') return;
      node.dataset.courseUxReady = '1';
      node.classList.add('course-ux-session');
      const heading = node.querySelector('h3');
      if (!heading) return;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'course-ux-toggle';
      toggle.innerHTML = '<span class="course-ux-toggle-icon" aria-hidden="true">+</span>';
      heading.appendChild(toggle);

      const links = resourceLinks(node);
      links.forEach(labelResource);
      if (links.length) {
        const count = document.createElement('span');
        count.className = 'course-ux-resource-count';
        count.textContent = `${links.length} ${links.length === 1 ? 'recurso' : 'recursos'}`;
        heading.insertAdjacentElement('afterend', count);
      }

      const state = document.createElement('span');
      state.className = 'course-ux-timeline-state';
      state.hidden = true;
      const countNode = node.querySelector('.course-ux-resource-count');
      if (countNode) countNode.insertAdjacentElement('afterend', state);
      else heading.insertAdjacentElement('afterend', state);

      let open = index === defaultIndex;
      try {
        const saved = sessionStorage.getItem(sessionKey(index));
        if (saved === '1') open = true;
        if (saved === '0') open = false;
      } catch (_error) {}
      setSessionOpen(node, open, toggle, index, false);

      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSessionOpen(node, node.classList.contains('course-ux-collapsed'), toggle, index, true);
      });
      heading.addEventListener('click', (event) => {
        if (event.target.closest('a,button')) return;
        toggle.click();
      });
    });
  }

  function enhanceModules() {
    const modules = [...document.querySelectorAll('details.module')];
    if (!modules.length) return;
    modules.forEach((module) => {
      module.addEventListener('toggle', () => {
        if (!MOBILE.matches || !module.open) return;
        modules.forEach((other) => { if (other !== module) other.open = false; });
      });
    });
  }

  function setInfoOpen(panel, open, button) {
    panel.classList.toggle('course-ux-info-collapsed', !open);
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('.course-ux-info-toggle-label').textContent = open ? 'Ocultar' : 'Ver';
    button.querySelector('.course-ux-info-toggle-icon').textContent = open ? '−' : '+';
  }

  function enhanceInfoPanel() {
    const panel = infoPanel();
    if (!panel || panel.dataset.courseUxInfo === '1') return;
    const heading = panel.querySelector('h2');
    if (!heading) return;
    panel.dataset.courseUxInfo = '1';
    panel.classList.add('course-ux-info-panel');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'course-ux-info-toggle';
    button.innerHTML = '<span class="course-ux-info-toggle-label">Ver</span><span class="course-ux-info-toggle-icon" aria-hidden="true">+</span>';
    heading.appendChild(button);
    setInfoOpen(panel, !MOBILE.matches, button);
    button.addEventListener('click', () => setInfoOpen(panel, panel.classList.contains('course-ux-info-collapsed'), button));
    MOBILE.addEventListener?.('change', (event) => setInfoOpen(panel, !event.matches, button));
  }

  function setLiveDetails(open, button) {
    if (!liveCard) return;
    liveCard.classList.toggle('course-ux-live-collapsed', !open);
    if (button) {
      button.setAttribute('aria-expanded', String(open));
      button.querySelector('.course-ux-live-toggle-label').textContent = open ? 'Ocultar fechas' : 'Ver fechas';
      button.querySelector('.course-ux-live-toggle-icon').textContent = open ? '−' : '+';
    }
  }

  function enhanceLiveCard() {
    liveCard = document.querySelector('.live-class-card');
    if (!liveCard || liveCard.dataset.courseUxReady === '1') return;
    liveCard.dataset.courseUxReady = '1';
    const heading = liveCard.querySelector('.live-class-head h2');
    if (heading) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'course-ux-live-toggle';
      button.innerHTML = '<span class="course-ux-live-toggle-label">Ver fechas</span><span class="course-ux-live-toggle-icon" aria-hidden="true">+</span>';
      heading.appendChild(button);
      setLiveDetails(!MOBILE.matches, button);
      button.addEventListener('click', () => setLiveDetails(liveCard.classList.contains('course-ux-live-collapsed'), button));
      MOBILE.addEventListener?.('change', (event) => setLiveDetails(!event.matches, button));
    }

    const join = liveCard.querySelector('.live-join');
    const existingLink = join?.querySelector('a[href]');
    const liveUrl = course?.schedule?.liveUrl || (validHref(existingLink) ? existingLink.href : '');
    if (join && liveUrl && !liveCard.querySelector('.course-ux-live-tools')) {
      const tools = document.createElement('div');
      tools.className = 'course-ux-live-tools';
      tools.innerHTML = `
        <button type="button" class="course-ux-tool-button" data-course-copy>Copiar enlace</button>`;
      join.insertAdjacentElement('afterend', tools);
      tools.querySelector('[data-course-copy]').addEventListener('click', async () => {
        const ok = await copyText(liveUrl);
        notify(ok ? 'Enlace de Zoom copiado.' : 'No se pudo copiar el enlace.');
      });
    }
  }

  function createDock() {
    if (!course?.schedule?.liveUrl || document.querySelector('.course-ux-dock')) return;
    dock = document.createElement('div');
    dock.className = 'course-ux-dock';
    dock.hidden = true;
    dock.innerHTML = `
      <div class="course-ux-dock-copy">
        <small id="courseUxDockKicker">Clase de hoy</small>
        <strong id="courseUxDockText">Acceso disponible</strong>
      </div>
      <a href="${escapeHtml(course.schedule.liveUrl)}" target="_blank" rel="noopener noreferrer">Ingresar</a>`;
    document.body.appendChild(dock);
  }

  function updateSessionStates(info) {
    if (!info?.sessions?.length) return;
    sessionNodes.forEach((node, index) => {
      const scheduled = info.sessions[index];
      const state = node.querySelector('.course-ux-timeline-state');
      if (!state || !scheduled) return;
      state.hidden = false;
      state.className = 'course-ux-timeline-state';
      node.classList.remove('is-course-live', 'is-course-completed', 'is-course-next');
      if (scheduled.isLive) {
        state.textContent = 'En vivo';
        state.classList.add('is-live');
        node.classList.add('is-course-live');
      } else if (scheduled.isCompleted) {
        state.textContent = 'Realizada';
        state.classList.add('is-completed');
        node.classList.add('is-course-completed');
      } else if (info.upcoming?.index === scheduled.index) {
        state.textContent = 'Próxima';
        state.classList.add('is-next');
        node.classList.add('is-course-next');
      } else {
        state.textContent = 'Programada';
        state.classList.add('is-upcoming');
      }
    });
  }

  function updateOverview(info) {
    if (!overview || !info) return;
    const progressText = overview.querySelector('#courseUxProgressText');
    const progressPercent = overview.querySelector('#courseUxProgressPercent');
    const progressBar = overview.querySelector('#courseUxProgressBar');
    const nextKicker = overview.querySelector('#courseUxNextKicker');
    const nextText = overview.querySelector('#courseUxNextText');
    const nextDetail = overview.querySelector('#courseUxNextDetail');
    const join = overview.querySelector('#courseUxOverviewJoin');

    progressText.textContent = `${info.completedCount} de ${info.total} ${info.total === 1 ? 'sesión realizada' : 'sesiones realizadas'}`;
    progressPercent.textContent = `${info.percent}%`;
    progressBar.style.width = `${info.percent}%`;

    const target = info.current || info.upcoming;
    if (info.current) {
      nextKicker.textContent = 'Sesión en curso';
      nextText.textContent = 'En vivo ahora';
      nextDetail.textContent = `${info.current.label} · hasta ${scheduleApi.formatTime(info.current.end, info.timeZone)}`;
    } else if (target) {
      nextKicker.textContent = 'Próxima clase';
      nextText.textContent = scheduleApi.relativeLabel(target, course, info.now);
      nextDetail.textContent = `${target.label} · ${scheduleApi.formatDate(target.start, info.timeZone)}`;
    } else {
      nextKicker.textContent = 'Cronograma';
      nextText.textContent = 'Clases programadas finalizadas';
      nextDetail.textContent = 'Los recursos habilitados permanecen disponibles en las sesiones.';
    }

    join.hidden = !info.liveUrl;
    if (info.liveUrl) join.href = info.liveUrl;
    join.textContent = info.joinable ? 'Entrar a clase ahora' : 'Ingresar a Zoom';
    overview.classList.toggle('is-live', Boolean(info.current));
  }

  function updateDock(info) {
    if (!dock || !info) return;
    const todayTarget = info.sessions.find((session) => session.isToday && !session.isCompleted) || info.current;
    const shouldShow = MOBILE.matches && Boolean(todayTarget || info.current || info.joinable);
    dock.hidden = !shouldShow;
    document.body.classList.toggle('has-course-ux-dock', shouldShow);
    if (!shouldShow) return;
    const target = info.current || info.joinable || todayTarget;
    dock.querySelector('#courseUxDockKicker').textContent = info.current ? 'En vivo ahora' : 'Clase de hoy';
    dock.querySelector('#courseUxDockText').textContent = info.current
      ? `${target.label} · en curso`
      : `${target.label} · ${scheduleApi.formatTime(target.start, info.timeZone)}`;
  }

  function updateDynamicState() {
    if (!course?.schedule || !scheduleApi) return;
    const info = scheduleApi.getInfo(course);
    updateOverview(info);
    updateSessionStates(info);
    updateDock(info);
    if (liveCard) {
      liveCard.classList.toggle('is-course-live', Boolean(info.current));
      liveCard.classList.toggle('is-course-finished', info.allCompleted);
      const kicker = liveCard.querySelector('.live-class-kicker');
      if (kicker && info.current) kicker.textContent = '● En vivo ahora';
      else if (kicker && info.allCompleted) kicker.textContent = '✓ Cronograma finalizado';
    }
  }

  function markStatusPills() {
    document.querySelectorAll('.aula-resource-status').forEach((status) => {
      const text = (status.textContent || '').trim().toLowerCase();
      status.classList.add('course-ux-resource-status');
      if (text.includes('disponible')) status.classList.add('is-available');
      else if (text.includes('pendiente') || text.includes('programada') || text.includes('próxim')) status.classList.add('is-pending');
      else if (text.includes('cerrad') || text.includes('finaliz')) status.classList.add('is-closed');
    });
  }

  function init() {
    if (!document.body.classList.contains('aula-course')) return;
    loadStyles();
    course = getCourse();
    document.body.classList.add('course-ux-ready');
    if (course) document.body.dataset.courseStatus = String(course.status || '').toLowerCase();

    observeHeader();
    enhanceExternalLinks();
    createQuickNav();
    createOverview();
    enhanceLiveCard();
    enhanceSessions();
    enhanceModules();
    enhanceInfoPanel();
    markStatusPills();
    createDock();
    updateDynamicState();

    window.setInterval(updateDynamicState, 60 * 1000);
    MOBILE.addEventListener?.('change', updateDynamicState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
