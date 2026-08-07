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
    dom.window.sessionStorage.setItem('altum_aula_session_v5', JSON.stringify(session));
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
assert.equal(masterLogin.session.courses.length, 11, 'El usuario maestro debe recibir las once aulas del catálogo');

const courseCatalog = authDom.window.ALTUM_COURSES.map((course) => ({
  id: course.id,
  file: course.file,
  flyer: course.flyer,
  status: course.status,
  sessionCount: course.sessionCount
}));
const openCourses = courseCatalog.filter((course) => course.status === 'Abierto');
const closedCourses = courseCatalog.filter((course) => course.status === 'Cerrado');
const catalogCourseIds = new Set(courseCatalog.map((course) => course.id));

assert.equal(courseCatalog.length, 11, 'El catálogo debe incluir los once programas encontrados en el proyecto y el SIRA');
assert.equal(openCourses.length, 3, 'Solo deben existir tres cursos abiertos');
assert.equal(closedCourses.length, 8, 'Los ocho programas anteriores deben conservar la etiqueta Cerrado');
assert.ok(openCourses.every((course) => course.sessionCount === 4), 'Cada curso abierto debe declarar cuatro sesiones');
assert.ok(closedCourses.every((course) => authDom.window.AltumAuth.hasCourse(masterLogin.session, course.id)), 'La etiqueta Cerrado no debe bloquear los cursos asignados al maestro');

assert.equal(rosterRows.length, 173, 'El padrón debe contener 173 asignaciones históricas deduplicadas');
assert.ok(rosterRows.every((row) => /^\d{8}$/.test(row[0])), 'Todos los DNI deben conservar ocho dígitos');
assert.ok(rosterRows.every((row) => catalogCourseIds.has(row[2]) && row[4] === 'activo'), 'Cada matrícula debe corresponder a un aula real del catálogo');

const assignmentsByDni = new Map();
for (const row of rosterRows) {
  if (!assignmentsByDni.has(row[0])) assignmentsByDni.set(row[0], new Set());
  assignmentsByDni.get(row[0]).add(row[2]);
}
assert.equal(assignmentsByDni.size, 157, 'El padrón debe contener 157 usuarios únicos con DNI válido');
assert.equal([...assignmentsByDni.values()].filter((courseIds) => courseIds.size > 1).length, 13, 'Deben conservarse trece personas con varios cursos');

const [studentDni, studentCourses] = [...assignmentsByDni.entries()].find(([, courseIds]) => courseIds.size > 1);
const studentLogin = await authDom.window.AltumAuth.authenticate(studentDni, studentDni);
assert.equal(studentLogin.ok, true, 'Un DNI matriculado debe iniciar sesión usando el mismo DNI como contraseña');
assert.deepEqual(new Set(studentLogin.session.courses), studentCourses, 'El alumno debe recibir todos y únicamente sus cursos asignados');

const eloyLogin = await authDom.window.AltumAuth.authenticate('80320361', '80320361');
assert.equal(eloyLogin.ok, true, 'Eloy Zenón debe poder iniciar sesión con el DNI indicado');
assert.deepEqual(new Set(eloyLogin.session.courses), new Set(['pae-gerencia-seguridad-criminologia']), 'Eloy Zenón debe recibir el PAE registrado en SIRA');

const calderonLogin = await authDom.window.AltumAuth.authenticate('09679293', '09679293');
assert.equal(calderonLogin.ok, true, 'Jaime Calderón debe poder iniciar sesión');
assert.deepEqual(new Set(calderonLogin.session.courses), new Set([
  'gestion-servicio-serenazgo-municipal',
  'orden-interno-seguridad-ciudadana',
  'pae-gerencia-seguridad-criminologia'
]), 'Jaime Calderón debe recibir sus tres matrículas históricas');

let missingDni = '99999999';
while (assignmentsByDni.has(missingDni)) missingDni = String(Number(missingDni) - 1).padStart(8, '0');
const missingLogin = await authDom.window.AltumAuth.authenticate(missingDni, missingDni);
assert.equal(missingLogin.ok, false, 'Un DNI no matriculado debe quedar bloqueado');

