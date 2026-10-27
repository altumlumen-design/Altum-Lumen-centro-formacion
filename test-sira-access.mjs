import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const html = read('sira-acceso.html');
const config = read('aula-config.js');
const bridge = read('sira-bridge.js');
const endpoint = 'https://script.google.com/macros/s/AKfycbysdGK_9D_nDDrhj6pa53_4H6eOT0U3k_KBqZ1iX_Co7oTCvdEAqnE5Sac1ZRAugfZo/exec';
const release = '20261027-sira-3753-r1';
const pageUrl = 'https://altumlumen-design.github.io/Altum-Lumen-centro-formacion/sira-acceso.html';
const parsed = new JSDOM(html, { url: pageUrl });
const blocks = [...parsed.window.document.querySelectorAll('script:not([src])')];
assert.equal(blocks.length, 9, 'El mirror debe conservar los nueve bloques de la interfaz actual.');
const scripts = blocks.map((block, index) => new Script(block.textContent, {
  filename: `sira-acceso.html:${block.id || `inline-${index + 1}`}`
}));
assert.match(html, /const SIRA_CLIENT_BUILD\s*=\s*['"]3\.7\.53['"]/);
assert.match(html, /(?:máximo|de|\/|hasta)\s*15/i, 'Debe existir el límite de quince anexos.');
assert.doesNotMatch(html, /(?:máximo\s*2\s*PDF|hasta\s*dos\s*PDF|aulaSessionHasAdditional|aula-additional-toggle)/i);
assert.equal(parsed.window.document.querySelector('script[src*="sira-teacher-career"]'), null,
  'Una capa docente antigua no debe sobreescribir la interfaz sincronizada.');
for (const name of ['aula-config.js', 'sira-bridge.js']) {
  assert.ok(parsed.window.document.querySelector(`script[src="${name}?v=${release}"]`),
    `${name} debe usar la consulta de la entrega vigente.`);
}
assert.doesNotMatch(html, /script\.google\.com\/macros\/s\//,
  'El mirror debe utilizar el endpoint de aula-config.js.');
parsed.window.close();

const annex = number => ({
  slot: `A${number}`, fileId: `fixture-file-${number}`, revision: `fixture-revision-${number}`,
  kind: number === 1 ? 'LECTURA_OBLIGATORIA' : 'ANEXO',
  title: `Lectura de prueba ${number}`, name: `lectura-${number}.pdf`, size: 2048
});
const waitFor = async (predicate, description) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(`No apareció ${description}.`);
};

function createUi(role) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => {
    if (error.type !== 'css parsing') errors.push(error);
  });
  const dom = new JSDOM(html, {
    url: pageUrl, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole
  });
  const { window } = dom;
  window.scrollTo = () => {};
  window.matchMedia = query => ({ matches: false, media: query, addListener() {}, removeListener() {} });
  window.confirm = () => true;
  window.fetch = () => { throw new Error('La prueba local no puede consultar servicios externos.'); };
  window.addEventListener('error', event => errors.push(event.error || event.message));
  const user = { id: `fixture-${role}`, username: `fixture.${role.toLowerCase()}`, name: `Prueba ${role}`, role };
  const program = { id: 'PROG-TEST', name: 'Curso de prueba', type: 'CURSO', state: 'ACTIVO', year: 2026 };
  const career = { user, level: { label: 'Docente Ordinario', rate: 50 }, levels: [], history: [], totalSessions: 0 };
  const calls = [];
  let materials = [annex(1), annex(2)];
  const course = () => ({
    programId: program.id, programName: program.name, courseId: 'course-test', programType: 'CURSO',
    isCourse: true, baseSessions: 4, maxSessions: 12, scheduleOptions: [], evaluations: [],
    sessions: [{ number: 1, title: 'Sesión de prueba', materialState: 'PENDIENTE', additionalMaterials: materials }]
  });
  const dashboard = { totalStudents: 0, totalEnrollments: 0, monthIncome: 0, totalIncome: 0, topPrograms: [], recent: [] };
  const respond = (method, args) => {
    calls.push({ method, args });
    if (method === 'login') return { token: 'local-test-token', user };
    if (method === 'getSessionInfo') return user;
    assert.equal(method, 'siraApi', `RPC inesperado: ${method}`);
    assert.equal(args[0], 'local-test-token', 'Las operaciones deben enviar la sesión creada por login.');
    const [, action, values] = args;
    switch (action) {
      case 'getTeacherWorkspace': return { courses: [{ ...program, programId: program.id }], career };
      case 'getTeacherCareerProfile': return career;
      case 'getTeacherCourseCore': return { ...course(), evaluationsLoading: true };
      case 'getTeacherCourseEvaluations': return { evaluations: [] };
      case 'getAulaCourseManager': return course();
      case 'getBootstrap': return { dashboard, programs: [program] };
      case 'getDashboard': return dashboard;
      case 'listPrograms': return [program];
      case 'listAulaProgramConfigs': return [];
      case 'getOperatorAlerts': return { count: 0, alerts: [] };
      case 'runDeferredBootstrapMaintenance': return {};
      case 'uploadAulaAdditionalMaterialPayload': {
        const [programId, sessionNumber, slot, data, payload] = values;
        assert.equal(programId, program.id);
        assert.equal(sessionNumber, 1);
        assert.equal(slot, 'A3');
        assert.equal(payload.name, 'actividad.docx');
        materials = [...materials, { ...annex(3), title: data.title, name: payload.name }];
        return { additionalMaterials: materials };
      }
      default: throw new Error(`Operación simulada no definida: ${action}`);
    }
  };
  const runner = (success, failure) => new Proxy({
    withSuccessHandler(callback) { return runner(callback, failure); },
    withFailureHandler(callback) { return runner(success, callback); }
  }, {
    get(target, method) {
      if (method in target) return target[method];
      return (...args) => Promise.resolve().then(() => respond(method, args)).then(success, error => {
        errors.push(error);
        if (failure) failure(error);
      });
    }
  });
  window.google = { script: { run: runner() } };
  new Script(config, { filename: 'aula-config.js' }).runInContext(dom.getInternalVMContext());
  assert.equal(window.ALTUM_AULA_CONFIG.authEndpoint, endpoint, 'Debe conservarse la misma implementación de Apps Script.');
  for (const script of scripts) script.runInContext(dom.getInternalVMContext());
  return { dom, window, calls, errors, program };
}

