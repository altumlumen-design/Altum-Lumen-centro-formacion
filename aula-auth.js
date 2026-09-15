(function () {
  'use strict';

  const config = window.ALTUM_AULA_CONFIG || {};
  const staticCourses = Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : [];
  const staticById = new Map(staticCourses.map((course) => [String(course.id || ''), course]));
  const sessionKey = config.sessionKey || 'altum_aula_session_v7';

  function formatPersonName(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    const lower = text.toLocaleLowerCase('es-PE');
    return lower.replace(/(^|[\s\-'])([a-záéíóúüñ])/g, (_m, separator, letter) =>
      separator + letter.toLocaleUpperCase('es-PE')
    );
  }

  function normalizeDni(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 8 ? digits : '';
  }

  function normalizeCourses(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))];
  }

  function initials(name, fallback) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return String(fallback || 'AL').slice(0, 2).toUpperCase();
    return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  function normalizeSummaries(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && item.id)
      .map((item) => ({
        id: String(item.id),
        programId: String(item.programId || ''),
        type: String(item.type || ''),
        title: String(item.title || item.shortTitle || ''),
        shortTitle: String(item.shortTitle || item.title || ''),
        area: String(item.area || ''),
        description: String(item.description || ''),
        coverUrl: String(item.coverUrl || ''),
        status: String(item.status || ''),
        duration: String(item.duration || ''),
        scheduleText: String(item.scheduleText || ''),
        startDate: String(item.startDate || ''),
        endDate: String(item.endDate || ''),
        dynamic: item.dynamic === true
      }));
  }

  function buildSession(payload, token) {
    const dni = normalizeDni(payload?.dni);
    const studentCode = String(payload?.studentCode || '').trim();
    const displayName = formatPersonName(payload?.name || dni || 'Alumno');
    return {
      dni,
      studentCode,
      displayName,
      initials: initials(displayName, dni || studentCode),
      role: payload?.role === 'master' ? 'master' : 'student',
      courses: normalizeCourses(payload?.courses),
      courseSummaries: normalizeSummaries(payload?.courseSummaries),
      token: String(token || ''),
      validatedAt: new Date().toISOString()
    };
  }

  function readSession() {
    try {
      const raw = window.sessionStorage.getItem(sessionKey);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.token || !Array.isArray(session.courses)) return null;
      session.dni = normalizeDni(session.dni);
      session.studentCode = String(session.studentCode || '').trim();
      session.displayName = formatPersonName(session.displayName || session.dni || 'Alumno');
      session.initials = initials(session.displayName, session.dni || session.studentCode);
      session.courses = normalizeCourses(session.courses);
      session.courseSummaries = normalizeSummaries(session.courseSummaries);
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

  function addHidden(form, name, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value ?? '');
    form.appendChild(input);
  }

  function requestSira(action, params) {
    const endpoint = String(config.authEndpoint || '').trim();
    if (!endpoint) return Promise.resolve({ ok: false, message: 'El servicio SIRA no está configurado.' });

    const expectedSource = {
      aulaAuth: 'SIRA_AULA_AUTH',
      aulaSession: 'SIRA_AULA_SESSION',
      aulaCourse: 'SIRA_AULA_COURSE'
    }[action];
    if (!expectedSource) return Promise.resolve({ ok: false, message: 'Solicitud de Aula no válida.' });

    return new Promise((resolve) => {
      const requestId = `altum-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const frame = document.createElement('iframe');
      const frameName = `sira_${requestId.replace(/[^a-z0-9_]/gi, '')}`;
      frame.name = frameName;
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px';

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = endpoint;
      form.target = frameName;
      form.style.display = 'none';
      addHidden(form, 'action', action);
      addHidden(form, 'requestId', requestId);
      Object.entries(params || {}).forEach(([key, value]) => addHidden(form, key, value));

      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timer);
        form.remove();
        window.setTimeout(() => frame.remove(), 0);
        resolve(result || { ok: false, message: 'SIRA devolvió una respuesta vacía.' });
      };
      const onMessage = (event) => {
        const data = event.data || {};
        if (data.source !== expectedSource || data.requestId !== requestId) return;
        const origin = String(event.origin || '');
        const trustedGoogleOrigin = origin === 'null' || /^https:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|script\.google\.com)$/i.test(origin);
        if (!trustedGoogleOrigin) return;
        finish(data.payload);
      };
      const timer = window.setTimeout(
        () => finish({ ok: false, message: 'SIRA tardó demasiado en responder. Inténtalo nuevamente.' }),
        Number(config.authTimeoutMs) || 20000
      );

      window.addEventListener('message', onMessage);
      document.body.append(frame, form);
      form.submit();
    });
  }

  async function authenticate(dniValue, passwordValue) {
    const user = normalizeDni(dniValue);
    const secret = normalizeDni(passwordValue);
    const invalid = 'El DNI o la contraseña no son correctos.';
    if (!user || !secret) return { ok: false, message: invalid };

    const result = await requestSira('aulaAuth', { dni: user, password: secret });
    if (!result || result.ok !== true || !result.user || !result.token) {
      return { ok: false, message: result?.message || invalid };
    }
    const session = buildSession(result.user, result.token);
    if (!session.courses.length) return { ok: false, message: 'Tu matrícula no tiene aulas habilitadas actualmente.' };
    return { ok: true, session: saveSession(session) };
  }

  async function refreshSession(existingSession) {
    const current = existingSession || readSession();
    if (!current?.token) return { ok: false, message: 'Debes iniciar sesión nuevamente.' };
    const result = await requestSira('aulaSession', { token: current.token });
    if (!result || result.ok !== true || !result.user || !result.token) {
      return { ok: false, message: result?.message || 'No fue posible actualizar tu sesión.' };
    }
    const session = buildSession(result.user, result.token);
    return { ok: true, session: saveSession(session) };
  }

  async function fetchCourse(courseId, existingSession) {
    const current = existingSession || readSession();
    if (!current?.token) return { ok: false, message: 'Debes iniciar sesión nuevamente.' };
    return requestSira('aulaCourse', { token: current.token, courseId: String(courseId || '') });
  }

  function hasCourse(session, courseId) {
    return Boolean(session && Array.isArray(session.courses) && session.courses.includes(String(courseId || '')));
  }

  function getCourseCatalog(session) {
    if (!session) return [];
    const summaryById = new Map((session.courseSummaries || []).map((item) => [item.id, item]));
    return (session.courses || []).map((id) => {
      const legacy = staticById.get(id) || null;
      const remote = summaryById.get(id) || null;
      if (remote?.dynamic) {
        return {
          id,
          title: remote.title || legacy?.title || id,
          shortTitle: remote.shortTitle || remote.title || legacy?.shortTitle || id,
          type: remote.type || legacy?.type || 'Programa',
          area: remote.area || legacy?.area || 'Formación especializada',
          duration: remote.duration || legacy?.duration || '',
          status: remote.status || legacy?.status || 'Abierto',
          file: `curso.html?id=${encodeURIComponent(id)}`,
          flyer: remote.coverUrl || legacy?.flyer || 'logo-centro-formacion.jpg',
          description: remote.description || legacy?.description || '',
          dynamic: true,
          scheduleText: remote.scheduleText || '',
          startDate: remote.startDate || '',
          endDate: remote.endDate || ''
        };
      }
      if (legacy) return Object.assign({}, legacy, { dynamic: false });
      return {
        id,
        title: remote?.title || id,
        shortTitle: remote?.shortTitle || remote?.title || id,
        type: remote?.type || 'Programa',
        area: remote?.area || 'Formación especializada',
        duration: remote?.duration || '',
        status: remote?.status || 'Abierto',
        file: remote?.dynamic ? `curso.html?id=${encodeURIComponent(id)}` : '',
        flyer: remote?.coverUrl || 'logo-centro-formacion.jpg',
        description: remote?.description || '',
        dynamic: Boolean(remote?.dynamic)
      };
    }).filter((course) => Boolean(course.file));
  }

  function getStaticCourse(courseId) {
    return staticById.get(String(courseId || '')) || null;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function mountUserMenu(container, session) {
    if (!container || !session) return;
    const name = escapeHtml(session.displayName);
    const studentCode = escapeHtml(session.studentCode || '');
    const dni = escapeHtml(session.dni || '');
    const badge = escapeHtml(session.initials);
    const small = session.role === 'master' ? 'Acceso maestro' : (studentCode ? `Código ${studentCode}` : `DNI ${dni}`);
    const details = session.role === 'master'
      ? '<span>Administración del Aula</span>'
      : `<span>${studentCode ? `Código ${studentCode} · ` : ''}DNI ${dni}</span>`;

    container.innerHTML = `
      <div class="aula-user-menu">
        <button class="aula-user-trigger" type="button" aria-haspopup="true" aria-expanded="false">
          <span class="aula-avatar" aria-hidden="true">${badge}</span>
          <span class="aula-user-copy"><strong>${name}</strong><small>${small}</small></span>
          <span class="aula-chevron" aria-hidden="true"></span>
        </button>
        <div class="aula-user-popover" role="menu" hidden>
          <div class="aula-user-summary"><strong>${name}</strong>${details}</div>
          <button class="aula-logout" type="button" role="menuitem">Cerrar sesión</button>
        </div>
      </div>`;

    const trigger = container.querySelector('.aula-user-trigger');
    const popover = container.querySelector('.aula-user-popover');
    const logoutButton = container.querySelector('.aula-logout');
    function closeMenu() { trigger.setAttribute('aria-expanded', 'false'); popover.hidden = true; }
    trigger.addEventListener('click', () => {
      const open = popover.hidden;
      popover.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    });
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
      status.className = 'aula-resource-status';
      status.textContent = label;
      status.setAttribute('aria-label', label);
      link.replaceWith(status);
    });
  }

  function mountCourseStatusNotice(courseId) {
    const course = staticById.get(String(courseId || ''));
    const main = document.querySelector('body.aula-course main');
    if (!course || course.status !== 'Cerrado' || !main || main.querySelector('.aula-course-ended-notice')) return;
    const notice = document.createElement('aside');
    notice.className = 'aula-course-ended-notice';
    notice.setAttribute('role', 'note');
    notice.innerHTML = '<span class="aula-course-ended-icon" aria-hidden="true">✓</span><div><strong>Este curso o programa ya finalizó.</strong><p>Puedes acceder a tus clases virtuales y a los materiales que permanezcan disponibles.</p></div>';
    main.prepend(notice);
  }

  async function guardCoursePage() {
    const body = document.body;
    if (!body.classList.contains('aula-course')) return;
    const courseId = body.dataset.courseId;
    const currentFile = window.location.pathname.split('/').pop() || '';
    const stored = readSession();
    if (!stored) {
      const next = /^[a-z0-9-]+\.html$/i.test(currentFile) ? currentFile : '';
      window.location.replace(`aula-virtual.html?login=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
      return;
    }

    const refreshed = await refreshSession(stored);
    if (!refreshed.ok) {
      clearSession();
      window.location.replace('aula-virtual.html?error=sesion');
      return;
    }
    const session = refreshed.session;
    if (!courseId || !hasCourse(session, courseId)) {
      window.location.replace('aula-virtual.html?error=sin-acceso');
      return;
    }

    enhanceCourseHeader(session);
    mountCourseStatusNotice(courseId);
    replaceInactiveLinks();
    body.classList.remove('auth-pending');
    body.classList.add('auth-ready');
  }

  window.AltumAuth = Object.freeze({
    authenticate,
    refreshSession,
    fetchCourse,
    clearSession,
    getSession: readSession,
    hasCourse,
    getCourseCatalog,
    getStaticCourse,
    mountUserMenu
  });

  document.addEventListener('DOMContentLoaded', guardCoursePage);
})();
