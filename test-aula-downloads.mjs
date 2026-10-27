import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

const authSource = await readFile(new URL('./aula-auth.js', import.meta.url), 'utf8');
const courseSource = await readFile(new URL('./aula-dynamic-course.js', import.meta.url), 'utf8');
const pdfBytes = Buffer.from('%PDF-1.7\nSynthetic classroom download\n');
const filePayload = () => ({ ok: true, name: 'synthetic-material.pdf', mime: 'application/pdf', size: pdfBytes.length, base64: pdfBytes.toString('base64') });
const courseId = 'synthetic-course';
const sources = { aulaAuth: 'SIRA_AULA_AUTH', aulaCourse: 'SIRA_AULA_COURSE', aulaMaterialFile: 'SIRA_AULA_MATERIAL', aulaSession: 'SIRA_AULA_SESSION' };

function courseFixture(count = 1, revision = 'revision-1') {
  return {
    id: courseId, title: 'Synthetic classroom', shortTitle: 'Synthetic classroom', sessions: [{
      id: `${courseId}-S01`, number: 1, title: 'Synthetic session',
      additionalMaterials: Array.from({ length: count }, (_, i) => ({ slot: `A${i + 1}`, kind: 'ANEXO', title: `Synthetic document ${i + 1}`, name: `synthetic-${i + 1}.pdf`, revision: `${revision}-${i + 1}` }))
    }], evaluations: []
  };
}

