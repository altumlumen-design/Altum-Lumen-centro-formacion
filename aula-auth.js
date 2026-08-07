(function () {
  'use strict';

  const config = window.ALTUM_AULA_CONFIG || {};
  const courses = Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : [];
  const catalogCourseIds = new Set(courses.map((course) => course.id));
  const sessionKey = config.sessionKey || 'altum_aula_session_v4';
  let rosterPromise = null;

  function readSession() {
    try {
      const value = window.sessionStorage.getItem(sessionKey);
      if (!value) return null;
      const session = JSON.parse(value);
      const dni = normalizeDni(session?.dni || session?.studentCode);
      if (!session || !dni || !Array.isArray(session.courses)) return null;
      session.dni = dni;
      session.studentCode = dni;
      session.courses = normalizeCourses(session.role === 'master' ? '*' : session.courses);
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
    if (value === '*') return [...catalogCourseIds];
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((courseId) => catalogCourseIds.has(courseId)))];
  }

  function initials(name, fallback) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return String(fallback || 'AL').slice(0, 2).toUpperCase();
    return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  function normalizeDni(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 8 ? digits : '';
  }

  function parseCsv(source) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const text = String(source || '').replace(/^\uFEFF/, '');

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          cell += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ',') {
        row.push(cell);
        cell = '';
      } else if (character === '\n') {
        row.push(cell.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += character;
      }
    }
    if (cell || row.length) {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
    }

    const headers = (rows.shift() || []).map((header) => header.trim().toLowerCase());
    return rows
      .filter((values) => values.some((value) => value.trim()))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || '').trim()])));
  }

  async function loadRoster() {
    if (!config.rosterFile) return [];
    if (!rosterPromise) {
      const rosterUrl = new URL(config.rosterFile, document.baseURI).href;
      rosterPromise = window.fetch(rosterUrl, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('Roster request failed');
          return response.text();
        })
        .then(parseCsv)
        .catch((error) => {
          rosterPromise = null;
          throw error;
        });
    }
    return rosterPromise;
  }

  function buildSession(payload) {
    const dni = normalizeDni(payload.dni || payload.studentCode);
    const displayName = String(payload.name || dni || 'Alumno').trim();
    return {
      dni,
      studentCode: dni,
      displayName,
      initials: initials(displayName, dni),
      role: payload.role === 'master' ? 'master' : 'student',
      courses: normalizeCourses(payload.courses),
      createdAt: new Date().toISOString()
    };
  }

  async function authenticate(dniValue, password) {
    const user = normalizeDni(dniValue);
    const secret = normalizeDni(password);
    const master = config.masterAccount || {};
    const invalidMessage = 'El DNI o la contraseña no son correctos.';

    if (!user || !secret) return { ok: false, message: invalidMessage };

    if (user === normalizeDni(master.user) && secret === normalizeDni(master.password)) {
      return {
        ok: true,
        session: saveSession(buildSession({
          dni: user,
          name: 'Usuario maestro',
          role: 'master',
          courses: '*'
        }))
      };
    }

    if (user !== secret) return { ok: false, message: invalidMessage };

    if (config.rosterFile) {
      try {
        const roster = await loadRoster();
        const matches = roster.filter((record) => (
          normalizeDni(record.dni) === user && String(record.estado || '').toLowerCase() === 'activo'
        ));
        if (matches.length) {
          const session = buildSession({
            dni: user,
            name: matches.at(-1).nombre,
            role: 'student',
            courses: matches.map((record) => record.curso_id)
          });
          if (!session.courses.length) {
            return { ok: false, message: 'Tu DNI no tiene cursos asignados actualmente.' };
          }
          return { ok: true, session: saveSession(session) };
        }
      } catch (_error) {
        if (!config.authEndpoint) {
          return { ok: false, message: 'No fue posible cargar el padrón de alumnos. Inténtalo nuevamente.' };
        }
      }
    }

    if (!config.authEndpoint) return { ok: false, message: invalidMessage };

    try {
      const response = await window.fetch(config.authEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: user, password: secret })
      });
      if (!response.ok) throw new Error('Auth request failed');
      const result = await response.json();
      if (!result || result.ok !== true || !result.user) {
        return { ok: false, message: invalidMessage };
      }

      const session = buildSession({
        dni: result.user.dni || result.user.studentCode || user,
        name: result.user.name,
        role: 'student',
        courses: result.user.courses
      });
      if (!session.courses.length) {
        return { ok: false, message: 'Tu usuario no tiene cursos asignados actualmente.' };
      }
      return { ok: true, session: saveSession(session) };
    } catch (_error) {
      return { ok: false, message: 'No fue posible validar el acceso. Inténtalo nuevamente.' };
    }
  }

  function hasCourse(session, courseId) {
    return Boolean(
      catalogCourseIds.has(courseId)
      && session
      && Array.isArray(session.courses)
      && session.courses.includes(courseId)
    );
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
    const code = escapeHtml(session.dni || session.studentCode);
    const badge = escapeHtml(session.initials);

    container.innerHTML = `
      <div class="aula-user-menu">
        <button class="aula-user-trigger" type="button" aria-haspopup="true" aria-expanded="false">
          <span class="aula-avatar" aria-hidden="true">${badge}</span>
          <span class="aula-user-copy"><strong>${name}</strong><small>${code}</small></span>
          <span class="aula-chevron" aria-hidden="true"></span>
        </button>
        <div class="aula-user-popover" role="menu" hidden>
          <div class="aula-user-summary"><strong>${name}</strong><span>DNI ${code}</span></div>
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
