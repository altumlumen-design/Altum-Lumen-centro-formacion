(function () {
  'use strict';

  function esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    const text = String(value || '').trim();
    return /^https:\/\/[^\s]+$/i.test(text) ? text : '';
  }

  function formatDate(value, withTime) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const options = withTime
      ? { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' }
      : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' };
    return new Intl.DateTimeFormat('es-PE', options).format(date);
  }

  const COURSE_CACHE_TTL_MS = 2 * 60 * 1000;

  function courseCacheKey(courseId) {
    return `altum_aula_course_cache_v1_${String(courseId || '')}`;
  }

  function readCourseCache(courseId) {
    try {
      const raw = window.sessionStorage.getItem(courseCacheKey(courseId));
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached?.course || !cached.cachedAt) return null;
      if (Date.now() - Number(cached.cachedAt) > COURSE_CACHE_TTL_MS) return null;
      return cached.course;
    } catch (_error) { return null; }
  }

  function writeCourseCache(courseId, course) {
    try {
      window.sessionStorage.setItem(courseCacheKey(courseId), JSON.stringify({ cachedAt: Date.now(), course }));
    } catch (_error) {}
  }

  function resourceLink(url, label, kind) {
    const href = safeUrl(url);
    if (!href) return `<span class="dynamic-resource is-pending">${esc(label)} · pendiente</span>`;
    return `<a class="dynamic-resource ${esc(kind || '')}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}<span aria-hidden="true">↗</span></a>`;
  }

  function renderCourse(course) {
    const root = document.getElementById('dynamicCourse');
    const cover = safeUrl(course.coverUrl) || 'logo-centro-formacion.jpg';
    const generalZoom = safeUrl(course.zoomUrl);
    const sessions = Array.isArray(course.sessions) ? course.sessions : [];
    const start = formatDate(course.startDate, false);
    const end = formatDate(course.endDate, false);

    document.title = `${course.shortTitle || course.title || 'Curso'} | ALTUM LUMEN`;

    root.innerHTML = `
      <section class="dynamic-hero">
        <div class="dynamic-shell dynamic-hero-grid">
          <div class="dynamic-cover">
            <img src="${esc(cover)}" alt="Portada de ${esc(course.shortTitle || course.title)}">
          </div>
          <div class="dynamic-hero-copy">
            <span class="dynamic-kicker">${esc(course.type || 'Programa académico')} · ${esc(course.status || 'Abierto')}</span>
            <h1>${esc(course.title || course.shortTitle)}</h1>
            <p>${esc(course.description || 'Aula académica para participantes matriculados.')}</p>
            <div class="dynamic-meta">
              ${start ? `<div><small>Inicio</small><strong>${esc(start)}</strong></div>` : ''}
              ${end ? `<div><small>Fin</small><strong>${esc(end)}</strong></div>` : ''}
              ${course.duration ? `<div><small>Duración</small><strong>${esc(course.duration)}</strong></div>` : ''}
              ${course.scheduleText ? `<div><small>Horario</small><strong>${esc(course.scheduleText)}</strong></div>` : ''}
              ${course.area ? `<div><small>Área</small><strong>${esc(course.area)}</strong></div>` : ''}
              <div><small>Sesiones</small><strong>${sessions.length}</strong></div>
            </div>
          </div>
        </div>
      </section>

      ${generalZoom ? `
      <section class="dynamic-shell dynamic-live">
        <div>
          <span>● Clases en vivo</span>
          <h2>Acceso general a las sesiones</h2>
          <p>Utiliza este acceso cuando la sesión no tenga un enlace propio.</p>
        </div>
        <a class="dynamic-btn primary" href="${esc(generalZoom)}" target="_blank" rel="noopener">Ingresar a Zoom ↗</a>
      </section>` : ''}

      <section class="dynamic-shell dynamic-content">
        <div class="dynamic-section-head">
          <div><span>Contenido académico</span><h2>Sesiones y recursos</h2></div>
          <p>Los enlaces se habilitan conforme avanza el programa.</p>
        </div>
        <div class="dynamic-sessions">
          ${sessions.length ? sessions.map((session) => `
            <article class="dynamic-session">
              <div class="dynamic-session-number">${esc(session.number || '')}</div>
              <div class="dynamic-session-body">
                <div class="dynamic-session-title">
                  <div>
                    <small>Sesión ${esc(session.number || '')}</small>
                    <h3>${esc(session.title || `Sesión ${session.number || ''}`)}</h3>
                  </div>
                  ${session.start ? `<time>${esc(formatDate(session.start, true))}</time>` : ''}
                </div>
                <div class="dynamic-resources">
                  ${resourceLink(session.zoomUrl, 'Clase en vivo', 'is-live')}
                  ${resourceLink(session.recordingUrl, 'Grabación', 'is-recording')}
                  ${resourceLink(session.materialUrl, 'Material', 'is-material')}
                  ${resourceLink(session.evaluationUrl, 'Evaluación', 'is-evaluation')}
                </div>
              </div>
            </article>`).join('') :
            '<div class="dynamic-empty">Las sesiones de este programa todavía no han sido publicadas.</div>'}
        </div>
      </section>`;
    root.hidden = false;
  }

  function optimizePortalReturn() {
    const link = document.querySelector('.aula-nav-link');
    if (!link) return;
    try {
      if (document.referrer && window.history.length > 1) {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin && /\/aula-virtual\.html$/i.test(ref.pathname)) {
          link.addEventListener('click', (event) => { event.preventDefault(); window.history.back(); });
        }
      }
      const prefetch = document.createElement('link');
      prefetch.rel = 'prefetch';
      prefetch.href = 'aula-virtual.html';
      document.head.appendChild(prefetch);
    } catch (_error) {}
  }

  function showError(message) {
    document.getElementById('dynamicLoading').hidden = true;
    document.getElementById('dynamicCourse').hidden = true;
    document.getElementById('dynamicErrorMessage').textContent = message || 'Inténtalo nuevamente desde tu Aula Virtual.';
    document.getElementById('dynamicError').hidden = false;
  }

  async function initDynamicCourse() {
    optimizePortalReturn();
    const courseId = new URLSearchParams(window.location.search).get('id') || '';
    if (!/^[a-z0-9][a-z0-9-]{1,95}$/i.test(courseId)) {
      showError('El identificador del curso no es válido.');
      return;
    }

    let session = window.AltumAuth.getSession();
    if (!session) {
      window.location.replace(`aula-virtual.html?login=1&nextCourse=${encodeURIComponent(courseId)}`);
      return;
    }

    // Si el curso no figura en la sesión local, hacemos una única revalidación.
    // En el caso normal evitamos la llamada aulaSession porque aulaCourse ya valida
    // token, alumno y matrícula en SIRA.
    if (!window.AltumAuth.hasCourse(session, courseId)) {
      const refreshed = await window.AltumAuth.refreshSession(session, { force: true });
      if (!refreshed.ok) {
        if (window.AltumAuth.isDefinitiveSessionFailure(refreshed)) window.AltumAuth.clearSession();
        window.location.replace(`aula-virtual.html?error=sesion&nextCourse=${encodeURIComponent(courseId)}`);
        return;
      }
      session = refreshed.session;
      if (!window.AltumAuth.hasCourse(session, courseId)) {
        window.location.replace('aula-virtual.html?error=sin-acceso');
        return;
      }
    }

    window.AltumAuth.mountUserMenu(document.getElementById('courseUserArea'), session);

    const cachedCourse = readCourseCache(courseId);
    if (cachedCourse) {
      document.getElementById('dynamicLoading').hidden = true;
      renderCourse(cachedCourse);
    }

    // Una sola llamada remota. Si ya había contenido reciente en caché, esta
    // actualización ocurre por detrás y el usuario no espera una pantalla vacía.
    const result = await window.AltumAuth.fetchCourse(courseId, session);
    if (!result?.ok) {
      if (cachedCourse && !window.AltumAuth.isDefinitiveSessionFailure(result)) return;
      if (window.AltumAuth.isDefinitiveSessionFailure(result)) window.AltumAuth.clearSession();
      showError(result?.message || 'No fue posible cargar el curso.');
      return;
    }

    if (result.legacy) {
      const legacy = window.AltumAuth.getStaticCourse(courseId);
      if (legacy?.file) {
        window.location.replace(legacy.file);
        return;
      }
      showError('Este curso utiliza el formato histórico, pero no encontramos su página en el catálogo actual.');
      return;
    }

    const course = result.course || {};
    writeCourseCache(courseId, course);
    document.getElementById('dynamicLoading').hidden = true;
    renderCourse(course);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDynamicCourse, { once: true });
  else initDynamicCourse();

})();
