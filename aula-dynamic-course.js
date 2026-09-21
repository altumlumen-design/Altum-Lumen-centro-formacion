(function () {
  'use strict';

  const TZ = 'America/Lima';
  const COURSE_CACHE_TTL_MS = 0; // Datos financieros y permisos siempre se validan en SIRA.

  function esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    const text = String(value || '').trim();
    return /^https:\/\/[^\s]+$/i.test(text) ? text : '';
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
    const direct = safeUrl(course?.zoomUrl);
    if (direct) return direct;
    const inherited = (sessions || []).map(session => safeUrl(session?.zoomUrl)).find(Boolean);
    if (inherited) return inherited;
    const courseId = String(course?.id || '');
    const legacy = (Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : []).find(item => String(item?.id || '') === courseId);
    return safeUrl(legacy?.schedule?.liveUrl);
  }

  function zoomResourceBlock(url) {
    const href = safeUrl(url);
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

  function materialResourceBlock(session) {
    const state = String(session?.materialState || '').trim().toUpperCase();
    const note = String(session?.materialNote || '').trim();
    if (state === 'NO_CORRESPONDE') {
      return `<div class="session-resource-state is-pending" style="border-style:solid">
        <div class="session-resource-copy"><span>▣</span><div><small>Material</small><strong>No corresponde</strong>${note ? `<small style="margin-top:4px;max-width:460px;white-space:normal;line-height:1.35;text-transform:none;letter-spacing:0">${esc(note)}</small>` : ''}</div></div>
      </div>`;
    }
    return resourceBlock(session?.materialUrl, 'Material', 'is-material', '▣');
  }

  function scheduleState(session, now, todayKey, nextId) {
    const start = asDate(session.start), end = asDate(session.end) || start;
    if (!start) return safeUrl(session?.recordingUrl) || safeUrl(session?.materialUrl) ? { key: 'done', label: 'Sesión realizada' } : { key: 'scheduled', label: 'Programada' };
    const key = dateParts(start);
    if (key === todayKey) return { key: 'today', label: 'Hoy' };
    if (end && end.getTime() < now.getTime()) return { key: 'done', label: 'Sesión realizada' };
    if (nextId && session.id === nextId) return { key: 'next', label: 'Próxima' };
    return { key: 'scheduled', label: 'Programada' };
  }

  function copyButton(url) {
    const href = safeUrl(url);
    return href ? `<button class="copy-link-btn" type="button" data-copy-url="${esc(href)}" aria-label="Copiar enlace de Zoom">Copiar enlace</button>` : '';
  }

  function isEvaluationOnlySession(session) {
    const semantic = String(session?.title || '').toLocaleLowerCase('es-PE');
    const looksLikeEvaluation = /examen|evaluaci[oó]n/.test(semantic);
    const hasClassResource = Boolean(safeUrl(session?.recordingUrl) || safeUrl(session?.materialUrl) || session?.start);
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
          ? (zoomUrl ? `<a class="class-btn class-btn-primary" href="${esc(zoomUrl)}" target="_blank" rel="noopener">${zoomMark()}<span>Unirse a la sesión</span></a>${copyButton(zoomUrl)}` : '<span class="class-muted-note">El enlace de Zoom del curso aún no ha sido publicado.</span>')
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
          ${materialResourceBlock(session)}
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
      const open = !expired && evaluation.available !== false && evaluation.accepting !== false && href;
      const moduleLabel = Number(evaluation.moduleNumber || 0) ? `Módulo ${Number(evaluation.moduleNumber)}` : (evaluation.type === 'FINAL' ? 'Evaluación final' : 'Evaluación');
      const minGrade = Number(evaluation.minGrade || 13), attempts = Number(evaluation.maxAttempts || 3), pdf = safeUrl(evaluation.pdfUrl), countdown = evaluationCountdownLabel(evaluation.deadline, now);
      return `<article class="evaluation-card ${open ? 'is-open' : 'is-closed'}" data-evaluation-card data-eval-deadline="${esc(evaluation.deadline || '')}">
        <div class="evaluation-icon" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
        <div class="evaluation-copy">
          <span class="eyebrow">${esc(moduleLabel)}</span>
          <h3>${esc(evaluation.title || moduleLabel)}</h3>
          <p>${esc(evaluation.description || (open ? 'Evaluación habilitada para participantes matriculados.' : 'La evaluación se encuentra cerrada.'))}</p>
          <div class="evaluation-rules"><span>✓ Nota mínima: <b>${esc(minGrade)}</b></span><span>↻ Hasta <b>${esc(attempts)} intentos</b></span></div>
          ${evaluation.comment ? `<div class="evaluation-comment">${esc(evaluation.comment)}</div>` : ''}
          ${evaluation.deadline ? `<div class="evaluation-deadline ${expired ? 'is-expired' : ''}"><span>⏱</span><div><small>Cierre: ${esc(evaluation.deadlineText || formatDate(evaluation.deadline, true))}</small><strong data-eval-countdown>${esc(countdown)}</strong></div></div>` : ''}
          ${Number(evaluation.totalPoints || 0) ? `<small>${esc(evaluation.totalPoints)} punto(s)</small>` : ''}
          ${pdf ? `<a class="evaluation-pdf-link" href="${esc(pdf)}" target="_blank" rel="noopener">Ver PDF de indicaciones</a>` : ''}
        </div>
        <div class="evaluation-action">${open ? `<a class="class-btn evaluation-btn" data-eval-action href="${esc(href)}" target="_blank" rel="noopener">Resolver evaluación</a>` : '<span class="evaluation-closed-label" data-eval-action>Cerrada</span>'}</div>
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
          if (action && action.tagName === 'A') { action.removeAttribute('href'); action.removeAttribute('target'); action.className = 'evaluation-closed-label'; action.textContent = 'Cerrada'; }
        }
      });
    };
    tick(); window.setInterval(tick, 30000);
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
    root.querySelectorAll('[data-copy-url]').forEach(button => {
      button.addEventListener('click', async () => {
        const url = button.dataset.copyUrl || '';
        if (!url) return;
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

  function bindCountdowns(root) {
    const nodes = [...root.querySelectorAll('[data-countdown-start]')];
    if (!nodes.length) return;
    const tick = () => { const now = new Date(); nodes.forEach(node => { node.textContent = countdownLabel(node.dataset.countdownStart, node.dataset.countdownEnd, now); }); };
    tick(); window.setInterval(tick, 30000);
  }

  function renderCourse(course) {
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
    bindCountdowns(root);
    bindEvaluationCountdowns(root);
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
