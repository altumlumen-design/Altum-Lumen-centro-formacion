# Aula Virtual Altum Lumen — paquete de carga

## Acceso temporal

- Usuario maestro: `77800233`
- Contraseña: `77800233`

El usuario maestro puede abrir las seis aulas incluidas en este paquete.

## Cómo cargarlo en GitHub

1. Descomprime el ZIP.
2. Abre el repositorio `altumlumen-design/Altum-Lumen-centro-formacion`.
3. Carga **todos los archivos directamente en la raíz del repositorio**, junto a los HTML actuales. No cargues la carpeta contenedora como una subcarpeta.
4. GitHub indicará que algunos archivos ya existen: confirma su reemplazo.
5. Confirma el commit y espera la actualización de GitHub Pages.
6. Abre `aula-virtual.html` desde la dirección pública del sitio.

Es indispensable conservar exactamente los nombres de los archivos. Los HTML, JavaScript, CSS, logotipo y portadas usan rutas relativas entre sí.

## Integración posterior de alumnos

`alumnos-plantilla.csv` contiene únicamente ejemplos ficticios y muestra el formato acordado. `FORMATO-ALUMNOS.md` documenta los identificadores válidos de los seis cursos. El punto de conexión futuro está reservado en `aula-config.js`, mediante `authEndpoint`.

El repositorio es público: **no cargues códigos reales, DNI reales ni contraseñas reales en GitHub**. Para accesos reales, el CSV deberá importarse en un servicio privado y el aula consultará ese servicio. Hasta configurar ese servicio, solamente funciona el usuario maestro.

## Archivos de desarrollo

Se incluyen `package.json`, `vite.config.js` y `test-aula.mjs` para compilar y comprobar el aula. No son necesarios para navegar en GitHub Pages, pero permiten mantener y validar el proyecto.