assert.equal(summary.sourceAcademicRows, 177, 'El resumen debe revisar las 177 filas académicas del SIRA');
assert.equal(summary.sourceRowsMappedToCatalog, 177, 'Todas las filas académicas deben quedar asociadas a un aula');
assert.equal(summary.activeAssignmentRows, 173, 'El resumen debe reconciliar las 173 asignaciones deduplicadas');
assert.equal(summary.uniqueUsers, 157, 'El resumen debe reconciliar los 157 usuarios con DNI válido');
assert.equal(summary.rowsWithoutUsableDni, 1, 'Debe quedar registrada una matrícula histórica sin DNI utilizable');
assert.deepEqual(summary.courseCounts, {
  'ia-derecho-4ta': 14,
  'formulacion-inversiones-publicas-ia': 26,
  'gestion-servicio-serenazgo-municipal': 11,
  'ia-derecho-3ra': 3,
  'ia-derecho-2da': 42,
  'ia-derecho-1ra': 15,
  'pae-gerencia-seguridad-criminologia': 4,
  'orden-interno-seguridad-ciudadana': 34,
  'direccion-gestion-seguridad-ciudadana': 20,
  'interculturalidad-convivencia-desarrollo-social': 1,
  'proyectos-inversion-publica-ia': 3
}, 'Los conteos por aula deben coincidir con el SIRA');
authDom.window.close();

const masterSession = masterLogin.session;
const dashboardDom = await createDom('aula-virtual.html', [...productionScripts, 'aula-portal.js'], masterSession);
assert.equal(dashboardDom.window.document.getElementById('dashboardView').hidden, false, 'La sesión debe mostrar Mis cursos');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-course-card').length, 11, 'El maestro debe ver las once aulas del catálogo');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-status.is-active').length, 3, 'Las tres tarjetas deben mostrarse abiertas');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-status.is-closed').length, 8, 'Los ocho cursos anteriores deben conservar la etiqueta Cerrado');
assert.equal(dashboardDom.window.document.querySelectorAll('.portal-course-ended').length, 8, 'Cada curso cerrado debe explicar que el programa ya finalizó');
assert.ok([...dashboardDom.window.document.querySelectorAll('.portal-course-link')].every((link) => link.textContent.includes('Ingresar al curso')), 'Abierto y Cerrado deben conservar el mismo botón de ingreso');
assert.ok(dashboardDom.window.document.querySelector('.aula-logout'), 'El menú debe permitir cerrar sesión');
dashboardDom.window.close();

const studentDom = await createDom('aula-virtual.html', [...productionScripts, 'aula-portal.js'], studentLogin.session);
assert.equal(studentDom.window.document.querySelectorAll('.portal-course-card').length, studentCourses.size, 'El alumno debe ver todos y únicamente sus cursos');
studentDom.window.close();

const calderonDom = await createDom('aula-virtual.html', [...productionScripts, 'aula-portal.js'], calderonLogin.session);
assert.equal(calderonDom.window.document.querySelectorAll('.portal-course-card').length, 3, 'Jaime Calderón debe ver tres cursos en Mis cursos');
assert.equal(calderonDom.window.document.querySelectorAll('.portal-course-ended').length, 2, 'Las dos matrículas finalizadas de Jaime Calderón deben mostrar el aviso');
calderonDom.window.close();

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
  assert.match(html, /Cerrado/, `${course.file} debe indicar estado cerrado`);
  assert.ok(closedDom.window.document.body.classList.contains('auth-ready'), `${course.file} debe permitir el ingreso cuando está asignado`);
  assert.ok(closedDom.window.document.querySelector('.aula-course-ended-notice'), `${course.file} debe mostrar el aviso de programa finalizado`);
  assert.equal(closedDom.window.document.querySelectorAll('a[href="#"]').length, 0, `${course.file} no debe conservar botones falsos después de cargar`);
  closedDom.window.close();
}

console.log('Aula Virtual: 157 usuarios, 173 asignaciones y once aulas accesibles según el historial del SIRA.');
