# Padrón de accesos del Aula Virtual

El aula utiliza `alumnos-accesos.csv` como padrón público. Cada acceso emplea el DNI de ocho dígitos como usuario y como contraseña.

## Formato

```csv
dni,nombre,curso_id,programa,estado
00000000,Estudiante de demostración,ia-derecho-4ta,Inteligencia Artificial Aplicada al Derecho – Cuarta Edición,activo
```

Debe existir una fila por cada relación alumno–curso. Si una persona pertenece a dos cursos, se repite el mismo DNI en dos filas y se cambia `curso_id`. Al iniciar sesión, el aula agrupa automáticamente todas las filas activas del DNI y muestra únicamente esos cursos.

Los identificadores válidos son:

- `ia-derecho-4ta`
- `formulacion-inversiones-publicas-ia`
- `gestion-servicio-serenazgo-municipal`
- `ia-derecho-3ra`
- `ia-derecho-2da`
- `ia-derecho-1ra`
- `pae-gerencia-seguridad-criminologia`
- `orden-interno-seguridad-ciudadana`
- `proyectos-inversion-publica-ia`

## Reglas de actualización

- El DNI debe conservarse como texto de exactamente ocho dígitos, incluidos los ceros iniciales.
- `estado` debe ser `activo` para habilitar el acceso.
- Los nombres de archivo y las cabeceras del CSV no deben modificarse.
- El archivo debe guardarse como CSV UTF-8 en la misma carpeta que `aula-virtual.html`.
- El usuario maestro `77800233` tiene acceso a las nueve aulas del catálogo.
- Las etiquetas `Abierto` y `Cerrado` son únicamente informativas y no alteran el permiso de ingreso.
- Un curso con etiqueta `Cerrado` se habilita normalmente cuando existe una fila activa que lo asigna al DNI.

`resumen-integracion-alumnos.json` registra los conteos obtenidos del SIRA e `inconsistencias-alumnos.csv` conserva los casos que requieren revisión administrativa.
