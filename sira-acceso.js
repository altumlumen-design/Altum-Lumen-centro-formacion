await import('./aula-config.js?v=20260916-aula334');

const button = document.getElementById('siraLaunch');
const status = document.getElementById('siraStatus');
const endpoint = String(window.ALTUM_AULA_CONFIG?.authEndpoint || '').trim();
const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/i.test(endpoint);

if (!button) throw new Error('No se encontró el control de acceso SIRA.');

if (!validEndpoint) {
  button.disabled = true;
  if (status) status.textContent = 'El acceso institucional no está disponible en este momento.';
} else {
  button.addEventListener('click', () => {
    button.disabled = true;
    if (status) status.textContent = 'Abriendo el entorno institucional seguro…';
    const target = new URL(endpoint);
    target.searchParams.set('source', 'centro-formacion');
    target.searchParams.set('v', '20261016');
    window.location.assign(target.toString());
  });
}
