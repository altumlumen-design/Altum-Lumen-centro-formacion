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
        portal: resolve(import.meta.dirname, 'index.html'),
        aula: resolve(import.meta.dirname, 'aula-virtual.html'),
        verificacion: resolve(import.meta.dirname, 'verificacion.html'),
        directorioExpertos: resolve(import.meta.dirname, 'directorio-expertos.html'),
        conferenciaSeguridadTerritorial: resolve(import.meta.dirname, 'conferencia-seguridad-ciudadana-control-territorial.html'),
        conferenciaSerenazgoPnp: resolve(import.meta.dirname, 'conferencia-serenazgo-pnp.html'),
        cursoGestionPublica: resolve(import.meta.dirname, 'curso-gestion-publica-municipal.html'),
        cursoGestionRiesgo: resolve(import.meta.dirname, 'curso-gestion-riesgo-desastres.html'),
        cursoInversionPublica: resolve(import.meta.dirname, 'curso-inversion-publica-gestion-proyectos.html'),
        dineds: resolve(import.meta.dirname, 'dineds.html'),
        dinegep: resolve(import.meta.dirname, 'dinegep.html'),
        dinegrd: resolve(import.meta.dirname, 'dinegrd.html'),
        dineip: resolve(import.meta.dirname, 'dineip.html'),
        dinesap: resolve(import.meta.dirname, 'dinesap.html'),
        dinesc: resolve(import.meta.dirname, 'dinesc.html'),
        iaDerechoPrimera: resolve(import.meta.dirname, 'ia-derecho-1ra-edicion.html'),
        iaDerechoSegunda: resolve(import.meta.dirname, 'ia-derecho-2da-edicion.html'),
        iaDerechoTercera: resolve(import.meta.dirname, 'ia-derecho-3ra-edicion.html'),
        iaDerechoCuarta: resolve(import.meta.dirname, 'ia-derecho-4ta-edicion.html'),
        formulacionInversionesIa: resolve(import.meta.dirname, 'formulacion-inversiones-publicas-ia.html'),
        serenazgoMunicipal: resolve(import.meta.dirname, 'gestion-servicio-serenazgo-municipal.html'),
        paeSeguridad: resolve(import.meta.dirname, 'pae-gerencia-seguridad-criminologia.html'),
        diplomadoOrdenInterno: resolve(import.meta.dirname, 'diplomado-orden-interno-seguridad-ciudadana.html'),
        diplomadoDireccionSeguridad: resolve(import.meta.dirname, 'diplomado-direccion-gestion-seguridad-ciudadana.html'),
        diplomadoInterculturalidad: resolve(import.meta.dirname, 'diplomado-interculturalidad-convivencia-desarrollo-social.html'),
        proyectosInversionIa: resolve(import.meta.dirname, 'proyectos-inversion-publica-ia.html')
      }
    }
  }
});
