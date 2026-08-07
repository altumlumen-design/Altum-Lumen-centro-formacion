# Formato de alumnos para el Aula Virtual

La fuente administrativa recomendada es un archivo CSV UTF-8 con una fila por matrícula:

```csv
codigo_alumno,dni,nombre,curso_id,estado
ALU-DEMO-001,00000000,Estudiante de demostración,ia-derecho-2da,activo
```

Si un alumno tiene dos cursos, se repite su código en dos filas y cambia `curso_id`. Los identificadores válidos son:

- `ia-derecho-2da`
- `ia-derecho-3ra`
- `ia-derecho-1ra`
- `pae-gerencia-seguridad-criminologia`
- `orden-interno-seguridad-ciudadana`
- `proyectos-inversion-publica-ia`

## Protección de datos

El repositorio es público. No se debe confirmar ni subir aquí un CSV con DNI reales. El archivo administrativo deberá importarse en un servicio privado, transformar el DNI en una credencial protegida y eliminar el archivo de importación. El navegador consultará ese servicio mediante el valor `authEndpoint` de `aula-config.js` y recibirá únicamente el nombre y los `curso_id` autorizados.

La plantilla incluida contiene solo datos ficticios. Mientras no se configure el servicio privado, el aula acepta únicamente el usuario maestro de demostración.
