import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const root = new URL('./', import.meta.url);
const productionScripts = ['aula-datos.js', 'aula-config.js', 'aula-auth.js'];

async function createDom(htmlFile, scripts, session = null) {
  const html = await readFile(new URL(htmlFile, root), 'utf8');
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: `https://aula.altumlumen.test/${htmlFile}`
  });

  if (session) {
    dom.window.sessionStorage.setItem('altum_aula_session_v2', JSON.stringify(session));
  }
  for (const script of scripts) {
    const source = await readFile(new URL(script, root), 'utf8');
    dom.window.eval(source);
  }
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  await new Promise((resolvePromise) => dom.window.setTimeout(resolvePromise, 10));
  return dom;
}

const authDom = await createDom('aula-virtual.html', productionScripts);
const wrongLogin = await authDom.window.AltumAuth.authenticate('77800233', 'incorrecta');
assert.equal(wrongLogin.ok, false, 'Las credenciales incorrectas deben rechazarse');
assert.equal(authDom.window.AltumAuth.getSession(), null, 'Un intento fallido no debe crear sesión');

const masterLogin = await authDom.window.AltumAuth.authenticate('77800233', '77800233');
assert.equal(masterLogin.ok, true, 'El usuario maestro debe iniciar sesión');
assert.equal(masterLogin.session.courses.length, 6, 'El usuario maestro debe tener las seis aulas');
const courseCatalog = authDom.window.ALTUM_COURSES.map((course) => ({
  id: course.id,
  file: course.file,
  flyer: course.flyer
}));
authDom.window.close();

const masterSession = {
  studentCode: '77800233',
  displayName: 'Usuario maestro',
  initials: 'UM',
  role: 'master',
  courses: [
    'ia-derecho-2da',
    'ia-derecho-3ra',
    'ia-derecho-1ra',
    'pae-gerencia-seguridad-criminologia',
    'orden-interno-seguridad-ciudadana',
    'proyectos-inversion-publica-ia'
  ],
  createdAt: new Date().toISOString()
};

const dashboardDom = await createDom('aula-virtual.html', [...productionScripts, 'aula-portal.js'], masterSession);
assert.equal(dashboardDom.window.document.getElementById('dashboardView').hidden, false, 'La sesión debe mostrar Mis cursos');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-course-card').length, 6, 'El maestro debe ver seis tarjetas');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-status.is-closed').length, 1, 'Debe conservarse el curso cerrado');
assert.ok(dashboardDom.window.document.querySelector('.aula-logout'), 'El menú debe permitir cerrar sesión');
dashboardDom.window.close();

const studentSession = {
  studentCode: 'ALU-DEMO-001',
  displayName: 'Estudiante de demostración',
  initials: 'ED',
  role: 'student',
  courses: ['ia-derecho-2da', 'pae-gerencia-seguridad-criminologia'],
  createdAt: new Date().toISOString()
};

const studentDom = await createDom('aula-virtual.html', [...productionScripts, 'aula-portal.js'], studentSession);
assert.equal(studentDom.window.document.querySelectorAll('.portal-course-card').length, 2, 'El alumno debe ver solo sus cursos');
studentDom.window.close();

let inactiveResourceCount = 0;
for (const course of courseCatalog) {
  await readFile(new URL(course.flyer, root));
  const courseDom = await createDom(course.file, productionScripts, masterSession);
  assert.equal(courseDom.window.document.body.dataset.courseId, course.id, `${course.file} debe proteger el curso correcto`);
  assert.ok(courseDom.window.document.body.classList.contains('auth-ready'), `${course.file} debe quedar visible para el maestro`);
  assert.equal(courseDom.window.document.querySelectorAll('a[href="#"]').length, 0, `${course.file} no debe contener botones falsos`);
  assert.equal(courseDom.window.document.querySelector('.aula-nav-link')?.textContent.trim(), 'Mis cursos', `${course.file} debe incluir Mis cursos`);
  assert.ok(courseDom.window.document.querySelector('.aula-logout'), `${course.file} debe incluir cerrar sesión`);
  inactiveResourceCount += courseDom.window.document.querySelectorAll('.aula-resource-status').length;
  courseDom.window.close();
}
assert.ok(inactiveResourceCount > 0, 'Los recursos todavía no habilitados deben mostrarse como estados no pulsables');

console.log('Aula Virtual: autenticación, asignación y seis aulas verificadas.');
