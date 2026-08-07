# Entrega del Aula Virtual con acceso por DNI

Esta entrega integra el padrón de `SIRA 2026 (1).xlsm` con los tres cursos abiertos en agosto de 2026. Los programas anteriores conservan la etiqueta visual `Cerrado`, pero esa etiqueta no bloquea el ingreso cuando el curso está asignado al usuario.

## Acceso

- Alumno: escribe su DNI de ocho dígitos como usuario y repite el mismo DNI como contraseña.
- Usuario maestro: `77800233` / `77800233`.
- Un DNI puede tener uno o varios cursos. **Mis cursos** reúne automáticamente todas sus matrículas asignadas.
- Un DNI inexistente, incompleto o sin cursos asignados no puede iniciar sesión.
- El usuario maestro puede revisar las nueve aulas del catálogo.
- **Cerrar sesión** elimina la sesión del navegador y regresa al formulario de ingreso.

## Cursos abiertos

| Aula | Matrículas activas | Sesiones |
|---|---:|---:|
| Inteligencia Artificial Aplicada al Derecho – Cuarta Edición | 14 | 4 |
| Formulación de Inversiones Públicas con Inteligencia Artificial | 26 | 4 |
| Gestión del Servicio de Serenazgo Municipal | 11 | 4 |
| **Total de asignaciones** | **51** |  |

El padrón contiene 49 usuarios únicos. Una persona está matriculada en los tres cursos, por lo que recibe las tres aulas después de iniciar sesión.

La revisión encontró cero DNI inválidos y cero conflictos de identidad dentro de los cursos abiertos. Las 26 matrículas de inversiones y las 11 de serenazgo coinciden completamente con las listas auxiliares de `Hoja 2`.

## Programas cerrados

Las tres ediciones anteriores de IA para el Derecho, el PAE de Gerencia de Seguridad y Criminología, el Diplomado de Orden Interno y Seguridad Ciudadana y la edición anterior de Proyectos de Inversión Pública con IA conservan la etiqueta `Cerrado`. Esta etiqueta es solo informativa: un alumno puede ingresar si su DNI tiene ese curso asignado en `alumnos-accesos.csv`.

## Archivos de datos

- `alumnos-accesos.csv`: padrón que lee el aula en tiempo de ejecución.
- `inconsistencias-alumnos.csv`: archivo de control; en esta entrega contiene solo la cabecera porque no se detectaron incidencias activas.
- `resumen-integracion-alumnos.json`: conteos y criterios aplicados durante la conversión.
- `alumnos-plantilla.csv`: ejemplo ficticio para futuras actualizaciones.

El formato del padrón es:

```csv
dni,nombre,curso_id,programa,estado
```

Debe existir una fila por cada curso asignado al alumno y `estado` debe ser `activo`.

## Cómo subir esta entrega a GitHub

1. Descomprime el ZIP.
2. Sube **el contenido de la carpeta**, no el ZIP, a la raíz del repositorio.
3. Acepta el reemplazo de los archivos existentes que tengan el mismo nombre.
4. No cambies el nombre ni la ubicación de `alumnos-accesos.csv`.
5. Comprueba la publicación abriendo `aula-virtual.html` desde la URL de GitHub Pages.

Para una compilación local opcional:

```bash
npm ci
npm test
npm run build
```

La carpeta `dist/` resultante incluye los tres archivos de datos necesarios.

## Alcance técnico

La validación solicitada es estática y se ejecuta en el navegador. En un repositorio o sitio público, el CSV puede ser descargado por cualquier visitante y el DNI usado como contraseña no constituye autenticación segura. Para un control de acceso real se necesita un servicio privado con contraseñas protegidas; la interfaz conserva la opción `authEndpoint` para esa evolución futura.
