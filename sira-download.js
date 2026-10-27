(function () {
  'use strict';

  // This page only receives the bytes already authorized by SIRA. It never
  // receives a login token, a Drive URL, a file ID, or a participant identity.
  const MAX_BYTES = 15 * 1024 * 1024;
  const READY_TIMEOUT_MS = 60000;
  const FILE_LIFETIME_MS = 5 * 60 * 1000;
  const FILE_TYPES = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', txt: 'text/plain', rtf: 'application/rtf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', zip: 'application/zip'
  };
  const opener = window.opener;
  const nonce = window.location.hash.slice(1);
  const status = document.getElementById('status');
  const save = document.getElementById('saveFile');
  let received = false, disposed = false, objectUrl = '', readyTimer, timeoutTimer, expiryTimer;

  // Keep the single-use handshake secret out of history and referrers.
  try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_error) {}

  function setStatus(message, error) {
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(error));
    status.setAttribute('role', error ? 'alert' : 'status');
    status.setAttribute('aria-live', error ? 'assertive' : 'polite');
  }

  function trustedOrigin(origin) {
    return origin === 'https://altumlumen-design.github.io'
      || origin === 'https://script.google.com'
      || origin === 'https://script.googleusercontent.com'
      || /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/i.test(origin);
  }

  function notify(source, origin, message) {
    try { opener.postMessage({ source, nonce, ...(message ? { message } : {}) }, origin); } catch (_error) {}
  }

  function stopHandshake() {
    window.clearInterval(readyTimer);
    window.clearTimeout(timeoutTimer);
    window.removeEventListener('message', receive);
  }

  function releaseFile() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
    save.removeAttribute('href');
    save.hidden = true;
    window.clearTimeout(expiryTimer);
  }

  function closeReceiver() {
    disposed = true;
    stopHandshake();
    releaseFile();
  }

  function safeFilename(value) {
    const name = String(value || 'material.pdf')
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '')
      .replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+|[. ]+$/g, '').trim().slice(0, 180);
    return name || 'material.pdf';
  }

  function checkedBlob(payload) {
    const size = Number(payload && payload.size);
    const encoded = payload && payload.base64;
    const filename = safeFilename(payload && payload.name);
    const extension = (filename.match(/\.([A-Za-z0-9]+)$/) || [])[1]?.toLowerCase();
    const mime = FILE_TYPES[extension];
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES
        || typeof encoded !== 'string' || !encoded
        || encoded.length > Math.ceil(MAX_BYTES / 3) * 4
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0
        || !mime || payload.mime !== mime) throw new Error('El archivo recibido no es válido. Regresa a SIRA y vuelve a pulsar Guardar archivo.');
    let raw;
    try { raw = window.atob(encoded); } catch (_error) { throw new Error('El archivo llegó incompleto. Regresa a SIRA e inténtalo nuevamente.'); }
    if (raw.length !== size || (mime === 'application/pdf' && raw.slice(0, 5) !== '%PDF-')) throw new Error('El archivo llegó incompleto o no tiene el formato esperado. Regresa a SIRA e inténtalo nuevamente.');
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function receive(event) {
    if (disposed || received || event.source !== opener || !trustedOrigin(String(event.origin || ''))) return;
    const data = event.data;
    if (!data || data.source !== 'SIRA_DOWNLOAD_PAYLOAD' || data.nonce !== nonce) return;
    // Consume the handshake even on malformed payloads. A retry starts from SIRA.
    received = true;
    stopHandshake();
    try {
      const blob = checkedBlob(data.payload);
      const filename = safeFilename(data.payload.name);
      objectUrl = URL.createObjectURL(blob);
      save.href = objectUrl;
      save.download = filename;
      save.hidden = false;
      save.setAttribute('aria-label', `Guardar archivo: ${filename}`);
      document.getElementById('fileName').textContent = filename;
      document.getElementById('fileName').hidden = false;
      const extension = (filename.match(/\.([A-Za-z0-9]+)$/) || [])[1]?.toUpperCase() || '';
      document.getElementById('fileSize').textContent = `${new Intl.NumberFormat('es-PE').format(blob.size)} bytes · ${extension}`;
      document.getElementById('fileSize').hidden = false;
      setStatus('Archivo preparado. Pulsa Guardar archivo si la descarga no comienza.', false);
      notify('SIRA_DOWNLOAD_ACCEPTED', event.origin);
      expiryTimer = window.setTimeout(() => {
        releaseFile();
        setStatus('El enlace de descarga venció. Regresa a SIRA y vuelve a pulsar Guardar archivo.', true);
      }, FILE_LIFETIME_MS);
      try { save.click(); } catch (_error) {}
    } catch (error) {
      releaseFile();
      setStatus(error.message || 'No fue posible preparar el archivo. Regresa a SIRA e inténtalo nuevamente.', true);
      notify('SIRA_DOWNLOAD_ERROR', event.origin, 'No fue posible preparar el archivo.');
    }
    // The original browsing context no longer needs to remain reachable.
    try { window.opener = null; } catch (_error) {}
  }

  save.addEventListener('click', () => {
    if (objectUrl) setStatus('Descarga solicitada. Si no aparece en las descargas de tu navegador, pulsa Guardar archivo nuevamente.', false);
  });
  window.addEventListener('pagehide', closeReceiver, { once: true });

  if (!opener || !/^[a-f0-9]{32}$/i.test(nonce)) {
    setStatus('Abre esta ventana desde el botón Guardar archivo de SIRA para recibir tu material.', true);
    return;
  }

  window.addEventListener('message', receive);
  const ready = () => {
    if (disposed || received) return;
    // READY carries only the random handshake value and is sent solely to the
    // captured opener. File bytes are accepted only from that opener and origin.
    notify('SIRA_DOWNLOAD_READY', '*');
  };
  readyTimer = window.setInterval(ready, 500);
  timeoutTimer = window.setTimeout(() => {
    stopHandshake();
    setStatus('No se recibió el archivo. Regresa a SIRA y vuelve a pulsar Guardar archivo.', true);
  }, READY_TIMEOUT_MS);
  ready();
})();
