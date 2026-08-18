(function () {
  'use strict';

  const config = window.ALTUM_AULA_CONFIG || {};
  const courses = Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : [];
  const catalogCourseIds = new Set(courses.map((course) => course.id));
  const sessionKey = config.sessionKey || 'altum_aula_session_v6';
  let rosterPromise = null;
  let siraWarmStarted = false;

  function warmSira() {
    const endpoint = String(config.authEndpoint || '').trim();
    if (!endpoint || siraWarmStarted || !document.body) return;
    siraWarmStarted = true;
    try {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = 'https://script.google.com';
      document.head.appendChild(preconnect);
    } catch (_error) {}
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px';
    frame.src = endpoint + (endpoint.includes('?') ? '&' : '?') + 'action=aulaHealth&warm=' + Date.now();
    const remove = () => { try { frame.remove(); } catch (_error) {} };
    frame.addEventListener('load', () => window.setTimeout(remove, 800), { once: true });
    document.body.appendChild(frame);
    window.setTimeout(remove, 8000);
  }

  function normalizeDni(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 8 ? digits : '';
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

  function buildSession(payload) {
    const dni = normalizeDni(payload.dni || payload.studentCode);
    const displayName = String(payload.name || dni || 'Alumno').trim();
    return {
      dni,
      studentCode: String(payload.studentCode || dni || '').trim(),
      displayName,
      initials: initials(displayName, dni),
      role: 'student',
      courses: normalizeCourses(payload.courses),
      source: 'SIRA',
      createdAt: new Date().toISOString()
    };
  }

  function readSession() {
    try {
      const value = window.sessionStorage.getItem(sessionKey);
      if (!value) return null;
      const session = JSON.parse(value);
      const dni = normalizeDni(session?.dni);
      if (!session || !dni || !Array.isArray(session.courses)) return null;
      session.dni = dni;
      session.courses = normalizeCourses(session.courses);
      if (!session.courses.length) return null;
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
    try { window.sessionStorage.removeItem(sessionKey); } catch (_error) {}
  }

  function parseCsv(source) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    const text = String(source || '').replace(/^\uFEFF/, '');
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"') quoted = true;
      else if (character === ',') { row.push(cell); cell = ''; }
      else if (character === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += character;
    }
    if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    const headers = (rows.shift() || []).map((header) => header.trim().toLowerCase());
    return rows.filter((values) => values.some((value) => value.trim()))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || '').trim()])));
  }

  async function loadRoster() {
    if (!config.rosterFile) return [];
    if (!rosterPromise) {
      const rosterUrl = new URL(config.rosterFile, document.baseURI).href;
      rosterPromise = window.fetch(rosterUrl, { cache: 'no-store' })
        .then((response) => { if (!response.ok) throw new Error('Roster request failed'); return response.text(); })
        .then(parseCsv)
        .catch((error) => { rosterPromise = null; throw error; });
    }
    return rosterPromise;
  }

  function addHidden(form, name, value) {
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = name; input.value = String(value || '');
    form.appendChild(input);
  }

  function authenticateThroughSira(dni, password) {
    const endpoint = String(config.authEndpoint || '').trim();
    if (!endpoint) return Promise.resolve({ ok: false, message: 'El servicio SIRA no está configurado.' });

    return new Promise((resolve) => {
      const requestId = `sira-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const frame = document.createElement('iframe');
      const frameName = `siraAuth_${requestId.replace(/[^a-z0-9_]/gi, '')}`;
      frame.name = frameName;
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px';

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = endpoint;
      form.target = frameName;
      form.style.display = 'none';
      addHidden(form, 'action', 'aulaAuth');
      addHidden(form, 'requestId', requestId);
      addHidden(form, 'dni', dni);
      addHidden(form, 'password', password);

      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        form.remove();
        setTimeout(() => frame.remove(), 0);
        resolve(result);
      };

      const onMessage = (event) => {
        if (event.source !== frame.contentWindow) return;
        const data = event.data || {};
        if (data.source !== 'SIRA_AULA_AUTH' || data.requestId !== requestId) return;
        finish(data.payload || { ok: false, message: 'Respuesta inválida del SIRA.' });
      };

      const timer = window.setTimeout(() => finish({ ok: false, message: 'SIRA tardó demasiado en responder. Inténtalo nuevamente.' }), 25000);
      window.addEventListener('message', onMessage);
      document.body.append(frame, form);
      form.submit();
    });
  }

  async function authenticate(dniValue, passwordValue) {
    const user = normalizeDni(dniValue);
    const secret = normalizeDni(passwordValue);
    const invalidMessage = 'El DNI o la contraseña no son correctos.';
    if (!user || !secret) return { ok: false, message: invalidMessage };

    // Cuando SIRA está configurado, es la única fuente de autenticación y autorización.
    if (String(config.authEndpoint || '').trim()) {
      try {
        const result = await authenticateThroughSira(user, secret);
        if (!result || result.ok !== true || !result.user) {
          return { ok: false, message: result?.message || invalidMessage };
        }
        const session = buildSession(result.user);
        if (!session.courses.length) return { ok: false, message: 'Tu matrícula no tiene aulas habilitadas actualmente.' };
        return { ok: true, session: saveSession(session) };
      } catch (_error) {
        return { ok: false, message: 'No fue posible validar el acceso con SIRA. Inténtalo nuevamente.' };
      }
    }

    // Compatibilidad temporal hasta activar SIRA en aula-config.js.
    const master = config.masterAccount || {};
    if (user === normalizeDni(master.user) && secret === normalizeDni(master.password)) {
      const session = buildSession({ dni: user, name: 'Usuario maestro', courses: '*' });
      session.role = 'master';
      session.courses = [...catalogCourseIds];
      return { ok: true, session: saveSession(session) };
    }
    if (user !== secret) return { ok: false, message: invalidMessage };
    if (config.rosterFile) {
      try {
        const roster = await loadRoster();
        const matches = roster.filter((record) => normalizeDni(record.dni) === user && String(record.estado || '').toLowerCase() === 'activo');
        if (matches.length) {
          const session = buildSession({ dni: user, name: matches.at(-1).nombre, courses: matches.map((record) => record.curso_id) });
          if (session.courses.length) return { ok: true, session: saveSession(session) };
        }
      } catch (_error) {}
    }
    return { ok: false, message: invalidMessage };
  }

  function hasCourse(session, courseId) {
    return Boolean(catalogCourseIds.has(courseId) && session && Array.isArray(session.courses) && session.courses.includes(courseId));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function mountUserMenu(container, session) {
    if (!container || !session) return;
    const name = escapeHtml(session.displayName), code = escapeHtml(session.dni), badge = escapeHtml(session.initials);
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
    function closeMenu() { trigger.setAttribute('aria-expanded', 'false'); popover.hidden = true; }
    trigger.addEventListener('click', () => { const open = popover.hidden; popover.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); });
    logoutButton.addEventListener('click', () => { clearSession(); window.location.replace('aula-virtual.html'); });
    document.addEventListener('click', (event) => { if (!container.contains(event.target)) closeMenu(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeMenu(); trigger.focus(); } });
  }

  function enhanceCourseHeader(session) {
    const header = document.querySelector('body.aula-course header');
    if (!header) return;
    header.className = 'aula-site-header';
    header.innerHTML = `
      <div class="container aula-header-inner">
        <a class="aula-brand" href="index.html" aria-label="Ir al Centro de Formación y Capacitación Profesional">
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
      status.className = 'aula-resource-status'; status.textContent = label; status.setAttribute('aria-label', label); link.replaceWith(status);
    });
  }

  function mountCourseStatusNotice(courseId) {
    const course = courses.find((item) => item.id === courseId);
    const main = document.querySelector('body.aula-course main');
    if (!course || course.status !== 'Cerrado' || !main || main.querySelector('.aula-course-ended-notice')) return;
    const notice = document.createElement('aside');
    notice.className = 'aula-course-ended-notice'; notice.setAttribute('role', 'note');
    notice.innerHTML = '<span class="aula-course-ended-icon" aria-hidden="true">✓</span><div><strong>Este curso o programa ya finalizó.</strong><p>Puedes acceder a tus clases virtuales y a los materiales que permanezcan disponibles.</p></div>';
    main.prepend(notice);
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
    mountCourseStatusNotice(courseId);
    replaceInactiveLinks();
    body.classList.remove('auth-pending'); body.classList.add('auth-ready');
  }

  window.AltumAuth = Object.freeze({ authenticate, clearSession, getSession: readSession, hasCourse, mountUserMenu });
  document.addEventListener('DOMContentLoaded', () => { warmSira(); guardCoursePage(); });
})();