async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function withFixture(options, run) {
  const errors = [], console = new VirtualConsole();
  console.on('jsdomError', error => { if (!/navigation \(except hash changes\)/.test(error.message)) errors.push(error); });
  const dom = new JSDOM('<!doctype html><body><div id="courseUserArea"></div><div id="dynamicLoading"></div><div id="dynamicError" hidden></div><p id="dynamicErrorMessage"></p><div id="dynamicCourse" hidden></div></body>', {
    url: `https://classroom.example.test/curso.html?id=${courseId}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console
  });
  const { window } = dom;
  await new Promise(resolve => window.document.readyState === 'complete' ? resolve() : window.addEventListener('load', resolve, { once: true }));
  const role = options.role || 'student';
  const user = { dni: '00000000', studentCode: `SYNTHETIC-${role.toUpperCase()}`, name: 'Synthetic Test User', role, courses: [courseId], courseSummaries: [] };
  const session = { ...user, displayName: user.name, token: `synthetic-${role}-token`, validatedAt: new Date().toISOString() };
  if (options.session !== false) window.sessionStorage.setItem('altum_aula_session_v7', JSON.stringify(session));
  window.ALTUM_AULA_CONFIG = { authEndpoint: 'https://script.google.com/macros/s/SYNTHETIC/exec', authTimeoutMs: 20000 };
  const requests = [], timers = new Map(), liveUrls = new Map(), revoked = [], anchorClicks = [], messageListeners = new Set();
  let nextTimer = 100000, nextUrl = 0, submitError = false, autoClickBlocked = options.blockAuto === true, courseRequests = 0;
  const setTimeoutNative = window.setTimeout.bind(window), clearTimeoutNative = window.clearTimeout.bind(window);
  window.setTimeout = (fn, ms, ...args) => {
    if (ms >= 20000) { const id = ++nextTimer; timers.set(id, { fn: () => fn(...args), ms }); return id; }
    return setTimeoutNative(fn, ms, ...args);
  };
  window.clearTimeout = id => { if (!timers.delete(id)) clearTimeoutNative(id); };
  const addEventListenerNative = window.addEventListener.bind(window), removeEventListenerNative = window.removeEventListener.bind(window);
  window.addEventListener = (type, fn, ...rest) => { if (type === 'message') messageListeners.add(fn); return addEventListenerNative(type, fn, ...rest); };
  window.removeEventListener = (type, fn, ...rest) => { if (type === 'message') messageListeners.delete(fn); return removeEventListenerNative(type, fn, ...rest); };
  window.URL.createObjectURL = blob => { const url = `blob:https://classroom.example.test/synthetic-${++nextUrl}`; liveUrls.set(url, blob); return url; };
  window.URL.revokeObjectURL = url => { revoked.push(url); liveUrls.delete(url); };
  window.document.addEventListener('click', event => { if (event.target.closest('a[href^="blob:"]')) event.preventDefault(); });
  window.HTMLAnchorElement.prototype.click = function () {
    anchorClicks.push({ href: this.href, download: this.download });
    if (autoClickBlocked) { autoClickBlocked = false; throw new Error('Synthetic browser blocked automatic download'); }
    this.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  window.HTMLFormElement.prototype.submit = function () {
    if (submitError) throw new Error('Synthetic form submission failure');
    const params = Object.fromEntries(new window.FormData(this));
    const frame = [...window.document.querySelectorAll('iframe')].find(item => item.name === this.target);
    assert.equal(frame?.referrerPolicy, 'no-referrer');
    assert.match(params.requestId, /^altum-[a-f0-9]{32}$/);
    requests.push(params);
    const emit = (payload, overrides = {}) => window.dispatchEvent(new window.MessageEvent('message', {
      origin: overrides.origin || 'https://synthetic-script.googleusercontent.com',
      data: { source: sources[params.action], requestId: params.requestId, payload, ...overrides.data }
    }));
    Promise.resolve().then(async () => {
      let payload;
      if (options.reply) payload = await options.reply(params, emit);
      else if (params.action === 'aulaAuth' || params.action === 'aulaSession') payload = { ok: true, user, token: session.token };
      else if (params.action === 'aulaCourse') {
        courseRequests += 1;
        payload = options.replyCourse ? await options.replyCourse(courseRequests, params) : { ok: true, course: courseFixture(options.count || 1) };
      } else if (params.action === 'aulaMaterialFile') payload = options.replyMaterial ? await options.replyMaterial(params) : filePayload();
      if (payload !== undefined) emit(payload);
    }).catch(error => errors.push(error));
  };
  const fixture = {
    dom, window, requests, timers, liveUrls, revoked, anchorClicks, errors, messageListeners,
    buttons: () => [...window.document.querySelectorAll('[data-additional-action]')],
    feedback: () => window.document.querySelector('[data-material-feedback]'),
    setSubmitError: value => { submitError = value; },
    flushTimers: ms => { for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); } }
  };
  try {
    window.eval(authSource);
    if (options.dynamic !== false) {
      window.eval(courseSource);
      await waitFor(() => fixture.buttons().length, 'dynamic classroom');
    }
    await run(fixture);
    assert.deepEqual(errors.map(error => error.message), [], 'No unexpected browser errors');
  } finally {
    window.dispatchEvent(new window.Event('pagehide'));
    dom.window.close();
  }
}

let passed = 0;
async function test(name, run) { await run(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

for (const count of [16, 40]) {
  await test(`student sees all ${count} session annexes with accessible list and download actions`, () => withFixture({ count }, async ({ window, buttons }) => {
    assert.equal(buttons().length, count);
    const disclosure = window.document.querySelector('.session-additional-disclosure');
    assert.ok(disclosure);
    assert.equal(disclosure.querySelector('summary strong').textContent, `${count} archivos`);
    assert.equal(disclosure.querySelectorAll('.session-additional-row').length, count);
    const last = buttons()[count - 1];
    assert.equal(last.dataset.slot, `A${count}`);
    assert.equal(last.getAttribute('aria-label'), `Descargar: Synthetic document ${count}`);
    assert.match(disclosure.textContent, new RegExp(`synthetic-${count}\\.pdf`));
    last.click();
    await waitFor(() => window.document.querySelector('[data-material-save]'), 'last annex prepared');
  }));
}

for (const role of ['student', 'master']) {
  await test(`${role}: signed-session material request through actual form bridge`, () => withFixture({ dynamic: false, session: false, role }, async ({ window, requests, messageListeners }) => {
    const login = await window.AltumAuth.authenticate('00000000', '00000000');
    assert.equal(login.ok, true);
    assert.equal(login.session.role, role);
    const result = await window.AltumAuth.fetchAdditionalMaterial(courseId, 1, 'A1', 'revision-1');
    assert.equal(result.base64, filePayload().base64);
    assert.equal(requests.at(-1).token, `synthetic-${role}-token`);
    assert.equal(new Set(requests.map(request => request.requestId)).size, requests.length);
    assert.equal(window.document.querySelectorAll('iframe, form').length, 0);
    assert.equal(messageListeners.size, 0);
  }));
}

await test('bridge ignores untrusted origin, source and request identifier', () => withFixture({ dynamic: false, reply: (_params, emit) => {
  emit({ ok: false }, { origin: 'https://untrusted.example.test' });
  emit({ ok: false }, { data: { source: 'OTHER_BRIDGE' } });
  emit({ ok: false }, { data: { requestId: 'wrong-request' } });
  return filePayload();
} }, async ({ window }) => {
  const result = await window.AltumAuth.fetchAdditionalMaterial(courseId, 1, 'A1', 'revision-1');
  assert.equal(result.ok, true);
  assert.equal(result.name, 'synthetic-material.pdf');
}));

await test('submission failure resolves with cleanup', () => withFixture({ dynamic: false }, async ({ window, setSubmitError, timers, messageListeners }) => {
  setSubmitError(true);
  const result = await window.AltumAuth.fetchAdditionalMaterial(courseId, 1, 'A1', 'revision-1');
  assert.equal(result.code, 'REQUEST_FAILED');
  assert.equal(window.document.querySelectorAll('iframe, form').length, 0);
  assert.equal(timers.size, 0);
  assert.equal(messageListeners.size, 0);
}));

await test('90 second material timeout resolves with cleanup and retry guidance', () => withFixture({ dynamic: false, reply: () => undefined }, async ({ window, flushTimers, timers, messageListeners }) => {
  const pending = window.AltumAuth.fetchAdditionalMaterial(courseId, 1, 'A1', 'revision-1');
  flushTimers(90000);
  const result = await pending;
  assert.equal(result.code, 'REQUEST_TIMEOUT');
  assert.match(result.message, /archivo.*Descargar/);
  assert.equal(window.document.querySelectorAll('iframe, form').length, 0);
  assert.equal(timers.size, 0);
  assert.equal(messageListeners.size, 0);
}));

await test('actual button prepares verified bytes and reuses its explicit save link after automatic download is blocked', () => withFixture({ blockAuto: true }, async ({ window, buttons, feedback, liveUrls, anchorClicks, revoked, requests }) => {
  buttons()[0].click();
  await waitFor(() => window.document.querySelector('[data-material-save]'), 'persistent save link');
  const link = window.document.querySelector('[data-material-save]');
  assert.equal(link.textContent, 'Guardar archivo');
  assert.equal(link.download, 'synthetic-material.pdf');
  assert.equal(link.target, '_self', 'El guardado no hereda el destino superior de una página embebida.');
  assert.match(link.getAttribute('aria-label'), /synthetic-material\.pdf/);
  assert.match(feedback().textContent, /Archivo preparado/);
  const blob = liveUrls.get(link.href);
  assert.equal(blob.size, pdfBytes.length);
  const bytes = await new Promise((resolve, reject) => { const reader = new window.FileReader(); reader.onload = () => resolve(Buffer.from(reader.result)); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
  assert.deepEqual(bytes, pdfBytes);
  link.click();
  assert.equal(anchorClicks.length, 2);
  assert.match(feedback().textContent, /Descarga solicitada/);
  assert.equal(link.isConnected, true);
  assert.equal(buttons()[0].disabled, false);
  const oldUrl = link.href;
  buttons()[0].click();
  assert.equal(window.document.querySelector('[data-material-save]').href, oldUrl);
  assert.equal(liveUrls.size, 1);
  assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 1, 'same authorized in-memory bytes need no second transfer');
  assert.equal(anchorClicks.length, 3);
  assert.equal(revoked.includes(oldUrl), false);
}));

for (const change of ['token', 'revision', 'course', 'session', 'slot', 'resource']) {
  await test(`prepared file is not reused after its ${change} changes`, () => withFixture({}, async ({ window, buttons, liveUrls, requests, revoked }) => {
    const button = buttons()[0]; button.click();
    await waitFor(() => window.document.querySelector('[data-material-save]'), 'initial prepared file');
    const originalUrl = window.document.querySelector('[data-material-save]').href;
    if (change === 'token') {
      const session = window.AltumAuth.getSession();
      window.sessionStorage.setItem('altum_aula_session_v7', JSON.stringify({ ...session, token: 'synthetic-new-token' }));
    } else if (change === 'resource') button.dataset.materialResource = 'MAIN';
    else button.dataset[change] += '-changed';
    button.click();
    await waitFor(() => window.document.querySelector('[data-material-save]')?.href !== originalUrl && liveUrls.size === 1, 'fresh authorized transfer');
    assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 2);
    assert.ok(revoked.includes(originalUrl));
    if (change === 'token') assert.equal(requests.at(-1).token, 'synthetic-new-token');
    if (change === 'resource') assert.equal(requests.at(-1).resource, 'MAIN');
  }));
}

await test('expired prepared bytes cannot be reused even before a suspended expiry timer runs', () => withFixture({}, async ({ window, buttons, liveUrls, requests, revoked }) => {
  const button = buttons()[0]; button.click();
  await waitFor(() => window.document.querySelector('[data-material-save]'), 'initial file before suspended timer');
  const oldUrl = window.document.querySelector('[data-material-save]').href;
  const now = window.Date.now(); window.Date.now = () => now + 300001;
  button.click();
  await waitFor(() => window.document.querySelector('[data-material-save]')?.href !== oldUrl && liveUrls.size === 1, 'fresh file after expiry');
  assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 2);
  assert.ok(revoked.includes(oldUrl));
}));

await test('a response for an old token does not prepare a file for a changed session', () => {
  let release;
  return withFixture({ replyMaterial: () => new Promise(resolve => { release = resolve; }) }, async ({ window, buttons, feedback, liveUrls }) => {
    buttons()[0].click(); await waitFor(() => release, 'pending old-session transfer');
    const session = window.AltumAuth.getSession();
    window.sessionStorage.setItem('altum_aula_session_v7', JSON.stringify({ ...session, token: 'synthetic-new-token' }));
    release(filePayload());
    await waitFor(() => !buttons()[0].disabled, 'changed-session response ignored');
    assert.equal(liveUrls.size, 0);
    assert.equal(window.document.querySelector('[data-material-save]'), null);
    assert.match(feedback().textContent, /sesión o el material cambió/);
  });
});

await test('the explicit save link retires prepared bytes when its user changes', () => withFixture({}, async ({ window, buttons, liveUrls, requests }) => {
  buttons()[0].click(); await waitFor(() => window.document.querySelector('[data-material-save]'), 'save link before user change');
  const link = window.document.querySelector('[data-material-save]');
  const session = window.AltumAuth.getSession();
  window.sessionStorage.setItem('altum_aula_session_v7', JSON.stringify({ ...session, token: 'synthetic-other-user-token' }));
  link.click();
  assert.equal(link.isConnected, false);
  assert.equal(liveUrls.size, 0);
  assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 1);
}));

await test('repeated principal download also reuses its verified prepared bytes', () => withFixture({ replyCourse: () => {
  const course = courseFixture();
  Object.assign(course.sessions[0], { materialState: 'DISPONIBLE', materialDelivery: 'SIRA', materialRevision: 'main-revision' });
  return { ok: true, course };
} }, async ({ window, liveUrls, requests, anchorClicks }) => {
  const button = window.document.querySelector('[data-material-resource="MAIN"]'); button.click();
  await waitFor(() => window.document.querySelector('[data-material-save]'), 'prepared principal');
  const url = window.document.querySelector('[data-material-save]').href;
  button.click();
  assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 1);
  assert.equal(window.document.querySelector('[data-material-save]').href, url);
  assert.equal(liveUrls.size, 1);
  assert.equal(anchorClicks.length, 2);
}));