function assertAnnexRows(form, expectedCount, newNumber) {
  assert.ok(form, 'Debe abrirse el formulario de sesión de la interfaz real.');
  const rows = [...form.querySelectorAll('[data-additional-slot]')];
  assert.equal(rows.length, expectedCount);
  assert.equal(form.querySelector('input.aula-additional-toggle'), null);
  for (const number of [1, 2]) {
    assert.equal(form.querySelector(`[data-additional-slot="A${number}"] .additional-slot-head b`)?.textContent,
      `Anexo ${number}`);
  }
  if (newNumber) {
    const empty = [...form.querySelectorAll('[data-existing="0"]')];
    assert.equal(empty.length, 1, 'Solo debe mostrarse un espacio nuevo.');
    assert.equal(empty[0].dataset.additionalSlot, `A${newNumber}`);
    assert.equal(empty[0].querySelector('.additional-slot-head b').textContent, `Nuevo anexo ${newNumber} de 15`);
    for (const extension of ['.pdf', '.docx', '.xlsx', '.zip']) {
      assert.ok(empty[0].querySelector('.additional-pdf').accept.includes(extension));
    }
  } else {
    assert.equal(form.querySelector('[data-existing="0"]'), null, 'Con quince guardados no debe aparecer un anexo 16.');
  }
  return rows;
}

