import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// El mismo Index.html publicado en Apps Script genera el acceso de GitHub.
// Uso: npm run sync:sira -- /ruta/al/Index.html [--check]
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourcePath=process.argv.slice(2).find(value=>!value.startsWith('--'));
if(!sourcePath)throw new Error('Indica el Index.html de la versión vigente de Apps Script.');
const source=fs.readFileSync(path.resolve(sourcePath),'utf8').replace(/\r\n/g,'\n');
const version=source.match(/const SIRA_CLIENT_BUILD='([^']+)'/)?.[1];
if(!version||!source.includes('function aulaRefreshAdditionalSession_('))throw new Error('El archivo no corresponde a la interfaz vigente de SIRA.');
if(source.includes('Hasta dos PDF'))throw new Error('Se rechazó una fuente anterior al gestor de 15 anexos.');
const sourceHash=crypto.createHash('sha256').update(source).digest('hex');
const build='20261027-sira-'+version.replace(/\./g,'')+'-r1';
const metadata=`<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="sira-source-sha256" content="${sourceHash}">
  <title>SIRA ${version} | Centro de Formación y Capacitación Profesional</title>
  <meta name="description" content="SIRA · Sistema Institucional de Registros Académicos de ALTUM LUMEN S.A.C. Acceso institucional para personal autorizado.">
  <link rel="canonical" href="https://altumlumen-design.github.io/Altum-Lumen-centro-formacion/sira-acceso.html">
  <meta property="og:locale" content="es_PE">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ALTUM LUMEN">
  <meta property="og:title" content="SIRA | Centro de Formación y Capacitación Profesional">
  <meta property="og:description" content="Sistema Institucional de Registros Académicos de ALTUM LUMEN S.A.C. · Acceso institucional.">
  <meta property="og:url" content="https://altumlumen-design.github.io/Altum-Lumen-centro-formacion/sira-acceso.html">
  <meta property="og:image" content="https://altumlumen-design.github.io/Altum-Lumen-centro-formacion/assets/social-preview/sira-acceso-20261016.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="SIRA | ALTUM LUMEN">
  <meta name="twitter:description" content="Acceso al Sistema Institucional de Registros Académicos de ALTUM LUMEN.">
  <meta name="twitter:image" content="https://altumlumen-design.github.io/Altum-Lumen-centro-formacion/assets/social-preview/sira-acceso-20261016.jpg">
  <link rel="icon" type="image/png" href="https://raw.githubusercontent.com/altumlumen-design/Altum-Lumen-centro-formacion/main/assets/logo-altum-lumen.png">
  `;
const styleStart=source.indexOf('  <style>');
if(styleStart<0)throw new Error('No se encontró el estilo principal de SIRA.');
let output='<!DOCTYPE html>\n<!-- Generado desde Index.html de Apps Script; usar npm run sync:sira. -->\n<html lang="es" data-sira-surface="github-pages">\n<head>\n'+metadata+source.slice(styleStart);
output=output.replace('</head>',`  <script src="aula-config.js?v=${build}"></script>\n  <script src="sira-bridge.js?v=${build}"></script>\n</head>`);
// La trayectoria y la navegación ya vienen integradas en Index.html; no cargar
// la antigua capa externa que redefinía esas funciones y la marca de versión.
const target=path.join(root,'sira-acceso.html');
const existing=fs.readFileSync(target,'utf8');
const normalized=output.replace(/\r\n/g,'\n');
const portalPath=path.join(root,'index.html'),portal=fs.readFileSync(portalPath,'utf8');
const updatedPortal=portal.replace(/sira-acceso\.html(?:\?v=[^"'\s<>]+)?/g,'sira-acceso.html?v='+build);
if(process.argv.includes('--check')){
  if(existing.replace(/\r\n/g,'\n')!==normalized)throw new Error('El acceso de GitHub no coincide con Index.html. Ejecuta npm run sync:sira.');
  if(portal!==updatedPortal)throw new Error('Los enlaces del portal todavía señalan una versión anterior de SIRA.');
  console.log(`OK: GitHub y Apps Script comparten la interfaz SIRA ${version} (${sourceHash.slice(0,12)}).`);
}else{
  fs.writeFileSync(target,existing.includes('\r\n')?normalized.replace(/\n/g,'\r\n'):normalized);
  if(portal!==updatedPortal)fs.writeFileSync(portalPath,updatedPortal);
  console.log(`Generado sira-acceso.html desde SIRA ${version} (${sourceHash.slice(0,12)}).`);
}
