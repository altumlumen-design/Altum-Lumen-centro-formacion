import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'copy-aula-data',
    async closeBundle() {
      await Promise.all([
        'alumnos-accesos.csv',
        'inconsistencias-alumnos.csv',
        'resumen-integracion-alumnos.json'
      ].map((fileName) => copyFile(
        resolve(import.meta.dirname, fileName),
        resolve(import.meta.dirname, 'dist', fileName)
      )));
    }
  }],
  build: {
    rollupOptions: {
      input: {
        aula: resolve(import.meta.dirname, 'aula-virtual.html'),
        iaDerechoPrimera: resolve(import.meta.dirname, 'ia-derecho-1ra-edicion.html'),
        iaDerechoSegunda: resolve(import.meta.dirname, 'ia-derecho-2da-edicion.html'),
        iaDerechoTercera: resolve(import.meta.dirname, 'ia-derecho-3ra-edicion.html'),
        iaDerechoCuarta: resolve(import.meta.dirname, 'ia-derecho-4ta-edicion.html'),
        formulacionInversionesIa: resolve(import.meta.dirname, 'formulacion-inversiones-publicas-ia.html'),
        serenazgoMunicipal: resolve(import.meta.dirname, 'gestion-servicio-serenazgo-municipal.html'),
        paeSeguridad: resolve(import.meta.dirname, 'pae-gerencia-seguridad-criminologia.html'),
        diplomadoOrdenInterno: resolve(import.meta.dirname, 'diplomado-orden-interno-seguridad-ciudadana.html'),
        proyectosInversionIa: resolve(import.meta.dirname, 'proyectos-inversion-publica-ia.html')
      }
    }
  }
});
