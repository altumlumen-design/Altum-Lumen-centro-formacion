(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function showMessage(element, message) {
    element.textContent = message;
    element.hidden = false;
  }

  function courseCatalog(session) {
    return window.AltumAuth.getCourseCatalog(session);
  }

  function getRequestedCourse(session) {
    const params = new URLSearchParams(window.location.search);
    const nextCourse = params.get('nextCourse');
    const catalog = courseCatalog(session);
    if (nextCourse && window.AltumAuth.hasCourse(session, nextCourse)) {
      return catalog.find((item) => item.id === nextCourse) || null;
    }

    const next = params.get('next');
    if (!next || !/^[a-z0-9-]+\.html$/i.test(next)) return null;
    const course = catalog.find((item) => item.file === next);
    if (!course || !window.AltumAuth.hasCourse(session, course.id)) return null;
    return course;
  }

  function renderCourses(session) {
    const grid = document.getElementById('courseGrid');
    const empty = document.getElementById('courseEmpty');
    const assigned = courseCatalog(session);
    document.getElementById('courseCount').textContent =
      `${assigned.length} ${assigned.length === 1 ? 'curso asignado' : 'cursos asignados'}`;

    grid.innerHTML = assigned.map((course) => {
      const status = String(course.status || 'Abierto');
      const statusClass = status.toLowerCase() === 'cerrado' ? 'is-closed' : 'is-active';
      const endedNotice = status.toLowerCase() === 'cerrado'
        ? '<p class="portal-course-ended">Este curso o programa ya finalizó. Puedes acceder a tus clases virtuales.</p>'
        : '';
      const description = course.description || 'Aula académica disponible para participantes matriculados.';
      const area = course.area || 'Formación especializada';
      const duration = course.duration || 'Consultar programa';
      return `
        <article class="portal-course-card">
          <div class="portal-course-image">
            <img src="${escapeHtml(course.flyer || 'logo-centro-formacion.jpg')}" alt="Portada de ${escapeHtml(course.shortTitle || course.title)}" loading="lazy">
            <span class="portal-status ${statusClass}">${escapeHtml(status)}</span>
          </div>
          <div class="portal-course-body">
            <span class="portal-course-type">${escapeHtml(course.type || 'Programa')}</span>
            <h3>${escapeHtml(course.shortTitle || course.title)}</h3>
            <p>${escapeHtml(description)}</p>
            ${endedNotice}
            <dl class="portal-course-meta">
              <div><dt>Área</dt><dd>${escapeHtml(area)}</dd></div>
              <div><dt>Duración</dt><dd>${escapeHtml(duration)}</dd></div>
            </dl>
            <a class="portal-course-link" href="${escapeHtml(course.file)}">Ingresar al curso<span aria-hidden="true">→</span></a>
          </div>
        </article>`;
    }).join('');

    empty.hidden = assigned.length !== 0;
  }

  function updateDashboardData(session) {
    document.getElementById('welcomeName').textContent =
      session.role === 'master' ? 'Usuario maestro' : session.displayName;
    renderCourses(session);
  }

  function showDashboard(session) {
    document.getElementById('loginView').hidden = true;
    document.getElementById('dashboardView').hidden = false;
    document.body.classList.add('portal-is-authenticated');
    updateDashboardData(session);
    window.AltumAuth.mountUserMenu(document.getElementById('portalUserArea'), session);

    const params = new URLSearchParams(window.location.search);
    const notice = document.getElementById('dashboardNotice');
    if (params.get('error') === 'sin-acceso') {
      showMessage(notice, 'Ese curso no se encuentra asignado a tu matrícula.');
    } else if (params.get('error') === 'sesion') {
      showMessage(notice, 'Tu sesión anterior venció o el acceso cambió. Inicia sesión nuevamente.');
    }
  }

  function showLogin(message) {
    document.getElementById('dashboardView').hidden = true;
    document.getElementById('loginView').hidden = false;
    document.body.classList.remove('portal-is-authenticated');
    if (message) showMessage(document.getElementById('loginError'), message);
    window.setTimeout(() => document.getElementById('studentDni').focus(), 60);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('loginForm');
    const error = document.getElementById('loginError');
    const submit = document.getElementById('loginSubmit');
    const stored = window.AltumAuth.getSession();

    if (stored) {
      // Stale-while-revalidate: el dashboard aparece de inmediato con la sesión
      // ya firmada. SIRA se consulta después, sin mostrar el login como pantalla intermedia.
      showDashboard(stored);
      if (!window.AltumAuth.isSessionFresh(stored)) {
        window.setTimeout(async () => {
          const refreshed = await window.AltumAuth.refreshSession(stored, { force: true });
          if (refreshed.ok) {
            updateDashboardData(refreshed.session);
          } else if (window.AltumAuth.isDefinitiveSessionFailure(refreshed)) {
            window.AltumAuth.clearSession();
            showLogin(refreshed.message || 'Tu sesión venció. Inicia sesión nuevamente.');
          }
        }, 0);
      }
    } else {
      showLogin();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = 'Ingresando…';

      const result = await window.AltumAuth.authenticate(
        document.getElementById('studentDni').value,
        document.getElementById('studentPassword').value
      );

      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Ingresar al aula';

      if (!result.ok) {
        showMessage(error, result.message || 'No fue posible iniciar sesión.');
        document.getElementById('studentPassword').select();
        return;
      }

      const requestedCourse = getRequestedCourse(result.session);
      if (requestedCourse) {
        window.location.replace(requestedCourse.file);
        return;
      }

      window.history.replaceState({}, '', 'aula-virtual.html');
      showDashboard(result.session);
    });
  });
})();
