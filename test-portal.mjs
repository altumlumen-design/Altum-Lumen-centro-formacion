import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
const portalCss = readFileSync(resolve(projectRoot, 'portal-renovado.css'), 'utf8');
const verificationHtml = readFileSync(resolve(projectRoot, 'verificacion.html'), 'utf8');
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
  'assets/autoridad-norma-moreno.png',
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

if (/Base p[uú]blica cargada correctamente/i.test(verificationHtml)) {
  throw new Error('El verificador no debe revelar mensajes internos sobre la carga de la base de datos.');
}

if (document.querySelectorAll('#offerGrid .offer').length !== 6) {
  throw new Error('La oferta académica no generó sus seis tarjetas.');
}

const executiveProgram = [...document.querySelectorAll('#offerGrid .offer')]
  .find((card) => card.textContent.includes('Programas Ejecutivos'));
if (!executiveProgram?.textContent.includes('90 a 180 horas académicas')) {
  throw new Error('Falta el Programa Ejecutivo con su rango de horas académicas.');
}

const authoritiesText = document.querySelector('#autoridades')?.textContent ?? '';
if (!authoritiesText.includes('RESOLUCIÓN DE GERENCIA GENERAL N° 00018-2026-AL/GG')
    || authoritiesText.includes('Director Académico (DT)')) {
  throw new Error('La designación del Director Académico no está actualizada.');
}

const secretaryEmail = document.querySelector('a[href="mailto:secretariageneral.altumlumen@gmail.com"]');
if (!secretaryEmail
    || !authoritiesText.includes('Norma Elena F. Moreno Mogollón')
    || !authoritiesText.includes('RESOLUCIÓN DE GERENCIA GENERAL N° 00011-2026-AL/GG')) {
  throw new Error('La Secretaría General no contiene nombre, correo y resolución válidos.');
}

if (!portalCss.includes('cielo.jpg?v=20260807-unificado')) {
  throw new Error('El portal institucional no utiliza la versión unificada de cielo.jpg.');
}

if (!portalCss.includes('font-family: Inter')
    || !portalCss.includes('font-size: clamp(30px, 3.55vw, 48px)')) {
  throw new Error('El sistema tipográfico sobrio del portal no está aplicado.');
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

console.log('Portal institucional: seis ofertas, tres autoridades, enlaces, publicaciones, WhatsApp y menú adaptable verificados.');
