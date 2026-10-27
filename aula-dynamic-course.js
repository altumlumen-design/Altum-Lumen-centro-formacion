(function () {
  'use strict';

  const TZ = 'America/Lima';
  const COURSE_CACHE_TTL_MS = 0; // Datos financieros y permisos siempre se validan en SIRA.
  const MATERIAL_MAX_BYTES = 15 * 1024 * 1024;
  const MATERIAL_READY_MS = 5 * 60 * 1000;
  const MATERIAL_READY_LIMIT = 3;
  const preparedMaterials = new Set();
  const courseCountdownTimers = [];
  let materialFeedbackId = 0;
  let materialPageHidden = false;

  window.addEventListener('pagehide', () => {
    materialPageHidden = true;
    clearPreparedMaterials();
  });
  window.addEventListener('pageshow', () => { materialPageHidden = false; });

  function esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    const text = String(value || '').trim();
    return /^https:\/\/[^\s]+$/i.test(text) ? text : '';
  }

  function safeZoomUrl(value) {
    const text = safeUrl(value);
    if (!text) return '';
    try {
      const host = new URL(text).hostname.toLowerCase();
      return host === 'zoom.us' || host.endsWith('.zoom.us') ? text : '';
    } catch (_error) { return ''; }
  }

  function asDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dateParts(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce((o, p) => (o[p.type] = p.value, o), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function formatDate(value, withTime) {
    const date = asDate(value);
    if (!date) return value ? String(value) : '';
    const options = withTime
      ? { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: TZ }
      : { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ };
    return new Intl.DateTimeFormat('es-PE', options).format(date);
  }

  function formatShortDate(value) {
    const date = asDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(date);
  }

  function formatTime(value) {
    const date = asDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(date);
  }

  function money(value) {
    const n = Number(value || 0);
    return `S/ ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
  }

  function courseCacheKey(courseId, session) {
    const who = String(session?.studentCode || session?.dni || session?.role || 'guest').replace(/[^a-z0-9_-]/gi, '');
    return `altum_aula_course_cache_v32_${who}_${String(courseId || '')}`;
  }

  function readCourseCache(courseId, session) {
    return null;
  }

  function writeCourseCache(courseId, session, course) {
    try { window.sessionStorage.removeItem(courseCacheKey(courseId, session)); } catch (_error) {}
  }

  function zoomMark() {
    return `<span class="zoom-mark" aria-hidden="true"><svg viewBox="0 0 24 24" role="img"><rect x="3" y="6" width="12" height="12" rx="3"></rect><path d="M15 10.1 20.2 7.5c.4-.2.8.1.8.6v7.8c0 .5-.4.8-.8.6L15 13.9z"></path></svg></span>`;
  }

  // Un único enlace de Zoom por curso. Primero usa SIRA; para cursos históricos
  // todavía no normalizados aprovecha el enlace del catálogo estático existente.
  function courseZoomUrl(course, sessions) {
    const direct = safeZoomUrl(course?.zoomUrl);
    if (direct) return direct;
    const inherited = (sessions || []).map(session => safeZoomUrl(session?.zoomUrl)).find(Boolean);
    if (inherited) return inherited;
    const courseId = String(course?.id || '');
    const legacy = (Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : []).find(item => String(item?.id || '') === courseId);
    return safeZoomUrl(legacy?.schedule?.liveUrl);
  }

  function zoomResourceBlock(url) {
    const href = safeZoomUrl(url);
    if (!href) return '';
    return `<div class="session-resource-state is-done is-zoom">
      <div class="session-resource-copy">${zoomMark()}<div><small>Clase en vivo</small><strong>Zoom disponible</strong></div></div>
      <a class="class-resource is-live" href="${esc(href)}" target="_blank" rel="noopener">Unirse</a>
    </div>`;
  }

  function resourceBlock(url, label, kind, icon) {
    const href = safeUrl(url), done = Boolean(href);
    return `<div class="session-resource-state ${done ? 'is-done' : 'is-pending'}">
      <div class="session-resource-copy"><span>${esc(icon || '•')}</span><div><small>${esc(label)}</small><strong>${done ? 'Disponible ✓' : 'Pendiente'}</strong></div></div>
      ${done ? `<a class="class-resource ${esc(kind || '')}" href="${esc(href)}" target="_blank" rel="noopener">Abrir</a>` : ''}
    </div>`;
  }

  function driveFileId(value) {
    const href = safeUrl(value);
    if (!href) return '';
    try {
      if (!['drive.google.com', 'drive.usercontent.google.com'].includes(new URL(href).hostname.toLowerCase())) return '';
    } catch (_error) { return ''; }
    const patterns = [/\/file\/d\/([A-Za-z0-9_-]+)/i, /[?&]id=([A-Za-z0-9_-]+)/i, /\/d\/([A-Za-z0-9_-]+)/i];
    for (const pattern of patterns) {
      const match = href.match(pattern);
      if (match) return match[1];
    }
    return '';
  }

  function materialResourceBlock(courseId, session) {
    const state = String(session?.materialState || '').trim().toUpperCase();
    const note = String(session?.materialNote || '').trim();
    if (state === 'NO_CORRESPONDE') {
      return `<div class="session-resource-state is-pending" style="border-style:solid">
        <div class="session-resource-copy"><span>▣</span><div><small>Material</small><strong>No corresponde</strong>${note ? `<small style="margin-top:4px;max-width:460px;white-space:normal;line-height:1.35;text-transform:none;letter-spacing:0">${esc(note)}</small>` : ''}</div></div>
      </div>`;
    }
    const href = safeUrl(session?.materialUrl);
    const managed = Boolean(driveFileId(href) || String(session?.materialFileId || '').trim()
      || (session?.materialDelivery === 'SIRA' && state === 'DISPONIBLE'));
    const done = Boolean(href || managed);
    const name = String(session?.materialName || `material-sesion-${session?.number || ''}.pdf`);
    return `<div class="session-resource-state ${done ? 'is-done' : 'is-pending'}">
      <div class="session-resource-copy"><span>▣</span><div><small>Material</small><strong>${done ? 'Disponible ✓' : 'Pendiente'}</strong></div></div>
      ${managed ? `<div class="material-download-actions"><button class="class-resource is-material" type="button" data-material-action="download" data-material-resource="MAIN" data-course="${esc(courseId)}" data-session="${esc(session?.number || '')}" data-revision="${esc(session?.materialRevision || '')}" data-name="${esc(name)}" aria-label="Descargar material: ${esc(name)}">Descargar</button></div>`
        : done ? `<a class="class-resource is-material" href="${esc(href)}" target="_blank" rel="noopener">Abrir</a>` : ''}
    </div>`;
  }

  function additionalMaterialResourceBlocks(courseId, session) {
    const items = Array.isArray(session?.additionalMaterials) ? session.additionalMaterials : [];
    const row = (item) => {
      const isReading = String(item?.kind || '').trim().toUpperCase() === 'LECTURA_OBLIGATORIA';
      const typeLabel = isReading ? 'Lectura obligatoria' : 'Material anexo';
      const title = String(item?.title || item?.name || typeLabel).trim();
      const filename = String(item?.name || '').trim();
      return `<div class="session-additional-row ${isReading ? 'is-required-reading' : 'is-annex'}">
        <div class="session-additional-mark">${isReading ? 'L' : 'A'}</div>
        <div class="session-additional-copy"><small>${esc(typeLabel)}</small><strong>${esc(title)}</strong>${filename ? `<span>${esc(filename)}</span>` : ''}</div>
        <div class="session-additional-actions"><button class="class-resource is-material" type="button" aria-label="Descargar: ${esc(title)}" data-additional-action="download" data-course="${esc(courseId)}" data-session="${esc(session?.number || '')}" data-slot="${esc(item?.slot || '')}" data-revision="${esc(item?.revision || '')}" data-name="${esc(filename || title)}">Descargar</button></div>
      </div>`;
    };
    if (!items.length) return '';
    if (items.length <= 2) return items.map(row).join('');
    const names = items.map(item => String(item?.name || item?.title || 'Archivo').trim()).filter(Boolean).join(' · ');
    return `<details class="session-additional-disclosure"><summary><span>Ver anexos</span><strong>${items.length} ${items.length === 1 ? 'archivo' : 'archivos'}</strong><small>${esc(names)}</small></summary><div class="session-additional-list">${items.map(row).join('')}</div></details>`;
  }

  function scheduleState(session, now, todayKey, nextId) {
    const start = asDate(session.start), end = asDate(session.end) || start;
    if (!start) return safeUrl(session?.recordingUrl) || safeUrl(session?.materialUrl) || (Array.isArray(session?.additionalMaterials) && session.additionalMaterials.length) ? { key: 'done', label: 'Sesión realizada' } : { key: 'scheduled', label: 'Programada' };
    const key = dateParts(start);
    if (key === todayKey) return { key: 'today', label: 'Hoy' };
    if (end && end.getTime() < now.getTime()) return { key: 'done', label: 'Sesión realizada' };
    if (nextId && session.id === nextId) return { key: 'next', label: 'Próxima' };
    return { key: 'scheduled', label: 'Programada' };
  }

  function copyButton() {
    return '<button class="copy-link-btn" type="button" data-copy-zoom aria-label="Copiar el mismo enlace de Zoom del botón anterior">Copiar enlace</button>';
  }

  function isEvaluationOnlySession(session) {
    const semantic = String(session?.title || '').toLocaleLowerCase('es-PE');
    const looksLikeEvaluation = /examen|evaluaci[oó]n/.test(semantic);
    const hasClassResource = Boolean(safeUrl(session?.recordingUrl) || safeUrl(session?.materialUrl) || (Array.isArray(session?.additionalMaterials) && session.additionalMaterials.length) || session?.start);
    return looksLikeEvaluation && !hasClassResource;
  }

  function collectEvaluations(course, sessions) {
    const out = [], seen = new Set();
    (Array.isArray(course?.evaluations) ? course.evaluations : []).forEach(item => {
      if (!item) return;
      const key = String(item.url || item.id || '');
      if (key && seen.has(key)) return;
      if (key) seen.add(key);
      out.push(item);
    });
    (sessions || []).forEach(session => {
      const url = safeUrl(session?.evaluationUrl);
      if (!url || seen.has(url)) return;
      seen.add(url);
      const semantic = String(session?.title || '').toLocaleLowerCase('es-PE');
      const moduleMatch = semantic.match(/m[oó]dulo\s*(\d+)/i);
      const moduleNumber = moduleMatch ? Number(moduleMatch[1]) : 0;
      out.push({
        id: `legacy-${session.id || session.number || out.length}`,
        title: /examen|evaluaci[oó]n/.test(semantic) ? (session.title || 'Evaluación') : (moduleNumber ? `Evaluación · Módulo ${moduleNumber}` : `Evaluación · Sesión ${session.number || ''}`),
        description: 'Evaluación académica del curso.',
        type: moduleNumber ? 'MODULO' : 'LEGACY', moduleNumber, published: true, accepting: true, available: true, url
      });
    });
    return out.sort((a, b) => Number(a.moduleNumber || 999) - Number(b.moduleNumber || 999));
  }

  function countdownLabel(startValue, endValue, now) {
    const start = asDate(startValue), end = asDate(endValue);
    if (!start) return '';
    const diff = start.getTime() - now.getTime();
    if (diff <= 0 && (!end || now.getTime() <= end.getTime())) return 'La clase está en curso';
    if (end && now.getTime() > end.getTime()) return 'La sesión de hoy ya finalizó';
    const mins = Math.max(0, Math.ceil(diff / 60000));
    if (mins < 60) return `Faltan ${mins} min`;
    if (mins < 24 * 60) { const h = Math.floor(mins / 60), m = mins % 60; return `Faltan ${h} h${m ? ` ${m} min` : ''}`; }
    const days = Math.ceil(mins / 1440); return `Faltan ${days} día${days === 1 ? '' : 's'}`;
  }

  function liveClassCard(course, sessions, now, todayKey) {
    const dated = sessions.filter(s => asDate(s.start));
    const today = dated.find(s => dateParts(asDate(s.start)) === todayKey);
    const upcoming = dated.filter(s => asDate(s.start).getTime() >= now.getTime()).sort((a, b) => asDate(a.start) - asDate(b.start))[0];
    const focus = today || upcoming || null;
    const zoomUrl = courseZoomUrl(course, sessions);
    // El enlace Zoom es único por curso, pero solo debe exponerse el día de la clase.
    // Un curso ya culminado no mantiene un botón de Zoom permanente en pantalla.
    if (!focus) return '';

    const title = today ? `✓ Hoy tienes clase${focus.number ? ` · Sesión ${esc(focus.number)}` : ''}` : `Próxima clase${focus.number ? ` · Sesión ${esc(focus.number)}` : ''}`;
    const when = `${formatDate(focus.start, true)}${focus.end ? ` – ${formatTime(focus.end)}` : ''}`;
    const count = countdownLabel(focus.start, focus.end, now);

    return `<section class="class-live-card ${today ? 'is-today' : ''}">
      <div class="class-live-icon">${today ? '<span class="today-check" aria-hidden="true">✓</span>' : zoomMark()}</div>
      <div class="class-live-copy">
        <span class="eyebrow">${today ? 'Clase de hoy' : 'Siguiente sesión'}</span>
        <h2>${title}</h2>
        <p>${esc(when)}</p>
        <strong class="class-countdown" data-countdown-start="${esc(focus.start || '')}" data-countdown-end="${esc(focus.end || '')}">${esc(count)}</strong>
        ${focus.reprogrammed ? `<span class="reprogrammed-note">↻ Sesión reprogramada${focus.previousStart ? ` · fecha anterior: ${esc(formatDate(focus.previousStart, false))}` : ''}</span>` : ''}
        <div class="live-reminders" role="note" aria-label="Recordatorios para la clase en vivo">
          <span>✓ Recuerda ingresar con tu nombre completo a la sesión.</span>
          <span>✓ Ingresa 5 minutos antes de la hora programada.</span>
        </div>
      </div>
      <div class="class-live-actions">
        ${today
          ? (zoomUrl ? `<a class="class-btn class-btn-primary" data-zoom-join href="${esc(zoomUrl)}" target="_blank" rel="noopener">${zoomMark()}<span>Unirse a la sesión</span></a>${copyButton()}` : '<span class="class-muted-note">El enlace de Zoom del curso aún no ha sido publicado.</span>')
          : '<span class="class-muted-note">El acceso de Zoom se mostrará el día de la sesión.</span>'}
      </div>
    </section>`;
  }

  function whatsappCard(course) {
    const href = safeUrl(course?.whatsappUrl);
    if (!href) return '';
    return `<section class="course-community-card"><div><span class="eyebrow">Comunidad del curso</span><h2>Grupo de WhatsApp</h2><p>Accede al grupo oficial registrado para este curso.</p></div><a class="whatsapp-btn" href="${esc(href)}" target="_blank" rel="noopener">Entrar al grupo de WhatsApp</a></section>`;
  }

  function financeCard(finance) {
    if (!finance) return '';
    if (finance.state === 'MOROSO') {
      return `<div class="student-summary-card is-debt"><small>Estado económico</small><strong>Moroso · ${esc(money(finance.balance))}</strong><span>${esc(finance.message || 'Cobranza cerrada administrativamente.')}</span></div>`;
    }
    if (finance.state === 'PENDIENTE') {
      return `<div class="student-summary-card is-debt"><small>Estado económico</small><strong>Pendiente · ${esc(money(finance.balance))}</strong><span>${esc(finance.message || 'Tienes un saldo pendiente registrado.')}</span></div>`;
    }
    if (finance.state === 'EN_DEUDA_ATENDIDA') {
      return `<div class="student-summary-card is-debt"><small>Estado económico</small><strong>Deuda registrada · ${esc(money(finance.balance))}</strong><span>${esc(finance.message || 'El equipo ya revisó este saldo.')}</span></div>`;
    }
    if (finance.state === 'AL_DIA') {
      return `<div class="student-summary-card is-ok"><small>Estado económico</small><strong>Al día</strong><span>No registra saldo pendiente</span></div>`;
    }
    return `<div class="student-summary-card"><small>Estado económico</small><strong>Sin saldo registrado</strong><span>No hay un saldo pendiente informado</span></div>`;
  }

  function certificateCard(certificate) {
    if (certificate?.expired) return `<div class="student-summary-card is-debt"><small>Certificado</small><strong>Plazo de descarga finalizado</strong><span>${esc(certificate.message || 'Solicita el duplicado del certificado.')}</span></div>`;
    if (!certificate?.available) return '';
    const download = safeUrl(certificate.downloadUrl) || safeUrl(certificate.viewUrl);
    if (!download) return '';
    return `<div class="student-summary-card certificate-card"><small>Certificado</small><strong>Disponible</strong><span>${certificate.message ? esc(certificate.message) : (certificate.issueDate ? `Emitido ${esc(formatDate(certificate.issueDate, false))}` : 'Documento académico emitido')}</span>${certificate.expiresDate ? `<span>Descarga disponible hasta ${esc(formatDate(certificate.expiresDate, false))}.</span>` : ''}<a class="mini-action" href="${esc(download)}" target="_blank" rel="noopener">Descargar certificado</a></div>`;
  }

  function renderAgenda(sessions, now, todayKey) {
    const dated = sessions.filter(s => asDate(s.start));
    if (!dated.length) return '<div class="class-empty">El cronograma se administra desde Gestión del curso.</div>';
    const future = dated.filter(s => asDate(s.start).getTime() >= now.getTime()).sort((a, b) => asDate(a.start) - asDate(b.start));
    const nextId = future[0]?.id || '';
    return `<div class="agenda-list">${dated.map(s => {
      const st = scheduleState(s, now, todayKey, nextId), date = formatShortDate(s.start), time = formatTime(s.start);
      return `<div class="agenda-item ${st.key === 'today' ? 'is-today' : ''}">
        <div class="agenda-dot"></div>
        <div class="agenda-date"><strong>${esc(date)}</strong><span>${esc(time)}${s.end ? ` – ${esc(formatTime(s.end))}` : ''}</span></div>
        <div class="agenda-copy"><strong>Sesión ${esc(s.number || '')}</strong><span>${esc(s.title || `Sesión ${s.number || ''}`)}</span>${s.reprogrammed ? '<small class="agenda-reprogrammed">↻ Reprogramada</small>' : ''}</div>
        <span class="agenda-status is-${esc(st.key)}">${esc(st.label)}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function renderSessions(course, sessions, now, todayKey) {
    if (!sessions.length) return '<div class="class-empty">Las sesiones de este curso todavía no han sido publicadas.</div>';
    const sharedZoom = courseZoomUrl(course, sessions);
    const future = sessions.filter(s => asDate(s.start) && asDate(s.start).getTime() >= now.getTime()).sort((a, b) => asDate(a.start) - asDate(b.start));
    const nextId = future[0]?.id || '';
    return sessions.map(session => {
      const st = scheduleState(session, now, todayKey, nextId), dateLine = session.start ? `${formatDate(session.start, true)}${session.end ? ` – ${formatTime(session.end)}` : ''}` : '';
      return `<article class="class-session-card ${st.key === 'today' ? 'is-today' : ''}">
        <div class="class-session-top">
          <div class="class-session-number">${String(session.number || '').padStart(2, '0')}</div>
          <div class="class-session-heading">
            <span>Sesión ${esc(session.number || '')}</span>
            <h3>${esc(session.title || `Sesión ${session.number || ''}`)}</h3>
            ${dateLine ? `<time>${esc(dateLine)}</time>` : ''}
            ${session.reprogrammed ? `<small class="session-reprogrammed">↻ Reprogramada${session.previousStart ? ` · antes: ${esc(formatDate(session.previousStart, false))}` : ''}</small>` : ''}
          </div>
          <span class="agenda-status is-${esc(st.key)}">${esc(st.label)}</span>
        </div>
        <div class="class-session-actions resource-progress-grid">
          ${st.key === 'today' ? zoomResourceBlock(sharedZoom) : ''}
          ${resourceBlock(session.recordingUrl, 'Grabación / video', 'is-recording', '▶')}
          ${materialResourceBlock(course?.id || course?.courseId || '', session)}
          ${additionalMaterialResourceBlocks(course?.id || course?.courseId || '', session)}
        </div>
      </article>`;
    }).join('');
  }

  function evaluationCountdownLabel(deadlineValue, now) {
    const deadline = asDate(deadlineValue);
    if (!deadline) return '';
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) return 'Plazo finalizado';
    const mins = Math.max(1, Math.ceil(diff / 60000));
    if (mins < 60) return `Cierra en ${mins} min`;
    if (mins < 24 * 60) { const h = Math.floor(mins / 60), m = mins % 60; return `Cierra en ${h} h${m ? ` ${m} min` : ''}`; }
    const days = Math.floor(mins / 1440), rem = mins % 1440, hours = Math.floor(rem / 60);
    return `Quedan ${days} día${days === 1 ? '' : 's'}${hours ? ` ${hours} h` : ''}`;
  }

  function renderEvaluations(evaluations) {
    if (!evaluations.length) return '<div class="class-empty">No hay evaluaciones publicadas para este curso.</div>';
    const now = new Date();
    return `<div class="evaluation-list">${evaluations.map((evaluation, index) => {
      const href = safeUrl(evaluation.url), deadline = asDate(evaluation.deadline), expired = evaluation.expired === true || Boolean(deadline && deadline.getTime() <= now.getTime());
      const open = !expired && evaluation.available !== false && evaluation.accepting !== false && (href || evaluation.requiresAttemptCheck);
      const moduleLabel = Number(evaluation.moduleNumber || 0) ? `Módulo ${Number(evaluation.moduleNumber)}` : (evaluation.type === 'FINAL' ? 'Evaluación final' : 'Evaluación');
      const minGrade = Number(evaluation.minGrade || 13), attempts = Number(evaluation.maxAttempts || 3), pdf = safeUrl(evaluation.pdfUrl), countdown = evaluationCountdownLabel(evaluation.deadline, now);
      return `<article class="evaluation-card ${open ? 'is-open' : 'is-closed'}" data-evaluation-card data-eval-deadline="${esc(evaluation.deadline || '')}">
        <div class="evaluation-icon" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
        <div class="evaluation-copy">
          <span class="eyebrow">${esc(moduleLabel)}</span>
          <h3>${esc(evaluation.title || moduleLabel)}</h3>
          <p>${esc(evaluation.description || (open ? 'Evaluación habilitada para participantes matriculados.' : 'La evaluación se encuentra cerrada.'))}</p>
          <div class="evaluation-rules"><span>✓ Nota mínima: <b>${esc(minGrade)}</b></span><span>↻ Hasta <b>${esc(attempts)} intentos</b></span></div>
          ${evaluation.attemptMessage ? `<div class="evaluation-comment">${esc(evaluation.attemptMessage)}${evaluation.attemptsUsed !== null && evaluation.attemptsUsed !== undefined ? ` (${esc(evaluation.attemptsUsed)}/3)` : ''}</div>` : ''}
          ${evaluation.comment ? `<div class="evaluation-comment">${esc(evaluation.comment)}</div>` : ''}
          ${evaluation.deadline ? `<div class="evaluation-deadline ${expired ? 'is-expired' : ''}"><span>⏱</span><div><small>Cierre: ${esc(evaluation.deadlineText || formatDate(evaluation.deadline, true))}</small><strong data-eval-countdown>${esc(countdown)}</strong></div></div>` : ''}
          ${Number(evaluation.totalPoints || 0) ? `<small>${esc(evaluation.totalPoints)} punto(s)</small>` : ''}
          ${pdf ? `<a class="evaluation-pdf-link" href="${esc(pdf)}" target="_blank" rel="noopener">Ver PDF de indicaciones</a>` : ''}
        </div>
        <div class="evaluation-action">${open && evaluation.requiresAttemptCheck ? `<button class="class-btn evaluation-btn" data-eval-action data-eval-id="${esc(evaluation.id)}">${evaluation.masterAccess ? "Revisar evaluación · Maestro" : "Resolver evaluación"}</button>` : open ? `<a class="class-btn evaluation-btn" data-eval-action href="${esc(href)}" target="_blank" rel="noopener">Resolver evaluación</a>` : '<span class="evaluation-closed-label" data-eval-action>Bloqueada</span>'}</div>
      </article>`;
    }).join('')}</div>`;
  }

  function bindEvaluationCountdowns(root) {
    const cards = [...root.querySelectorAll('[data-evaluation-card][data-eval-deadline]')].filter(card => card.dataset.evalDeadline);
    if (!cards.length) return;
    const tick = () => {
      const now = new Date();
      cards.forEach(card => {
        const deadline = asDate(card.dataset.evalDeadline), label = card.querySelector('[data-eval-countdown]');
        if (!deadline) return;
        if (label) label.textContent = evaluationCountdownLabel(deadline, now);
        if (deadline.getTime() <= now.getTime()) {
          card.classList.remove('is-open'); card.classList.add('is-closed');
          card.querySelector('.evaluation-deadline')?.classList.add('is-expired');
          const action = card.querySelector('[data-eval-action]');
          if (action && (action.tagName === 'A' || action.tagName === 'BUTTON')) { action.removeAttribute('href'); if (action.tagName === 'BUTTON') action.disabled = true; action.removeAttribute('target'); action.className = 'evaluation-closed-label'; action.textContent = 'Bloqueada'; }
        }
      });
    };
    tick(); courseCountdownTimers.push(window.setInterval(tick, 30000));
  }

  function courseProgressCard(course, sessions, now) {
    const total = Math.max(0, Number(course?.totalSessions || sessions.length || 0));
    if (!total) return '';
    let completed = Math.max(0, Number(course?.completedSessions || 0));
    if (!course?.totalSessions) completed = sessions.filter(s => {
      const end = asDate(s.end) || asDate(s.start);
      return end ? end.getTime() < now.getTime() : Boolean(safeUrl(s.recordingUrl) || safeUrl(s.materialUrl));
    }).length;
    completed = Math.min(total, completed);
    const percent = Math.max(0, Math.min(100, Number.isFinite(Number(course?.progressPercent)) && Number(course.progressPercent) > 0
      ? Math.round(Number(course.progressPercent))
      : Math.round((completed / total) * 100)));
    const label = String(course?.statusLabel || (percent >= 100 ? 'Finalizado' : 'En curso'));
    return `<section class="course-progress-card" aria-label="Avance del curso">
      <div class="course-progress-head"><div><span class="eyebrow">Avance académico</span><strong>${esc(label)}</strong></div><b>${percent}%</b></div>
      <div class="course-progress-track"><span style="width:${percent}%"></span></div>
      <small>${completed} de ${total} sesiones realizadas</small>
    </section>`;
  }

  function bindCopyButtons(root) {
    root.querySelectorAll('[data-copy-zoom]').forEach(button => {
      button.addEventListener('click', async () => {
        // Fuente única: copiar siempre el href del mismo control que abre Zoom.
        // No conservamos una segunda URL en data-* que pueda quedar desactualizada
        // o cruzarse con el enlace independiente de WhatsApp.
        const join = button.closest('.class-live-actions')?.querySelector('a[data-zoom-join][href]');
        const url = safeZoomUrl(join?.href);
        if (!url) {
          button.textContent = 'Enlace no disponible';
          window.setTimeout(() => { button.textContent = 'Copiar enlace'; }, 1800);
          return;
        }
        const original = button.textContent;
        try {
          await navigator.clipboard.writeText(url);
          button.textContent = 'Copiado ✓';
        } catch (_error) {
          const area = document.createElement('textarea');
          area.value = url; area.style.position = 'fixed'; area.style.opacity = '0';
          document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
          button.textContent = 'Copiado ✓';
        }
        window.setTimeout(() => { button.textContent = original; }, 1800);
      });
    });
  }

  function blobFromMaterialPayload(payload) {
    const size = Number(payload?.size), encoded = String(payload?.base64 || '');
    if (!Number.isSafeInteger(size) || size <= 0 || size > MATERIAL_MAX_BYTES || !encoded || encoded.length > Math.ceil(MATERIAL_MAX_BYTES / 3) * 4) {
      throw new Error('El archivo recibido no es válido. Vuelve a pulsar Descargar.');
    }
    let raw;
    try { raw = atob(encoded); }
    catch (_error) { throw new Error('El archivo recibido está incompleto. Vuelve a pulsar Descargar.'); }
    if (raw.length !== size) throw new Error('El archivo llegó incompleto. Vuelve a pulsar Descargar.');
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    const blob = new Blob([bytes], { type: payload?.mime || 'application/octet-stream' });
    if (blob.size !== size) throw new Error('No fue posible preparar el archivo completo. Vuelve a pulsar Descargar.');
    return blob;
  }

  function releasePreparedMaterial(entry, message) {
    if (!preparedMaterials.delete(entry)) return;
    window.clearTimeout(entry.timer);
    URL.revokeObjectURL(entry.url);
    entry.link.remove();
    if (message && entry.feedback.isConnected) setMaterialFeedback(entry.feedback, message);
  }

  function clearPreparedMaterials() {
    [...preparedMaterials].forEach(entry => releasePreparedMaterial(entry, 'Para guardar este archivo, vuelve a pulsar Descargar.'));
  }

  function materialFeedback(button) {
    const actions = button.closest('.session-additional-actions, .material-download-actions');
    let feedback = actions.querySelector('[data-material-feedback]');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'material-download-feedback';
      feedback.dataset.materialFeedback = '';
      feedback.id = `material-feedback-${++materialFeedbackId}`;
      actions.appendChild(feedback);
      button.setAttribute('aria-describedby', feedback.id);
    }
    return feedback;
  }

  function setMaterialFeedback(feedback, message, error = false) {
    feedback.hidden = false;
    feedback.classList.toggle('is-error', error);
    feedback.setAttribute('role', error ? 'alert' : 'status');
    feedback.setAttribute('aria-live', error ? 'assertive' : 'polite');
    let copy = feedback.querySelector('[data-material-message]');
    if (!copy) {
      copy = document.createElement('span');
      copy.dataset.materialMessage = '';
      feedback.prepend(copy);
    }
    copy.textContent = message;
  }

  function materialSessionExpired(result, courseId, feedback) {
    if (result?.code !== 'SESSION_EXPIRED' && !window.AltumAuth.isDefinitiveSessionFailure(result)) return false;
    clearPreparedMaterials();
    window.AltumAuth.clearSession();
    setMaterialFeedback(feedback, 'Tu sesión venció. Vuelve a iniciar sesión para descargar el archivo.', true);
    const login = document.createElement('a');
    login.className = 'class-resource';
    login.dataset.materialLogin = '';
    login.href = `aula-virtual.html?login=1&error=sesion&nextCourse=${encodeURIComponent(courseId)}`;
    login.textContent = 'Iniciar sesión';
    feedback.appendChild(login);
    window.location.replace(login.href);
    return true;
  }

  async function refreshChangedMaterials(button, feedback) {
    const courseId = button.dataset.course;
    setMaterialFeedback(feedback, 'Los materiales cambiaron. Actualizando la lista…', true);
    const result = await window.AltumAuth.fetchCourse(courseId);
    if (!button.isConnected || materialPageHidden) return;
    if (materialSessionExpired(result, courseId, feedback)) return;
    if (!result?.ok || !result.course) throw new Error(result?.message || 'No fue posible actualizar la lista. Recarga el curso y selecciona el archivo nuevamente.');
    writeCourseCache(courseId, window.AltumAuth.getSession(), result.course);
    renderCourse(result.course);
    const notice = document.createElement('div');
    notice.className = 'material-course-notice';
    notice.dataset.materialCourseNotice = '';
    notice.setAttribute('role', 'alert');
    notice.tabIndex = -1;
    notice.textContent = 'Los materiales cambiaron. La lista está actualizada: selecciona nuevamente el archivo que deseas descargar.';
    document.getElementById('dynamicCourse').prepend(notice);
    notice.focus();
  }

  function materialDownloadKey(button) {
    const token = String(window.AltumAuth.getSession()?.token || '');
    return token ? JSON.stringify([token, button.dataset.materialResource || 'ADDITIONAL', button.dataset.course || '', button.dataset.session || '', button.dataset.slot || '', button.dataset.revision || '']) : '';
  }

  function prepareMaterialDownload(button, feedback, payload, fallbackName, requestKey) {
    const blob = blobFromMaterialPayload(payload);
    while (preparedMaterials.size >= MATERIAL_READY_LIMIT) {
      releasePreparedMaterial(preparedMaterials.values().next().value, 'Para guardar este archivo, vuelve a pulsar Descargar.');
    }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.target = '_self';
    link.download = String(payload.name || fallbackName);
    link.className = 'class-resource is-material material-save-link';
    link.textContent = 'Guardar archivo';
    link.setAttribute('aria-label', `Guardar archivo: ${link.download}`);
    link.dataset.materialSave = '';
    setMaterialFeedback(feedback, 'Archivo preparado. Pulsa Guardar archivo si la descarga no comienza.');
    feedback.appendChild(link);
    const entry = { url, link, feedback, button, key: requestKey, expiresAt: Date.now() + MATERIAL_READY_MS, timer: null };
    preparedMaterials.add(entry);
    entry.timer = window.setTimeout(() => releasePreparedMaterial(entry, 'El enlace de descarga venció. Vuelve a pulsar Descargar para preparar el archivo.'), MATERIAL_READY_MS);
    link.addEventListener('click', event => {
      if (!entry.key || entry.key !== materialDownloadKey(button) || Date.now() >= entry.expiresAt) {
        event.preventDefault();
        releasePreparedMaterial(entry, 'El archivo preparado venció o la sesión cambió. Vuelve a pulsar Descargar.');
        return;
      }
      setMaterialFeedback(feedback, 'Descarga solicitada. Si no aparece, pulsa Guardar archivo nuevamente.');
    });
    // Algunos navegadores bloquean la descarga tras una espera. El enlace permanece
    // visible para que el participante pueda iniciarla con un clic propio.
    try { link.click(); } catch (_error) {}
  }

  function bindMaterialDownloadButtons(root) {
    root.querySelectorAll('[data-additional-action], [data-material-action]').forEach(button => {
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const name = button.dataset.name || 'material adicional';
        const original = button.textContent;
        const feedback = materialFeedback(button);
        const requestKey = materialDownloadKey(button);
        const prepared = [...preparedMaterials].find(entry => entry.button === button && requestKey && entry.key === requestKey && entry.expiresAt > Date.now() && entry.link.isConnected);
        if (prepared) {
          setMaterialFeedback(feedback, 'Archivo preparado. Pulsa Guardar archivo si la descarga no comienza.');
          try { prepared.link.click(); } catch (_error) {}
          return;
        }
        [...preparedMaterials].filter(entry => entry.button === button).forEach(entry => releasePreparedMaterial(entry));
        feedback.querySelector('[data-material-login]')?.remove();
        button.disabled = true;
        button.textContent = 'Preparando…';
        setMaterialFeedback(feedback, 'Preparando el archivo…');
        try {
          const result = button.dataset.materialResource === 'MAIN'
            ? await window.AltumAuth.fetchSessionMaterial(button.dataset.course, Number(button.dataset.session || 0), button.dataset.revision || '')
            : await window.AltumAuth.fetchAdditionalMaterial(button.dataset.course, Number(button.dataset.session || 0), button.dataset.slot, button.dataset.revision || '');
          if (!button.isConnected || materialPageHidden) return;
          if (requestKey !== materialDownloadKey(button)) {
            setMaterialFeedback(feedback, 'La sesión o el material cambió. Vuelve a pulsar Descargar para recibir el archivo vigente.', true);
            return;
          }
          if (materialSessionExpired(result, button.dataset.course, feedback)) return;
          if (result?.code === 'MATERIAL_CHANGED') { await refreshChangedMaterials(button, feedback); return; }
          if (!result?.ok || !result?.base64) throw new Error(result?.message || 'El archivo no pudo entregarse. Vuelve a pulsar Descargar.');
          prepareMaterialDownload(button, feedback, result, name, requestKey);
        } catch (error) {
          if (button.isConnected) setMaterialFeedback(feedback, error?.message || 'No fue posible recibir el archivo. Vuelve a pulsar Descargar.', true);
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });
    });
  }

  function bindCountdowns(root) {
    const nodes = [...root.querySelectorAll('[data-countdown-start]')];
    if (!nodes.length) return;
    const tick = () => { const now = new Date(); nodes.forEach(node => { node.textContent = countdownLabel(node.dataset.countdownStart, node.dataset.countdownEnd, now); }); };
    tick(); courseCountdownTimers.push(window.setInterval(tick, 30000));
  }

  function renderCourse(course) {
    clearPreparedMaterials();
    courseCountdownTimers.splice(0).forEach(timer => window.clearInterval(timer));
    const root = document.getElementById('dynamicCourse');
    const cover = safeUrl(course.coverUrl) || 'logo-centro-formacion.jpg';
    const allSessions = Array.isArray(course.sessions) ? course.sessions : [];
    const academicSessions = allSessions.filter(session => !isEvaluationOnlySession(session));
    const evaluations = collectEvaluations(course, allSessions);
    const start = formatDate(course.startDate, false), end = formatDate(course.endDate, false);
    const participant = course.participant || {};
    const now = new Date(), todayKey = dateParts(now);

    document.title = `${course.shortTitle || course.title || 'Curso'} | Aula Virtual ALTUM LUMEN`;

    root.innerHTML = `
      <section class="class-hero">
        <div class="class-shell class-hero-grid">
          <div class="class-cover"><img src="${esc(cover)}" alt="Portada de ${esc(course.shortTitle || course.title || 'curso')}"></div>
          <div class="class-hero-copy">
            <span class="class-kicker">${esc(course.type || 'Programa académico')} · Aula Virtual</span>
            <h1>${esc(course.title || course.shortTitle || 'Curso')}</h1>
            <p>${esc(course.description || 'Espacio académico para participantes matriculados.')}</p>
            <div class="class-meta">
              ${start ? `<div><small>Inicio</small><strong>${esc(start)}</strong></div>` : ''}
              ${end ? `<div><small>Cierre</small><strong>${esc(end)}</strong></div>` : ''}
              ${course.duration ? `<div><small>Duración</small><strong>${esc(course.duration)}</strong></div>` : ''}
              ${course.scheduleText ? `<div><small>Horario</small><strong>${esc(course.scheduleText)}</strong></div>` : ''}
              <div><small>Sesiones</small><strong>${academicSessions.length}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div class="class-shell class-dashboard">
        <section class="student-summary-grid">
          ${participant.name ? `<div class="student-summary-card"><small>Participante</small><strong>${esc(participant.name)}</strong><span>Acceso personal al curso</span></div>` : ''}
          ${financeCard(course.finance)}
          ${certificateCard(course.certificate)}
        </section>

        ${courseProgressCard(course, academicSessions, now)}
        ${liveClassCard(course, academicSessions, now, todayKey)}
        ${whatsappCard(course)}

        <div class="class-layout">
          <section class="class-panel agenda-panel">
            <div class="class-section-head"><div><span class="eyebrow">Agenda académica</span><h2>Cronograma del curso</h2></div><p>Fechas y horarios actualizados del curso.</p></div>
            ${renderAgenda(academicSessions, now, todayKey)}
          </section>

          <section class="class-panel resources-panel">
            <div class="class-section-head"><div><span class="eyebrow">Aula de clases</span><h2>Sesiones y recursos</h2></div><p>Consulta grabaciones y materiales publicados por sesión.</p></div>
            <div class="class-session-list">${renderSessions(course, academicSessions, now, todayKey)}</div>
          </section>
        </div>

        ${evaluations.length ? `<section class="class-panel evaluation-panel"><div class="class-section-head"><div><span class="eyebrow">Evaluación académica</span><h2>Evaluaciones del curso</h2></div><p>Accede únicamente a las evaluaciones que se encuentren habilitadas.</p></div>${renderEvaluations(evaluations)}</section>` : ''}
      </div>`;

    root.hidden = false;
    bindCopyButtons(root);
    bindMaterialDownloadButtons(root);
    bindCountdowns(root);
    bindEvaluationCountdowns(root);
    root.querySelectorAll('[data-eval-id]').forEach(button => button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true; button.textContent = 'Verificando intentos…';
      try {
        const courseId = new URLSearchParams(window.location.search).get('id');
        const result = await window.AltumAuth.fetchEvaluation(courseId, button.dataset.evalId);
        if (result?.ok && result.masterReview) {
          const dialog = document.createElement('dialog'); dialog.style.cssText = 'max-width:800px;width:90%;max-height:85vh;overflow:auto;padding:24px;border:0;border-radius:16px';
          const editUrl = safeUrl(result.editUrl);
          dialog.innerHTML = '<h2>' + esc(result.title || 'Evaluación') + '</h2><p>Revisión del usuario maestro. No envía respuestas ni modifica notas.</p>' +
            (result.deadline ? '<p>Cierre para alumnos: ' + esc(formatDate(result.deadline, true)) + '</p>' : '') +
            (Array.isArray(result.questions) && result.questions.length ? result.questions.map((q, i) => '<section><h3>' + (i+1) + '. ' + esc(q.title || '') + '</h3><ol>' + (q.options || []).map((option, n) => '<li>' + esc(option) + ((q.correct || []).includes(n) ? ' ✓' : '') + '</li>').join('') + '</ol></section>').join('') : '<p>Esta evaluación histórica no tiene preguntas guardadas en SIRA. Revisa su formulario original.</p>') +
            (editUrl && /^https:\/\/docs\.google\.com\/forms\//.test(editUrl) ? '<p><a target="_blank" rel="noopener" href="' + esc(editUrl) + '">Administrar en Google Forms</a> (requiere una cuenta Google con permiso de edición)</p>' : '') + '<button type="button">Cerrar</button>';
          dialog.querySelector('button').onclick = () => dialog.close(); dialog.addEventListener('close', () => dialog.remove()); document.body.appendChild(dialog); dialog.showModal(); button.textContent = 'Revisar evaluación · Maestro'; return;
        }
        const url = safeUrl(result?.url);
        if (result?.ok && url && /^https:\/\/docs\.google\.com\/forms\//.test(url)) { window.location.assign(url); return; }
        button.textContent = result?.message || 'No fue posible verificar. Vuelve a intentar.';
      } catch (_error) { button.textContent = 'No fue posible verificar. Vuelve a intentar.'; }
      finally { button.disabled = false; }
    }));
  }

  function optimizePortalReturn() {
    const link = document.querySelector('.aula-nav-link');
    if (!link) return;
    try {
      if (document.referrer && window.history.length > 1) {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin && /\/aula-virtual\.html$/i.test(ref.pathname)) {
          link.addEventListener('click', event => { event.preventDefault(); window.history.back(); });
        }
      }
      const prefetch = document.createElement('link'); prefetch.rel = 'prefetch'; prefetch.href = 'aula-virtual.html'; document.head.appendChild(prefetch);
    } catch (_error) {}
  }

  function showError(message) {
    document.getElementById('dynamicLoading').hidden = true;
    document.getElementById('dynamicCourse').hidden = true;
    document.getElementById('dynamicErrorMessage').textContent = message || 'Inténtalo nuevamente desde tu Aula Virtual.';
    document.getElementById('dynamicError').hidden = false;
  }

  async function initDynamicCourse() {
    optimizePortalReturn();
    const courseId = new URLSearchParams(window.location.search).get('id') || '';
    if (!/^[a-z0-9][a-z0-9-]{1,95}$/i.test(courseId)) { showError('El identificador del curso no es válido.'); return; }

    let session = window.AltumAuth.getSession();
    if (!session) { window.location.replace(`aula-virtual.html?login=1&nextCourse=${encodeURIComponent(courseId)}`); return; }

    if (!window.AltumAuth.hasCourse(session, courseId)) {
      const refreshed = await window.AltumAuth.refreshSession(session, { force: true });
      if (!refreshed.ok) {
        if (window.AltumAuth.isDefinitiveSessionFailure(refreshed)) window.AltumAuth.clearSession();
        window.location.replace(`aula-virtual.html?error=sesion&nextCourse=${encodeURIComponent(courseId)}`); return;
      }
      session = refreshed.session;
      if (!window.AltumAuth.hasCourse(session, courseId)) { window.location.replace('aula-virtual.html?error=sin-acceso'); return; }
    }

    window.AltumAuth.mountUserMenu(document.getElementById('courseUserArea'), session);

    const cachedCourse = null;

    const result = await window.AltumAuth.fetchCourse(courseId, session);
    if (!result?.ok) {
      if (window.AltumAuth.isDefinitiveSessionFailure(result)) window.AltumAuth.clearSession();
      showError(result?.message || 'No fue posible cargar los recursos del curso.'); return;
    }

    if (result.legacy) {
      const legacy = window.AltumAuth.getStaticCourse(courseId);
      if (legacy?.file) { window.location.replace(legacy.file); return; }
      showError('Esta aula todavía no está disponible en el formato actualizado.'); return;
    }

    const course = result.course || {};
    writeCourseCache(courseId, session, course);
    document.getElementById('dynamicLoading').hidden = true;
    renderCourse(course);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDynamicCourse, { once: true });
  else initDynamicCourse();
})();
