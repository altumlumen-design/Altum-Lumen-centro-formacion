(function () {
  'use strict';

  const DEFAULT_TIME_ZONE = 'America/Lima';
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  function getCourses() {
    return Array.isArray(window.ALTUM_COURSES) ? window.ALTUM_COURSES : [];
  }

  function getCourse(courseOrId) {
    if (courseOrId && typeof courseOrId === 'object') return courseOrId;
    return getCourses().find((course) => course.id === courseOrId) || null;
  }

  function toDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function timeZoneOf(course) {
    return course?.schedule?.timeZone || DEFAULT_TIME_ZONE;
  }

  function parts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return Object.fromEntries(
      formatter.formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value])
    );
  }

  function dayKey(date, timeZone) {
    const value = parts(date, timeZone);
    return `${value.year}-${value.month}-${value.day}`;
  }

  function sessionList(courseOrId) {
    const course = getCourse(courseOrId);
    const sessions = Array.isArray(course?.schedule?.sessions) ? course.schedule.sessions : [];
    return sessions
      .map((session, index) => {
        const start = toDate(session.start);
        const end = toDate(session.end);
        if (!start || !end) return null;
        return {
          ...session,
          index,
          number: Number(session.number || index + 1),
          label: String(session.label || `Sesión ${index + 1}`),
          start,
          end
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  function getInfo(courseOrId, nowValue) {
    const course = getCourse(courseOrId);
    const now = toDate(nowValue) || new Date();
    const sessions = sessionList(course);
    const timeZone = timeZoneOf(course);

    const enriched = sessions.map((session) => {
      const startMs = session.start.getTime();
      const endMs = session.end.getTime();
      const nowMs = now.getTime();
      return {
        ...session,
        isCompleted: nowMs > endMs,
        isLive: nowMs >= startMs && nowMs <= endMs,
        isJoinWindow: nowMs >= startMs - (45 * MINUTE) && nowMs <= endMs + (20 * MINUTE),
        isToday: dayKey(session.start, timeZone) === dayKey(now, timeZone)
      };
    });

    const completed = enriched.filter((session) => session.isCompleted);
    const current = enriched.find((session) => session.isLive) || null;
    const joinable = enriched.find((session) => session.isJoinWindow) || null;
    const upcoming = enriched.find((session) => session.start.getTime() > now.getTime()) || null;
    const next = current || upcoming || null;
    const total = enriched.length;
    const completedCount = completed.length;
    const percent = total ? Math.min(100, Math.max(0, Math.round((completedCount / total) * 100))) : 0;

    return {
      course,
      timeZone,
      now,
      sessions: enriched,
      completed,
      current,
      joinable,
      upcoming,
      next,
      total,
      completedCount,
      percent,
      allCompleted: Boolean(total && completedCount === total),
      liveUrl: course?.schedule?.liveUrl || ''
    };
  }

  function formatTime(dateValue, timeZone = DEFAULT_TIME_ZONE) {
    const date = toDate(dateValue);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date).replace(/\s*a\.\s*m\./i, ' a. m.').replace(/\s*p\.\s*m\./i, ' p. m.');
  }

  function formatDate(dateValue, timeZone = DEFAULT_TIME_ZONE, options = {}) {
    const date = toDate(dateValue);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone,
      weekday: options.weekday === false ? undefined : 'long',
      day: 'numeric',
      month: options.month || 'long'
    }).format(date);
  }

  function formatCompactDate(dateValue, timeZone = DEFAULT_TIME_ZONE) {
    const date = toDate(dateValue);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }).format(date).replace(/\.$/, '');
  }

  function relativeLabel(session, courseOrId, nowValue) {
    if (!session) return '';
    const course = getCourse(courseOrId);
    const info = getInfo(course, nowValue);
    const now = info.now;
    const timeZone = info.timeZone;
    const start = toDate(session.start);
    const end = toDate(session.end);
    if (!start || !end) return '';

    const nowMs = now.getTime();
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (nowMs >= startMs && nowMs <= endMs) return 'En vivo ahora';

    const minutes = Math.round((startMs - nowMs) / MINUTE);
    if (minutes > 0 && minutes <= 60) return `Empieza en ${minutes} min`;

    const today = dayKey(start, timeZone) === dayKey(now, timeZone);
    if (today) return `Hoy · ${formatTime(start, timeZone)}`;

    const tomorrow = new Date(now.getTime() + DAY);
    if (dayKey(start, timeZone) === dayKey(tomorrow, timeZone)) {
      return `Mañana · ${formatTime(start, timeZone)}`;
    }

    const days = Math.ceil((startMs - nowMs) / DAY);
    if (days > 0 && days <= 7) {
      const weekday = new Intl.DateTimeFormat('es-PE', { timeZone, weekday: 'long' }).format(start);
      return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${formatTime(start, timeZone)}`;
    }

    return `${formatCompactDate(start, timeZone)} · ${formatTime(start, timeZone)}`;
  }

  window.AltumSchedule = Object.freeze({
    DEFAULT_TIME_ZONE,
    getCourse,
    getInfo,
    formatTime,
    formatDate,
    formatCompactDate,
    relativeLabel
  });
})();