for (const code of ['ACCESS_DENIED', 'MATERIAL_UNAVAILABLE', 'PRIVATE_REQUIRED']) {
  await test(`${code}: persistent visible alert with retry and no file`, () => withFixture({ replyMaterial: () => ({ ok: false, code, message: `Synthetic ${code} explanation.` }) }, async ({ buttons, feedback, timers, liveUrls }) => {
    buttons()[0].click();
    await waitFor(() => feedback()?.getAttribute('role') === 'alert', 'persistent material error');
    assert.equal(feedback().textContent, `Synthetic ${code} explanation.`);
    assert.equal(buttons()[0].textContent, 'Descargar');
    assert.equal(buttons()[0].disabled, false);
    assert.equal(liveUrls.size, 0);
    assert.equal([...timers.values()].some(timer => timer.ms === 2800), false);
  }));
}

await test('invalid, truncated and oversized payloads never create save links', () => {
  const replies = [{ ...filePayload(), size: pdfBytes.length + 1 }, { ...filePayload(), size: undefined }, { ...filePayload(), base64: '!invalid!' }, { ...filePayload(), size: 16 * 1024 * 1024 }];
  return withFixture({ replyMaterial: () => replies.shift() }, async ({ buttons, feedback, liveUrls, window, requests }) => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      buttons()[0].click();
      await waitFor(() => requests.filter(request => request.action === 'aulaMaterialFile').length === attempt && feedback()?.getAttribute('role') === 'alert', 'invalid payload error');
      assert.equal(liveUrls.size, 0);
      assert.equal(window.document.querySelector('[data-material-save]'), null);
    }
  });
});

