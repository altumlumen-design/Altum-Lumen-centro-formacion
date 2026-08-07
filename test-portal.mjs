import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
const viteConfig = readFileSync(resolve(projectRoot, 'vite.config.js'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://altum-lumen.test/'
});

dom.window.eval(readFileSync(resolve(projectRoot, 'portal-renovado.js'), 'utf8'));

const { document } = dom.window;
const requiredFiles = [
  'cielo.jpg',
  'portal-renovado.css',
  'portal-renovado.js',
  'assets/publicaciones/aniversario-altum-lumen.jpg',
  'assets/publicaciones/aula-virtual-altum-lumen.jpg',
  'assets/publicaciones/canal-whatsapp.jpg',
  'assets/publicaciones/ia-aplicada-derecho.jpg',
  'assets/publicaciones/ley-idoneidad.jpg',
  'assets/publicaciones/nuevo-reglamento-inviertepe.jpg'
];

for (const fileName of requiredFiles) {
  if (!existsSync(resolve(projectRoot, fileName))) {
    throw new Error(`Falta el recurso local ${fileName}`);
  }
}

if (document.querySelectorAll('#offerGrid .offer').length !== 5) {
  throw new Error('La oferta académica no generó sus cinco tarjetas.');
}

if (document.querySelectorAll('#publicaciones .publication-card').length !== 6) {
  throw new Error('La sección de publicaciones no contiene seis tarjetas.');
}

for (const href of ['aula-virtual.html', 'verificacion.html', 'directorio-expertos.html']) {
  if (!document.querySelector(`a[href="${href}"]`)) {
    throw new Error(`Falta el acceso principal a ${href}`);
  }

  if (!viteConfig.includes(`'${href}'`)) {
    throw new Error(`La ruta ${href} no está incluida en la compilación de producción.`);
  }
}

const whatsappButton = document.querySelector('.whatsapp-float');
if (!whatsappButton?.href.startsWith('https://wa.me/51928928767')) {
  throw new Error('El botón flotante de WhatsApp no tiene el destino esperado.');
}

const menuToggle = document.querySelector('.menu-toggle');
const header = document.querySelector('.topbar');
menuToggle.click();
if (!header.classList.contains('nav-open') || menuToggle.getAttribute('aria-expanded') !== 'true') {
  throw new Error('El menú adaptable no abre correctamente.');
}
menuToggle.click();
if (header.classList.contains('nav-open') || menuToggle.getAttribute('aria-expanded') !== 'false') {
  throw new Error('El menú adaptable no cierra correctamente.');
}

console.log('Portal institucional: enlaces preservados, seis publicaciones, WhatsApp y menú adaptable verificados.');
