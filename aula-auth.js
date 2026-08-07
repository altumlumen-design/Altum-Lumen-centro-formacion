(function () {
  'use strict';

  const config = window.ALTUM_AULA_CONFIG || {};
  const courses = Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : [];
  const validCourseIds = new Set(courses.map((course) => course.id));
  const sessionKey = config.sessionKey || 'altum_aula_session_v2';

  function readSession() {
    try {
      const value = window.sessionStorage.getItem(sessionKey);
      if (!value) return null;
      const session = JSON.parse(value);
      if (!session || !session.studentCode || !Array.isArray(session.courses)) return null;
      return session;
    } catch (_error) {
      return null;
    }
  }

  function saveSession(session) {
    window.sessionStorage.setItem(sessionKey, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    try {
      window.sessionStorage.removeItem(sessionKey);
    } catch (_error) {
      // The redirect still completes when browser storage is unavailable.
    }
  }

  function normalizeCourses(value) {
    if (value === '*') return courses.map((course) => course.id);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((courseId) => validCourseIds.has(courseId)))];
  }

  function initials(name, fallback) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return String(fallback || 'AL').slice(0, 2).toUpperCase();
    return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  function buildSession(payload) {
    const displayName = String(payload.name || payload.studentCode || 'Alumno').trim();
    return {
      studentCode: String(payload.studentCode || '').trim(),
      displayName,
      initials: initials(displayName, payload.studentCode),
      role: payload.role === 'master' ? 'master' : 'student',
      courses: normalizeCourses(payload.courses),
      createdAt: new Date().toISOString()
    };
  }

  async function authenticate(studentCode, password) {
    const user = String(studentCode || '').trim();
    const secret = String(password || '').trim();
    const master = config.masterAccount || {};

    if (user === String(master.user || '') && secret === String(master.password || '')) {
      return {
        ok: true,
        session: saveSession(buildSession({
          studentCode: user,
          name: 'Usuario maestro',
          role: 'master',
          courses: '*'
        }))
      };
    }

    if (!config.authEndpoint) {
      return { ok: false, message: 'El código de alumno o la contraseña no son correctos.' };
    }

    try {
      const response = await window.fetch(config.authEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCode: user, password: secret })
      });
      if (!response.ok) throw new Error('Auth request failed');
      const result = await response.json();
      if (!result || result.ok !== true || !result.user) {
        return { ok: false, message: 'El código de alumno o la contraseña no son correctos.' };
      }

      const session = buildSession({
        studentCode: result.user.studentCode || user,
        name: result.user.name,
        role: 'student',
        courses: result.user.courses
      });
      if (!session.courses.length) {
        return { ok: false, message: 'Tu usuario no tiene cursos habilitados actualmente.' };
      }
      return { ok: true, session: saveSession(session) };
    } catch (_error) {
      return { ok: false, message: 'No fue posible validar el acceso. Inténtalo nuevamente.' };
    }
  }

  function hasCourse(session, courseId) {
    return Boolean(session && Array.isArray(session.courses) && session.courses.includes(courseId));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function mountUserMenu(container, session) {
    if (!container || !session) return;
    const name = escapeHtml(session.displayName);
    const code = escapeHtml(session.studentCode);
    const badge = escapeHtml(session.initials);

    container.innerHTML = `
      <div class="aula-user-menu">
        <button class="aula-user-trigger" type="button" aria-haspopup="true" aria-expanded="false">
          <span class="aula-avatar" aria-hidden="true">${badge}</span>
          <span class="aula-user-copy"><strong>${name}</strong><small>${code}</small></span>
          <span class="aula-chevron" aria-hidden="true"></span>
        </button>
        <div class="aula-user-popover" role="menu" hidden>
          <div class="aula-user-summary"><strong>${name}</strong><span>Código ${code}</span></div>
          <button class="aula-logout" type="button" role="menuitem">Cerrar sesión</button>
        </div>
      </div>`;

    const trigger = container.querySelector('.aula-user-trigger');
    const popover = container.querySelector('.aula-user-popover');
    const logoutButton = container.querySelector('.aula-logout');

    function closeMenu() {
      trigger.setAttribute('aria-expanded', 'false');
      popover.hidden = true;
    }

    trigger.addEventListener('click', () => {
      const willOpen = popover.hidden;
      popover.hidden = !willOpen;
      trigger.setAttribute('aria-expanded', String(willOpen));
    });
    logoutButton.addEventListener('click', () => {
      clearSession();
      window.location.replace('aula-virtual.html');
    });
    document.addEventListener('click', (event) => {
      if (!container.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        trigger.focus();
      }
    });
  }

  function enhanceCourseHeader(session) {
    const header = document.querySelector('body.aula-course header');
    if (!header) return;
    header.className = 'aula-site-header';
    header.innerHTML = `
      <div class="container aula-header-inner">
        <a class="aula-brand" href="aula-virtual.html" aria-label="Ir a Mis cursos">
          <img src="logo-centro-formacion.jpg" alt="Altum Lumen">
          <span><small>Centro de Formación</small><strong>Aula Virtual</strong></span>
        </a>
        <nav class="aula-header-nav" aria-label="Navegación del aula">
          <a class="aula-nav-link" href="aula-virtual.html">Mis cursos</a>
          <div id="courseUserArea"></div>
        </nav>
      </div>`;
    mountUserMenu(header.querySelector('#courseUserArea'), session);
  }

  function replaceInactiveLinks() {
    document.querySelectorAll('body.aula-course a[href="#"]').forEach((link) => {
      const text = link.textContent.trim().toLowerCase();
      let label = 'Próximamente';
      if (link.classList.contains('material-alert')) label = 'Material compartido por WhatsApp';
      else if (text.includes('material')) label = 'Material pendiente';
      else if (text.includes('evaluación')) label = 'Evaluación pendiente';
      else if (text.includes('grabación') || text.includes('pendiente')) label = 'Grabación pendiente';

      const status = document.createElement('span');
      status.className = 'aula-resource-status';
      status.textContent = label;
      status.setAttribute('aria-label', label);
      link.replaceWith(status);
    });
  }

  function guardCoursePage() {
    const body = document.body;
    if (!body.classList.contains('aula-course')) return;
    const courseId = body.dataset.courseId;
    const session = readSession();
    const currentFile = window.location.pathname.split('/').pop() || '';

    if (!session) {
      const next = /^[a-z0-9-]+\.html$/i.test(currentFile) ? currentFile : '';
      window.location.replace(`aula-virtual.html?login=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
      return;
    }
    if (!courseId || !hasCourse(session, courseId)) {
      window.location.replace('aula-virtual.html?error=sin-acceso');
      return;
    }

    enhanceCourseHeader(session);
    replaceInactiveLinks();
    body.classList.remove('auth-pending');
    body.classList.add('auth-ready');
  }

  window.AltumAuth = Object.freeze({
    authenticate,
    clearSession,
    getSession: readSession,
    hasCourse,
    mountUserMenu
  });

  document.addEventListener('DOMContentLoaded', guardCoursePage);
})();
