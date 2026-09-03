/*
 * ALTUM LUMEN · Verificación pública
 * Actualización: 03/09/2026
 *
 * SUBIR JUNTO CON: registros_publicos.json
 * Ambos archivos conservan el mismo nombre base: registros_publicos
 *
 * La base histórica se conserva fijada al commit previo a esta actualización.
 * registros_publicos.json contiene la capa acumulativa de registros nuevos.
 */
(() => {
  'use strict';

  const VERSION = '20260903-1453';
  const HISTORICO_URL = 'https://raw.githubusercontent.com/altumlumen-design/Altum-Lumen-centro-formacion/506dcb58b4aabfa09a27869f02a19b77dd35c2ae/registros_publicos.json';
  const ACTUALIZACION_URL = 'registros_publicos.json?v=' + encodeURIComponent(VERSION);

  function cargarJsonSincrono(url, etiqueta) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    try {
      xhr.send(null);
    } catch (error) {
      throw new Error('No se pudo cargar ' + etiqueta + ': ' + (error && error.message ? error.message : error));
    }
    if (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) {
      throw new Error(etiqueta + ' respondió HTTP ' + xhr.status + '.');
    }
    const data = JSON.parse(xhr.responseText || '[]');
    if (!Array.isArray(data)) throw new Error(etiqueta + ' no contiene un arreglo válido.');
    return data;
  }

  function fusionarRegistros(base, actualizacion) {
    const porCodigo = new Map();
    const sinCodigo = [];

    (base || []).forEach((registro) => {
      if (!registro || typeof registro !== 'object') return;
      const codigo = String(registro.codigo_emision || '').trim();
      if (codigo) porCodigo.set(codigo, registro);
      else sinCodigo.push(registro);
    });

    (actualizacion || []).forEach((registro) => {
      if (!registro || typeof registro !== 'object') return;
      const codigo = String(registro.codigo_emision || '').trim();
      if (codigo) porCodigo.set(codigo, registro);
      else sinCodigo.push(registro);
    });

    return sinCodigo.concat(Array.from(porCodigo.values()));
  }

  try {
    const baseHistorica = cargarJsonSincrono(HISTORICO_URL, 'la base histórica');
    const actualizacion = cargarJsonSincrono(ACTUALIZACION_URL, 'registros_publicos.json');
    window.REGISTROS_PUBLICOS = fusionarRegistros(baseHistorica, actualizacion);
    window.REGISTROS_PUBLICOS_META = Object.freeze({
      version: VERSION,
      baseHistorica: baseHistorica.length,
      actualizacion: actualizacion.length,
      total: window.REGISTROS_PUBLICOS.length
    });
  } catch (error) {
    console.error('[ALTUM LUMEN] Error al preparar registros públicos:', error);
    window.REGISTROS_PUBLICOS = [];
    window.REGISTROS_PUBLICOS_META = Object.freeze({
      version: VERSION,
      baseHistorica: 0,
      actualizacion: 0,
      total: 0,
      error: String(error && error.message ? error.message : error)
    });
  }
})();