for (const role of ['DOCENTE', 'OPERADOR']) {
  const ui = createUi(role);
  const { window, dom, calls, errors, program } = ui;
  try {
    window.document.getElementById('loginUser').value = `fixture.${role.toLowerCase()}`;
    window.document.getElementById('loginPass').value = 'contraseña-simulada';
    await window.doLogin();
    assert.equal(window.document.documentElement.dataset.siraBuild, '3.7.53');
    assert.equal(window.document.documentElement.dataset.siraRole, role);
    assert.ok(window.document.getElementById('loginScreen').classList.contains('hidden'));
    if (role === 'DOCENTE') {
      await waitFor(() => window.document.querySelector('#teacherWorkspaceRoot .teacher-course-card'), 'el curso del docente');
      await window.openTeacherCourse_(program.id);
      await waitFor(() => calls.some(call => call.method === 'siraApi' && call.args[1] === 'getTeacherCourseEvaluations'),
        'la carga diferida de evaluaciones');
      assert.ok(window.document.getElementById('view-dashboard').classList.contains('hidden'));
    } else {
      await waitFor(() => calls.some(call => call.method === 'siraApi' && call.args[1] === 'getBootstrap'), 'el inicio del operador');
      await window.openCourseManager(program.id);
      assert.ok(window.document.getElementById('view-teacher').classList.contains('hidden'));
    }
    const form = window.document.querySelector(role === 'DOCENTE' ? 'form.teacher-aula-session' : '#aulaManagerSessions form');
    assertAnnexRows(form, 3, 3);
    if (role === 'DOCENTE') {
      const slot = form.querySelector('[data-additional-slot="A3"]');
      slot.querySelector('.additional-title').value = 'Actividad de práctica';
      Object.defineProperty(slot.querySelector('.additional-pdf'), 'files', { configurable: true, value: [{
        name: 'actividad.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 3,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer
      }] });
      await window.teacherUploadAdditional_(slot.querySelector('.btn.primary'), program.id, 1, 'A3');
      assertAnnexRows(form, 4, 4);
      assert.equal(form.querySelector('[data-additional-slot="A3"] .additional-current-name b').textContent, 'actividad.docx');
      assert.equal(form.querySelector('summary strong').textContent, '3/15');
    }
    const source = form.querySelector('[data-additional-slot="A1"]');
    const fifteen = Array.from({ length: 15 }, (_, index) => annex(index + 1));
    window.aulaRefreshAdditionalSession_(source, fifteen, program.id, 1, role === 'DOCENTE');
    assertAnnexRows(form, 15, null);
    assert.equal(window.aulaValidateAdditionalCollection_(form, 1).length, 15);
    const grid = form.querySelector('.aula-additional-grid');
    grid.insertAdjacentHTML('beforeend', window.aulaAdditionalSlotHtml_(annex(16), 16, program.id, 1, role === 'DOCENTE'));
    assert.throws(() => window.aulaValidateAdditionalCollection_(form, 1), /máximo de 15/,
      'La validación debe rechazar dieciséis anexos activos.');
    assert.deepEqual(errors, [], `La interfaz ${role} no debe producir errores.`);
  } finally {
    dom.window.close();
  }
}

// Ejecuta el puente completo: ninguna llamada sale del DOM de prueba.
const bridgeDom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: pageUrl, runScripts: 'outside-only'
});
try {
  const { window } = bridgeDom;
  const delays = [];
  let timerId = 0;
  window.setTimeout = (_callback, delay) => { delays.push(delay); return ++timerId; };
  window.clearTimeout = () => {};
  window.HTMLFormElement.prototype.submit = function () {
    assert.equal(this.action, endpoint);
    const requestId = this.querySelector('[name="requestId"]').value;
    window.dispatchEvent(new window.MessageEvent('message', {
      origin: 'https://script.google.com',
      data: { source: 'SIRA_PORTAL_RPC', requestId, payload: { ok: true, result: 'local-ok' } }
    }));
  };
  new Script(config, { filename: 'aula-config.js' }).runInContext(bridgeDom.getInternalVMContext());
  new Script(bridge, { filename: 'sira-bridge.js' }).runInContext(bridgeDom.getInternalVMContext());
  for (const [method, args, expectedTimeout] of [
    ['login', ['fixture.docente', 'contraseña-simulada'], 60000],
    ['siraApi', ['local-test-token', 'getTeacherCourseCore', ['PROG-TEST']], 90000],
    ['siraApi', ['local-test-token', 'uploadAulaAdditionalMaterialPayload', ['PROG-TEST', 1, 'A3', {}, { base64: 'AQID' }]], 345000],
    ['siraApi', ['local-test-token', 'exportStudentsExcel', []], 345000]
  ]) {
    delays.length = 0;
    const result = await new Promise((resolve, reject) => {
      window.google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[method](...args);
    });
    assert.equal(result, 'local-ok');
    assert.equal(delays.find(delay => delay > 0), expectedTimeout,
      `El puente debe escoger el plazo correcto para ${method === 'siraApi' ? args[1] : method}.`);
  }
} finally {
  bridgeDom.window.close();
}

console.log('SIRA 3.7.53: nueve scripts válidos; acceso docente y operador, anexos progresivos hasta 15 y plazos RPC verificados sin servicios externos.');
