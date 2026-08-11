const ALTUM_CLEAN_ROUTE_VERSION = '20260810-r2';
const ROOT_URL = new URL('./', import.meta.url);

const LEGACY_TO_CLEAN = Object.freeze({
  'aula-virtual.html': 'aula/',
  'ia-derecho-4ta-edicion.html': 'curso/ia-derecho-4/',
  'formulacion-inversiones-publicas-ia.html': 'curso/formulacion-inversiones-ia/',
  'gestion-servicio-serenazgo-municipal.html': 'curso/serenazgo-municipal/',
  'ia-derecho-3ra-edicion.html': 'curso/ia-derecho-3/',
  'ia-derecho-2da-edicion.html': 'curso/ia-derecho-2/',
  'ia-derecho-1ra-edicion.html': 'curso/ia-derecho-1/',
  'pae-gerencia-seguridad-criminologia.html': 'programa/gerencia-seguridad-criminologia/',
  'diplomado-orden-interno-seguridad-ciudadana.html': 'programa/orden-interno-seguridad-ciudadana/',
  'diplomado-direccion-gestion-seguridad-ciudadana.html': 'programa/direccion-gestion-seguridad-ciudadana/',
  'diplomado-interculturalidad-convivencia-desarrollo-social.html': 'programa/interculturalidad-convivencia-desarrollo-social/',
  'proyectos-inversion-publica-ia.html': 'curso/proyectos-inversion-publica-ia/'
});

const CLEAN_PATHS = new Set(Object.values(LEGACY_TO_CLEAN).map((route) => new URL(route, ROOT_URL).pathname));

function ensureStableBase() {
  const existing = document.querySelector('base');
  if (existing) return existing;
  const base = document.createElement('base');
  base.href = ROOT_URL.href;
  base.dataset.altumCleanRoute = ALTUM_CLEAN_ROUTE_VERSION;
  document.head.prepend(base);
  return base;
}

function currentLegacyFile() {
  const path = window.location.pathname;
  const filename = path.slice(path.lastIndexOf('/') + 1);
  return Object.prototype.hasOwnProperty.call(LEGACY_TO_CLEAN, filename) ? filename : '';
}


function cleanUrlForLegacyUrl(url) {
  if (!url || url.origin !== ROOT_URL.origin || !url.pathname.startsWith(ROOT_URL.pathname)) return null;
  const filename = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  const cleanRoute = LEGACY_TO_CLEAN[filename];
  if (!cleanRoute) return null;
  const clean = new URL(cleanRoute, ROOT_URL);
  clean.search = url.search;
  clean.hash = url.hash;
  return clean;
}

function rewriteKnownLinks() {
  document.querySelectorAll('a[href]').forEach((anchor) => {
    const raw = anchor.getAttribute('href');
    if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
    let url;
    try { url = new URL(raw, ROOT_URL); } catch (_) { return; }
    const clean = cleanUrlForLegacyUrl(url);
    if (clean) anchor.href = clean.pathname + clean.search + clean.hash;
  });
}

function syncCanonicalElements(cleanUrl) {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = cleanUrl.href;
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = cleanUrl.href;
}

function syncCleanUrl() {
  rewriteKnownLinks();
  const legacy = currentLegacyFile();
  if (!legacy) {
    if (CLEAN_PATHS.has(window.location.pathname)) ensureStableBase();
    return false;
  }

  ensureStableBase();
  const cleanUrl = new URL(LEGACY_TO_CLEAN[legacy], ROOT_URL);
  cleanUrl.search = window.location.search;
  cleanUrl.hash = window.location.hash;

  syncCanonicalElements(cleanUrl);
  if (window.location.pathname !== cleanUrl.pathname) {
    window.history.replaceState(window.history.state, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
  return true;
}

function observePortalNavigation() {
  if (!document.body.classList.contains('aula-portal')) return;
  const root = document.getElementById('dashboardView') || document.body;
  const observer = new MutationObserver(() => syncCleanUrl());
  observer.observe(root, { attributes: true, subtree: true, attributeFilter: ['hidden', 'class'] });
}

function init() {
  syncCleanUrl();
  observePortalNavigation();
  window.addEventListener('popstate', () => syncCleanUrl());
  window.addEventListener('pageshow', () => syncCleanUrl());
}

window.AltumCleanRoutes = Object.freeze({
  version: ALTUM_CLEAN_ROUTE_VERSION,
  root: ROOT_URL.href,
  routes: LEGACY_TO_CLEAN,
  sync: syncCleanUrl,
  rewriteLinks: rewriteKnownLinks
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
