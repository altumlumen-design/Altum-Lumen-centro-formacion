# Sincronización del acceso institucional

`sira-acceso.html` contiene la interfaz del portal; `sira-bridge.js` solo comunica sus operaciones con la implementación existente de Apps Script. Publicar una versión del backend no sustituye ese HTML.

Para actualizar la interfaz, usar exactamente el `Index.html` que se guardó y publicó en Apps Script:

```sh
npm run sync:sira -- /ruta/al/Index.html
npm run sync:sira -- /ruta/al/Index.html --check
npm run test:sira
```

El generador conserva los metadatos institucionales y el puente de comunicación, incorpora los estilos y funciones del mismo Index, y actualiza los accesos del portal. Guarda el SHA-256 de la fuente normalizada en `meta[name="sira-source-sha256"]`.

No volver a cargar `sira-teacher-career.js` junto a la interfaz actual: sus funciones ya están incorporadas en Index y la antigua capa externa las sobrescribe.

Antes de publicar, respaldar el commit anterior. Después, comprobar el ingreso real por `sira-acceso.html` desde el portal, además del `/exec` de Apps Script. Verificar contador de anexos, una sola fila nueva, ausencia de la casilla antigua y versión visible. Comprobar también operador, móvil y descargas. No utilizar operaciones financieras o emisión de documentos como pruebas de conectividad.

La revisión `--check` requiere la fuente canónica de Apps Script y falla si el mirror o los enlaces no coinciden; no debe sustituirse por una comprobación del número de versión solamente.
