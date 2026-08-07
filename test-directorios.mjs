import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const read = (fileName) => readFileSync(resolve(projectRoot, fileName), 'utf8');
const dom = (fileName) => new JSDOM(read(fileName), { url: `https://altum-lumen.test/${fileName}` });

const css = read('directorio-expertos.css');
if (!css.includes('cielo.jpg?v=20260807-unificado') || !css.includes('font-family: Inter')) {
  throw new Error('Los directorios no utilizan el cielo unificado y la tipografía institucional.');
}

for (const asset of [
  'cielo.jpg',
  'assets/logo-altum-lumen.png',
  'assets/convocatoria-dinesc-2026.jpg',
  'directorio-expertos.css'
]) {
  if (!existsSync(resolve(projectRoot, asset))) {
    throw new Error(`Falta el recurso ${asset}`);
  }
}

const hub = dom('directorio-expertos.html').window.document;
if (hub.querySelectorAll('.directory-card').length !== 6) {
  throw new Error('La portada debe contener exactamente seis directorios.');
}

if (hub.querySelectorAll('.status.active').length !== 1
    || hub.querySelectorAll('.status.pending').length !== 5) {
  throw new Error('Solo DINESC debe figurar con convocatoria vigente.');
}

const dinesc = dom('dinesc.html').window.document;
const dinescText = dinesc.body.textContent.replace(/\s+/g, ' ');

for (const expectedText of [
  'Primera convocatoria vigente',
  'Del 1 al 21 de agosto de 2026',
  'Del 22 al 26 de agosto de 2026',
  '28 de agosto de 2026',
  'Experiencia acreditada no menor de cinco años',
  'direccionacademica.altumlumen@gmail.com',
  '928 928 767'
]) {
  if (!dinescText.includes(expectedText)) {
    throw new Error(`DINESC no contiene el dato requerido: ${expectedText}`);
  }
}

for (const href of [
  'https://forms.gle/pwTdRqMwqGtuct5L8',
  'https://drive.google.com/file/d/1YVRF6w81IAZ1wsc7HdvOF_zODKhtWezF/view?usp=sharing',
  'https://www.facebook.com/share/p/1F1raMBjrJ/'
]) {
  if (!dinesc.querySelector(`a[href="${href}"]`)) {
    throw new Error(`Falta el enlace oficial ${href}`);
  }
}

if (dinesc.querySelectorAll('#directoryBody tr').length !== 0) {
  throw new Error('La tabla DINESC debe permanecer vacía hasta su publicación oficial.');
}

const csvLines = read('dinesc-directorio.csv').trim().split(/\r?\n/);
if (csvLines.length !== 1 || !csvLines[0].startsWith('nombres_apellidos,')) {
  throw new Error('El CSV DINESC debe conservar únicamente su cabecera, sin registros de ejemplo.');
}

if (/example\.com/i.test(read('dinesc.html')) || /example\.com/i.test(read('dinesc-directorio.csv'))) {
  throw new Error('DINESC aún contiene datos ficticios.');
}

const pendingPages = ['dinegrd.html', 'dinegep.html', 'dinesap.html', 'dineip.html', 'dineds.html'];
for (const fileName of pendingPages) {
  const page = dom(fileName).window.document;
  const text = page.body.textContent.replace(/\s+/g, ' ');
  if (!text.includes('Aún no hay convocatoria')) {
    throw new Error(`${fileName} no comunica que aún no hay convocatoria.`);
  }
  if (page.querySelectorAll('tbody tr').length !== 0) {
    throw new Error(`${fileName} no debe contener integrantes ni filas de ejemplo.`);
  }
  if (!page.querySelector('.whatsapp-float')?.href.startsWith('https://wa.me/51928928767')) {
    throw new Error(`${fileName} no contiene el canal de WhatsApp institucional.`);
  }
}

const viteConfig = read('vite.config.js');
for (const fileName of ['directorio-expertos.html', 'dinesc.html', ...pendingPages]) {
  if (!viteConfig.includes(`'${fileName}'`)) {
    throw new Error(`${fileName} no está incluida en la compilación de producción.`);
  }
}

console.log('Directorios: línea gráfica unificada, DINESC vigente y cinco directorios sin convocatoria verificados.');
