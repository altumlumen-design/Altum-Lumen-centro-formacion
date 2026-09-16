const PERF_VERSION = '20260915-aula32';
const SESSION_KEY = 'altum_aula_session_v7';

// FAST BOOT: si ya existe sesión, evita que el formulario de login parpadee
// mientras se hidrata el catálogo firmado que quedó en sessionStorage.
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
    window.fetch(url.href, { method:'GET', mode:'no-cors', cache:'no-store', credentials:'omit', priority:'low' }).catch(() => {});
  } catch (_error) {}
}

// Solo cargamos lo imprescindible. El antiguo aula-portal-ux.js ya no se importa:
// su clasificación dependía de estados estáticos y podía mezclar Vigentes/Anteriores.
await import('./aula-config.js?v=20260915-aula32');
warmSiraInBackground();
await Promise.all([
  import('./aula-datos.js?v=20260810-final-r2'),
  import('./aula-clean-routes.js?v=20260810-final-r2')
]);
await import('./aula-auth.js?v=20260915-aula32');
await import('./aula-portal.js?v=20260915-aula32');
