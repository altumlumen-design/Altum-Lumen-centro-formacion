# Entrega del Aula Virtual con acceso por DNI

Esta entrega integra las 177 filas académicas de `SIRA 2026 (1).xlsm` con las once aulas del catálogo. Los programas anteriores conservan la etiqueta visual `Cerrado`, pero esa etiqueta no bloquea el ingreso cuando el curso está asignado al usuario.

## Acceso

- Alumno: escribe su DNI de ocho dígitos como usuario y repite el mismo DNI como contraseña.
- Usuario maestro: `77800233` / `77800233`.
- Un DNI puede tener uno o varios cursos. **Mis cursos** reúne automáticamente todas sus matrículas asignadas.
- Un DNI inexistente, incompleto o sin cursos asignados no puede iniciar sesión.
- El usuario maestro puede revisar las once aulas del catálogo.
- **Cerrar sesión** elimina la sesión del navegador y regresa al formulario de ingreso.

## Cursos abiertos

| Aula | Matrículas activas | Sesiones |
|---|---:|---:|
| Inteligencia Artificial Aplicada al Derecho – Cuarta Edición | 14 | 4 |
| Formulación de Inversiones Públicas con Inteligencia Artificial | 26 | 4 |
| Gestión del Servicio de Serenazgo Municipal | 11 | 4 |
| **Subtotal abierto** | **51** |  |

Las 26 matrículas de inversiones y las 11 de serenazgo coinciden completamente con las listas auxiliares de `Hoja 2`.

## Programas cerrados

| Aula finalizada | Asignaciones con acceso |
|---|---:|
| Inteligencia Artificial para el Derecho – Tercera Edición | 3 |
| Inteligencia Artificial para el Derecho – Segunda Edición | 42 |
| Inteligencia Artificial para el Derecho – Primera Edición | 15 |
| Gerencia de Seguridad y Criminología | 4 |
| Orden Interno y Seguridad Ciudadana | 34 |
| Dirección y Gestión de la Seguridad Ciudadana | 20 |
| Interculturalidad, Convivencia y Desarrollo Social | 1 |
| Proyectos de Inversión Pública con Inteligencia Artificial | 3 |
| **Subtotal finalizado** | **122** |

Estas ocho aulas conservan la etiqueta `Cerrado`. La etiqueta es solo informativa: el alumno puede ingresar normalmente cuando el curso está asignado a su DNI. Tanto la tarjeta de **Mis cursos** como el aula muestran el aviso: “Este curso o programa ya finalizó. Puedes acceder a tus clases virtuales”.

## Resultado de la revisión del SIRA

- 177 filas académicas revisadas y asociadas a un aula.
- 173 relaciones únicas alumno–curso después de eliminar matrículas duplicadas del mismo curso.
- 157 usuarios únicos con DNI válido.
- 13 personas tienen más de un curso; el máximo encontrado es tres.
- Eloy Zenón (`80320361`) recibe el PAE de Gerencia de Seguridad y Criminología.
- Jaime Calderón (`09679293`) recibe Serenazgo Municipal, Orden Interno y el PAE.
- Una matrícula de Orden Interno no puede convertirse en acceso porque el SIRA no contiene DNI para esa persona.
- Dos variantes de nombre asociadas al mismo DNI se resolvieron usando el registro más reciente, conforme al criterio indicado.

## Archivos de datos

- `alumnos-accesos.csv`: padrón que lee el aula en tiempo de ejecución.
- `inconsistencias-alumnos.csv`: contiene la matrícula sin DNI y las dos variantes de nombre detectadas.
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
