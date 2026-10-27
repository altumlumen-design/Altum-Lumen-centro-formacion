import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const source = await readFile(new URL('./sira-download.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./sira-download.html', import.meta.url), 'utf8');
const nonce = '0123456789abcdef0123456789abcdef';
const origin = 'https://n-synthetic-0lu-script.googleusercontent.com';
const bytes = Buffer.from('%PDF-1.7\nSynthetic authorized material\n');
const payload = () => ({ name: 'synthetic.pdf', mime: 'application/pdf', size: bytes.length, base64: bytes.toString('base64') });

async function fixture(options, run) {
  const dom = new JSDOM(html, { url: `https://altumlumen-design.github.io/Altum-Lumen-centro-formacion/sira-download.html#${options.nonce ?? nonce}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const notices = [], intervals = new Map(), timers = new Map(), urls = new Map(), revoked = [], clicks = [];
  const opener = { postMessage: (message, targetOrigin) => notices.push({ message, targetOrigin }) };
  window.opener = options.noOpener ? null : opener;
  let id = 0;
  window.setInterval = (fn, ms) => { const key = ++id; intervals.set(key, { fn, ms }); return key; };
  window.clearInterval = key => intervals.delete(key);
  window.setTimeout = (fn, ms) => { const key = ++id; timers.set(key, { fn, ms }); return key; };
  window.clearTimeout = key => timers.delete(key);
  window.URL.createObjectURL = blob => { const url = `blob:https://altumlumen-design.github.io/test-${++id}`; urls.set(url, blob); return url; };
  window.URL.revokeObjectURL = url => { revoked.push(url); urls.delete(url); };
  window.HTMLAnchorElement.prototype.click = function () {
    clicks.push({ href: this.href, download: this.download });
    if (options.blockAuto) throw new Error('Synthetic automatic download restriction');
    this.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  window.document.addEventListener('click', event => event.preventDefault());
  const send = (overrides = {}) => window.dispatchEvent(new window.MessageEvent('message', {
    source: overrides.source ?? opener, origin: overrides.origin ?? origin,
    data: overrides.data ?? { source: 'SIRA_DOWNLOAD_PAYLOAD', nonce, payload: payload() }
  }));
  const flush = ms => { for (const [key, timer] of [...timers]) if (timer.ms === ms) { timers.delete(key); timer.fn(); } };
  try {
    window.eval(source);
    await run({ window, opener, notices, intervals, timers, urls, revoked, clicks, send, flush, save: window.document.getElementById('saveFile'), status: window.document.getElementById('status') });
  } finally { window.dispatchEvent(new window.Event('pagehide')); window.close(); }
}

let passed = 0;
async function test(name, run) { await run(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

await test('fragment removed immediately and READY contains only the nonce', () => fixture({}, ({ window, notices, intervals }) => {
  assert.equal(window.location.hash, '');
  assert.equal(notices.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(notices[0])), { message: { source: 'SIRA_DOWNLOAD_READY', nonce }, targetOrigin: '*' });
  assert.equal([...intervals.values()][0].ms, 500);
  [...intervals.values()][0].fn();
  assert.equal(notices.length, 2);
}));

for (const invalid of [{ noOpener: true }, { nonce: '' }, { nonce: 'short' }, { nonce: 'z'.repeat(32) }]) {
  await test(`invalid entry fails without handshake: ${JSON.stringify(invalid)}`, () => fixture(invalid, ({ notices, timers, intervals, save, status }) => {
    assert.equal(notices.length, 0); assert.equal(timers.size, 0); assert.equal(intervals.size, 0);
    assert.equal(save.hidden, true); assert.equal(status.getAttribute('role'), 'alert');
  }));
}

await test('wrong source, origin, nonce and message name are ignored before valid delivery', () => fixture({}, ({ send, save, urls, notices }) => {
  send({ source: { postMessage() {} } });
  for (const untrusted of ['null', 'http://script.google.com', 'https://other.googleusercontent.com', 'https://script.google.com.attacker.test', 'https://x-script.googleusercontent.com.attacker.test', 'https://other.github.io']) send({ origin: untrusted });
  send({ data: { source: 'SIRA_DOWNLOAD_PAYLOAD', nonce: 'f'.repeat(32), payload: payload() } });
  send({ data: { source: 'OTHER', nonce, payload: payload() } });
  assert.equal(urls.size, 0); assert.equal(save.hidden, true); assert.equal(notices.length, 1);
  send(); assert.equal(urls.size, 1); assert.equal(save.hidden, false);
}));

await test('verified PDF bytes prepare a persistent real download after auto-save is blocked', () => fixture({ blockAuto: true }, async ({ window, send, save, urls, notices, timers, intervals, clicks, status }) => {
  send();
  assert.equal(save.download, 'synthetic.pdf'); assert.equal(save.hidden, false);
  assert.match(status.textContent, /Archivo preparado/); assert.equal(status.getAttribute('role'), 'status');
  assert.equal(intervals.size, 0); assert.equal([...timers.values()].some(timer => timer.ms === 60000), false);
  assert.equal([...timers.values()].filter(timer => timer.ms === 300000).length, 1);
  assert.equal(clicks.length, 1); assert.equal(urls.size, 1);
  const blob = urls.get(save.href);
  assert.equal(blob.type, 'application/pdf'); assert.equal(blob.size, bytes.length);
  const actual = await new Promise((resolve, reject) => { const reader = new window.FileReader(); reader.onload = () => resolve(Buffer.from(reader.result)); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
  assert.deepEqual(actual, bytes);
  assert.deepEqual(JSON.parse(JSON.stringify(notices.at(-1))), { message: { source: 'SIRA_DOWNLOAD_ACCEPTED', nonce }, targetOrigin: origin });
  assert.equal(window.opener, null);
  save.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.match(status.textContent, /Descarga solicitada/); assert.equal(save.hidden, false);
}));

for (const allowedOrigin of ['https://script.google.com', 'https://script.googleusercontent.com', 'https://altumlumen-design.github.io']) {
  await test(`exact supported origin receives its own acknowledgement: ${allowedOrigin}`, () => fixture({}, ({ send, urls, notices }) => {
    send({ origin: allowedOrigin }); assert.equal(urls.size, 1); assert.equal(notices.at(-1).targetOrigin, allowedOrigin);
  }));
}

const invalidPayloads = [
  { ...payload(), size: undefined }, { ...payload(), size: 0 }, { ...payload(), size: 16 * 1024 * 1024 },
  { ...payload(), size: bytes.length + 1 }, { ...payload(), base64: '!invalid!' },
  { ...payload(), base64: Buffer.alloc(bytes.length, 'x').toString('base64') },
  { ...payload(), mime: 'text/html' }, { ...payload(), base64: payload().base64.slice(0, -1) }
];
for (const [index, invalid] of invalidPayloads.entries()) {
  await test(`invalid payload ${index + 1} cannot create a downloadable file`, () => fixture({}, ({ send, save, urls, notices, status, timers, intervals }) => {
    send({ data: { source: 'SIRA_DOWNLOAD_PAYLOAD', nonce, payload: invalid } });
    assert.equal(urls.size, 0); assert.equal(save.hidden, true); assert.equal(status.getAttribute('role'), 'alert');
    assert.equal(notices.at(-1).message.source, 'SIRA_DOWNLOAD_ERROR');
    assert.equal(notices.at(-1).targetOrigin, origin); assert.equal(timers.size, 0); assert.equal(intervals.size, 0);
    send(); assert.equal(urls.size, 0, 'malformed handshakes are consumed');
  }));
}

await test('filenames are text-only and safe for local saving', () => fixture({}, ({ send, save, window }) => {
  send({ data: { source: 'SIRA_DOWNLOAD_PAYLOAD', nonce, payload: { ...payload(), name: '../<script>\u202e/unsafe:pdf.pdf' } } });
  assert.equal(save.download, '__script__unsafe_pdf.pdf');
  assert.equal(window.document.getElementById('fileName').textContent, save.download);
  assert.equal(window.document.querySelector('#fileName script'), null);
}));

await test('duplicate payloads cannot replace or allocate another file', () => fixture({}, ({ send, urls, save }) => {
  send(); const initial = save.href; send(); assert.equal(save.href, initial); assert.equal(urls.size, 1);
}));

for (const file of [
  { name: 'lectura.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: Buffer.from('PK\x03\x04Synthetic office archive\x00\xff', 'latin1') },
  { name: 'indicaciones.txt', mime: 'text/plain', bytes: Buffer.from('Lectura complementaria: síntesis y análisis.\n') },
  { name: 'anexos.zip', mime: 'application/zip', bytes: Buffer.from('PK\x03\x04Synthetic ZIP archive\x00\xfe', 'latin1') }
]) {
  await test(`supported ${file.name} preserves exact bytes, MIME and filename`, () => fixture({}, async ({ window, send, save, urls }) => {
    send({ data: { source: 'SIRA_DOWNLOAD_PAYLOAD', nonce, payload: { name: file.name, mime: file.mime, size: file.bytes.length, base64: file.bytes.toString('base64') } } });
    assert.equal(save.hidden, false); assert.equal(save.download, file.name);
    const blob = urls.get(save.href); assert.equal(blob.type, file.mime); assert.equal(blob.size, file.bytes.length);
    const actual = await new Promise((resolve, reject) => { const reader = new window.FileReader(); reader.onload = () => resolve(Buffer.from(reader.result)); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
    assert.deepEqual(actual, file.bytes);
    assert.match(window.document.getElementById('fileSize').textContent, new RegExp(file.name.split('.').pop().toUpperCase()));
  }));
}

await test('60 second timeout removes ready retries and late payload listener', () => fixture({}, ({ send, flush, status, timers, intervals, urls }) => {
  flush(60000); assert.match(status.textContent, /No se recibió el archivo/);
  assert.equal(status.getAttribute('role'), 'alert'); assert.equal(intervals.size, 0); assert.equal(timers.size, 0);
  send(); assert.equal(urls.size, 0);
}));

await test('five minute expiry revokes prepared bytes and offers retry from SIRA', () => fixture({}, ({ send, flush, status, urls, revoked, save }) => {
  send(); const url = save.href; flush(300000);
  assert.equal(urls.size, 0); assert.deepEqual(revoked, [url]); assert.equal(save.hidden, true); assert.equal(save.hasAttribute('href'), false);
  assert.match(status.textContent, /venció.*SIRA/);
}));

await test('leaving closes handshake and revokes a prepared blob', () => fixture({}, ({ window, send, urls, revoked, timers, intervals }) => {
  send(); window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(urls.size, 0); assert.equal(revoked.length, 1); assert.equal(timers.size, 0); assert.equal(intervals.size, 0);
  send(); assert.equal(urls.size, 0);
}));

process.stdout.write(`Secure download handoff: ${passed} tests passed.\n`);