await test('revision conflict refreshes the real course and requires another selection before downloading', () => {
  let materialRequests = 0;
  return withFixture({
    replyCourse: count => ({ ok: true, course: courseFixture(1, count === 1 ? 'revision-1' : 'revision-2') }),
    replyMaterial: () => ++materialRequests === 1 ? { ok: false, code: 'MATERIAL_CHANGED', message: 'Synthetic revision conflict.' } : filePayload()
  }, async ({ window, buttons, liveUrls, requests }) => {
    buttons()[0].click();
    await waitFor(() => window.document.querySelector('[data-material-course-notice]'), 'refreshed material list');
    assert.equal(requests.filter(request => request.action === 'aulaCourse').length, 2);
    assert.equal(materialRequests, 1);
    assert.equal(liveUrls.size, 0);
    assert.equal(buttons()[0].dataset.revision, 'revision-2-1');
    assert.match(window.document.querySelector('[role="alert"]').textContent, /selecciona nuevamente/);
    buttons()[0].click();
    await waitFor(() => liveUrls.size === 1, 'explicit selection after refresh');
    assert.equal(materialRequests, 2);
    assert.equal(requests.at(-1).revision, 'revision-2-1');
  });
});

await test('failed conflict refresh leaves a persistent error instead of repeating the stale download', () => withFixture({
  replyCourse: count => count === 1 ? { ok: true, course: courseFixture() } : { ok: false, message: 'Synthetic refresh failure.' },
  replyMaterial: () => ({ ok: false, code: 'MATERIAL_CHANGED' })
}, async ({ buttons, feedback, liveUrls, requests }) => {
  buttons()[0].click();
  await waitFor(() => feedback()?.textContent === 'Synthetic refresh failure.', 'refresh failure');
  assert.equal(feedback().getAttribute('role'), 'alert');
  assert.equal(buttons()[0].disabled, false);
  assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 1);
  assert.equal(liveUrls.size, 0);
}));

