import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const root = new URL('./', import.meta.url);
const productionScripts = ['aula-datos.js', 'aula-config.js', 'aula-auth.js'];
const rosterText = await readFile(new URL('alumnos-accesos.csv', root), 'utf8');
const summary = JSON.parse(await readFile(new URL('resumen-integracion-alumnos.json', root), 'utf8'));

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const text = source.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((values) => values.some(Boolean));
}

const rosterRows = parseCsv(rosterText).slice(1);

async function createDom(htmlFile, scripts, session = null) {
  const html = await readFile(new URL(htmlFile, root), 'utf8');
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: `https://aula.altumlumen.test/${htmlFile}`
  });
  dom.window.fetch = async (input) => {
    if (String(input).endsWith('/alumnos-accesos.csv')) {
      return { ok: true, text: async () => rosterText };
    }
    return { ok: false, text: async () => '' };
  };

  if (session) {
    dom.window.sessionStorage.setItem('altum_aula_session_v4', JSON.stringify(session));
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
const wrongLogin = await authDom.window.AltumAuth.authenticate('77800233', '00000000');
assert.equal(wrongLogin.ok, false, 'Las credenciales incorrectas deben rechazarse');
assert.equal(authDom.window.AltumAuth.getSession(), null, 'Un intento fallido no debe crear sesión');

const masterLogin = await authDom.window.AltumAuth.authenticate('77800233', '77800233');
assert.equal(masterLogin.ok, true, 'El usuario maestro debe iniciar sesión');
assert.equal(masterLogin.session.courses.length, 9, 'El usuario maestro debe recibir las nueve aulas del catálogo');

const courseCatalog = authDom.window.ALTUM_COURSES.map((course) => ({
  id: course.id,
  file: course.file,
  flyer: course.flyer,
  status: course.status,
  sessionCount: course.sessionCount
}));
const openCourses = courseCatalog.filter((course) => course.status === 'Abierto');
const closedCourses = courseCatalog.filter((course) => course.status === 'Cerrado');
const openCourseIds = new Set(openCourses.map((course) => course.id));

assert.equal(courseCatalog.length, 9, 'El catálogo debe conservar nueve programas');
assert.equal(openCourses.length, 3, 'Solo deben existir tres cursos abiertos');
assert.equal(closedCourses.length, 6, 'Los seis programas anteriores deben estar cerrados');
assert.ok(openCourses.every((course) => course.sessionCount === 4), 'Cada curso abierto debe declarar cuatro sesiones');
assert.ok(closedCourses.every((course) => authDom.window.AltumAuth.hasCourse(masterLogin.session, course.id)), 'La etiqueta Cerrado no debe bloquear los cursos asignados al maestro');

assert.equal(rosterRows.length, 51, 'El padrón debe contener 51 asignaciones activas');
assert.ok(rosterRows.every((row) => /^\d{8}$/.test(row[0])), 'Todos los DNI deben conservar ocho dígitos');
assert.ok(rosterRows.every((row) => openCourseIds.has(row[2]) && row[4] === 'activo'), 'Cada matrícula debe corresponder a un curso abierto');

const assignmentsByDni = new Map();
for (const row of rosterRows) {
  if (!assignmentsByDni.has(row[0])) assignmentsByDni.set(row[0], new Set());
  assignmentsByDni.get(row[0]).add(row[2]);
}
assert.equal(assignmentsByDni.size, 49, 'El padrón debe contener 49 usuarios únicos');
assert.equal([...assignmentsByDni.values()].filter((courseIds) => courseIds.size > 1).length, 1, 'Debe existir una persona con varios cursos abiertos');

const [studentDni, studentCourses] = [...assignmentsByDni.entries()].find(([, courseIds]) => courseIds.size > 1);
const studentLogin = await authDom.window.AltumAuth.authenticate(studentDni, studentDni);
assert.equal(studentLogin.ok, true, 'Un DNI matriculado debe iniciar sesión usando el mismo DNI como contraseña');
assert.deepEqual(new Set(studentLogin.session.courses), studentCourses, 'El alumno debe recibir todos y únicamente sus cursos asignados');

let missingDni = '99999999';
while (assignmentsByDni.has(missingDni)) missingDni = String(Number(missingDni) - 1).padStart(8, '0');
const missingLogin = await authDom.window.AltumAuth.authenticate(missingDni, missingDni);
assert.equal(missingLogin.ok, false, 'Un DNI no matriculado debe quedar bloqueado');

assert.equal(summary.activeAssignmentRows, 51, 'El resumen debe reconciliar las 51 asignaciones');
assert.equal(summary.uniqueUsers, 49, 'El resumen debe reconciliar los 49 usuarios');
assert.equal(summary.openRowsWithoutValidDni, 0, 'No debe existir una matrícula abierta sin DNI');
assert.deepEqual(summary.courseCounts, {
  'ia-derecho-4ta': 14,
  'formulacion-inversiones-publicas-ia': 26,
  'gestion-servicio-serenazgo-municipal': 11
}, 'Los conteos por aula deben coincidir con el SIRA');
authDom.window.close();

const masterSession = masterLogin.session;
const dashboardDom = await createDom('aula-virtual.html', [...productionScripts, 'aula-portal.js'], masterSession);
assert.equal(dashboardDom.window.document.getElementById('dashboardView').hidden, false, 'La sesión debe mostrar Mis cursos');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-course-card').length, 9, 'El maestro debe ver las nueve aulas del catálogo');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-status.is-active').length, 3, 'Las tres tarjetas deben mostrarse abiertas');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-status.is-closed').length, 6, 'Los seis cursos anteriores deben conservar la etiqueta Cerrado');
assert.ok([...dashboardDom.window.document.querySelectorAll('.portal-course-link')].every((link) => link.textContent.includes('Ingresar al curso')), 'Abierto y Cerrado deben conservar el mismo botón de ingreso');
assert.ok(dashboardDom.window.document.querySelector('.aula-logout'), 'El menú debe permitir cerrar sesión');
dashboardDom.window.close();

