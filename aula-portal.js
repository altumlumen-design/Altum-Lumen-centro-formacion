(function () {
  'use strict';

  const courses = Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : [];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showMessage(element, message) {
    element.textContent = message;
    element.hidden = false;
  }

  function getRequestedCourse(session) {
    const next = new URLSearchParams(window.location.search).get('next');
    if (!next || !/^[a-z0-9-]+\.html$/i.test(next)) return null;
    const course = courses.find((item) => item.file === next);
    if (!course || !window.AltumAuth.hasCourse(session, course.id)) return null;
    return course;
  }

  function renderCourses(session) {
    const grid = document.getElementById('courseGrid');
    const empty = document.getElementById('courseEmpty');
    const assigned = courses.filter((course) => window.AltumAuth.hasCourse(session, course.id));
    document.getElementById('courseCount').textContent = `${assigned.length} ${assigned.length === 1 ? 'curso asignado' : 'cursos asignados'}`;

    grid.innerHTML = assigned.map((course) => {
      const statusClass = course.status === 'Cerrado' ? 'is-closed' : 'is-active';
      return `
        <article class="portal-course-card">
          <div class="portal-course-image">
            <img src="${escapeHtml(course.flyer)}" alt="Portada de ${escapeHtml(course.shortTitle)}">
            <span class="portal-status ${statusClass}">${escapeHtml(course.status)}</span>
          </div>
          <div class="portal-course-body">
            <span class="portal-course-type">${escapeHtml(course.type)}</span>
            <h3>${escapeHtml(course.shortTitle)}</h3>
            <p>${escapeHtml(course.description)}</p>
            <dl class="portal-course-meta">
              <div><dt>Área</dt><dd>${escapeHtml(course.area)}</dd></div>
              <div><dt>Duración</dt><dd>${escapeHtml(course.duration)}</dd></div>
            </dl>
            <a class="portal-course-link" href="${escapeHtml(course.file)}">Ingresar al curso<span aria-hidden="true">→</span></a>
          </div>
        </article>`;
    }).join('');

    empty.hidden = assigned.length !== 0;
  }

  function showDashboard(session) {
    document.getElementById('loginView').hidden = true;
    document.getElementById('dashboardView').hidden = false;
    document.body.classList.add('portal-is-authenticated');
    document.getElementById('welcomeName').textContent = session.role === 'master' ? 'Usuario maestro' : session.displayName;
    window.AltumAuth.mountUserMenu(document.getElementById('portalUserArea'), session);
    renderCourses(session);

    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'sin-acceso') {
      const notice = document.getElementById('dashboardNotice');
      showMessage(notice, 'Ese curso no se encuentra asignado a tu usuario.');
    }
  }

  function showLogin() {
    document.getElementById('dashboardView').hidden = true;
    document.getElementById('loginView').hidden = false;
    document.body.classList.remove('portal-is-authenticated');
    window.setTimeout(() => document.getElementById('studentDni').focus(), 60);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const error = document.getElementById('loginError');
    const submit = document.getElementById('loginSubmit');
    const session = window.AltumAuth.getSession();

    if (session) showDashboard(session);
    else showLogin();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = 'Validando…';

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