await test('expired session is cleared and login recovery preserves the course', () => withFixture({ replyMaterial: () => ({ ok: false, code: 'SESSION_EXPIRED', message: 'Synthetic expired session.' }) }, async ({ window, buttons, feedback, liveUrls }) => {
  buttons()[0].click();
  await waitFor(() => window.document.querySelector('[data-material-login]'), 'login recovery');
  assert.equal(window.AltumAuth.getSession(), null);
  const loginUrl = new URL(window.document.querySelector('[data-material-login]').href);
  assert.equal(loginUrl.pathname, '/aula-virtual.html');
  assert.equal(loginUrl.searchParams.get('login'), '1');
  assert.equal(loginUrl.searchParams.get('nextCourse'), courseId);
  assert.equal(feedback().getAttribute('role'), 'alert');
  assert.equal(liveUrls.size, 0);
}));

await test('only three files remain prepared and each link expires after five minutes', () => withFixture({ count: 4 }, async ({ window, buttons, liveUrls, revoked, flushTimers, timers }) => {
  for (let index = 0; index < 4; index += 1) {
    buttons()[index].click();
    await waitFor(() => !buttons()[index].disabled && window.document.querySelectorAll('[data-material-save]').length === Math.min(3, index + 1), `prepared file ${index + 1}`);
  }
  assert.equal(liveUrls.size, 3);
  assert.equal(revoked.length, 1);
  assert.equal([...timers.values()].filter(timer => timer.ms === 300000).length, 3);
  flushTimers(300000);
  assert.equal(liveUrls.size, 0);
  assert.equal(window.document.querySelectorAll('[data-material-save]').length, 0);
  assert.equal(revoked.length, 4);
  assert.match(window.document.querySelectorAll('[data-material-feedback]')[3].textContent, /enlace de descarga venció/);
}));

