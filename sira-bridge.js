(function () {
  'use strict';

  const SOURCE = 'SIRA_PORTAL_RPC';
  const NORMAL_TIMEOUT = 90000;
  const LOGIN_TIMEOUT = 60000;
  const HEAVY_TIMEOUT = 345000;
  let sequence = 0;

  function endpoint() {
    return String(window.ALTUM_AULA_CONFIG && window.ALTUM_AULA_CONFIG.authEndpoint || '').trim();
  }

  function trustedGoogleOrigin(origin) {
    return origin === 'null' || /^https:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|script\.google\.com)$/i.test(String(origin || ''));
  }

  function isHeavy(method, args) {
    if (/upload|export|process|sync|migrate|publish|normalize|install|recover|createPedaBatch/i.test(method)) return true;
    try { return JSON.stringify(args || []).length > 2 * 1024 * 1024; } catch (_error) { return false; }
  }

  function addHidden(form, name, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value == null ? '' : value);
    form.appendChild(input);
  }

  function request(method, args) {
    const url = endpoint();
    if (!url) return Promise.reject(new Error('El servicio SIRA no está configurado.'));

    return new Promise((resolve, reject) => {
      sequence += 1;
      // Identificador resistente a colisiones y a intentos de falsificar respuestas.
      const entropy = new Uint32Array(4);
      crypto.getRandomValues(entropy);
      const requestId = `sira-admin-${Date.now()}-${sequence}-${Array.from(entropy, n => n.toString(36)).join('-')}`;
      const frame = document.createElement('iframe');
      const frameName = `sira_admin_${requestId.replace(/[^a-z0-9_]/gi, '')}`;
      frame.name = frameName;
      frame.setAttribute('aria-hidden', 'true');
      frame.referrerPolicy = 'no-referrer';
      frame.style.cssText = 'position:fixed;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px';

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url;
      form.target = frameName;
      form.style.display = 'none';
      addHidden(form, 'action', 'siraPortalRpc');
      addHidden(form, 'requestId', requestId);
      addHidden(form, 'origin', window.location.origin);
      addHidden(form, 'fn', method);
      addHidden(form, 'args', JSON.stringify(Array.isArray(args) ? args : []));

      let done = false;
      const finish = (error, value) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        try { form.remove(); } catch (_error) {}
        window.setTimeout(() => { try { frame.remove(); } catch (_error) {} }, 0);
        if (error) reject(error); else resolve(value);
      };

      const onMessage = (event) => {
        const data = event.data || {};
        if (data.source !== SOURCE || data.requestId !== requestId) return;
        if (!trustedGoogleOrigin(event.origin)) return;
        // HtmlService puede originar la respuesta desde un iframe anidado de Google.
        // En ese caso event.source es el iframe interno, no frame.contentWindow.
        // El requestId aleatorio y el origen Google identifican la respuesta.

        const payload = data.payload || {};
        if (payload.ok === true) finish(null, payload.result);
        else finish(new Error(String(payload.error && payload.error.message || 'No fue posible completar la operación.')));
      };

      const timeout = method === 'login' ? LOGIN_TIMEOUT : (isHeavy(method, args) ? HEAVY_TIMEOUT : NORMAL_TIMEOUT);
      const timer = window.setTimeout(() => finish(new Error('La operación está tardando demasiado. Puedes volver a intentarlo sin duplicar la acción.')), timeout);
      window.addEventListener('message', onMessage);
      document.body.append(frame, form);
      try { form.submit(); } catch (err) {
        finish(new Error('No se pudo iniciar la comunicación con SIRA: ' + (err && err.message || err)));
      }
    });
  }

  function runner(success, failure) {
    const chain = {
      withSuccessHandler(fn) { return runner(typeof fn === 'function' ? fn : null, failure); },
      withFailureHandler(fn) { return runner(success, typeof fn === 'function' ? fn : null); }
    };
    return new Proxy(chain, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop !== 'string') return undefined;
        return function () {
          const args = Array.prototype.slice.call(arguments);
          request(prop, args).then(
            value => { if (success) success(value); },
            error => { if (failure) failure({ message: error.message || String(error) }); }
          );
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable: false,
    enumerable: true,
    get() { return runner(null, null); }
  });

  ['https://script.google.com', 'https://script.googleusercontent.com'].forEach(href => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
})();
