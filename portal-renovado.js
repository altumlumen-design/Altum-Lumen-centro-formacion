(function () {
  const header = document.querySelector(".topbar");
  const toggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");

  const viewMeta = {
    inicio: { hash: "#inicio", label: "Inicio", path: "./" },
    oferta: { hash: "#oferta", label: "Oferta académica", path: "oferta.html" },
    docentes: { hash: "#docentes", label: "Docentes y especialistas", path: "docentes.html" },
    autoridades: { hash: "#autoridades", label: "Autoridades", path: "autoridades.html" },
    verificacion: { hash: "#verificacion", label: "Validez y verificación", path: "validez-verificacion.html" },
    contacto: { hash: "#contacto", label: "Contacto", path: "contacto.html" }
  };

  const routeByHash = new Map([
    ["#inicio", "inicio"],
    ["#publicaciones", "inicio"],
    ["#convenios", "inicio"],
    ["#oferta", "oferta"],
    ["#areas", "oferta"],
    ["#docentes", "docentes"],
    ["#autoridades", "autoridades"],
    ["#verificacion", "verificacion"],
    ["#contacto", "contacto"]
  ]);

  const viewItems = [
    [document.querySelector("#inicio"), "inicio"],
    [document.querySelector("#publicaciones"), "inicio"],
    [document.querySelector("#convenios"), "inicio"],
    [document.querySelector("#oferta"), "oferta"],
    [document.querySelector("#areas"), "oferta"],
    [document.querySelector("#docentes"), "docentes"],
    [document.querySelector("#autoridades"), "autoridades"],
    [document.querySelector("#verificacion"), "verificacion"],
    [document.querySelector("#contacto"), "contacto"]
  ].filter(function (entry) {
    return Boolean(entry[0]);
  });

  function injectPortalStyles() {
    if (document.querySelector("#portal-view-navigation-styles")) return;

    const style = document.createElement("style");
    style.id = "portal-view-navigation-styles";
    style.textContent = `
      [data-portal-view-item][hidden] {
        display: none !important;
      }

      .topbar .main-nav {
        flex-wrap: wrap !important;
      }

      .topbar .main-nav > .navlink[aria-current="page"] {
        color: #fff !important;
        background: linear-gradient(135deg, #9f1028, #c81934) !important;
        border-color: rgba(255,255,255,.7) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 7px 18px rgba(91,9,25,.24) !important;
      }

      .topbar .main-nav > .corporate-portal-link {
        display: inline-flex !important;
        align-items: center !important;
        gap: 7px !important;
      }

      .corporate-portal-icon {
        width: 17px !important;
        height: 17px !important;
        flex: 0 0 17px !important;
        display: block !important;
        object-fit: contain !important;
        border-radius: 50% !important;
        background: #fff !important;
        box-shadow: 0 0 0 1px rgba(255,255,255,.45) !important;
      }

      .floating-actions .float-icon {
        border-radius: 50% !important;
        border: 1px solid rgba(255,255,255,.24) !important;
        background: rgba(255,255,255,.14) !important;
      }

      .floating-actions .float-icon svg {
        width: 20px !important;
        height: 20px !important;
        display: block !important;
      }

      .floating-actions .whatsapp-float,
      .floating-actions .records-float {
        border-radius: 18px !important;
        padding: 11px 14px !important;
      }

      .floating-actions .whatsapp-float {
        max-width: 285px !important;
        background: linear-gradient(135deg, #08743f, #20ad60) !important;
      }

      .floating-actions .records-float {
        max-width: 300px !important;
        background: linear-gradient(135deg, #082b4c, #2675a6) !important;
      }

      .floating-actions .float-copy strong {
        line-height: 1.25 !important;
      }

      @media (max-width: 940px) {
        .topbar .main-nav > .corporate-portal-link {
          justify-content: flex-start !important;
        }
      }

      @media (max-width: 680px) {
        .floating-actions .whatsapp-float,
        .floating-actions .records-float {
          max-width: none !important;
          min-height: 58px !important;
        }

        .floating-actions .float-icon svg {
          width: 18px !important;
          height: 18px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildNavigation() {
    if (!mainNav) return;

    const fragment = document.createDocumentFragment();
    ["inicio", "oferta", "docentes", "autoridades", "verificacion", "contacto"].forEach(function (view) {
      const meta = viewMeta[view];
      const link = document.createElement("a");
      link.className = "navlink";
      link.href = meta.path;
      link.textContent = meta.label;
      link.dataset.portalView = view;
      fragment.appendChild(link);
    });

    const platforms = document.createElement("details");
    platforms.className = "navdrop";
    platforms.innerHTML = `
      <summary>Plataformas</summary>
      <div class="dropmenu">
        <a href="aula-virtual.html" target="_blank" rel="noopener">
          <b>Aula Virtual</b>
          <span>Acceso a cursos, sesiones y materiales.</span>
        </a>
        <a href="verificacion.html" target="_blank" rel="noopener">
          <b>Registros Académicos</b>
          <span>Consulta y verificación documentaria.</span>
        </a>
        <a href="directorio-expertos.html" target="_blank" rel="noopener">
          <b>Directorio de Expertos</b>
          <span>Red nacional de expertos por especialidad.</span>
        </a>
      </div>
    `;
    fragment.appendChild(platforms);

    const corporateLink = document.createElement("a");
    corporateLink.className = "navlink corporate-portal-link";
    corporateLink.href = "https://altumlumen-design.github.io/Altum-Lumen-S.A.C./";
    corporateLink.setAttribute("data-corporate-portal", "true");
    corporateLink.setAttribute("aria-label", "Ir al portal corporativo de ALTUM LUMEN S.A.C.");

    const icon = document.createElement("img");
    icon.className = "corporate-portal-icon";
    icon.src = "portal-corporativo-icon.png";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    icon.decoding = "async";

    const label = document.createElement("span");
    label.textContent = "Portal corporativo";

    corporateLink.append(icon, label);
    fragment.appendChild(corporateLink);
    mainNav.replaceChildren(fragment);
  }

  function setupDropdowns() {
    const dropdowns = Array.from(document.querySelectorAll(".main-nav .navdrop"));

    dropdowns.forEach(function (dropdown) {
      dropdown.addEventListener("toggle", function () {
        if (!dropdown.open) return;
        dropdowns.forEach(function (other) {
          if (other !== dropdown) other.open = false;
        });
      });
    });

    document.addEventListener("click", function (event) {
      dropdowns.forEach(function (dropdown) {
        if (!dropdown.contains(event.target)) dropdown.open = false;
      });
    });
  }

  function enhanceFloatingActions() {
    const whatsapp = document.querySelector(".whatsapp-float");
    const records = document.querySelector(".records-float");

    if (whatsapp) {
      whatsapp.setAttribute("aria-label", "Atención directa por WhatsApp con ALTUM LUMEN");
      whatsapp.innerHTML = `
        <span class="float-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M20 11.7a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8.2 8.4c.2-.5.5-.6.8-.6h.4c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.6.7c-.2.2-.2.4-.1.6.5 1 1.3 1.8 2.3 2.3.2.1.4.1.6-.1l.8-.9c.2-.2.4-.2.7-.1l1.8.9c.3.1.4.3.4.6 0 .4-.2 1.2-.7 1.6-.5.5-1.2.7-2 .6-1.1-.1-2.7-.7-4.2-2.1-1.2-1.1-2.1-2.5-2.4-3.7-.3-1.2.2-2.2 1-2.7Z" fill="currentColor"/>
          </svg>
        </span>
        <span class="float-copy"><small>Atención directa</small><strong>Comunícate por WhatsApp</strong></span>
      `;
    }

    if (records) {
      records.setAttribute("aria-label", "Verificar un certificado de ALTUM LUMEN");
      records.innerHTML = `
        <span class="float-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 3.5h9.5l2.5 2.6v8.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 3.5h9v3h3M6 3.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 9h6M8 12.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="17" cy="17" r="3.5" stroke="currentColor" stroke-width="1.8"/>
            <path d="m15.5 17 1 1 2-2.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="float-copy"><small>Verificación académica</small><strong>¿Deseas verificar un certificado?</strong></span>
      `;
    }
  }

  function closeMobileNavigation() {
    if (header) header.classList.remove("nav-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Abrir menú");
      toggle.textContent = "☰";
    }
  }

  function resolveView(hash) {
    return routeByHash.get(hash) || "inicio";
  }

  function setCurrentNavigation(view) {
    if (!mainNav) return;
    mainNav.querySelectorAll("[data-portal-view]").forEach(function (link) {
      if (link.dataset.portalView === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function showView(hash, options) {
    const settings = options || {};
    const view = resolveView(hash);

    viewItems.forEach(function (entry) {
      const element = entry[0];
      const itemView = entry[1];
      element.dataset.portalViewItem = itemView;
      element.hidden = itemView !== view;
    });

    setCurrentNavigation(view);
    closeMobileNavigation();

    const baseTitle = "ALTUM LUMEN | Centro de Formación y Capacitación Profesional";
    document.title = view === "inicio" ? baseTitle : viewMeta[view].label + " | ALTUM LUMEN";

    if (settings.scroll === false) return;

    requestAnimationFrame(function () {
      const requested = hash && document.querySelector(hash);
      const isSecondaryAnchor = hash === "#publicaciones" || hash === "#convenios" || hash === "#areas";

      if (requested && isSecondaryAnchor && !requested.hidden) {
        requested.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
  }

  injectPortalStyles();
  buildNavigation();
  setupDropdowns();
  enhanceFloatingActions();

  if (header && toggle) {
    toggle.addEventListener("click", function () {
      const open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      toggle.textContent = open ? "×" : "☰";
    });
  }

  if (mainNav) {
    mainNav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMobileNavigation();
    });
  }

  function sharePathForHash(hash) {
    const view = resolveView(hash);
    let path = viewMeta[view].path;
    if (hash === "#publicaciones" || hash === "#convenios") path = "./" + hash;
    if (hash === "#areas") path = "oferta.html#areas";
    return path;
  }

  function hashFromLocation() {
    if (routeByHash.has(window.location.hash)) return window.location.hash;
    const file = window.location.pathname.split("/").pop();
    const match = Object.keys(viewMeta).find(function (key) {
      return viewMeta[key].path.replace(/^\.\//, "") === file;
    });
    return match ? viewMeta[match].hash : "#inicio";
  }

  document.addEventListener("click", function (event) {
    const link = event.target.closest("a");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const portalView = link.dataset.portalView;
    let hash = null;
    if (portalView && viewMeta[portalView]) hash = viewMeta[portalView].hash;
    else {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("#") && routeByHash.has(href)) hash = href;
    }
    if (!hash) return;

    event.preventDefault();
    const path = sharePathForHash(hash);
    history.pushState({ portalView: resolveView(hash), hash: hash }, "", path);
    showView(hash);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMobileNavigation();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 940) closeMobileNavigation();
  });

  window.addEventListener("popstate", function (event) {
    const hash = event.state && routeByHash.has(event.state.hash) ? event.state.hash : hashFromLocation();
    showView(hash);
  });

  const initialHash = routeByHash.has(window.location.hash) ? window.location.hash : hashFromLocation();
  const initialView = resolveView(initialHash);
  history.replaceState({ portalView: initialView, hash: initialHash }, "", sharePathForHash(initialHash));
  showView(initialHash, { scroll: false });
})();