await test('pagehide revokes prepared files and clears their expiry timers', () => withFixture({}, async ({ window, buttons, liveUrls, timers }) => {
  buttons()[0].click();
  await waitFor(() => liveUrls.size === 1, 'prepared file before leaving');
  window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(liveUrls.size, 0);
  assert.equal(window.document.querySelector('[data-material-save]'), null);
  assert.equal([...timers.values()].some(timer => timer.ms === 300000), false);
}));

await test('a response arriving after pagehide does not allocate an inaccessible file', () => {
  let release;
  return withFixture({ replyMaterial: () => new Promise(resolve => { release = resolve; }) }, async ({ window, buttons, requests, liveUrls }) => {
    buttons()[0].click();
    await waitFor(() => release && requests.some(request => request.action === 'aulaMaterialFile'), 'pending download');
    window.dispatchEvent(new window.Event('pagehide'));
    release(filePayload());
    await waitFor(() => !buttons()[0].disabled, 'late response cleanup');
    assert.equal(liveUrls.size, 0);
    assert.equal(window.document.querySelector('[data-material-save]'), null);
  });
});

for (const role of ['student', 'master']) {
  await test(`${role}: managed main material uses the authenticated bridge and persistent save fallback`, () => withFixture({
    role, blockAuto: true,
    replyCourse: () => {
      const course = courseFixture();
      Object.assign(course.sessions[0], { materialState: 'DISPONIBLE', materialFileId: 'SYNTHETIC_MAIN_FILE', materialUrl: 'https://drive.google.com/file/d/SYNTHETIC_MAIN_FILE/view', materialName: 'synthetic-main.pdf', materialDelivery: 'SIRA', materialRevision: 'main-revision-1' });
      return { ok: true, course };
    }
  }, async ({ window, requests, liveUrls }) => {
    const main = window.document.querySelector('[data-material-resource="MAIN"]');
    assert.ok(main);
    assert.equal(window.document.querySelector('a[href*="drive.google.com"], a[href*="drive.usercontent.google.com"]'), null);
    main.click();
    await waitFor(() => main.closest('.material-download-actions').querySelector('[data-material-save]'), 'main material save fallback');
    const request = requests.find(item => item.action === 'aulaMaterialFile');
    assert.equal(request.resource, 'MAIN');
    assert.equal(request.courseId, courseId);
    assert.equal(request.sessionNumber, '1');
    assert.equal(request.revision, 'main-revision-1');
    assert.equal(request.slot, undefined);
    assert.equal(request.token, `synthetic-${role}-token`);
    assert.equal(liveUrls.size, 1);
    assert.match(main.closest('.material-download-actions').textContent, /Archivo preparado.*Guardar archivo/);
  }));
}

await test('a stored main file ID remains downloadable without a public URL', () => withFixture({ replyCourse: () => {
  const course = courseFixture();
  Object.assign(course.sessions[0], { materialState: 'DISPONIBLE', materialFileId: 'SYNTHETIC_PRIVATE_MAIN', materialRevision: 'main-revision-1' });
  return { ok: true, course };
} }, async ({ window, liveUrls }) => {
  const main = window.document.querySelector('[data-material-resource="MAIN"]');
  assert.ok(main);
  main.click();
  await waitFor(() => liveUrls.size === 1, 'main file without public URL');
}));

