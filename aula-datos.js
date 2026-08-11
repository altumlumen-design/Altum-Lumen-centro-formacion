(function () {
  'use strict';

  const lima = 'America/Lima';

  window.ALTUM_COURSES = Object.freeze([
    {
      id: 'ia-derecho-4ta',
      title: 'Curso Especializado en Inteligencia Artificial Aplicada al Derecho – Cuarta Edición',
      shortTitle: 'Inteligencia Artificial Aplicada al Derecho – Cuarta Edición',
      type: 'Curso especializado',
      area: 'Derecho',
      duration: '48 horas académicas',
      sessionCount: 4,
      status: 'Abierto',
      file: 'ia-derecho-4ta-edicion.html',
      flyer: 'flyer-ia-derecho-4ta.png',
      description: 'Redacción jurídica, análisis de casos y estrategia legal asistida con inteligencia artificial.',
      schedule: Object.freeze({
        timeZone: lima,
        liveUrl: 'https://us06web.zoom.us/j/89623750850?pwd=laPQag0tqVIOQVQnT3qqeNaQInOF0i.1',
        sessions: Object.freeze([
          Object.freeze({ number: 1, label: 'Sesión 1', start: '2026-08-08T19:00:00-05:00', end: '2026-08-08T21:00:00-05:00' }),
          Object.freeze({ number: 2, label: 'Sesión 2', start: '2026-08-09T19:00:00-05:00', end: '2026-08-09T21:00:00-05:00' }),
          Object.freeze({ number: 3, label: 'Sesión 3', start: '2026-08-15T19:00:00-05:00', end: '2026-08-15T21:00:00-05:00' }),
          Object.freeze({ number: 4, label: 'Sesión 4', start: '2026-08-16T19:00:00-05:00', end: '2026-08-16T21:00:00-05:00' })
        ])
      })
    },
    {
      id: 'formulacion-inversiones-publicas-ia',
      title: 'Curso Especializado en Formulación de Inversiones Públicas con Inteligencia Artificial',
      shortTitle: 'Formulación de Inversiones Públicas con Inteligencia Artificial',
      type: 'Curso especializado',
      area: 'Gestión de proyectos',
      duration: '48 horas académicas',
      sessionCount: 4,
      status: 'Abierto',
      file: 'formulacion-inversiones-publicas-ia.html',
      flyer: 'flyer-formulacion-inversiones-publicas-ia.png',
      description: 'Formulación y evaluación de inversiones públicas con apoyo de herramientas de inteligencia artificial.',
      schedule: Object.freeze({
        timeZone: lima,
        liveUrl: 'https://us06web.zoom.us/j/89634321952?pwd=uy8BDflYnNZgQK5x2wyEbdgwmPF6yc.1',
        sessions: Object.freeze([
          Object.freeze({ number: 1, label: 'Sesión 1', start: '2026-08-10T18:00:00-05:00', end: '2026-08-10T20:00:00-05:00' }),
          Object.freeze({ number: 2, label: 'Sesión 2', start: '2026-08-12T18:00:00-05:00', end: '2026-08-12T20:00:00-05:00' }),
          Object.freeze({ number: 3, label: 'Sesión 3', start: '2026-08-17T18:00:00-05:00', end: '2026-08-17T20:00:00-05:00' }),
          Object.freeze({ number: 4, label: 'Sesión 4', start: '2026-08-19T18:00:00-05:00', end: '2026-08-19T20:00:00-05:00' })
        ])
      })
    },
    {
      id: 'gestion-servicio-serenazgo-municipal',
      title: 'Curso Especializado en Gestión del Servicio de Serenazgo Municipal',
      shortTitle: 'Gestión del Servicio de Serenazgo Municipal',
      type: 'Curso especializado',
      area: 'Seguridad ciudadana',
      duration: '48 horas académicas',
      sessionCount: 4,
      status: 'Abierto',
      file: 'gestion-servicio-serenazgo-municipal.html',
      flyer: 'flyer-gestion-servicio-serenazgo-municipal.png',
      description: 'Gestión operativa del serenazgo municipal y aplicación del Manual del Sereno Municipal.',
      schedule: Object.freeze({
        timeZone: lima,
        liveUrl: 'https://us06web.zoom.us/j/87260810478?pwd=Idtk6zOGzt6vhwc5aAefRQMOLJSTj9.1',
        sessions: Object.freeze([
          Object.freeze({ number: 1, label: 'Sesión 1', start: '2026-08-11T19:00:00-05:00', end: '2026-08-11T21:00:00-05:00' }),
          Object.freeze({ number: 2, label: 'Sesión 2', start: '2026-08-13T19:00:00-05:00', end: '2026-08-13T21:00:00-05:00' }),
          Object.freeze({ number: 3, label: 'Sesión 3', start: '2026-08-18T19:00:00-05:00', end: '2026-08-18T21:00:00-05:00' }),
          Object.freeze({ number: 4, label: 'Sesión 4', start: '2026-08-20T19:00:00-05:00', end: '2026-08-20T21:00:00-05:00' })
        ])
      })
    },
    {
      id: 'ia-derecho-3ra',
      title: 'Curso Especializado en Inteligencia Artificial para el Derecho – Tercera Edición',
      shortTitle: 'Inteligencia Artificial para el Derecho – Tercera Edición',
      type: 'Curso especializado',
      area: 'Derecho',
      duration: '48 horas académicas',
      status: 'Cerrado',
      file: 'ia-derecho-3ra-edicion.html',
      flyer: 'flyer-ia-derecho-3ra.jpg',
      description: 'Edición anterior disponible para los alumnos que la tengan asignada.'
    },
    {
      id: 'ia-derecho-2da',
      title: 'Curso Especializado en Inteligencia Artificial para el Derecho – Segunda Edición',
      shortTitle: 'Inteligencia Artificial para el Derecho – Segunda Edición',
      type: 'Curso especializado',
      area: 'Derecho',
      duration: '48 horas académicas',
      status: 'Cerrado',
      file: 'ia-derecho-2da-edicion.html',
      flyer: 'flyer-ia-derecho-2da.jpg',
      description: 'Edición anterior disponible para los alumnos que la tengan asignada.'
    },
    {
      id: 'ia-derecho-1ra',
      title: 'Curso Especializado en Inteligencia Artificial para el Derecho – Primera Edición',
      shortTitle: 'Inteligencia Artificial para el Derecho – Primera Edición',
      type: 'Curso especializado',
      area: 'Derecho',
      duration: '48 horas académicas',
      status: 'Cerrado',
      file: 'ia-derecho-1ra-edicion.html',
      flyer: 'flyer-ia-derecho-1ra.jpg',
      description: 'Edición anterior disponible para los alumnos que la tengan asignada.'
    },
    {
      id: 'pae-gerencia-seguridad-criminologia',
      title: 'Programa de Alta Especialización en Gerencia de Seguridad y Criminología',
      shortTitle: 'Gerencia de Seguridad y Criminología',
      type: 'Programa de Alta Especialización',
      area: 'Gestión pública',
      duration: '384 horas académicas',
      status: 'Cerrado',
      file: 'pae-gerencia-seguridad-criminologia.html',
      flyer: 'flyer-pae-gerencia-seguridad-criminologia.jpg',
      description: 'Programa anterior disponible para los alumnos que lo tengan asignado.'
    },
    {
      id: 'orden-interno-seguridad-ciudadana',
      title: 'Diplomado Especializado en Orden Interno y Seguridad Ciudadana',
      shortTitle: 'Orden Interno y Seguridad Ciudadana',
      type: 'Diplomado especializado',
      area: 'Gestión pública',
      duration: '240 horas académicas',
      status: 'Cerrado',
      file: 'diplomado-orden-interno-seguridad-ciudadana.html',
      flyer: 'flyer-orden-interno-seguridad-ciudadana.jpg',
      description: 'Diplomado anterior disponible para los alumnos que lo tengan asignado.'
    },
    {
      id: 'direccion-gestion-seguridad-ciudadana',
      title: 'Diplomado Especializado en Dirección y Gestión de la Seguridad Ciudadana',
      shortTitle: 'Dirección y Gestión de la Seguridad Ciudadana',
      type: 'Diplomado especializado',
      area: 'Gestión pública y seguridad ciudadana',
      duration: '240 horas académicas',
      sessionCount: 6,
      status: 'Cerrado',
      file: 'diplomado-direccion-gestion-seguridad-ciudadana.html',
      flyer: 'logo-centro-formacion.jpg',
      description: 'Diplomado finalizado y disponible para los alumnos que lo tengan asignado.'
    },
    {
      id: 'interculturalidad-convivencia-desarrollo-social',
      title: 'Diplomado Especializado en Interculturalidad, Convivencia y Desarrollo Social',
      shortTitle: 'Interculturalidad, Convivencia y Desarrollo Social',
      type: 'Diplomado especializado',
      area: 'Desarrollo social',
      duration: '240 horas académicas',
      sessionCount: 0,
      status: 'Cerrado',
      file: 'diplomado-interculturalidad-convivencia-desarrollo-social.html',
      flyer: 'logo-centro-formacion.jpg',
      description: 'Archivo académico del diplomado disponible para la persona matriculada.'
    },
    {
      id: 'proyectos-inversion-publica-ia',
      title: 'Curso Especializado en Proyectos de Inversión Pública con Inteligencia Artificial',
      shortTitle: 'Proyectos de Inversión Pública con Inteligencia Artificial',
      type: 'Curso especializado',
      area: 'Gestión de proyectos',
      duration: '48 horas académicas',
      status: 'Cerrado',
      file: 'proyectos-inversion-publica-ia.html',
      flyer: 'flyer-proyectos-inversion-publica-ia.png',
      description: 'Edición anterior disponible para los alumnos que la tengan asignada.'
    }
  ]);
})();
