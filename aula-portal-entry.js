const PERF_VERSION = '20260915-aula24';
const SESSION_KEY = 'altum_aula_session_v7';

// FAST BOOT: si ya existe sesión, el formulario de login no vuelve a aparecer
// mientras cargan los módulos. El estilo se retira únicamente cuando portal.js
// ya decidió qué vista debe quedar visible.
try {
  if (window.sessionStorage.getItem(SESSION_KEY)) {
    const style = document.createElement('style');
    style.dataset.altumFastBoot = PERF_VERSION;
    style.textContent = '#loginView{display:none!important}';
    document.head.appendChild(style);
  }
} catch (_error) {}

function warmSiraInBackground() {
  try {
    const endpoint = String(window.ALTUM_AULA_CONFIG?.authEndpoint || '').trim();
    if (!endpoint || !window.fetch) return;
    const url = new URL(endpoint);
    url.searchParams.set('action', 'aulaHealth');
    url.searchParams.set('_', String(Date.now()));
    // Respuesta opaca intencional: solo buscamos adelantar DNS/TLS, cold start y cachés.
    window.fetch(url.href, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      priority: 'low'
    }).catch(() => {});
  } catch (_error) {}
}

// Las dependencias independientes se descargan en paralelo. La versión anterior
// las esperaba una por una y podía sumar varios segundos en conexiones lentas.
const configPromise = import('./aula-config.js?v=20260915-aula24');
const dataPromise = import('./aula-datos.js?v=20260810-final-r2');
const schedulePromise = import('./aula-schedule.js?v=20260810-final-r2');
const routesPromise = import('./aula-clean-routes.js?v=20260810-final-r2');

await configPromise;
warmSiraInBackground();
await Promise.all([dataPromise, schedulePromise, routesPromise]);
await import('./aula-auth.js?v=20260915-aula24');
await import('./aula-portal.js?v=20260915-aula24');

// Mejoras visuales no críticas: se cargan después de que el portal básico ya funciona.
const loadUx = () => import('./aula-portal-ux.js?v=20260810-final-r3').catch(() => {});
if ('requestIdleCallback' in window) window.requestIdleCallback(loadUx, { timeout: 1200 });
else window.setTimeout(loadUx, 120);