await test('opaque SIRA delivery supports main files without exposing a Drive ID or URL', () => withFixture({ replyCourse: () => {
  const course = courseFixture();
  Object.assign(course.sessions[0], { materialState: 'DISPONIBLE', materialDelivery: 'SIRA', materialRevision: 'opaque-main-revision' });
  return { ok: true, course };
} }, async ({ window, requests, liveUrls }) => {
  const main = window.document.querySelector('[data-material-resource="MAIN"]');
  assert.ok(main);
  main.click();
  await waitFor(() => liveUrls.size === 1, 'opaque main delivery');
  const request = requests.find(item => item.action === 'aulaMaterialFile');
  assert.equal(request.resource, 'MAIN');
  assert.equal(request.revision, 'opaque-main-revision');
  assert.equal(request.fileId, undefined);
  assert.equal(request.url, undefined);
}));

await test('NO_CORRESPONDE suppresses a stale main URL and file ID', () => withFixture({ replyCourse: () => {
  const course = courseFixture();
  Object.assign(course.sessions[0], { materialState: 'NO_CORRESPONDE', materialFileId: 'SYNTHETIC_STALE_MAIN', materialUrl: 'https://drive.google.com/file/d/SYNTHETIC_STALE_MAIN/view', materialDelivery: 'SIRA' });
  return { ok: true, course };
} }, async ({ window, requests }) => {
  assert.equal(window.document.querySelector('[data-material-resource="MAIN"]'), null);
  assert.equal(window.document.querySelector('a[href*="SYNTHETIC_STALE_MAIN"]'), null);
  assert.match(window.document.querySelector('.class-session-actions').textContent, /No corresponde/);
  assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 0);
}));

await test('external main resources keep their original open link and never request a SIRA file', () => withFixture({ replyCourse: () => {
  const course = courseFixture();
  Object.assign(course.sessions[0], { materialState: 'DISPONIBLE', materialUrl: 'https://resources.example.test/d/synthetic-notes.pdf' });
  return { ok: true, course };
} }, async ({ window, requests, liveUrls }) => {
  assert.equal(window.document.querySelector('[data-material-resource="MAIN"]'), null);
  const external = window.document.querySelector('a[href="https://resources.example.test/d/synthetic-notes.pdf"]');
  assert.ok(external);
  assert.equal(external.textContent, 'Abrir');
  external.click();
  assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 0);
  assert.equal(liveUrls.size, 0);
}));

await test('a missing main material remains pending even when the response supports SIRA delivery', () => withFixture({ replyCourse: () => {
  const course = courseFixture();
  Object.assign(course.sessions[0], { materialState: 'PENDIENTE', materialDelivery: 'SIRA', materialRevision: '' });
  return { ok: true, course };
} }, async ({ window }) => {
  assert.equal(window.document.querySelector('[data-material-resource="MAIN"]'), null);
}));

await test('main material revision conflict refreshes its button without downloading the replacement', () => withFixture({
  replyCourse: count => {
    const course = courseFixture();
    Object.assign(course.sessions[0], { materialState: 'DISPONIBLE', materialFileId: `SYNTHETIC_MAIN_${count}`, materialDelivery: 'SIRA', materialRevision: `main-revision-${count}` });
    return { ok: true, course };
  },
  replyMaterial: () => ({ ok: false, code: 'MATERIAL_CHANGED' })
}, async ({ window, requests, liveUrls }) => {
  window.document.querySelector('[data-material-resource="MAIN"]').click();
  await waitFor(() => window.document.querySelector('[data-material-course-notice]'), 'refreshed main material');
  assert.equal(window.document.querySelector('[data-material-resource="MAIN"]').dataset.revision, 'main-revision-2');
  assert.equal(requests.filter(request => request.action === 'aulaMaterialFile').length, 1);
  assert.equal(liveUrls.size, 0);
}));

await test('actual download button shows a persistent timeout message and enables another attempt', () => withFixture({ replyMaterial: () => undefined }, async ({ buttons, feedback, requests, flushTimers, messageListeners }) => {
  buttons()[0].click();
  await waitFor(() => requests.some(request => request.action === 'aulaMaterialFile'), 'unanswered material request');
  flushTimers(90000);
  await waitFor(() => feedback()?.getAttribute('role') === 'alert', 'persistent timeout feedback');
  assert.match(feedback().textContent, /archivo.*Descargar/);
  assert.equal(buttons()[0].disabled, false);
  assert.equal(messageListeners.size, 0);
}));

process.stdout.write(`Aula downloads: ${passed} tests passed using synthetic users and actual production handlers.\n`);
