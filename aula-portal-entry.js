const PERF_VERSION = '20260915-perf1';
const SESSION_KEY = 'altum_aula_session_v7';

// Si ya existe una sesión, ocultamos el login antes de cargar el resto del portal.
// Así al volver desde un curso nunca aparece el formulario durante la revalidación.
let bootStyle = null;
try {
  if (window.sessionStorage.getItem(SESSION_KEY)) {
    bootStyle = document.createElement('style');
    bootStyle.dataset.altumFastBoot = PERF_VERSION;
    bootStyle.textContent = '#loginView{display:none!important}';
    document.head.appendChild(bootStyle);
  }
} catch (_error) {}

await import('./aula-datos.js?v=20260810-final-r2');
await import('./aula-schedule.js?v=20260810-final-r2');
await import('./aula-config.js?v=20260915-sira2');
await import('./aula-auth.js?v=20260915-perf1');
await import('./aula-portal.js?v=20260915-perf1');
await import('./aula-portal-ux.js?v=20260810-final-r3');
await import('./aula-clean-routes.js?v=20260810-final-r2');

if (bootStyle) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootStyle.remove(), { once: true });
  } else {
    bootStyle.remove();
  }
}