const studentDom = await createDom('aula-virtual.html', [...productionScripts, 'aula-portal.js'], studentLogin.session);
assert.equal(studentDom.window.document.querySelectorAll('.portal-course-card').length, studentCourses.size, 'El alumno debe ver todos y únicamente sus cursos');
studentDom.window.close();

for (const course of courseCatalog) {
  await readFile(new URL(course.flyer, root));
  await readFile(new URL(course.file, root));
}

let scheduledResourceCount = 0;
for (const course of openCourses) {
  const courseDom = await createDom(course.file, productionScripts, masterSession);
  assert.equal(courseDom.window.document.body.dataset.courseId, course.id, `${course.file} debe proteger el curso correcto`);
  assert.ok(courseDom.window.document.body.classList.contains('auth-ready'), `${course.file} debe quedar visible para el maestro`);
  assert.equal(courseDom.window.document.querySelectorAll('.course-session').length, 4, `${course.file} debe contener cuatro sesiones`);
  assert.equal(courseDom.window.document.querySelectorAll('a[href="#"]').length, 0, `${course.file} no debe contener botones falsos`);
  assert.equal(courseDom.window.document.querySelector('.aula-nav-link')?.textContent.trim(), 'Mis cursos', `${course.file} debe incluir Mis cursos`);
  assert.ok(courseDom.window.document.querySelector('.aula-logout'), `${course.file} debe incluir cerrar sesión`);
  scheduledResourceCount += courseDom.window.document.querySelectorAll('.aula-resource-status').length;
  courseDom.window.close();
}
assert.equal(scheduledResourceCount, 12, 'Las cuatro sesiones de cada curso deben mostrar su estado programado');

for (const course of closedCourses) {
  const html = await readFile(new URL(course.file, root), 'utf8');
  const closedDom = await createDom(course.file, productionScripts, masterSession);
  assert.equal(closedDom.window.document.body.dataset.courseId, course.id, `${course.file} debe conservar su identificador`);
  assert.match(html, /<div><b>Estado<\/b><span>Cerrado<\/span><\/div>/, `${course.file} debe indicar estado cerrado`);
  assert.ok(closedDom.window.document.body.classList.contains('auth-ready'), `${course.file} debe permitir el ingreso cuando está asignado`);
  closedDom.window.close();
}

console.log('Aula Virtual: 49 usuarios, 51 asignaciones y nueve aulas accesibles según asignación; las etiquetas no bloquean el ingreso.');
