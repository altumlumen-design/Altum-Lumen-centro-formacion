import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        aula: resolve(import.meta.dirname, 'aula-virtual.html'),
        iaDerechoPrimera: resolve(import.meta.dirname, 'ia-derecho-1ra-edicion.html'),
        iaDerechoSegunda: resolve(import.meta.dirname, 'ia-derecho-2da-edicion.html'),
        iaDerechoTercera: resolve(import.meta.dirname, 'ia-derecho-3ra-edicion.html'),
        paeSeguridad: resolve(import.meta.dirname, 'pae-gerencia-seguridad-criminologia.html'),
        diplomadoOrdenInterno: resolve(import.meta.dirname, 'diplomado-orden-interno-seguridad-ciudadana.html'),
        proyectosInversionIa: resolve(import.meta.dirname, 'proyectos-inversion-publica-ia.html')
      }
    }
  }
});
