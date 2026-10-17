await import('./aula-config.js?v=20261017-sira347');

const button = document.getElementById('siraLaunch');
const status = document.getElementById('siraStatus');
const endpoint = String(window.ALTUM_AULA_CONFIG?.authEndpoint || '').trim();
const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/i.test(endpoint);

if (!button) throw new Error('No se encontró el control de acceso SIRA.');

let opening = false;

function openSira() {
  if (opening || !validEndpoint) return;
  opening = true;
  button.disabled = true;
  if (status) status.textContent = 'Abriendo el sistema oficial SIRA 3.7.47…';
  const target = new URL(endpoint);
  target.searchParams.set('source', 'centro-formacion');
  target.searchParams.set('v', '347');
  window.location.replace(target.toString());
}

if (!validEndpoint) {
  button.disabled = true;
  if (status) status.textContent = 'El acceso institucional no está disponible en este momento.';
} else {
  button.addEventListener('click', openSira);
  window.setTimeout(openSira, 180);
}
