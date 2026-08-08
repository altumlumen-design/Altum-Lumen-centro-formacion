(function () {
  const header = document.querySelector(".topbar");
  const toggle = document.querySelector(".menu-toggle");
  const dropdowns = Array.from(document.querySelectorAll(".navdrop"));

  if (header && toggle) {
    toggle.addEventListener("click", function () {
      const open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      toggle.textContent = open ? "×" : "☰";
    });
  }

  dropdowns.forEach(function (dropdown) {
    dropdown.addEventListener("toggle", function () {
      if (!dropdown.open) return;
      dropdowns.forEach(function (other) {
        if (other !== dropdown) other.open = false;
      });
    });
  });

  const mainNav = document.querySelector(".main-nav");
  if (mainNav && !mainNav.querySelector('[data-corporate-portal="true"]')) {
    const corporateLink = document.createElement("a");
    corporateLink.className = "navlink";
    corporateLink.href = "https://altumlumen-design.github.io/Altum-Lumen-S.A.C./";
    corporateLink.textContent = "Portal corporativo";
    corporateLink.setAttribute("data-corporate-portal", "true");
    corporateLink.setAttribute("aria-label", "Ir al portal corporativo de ALTUM LUMEN S.A.C.");
    mainNav.appendChild(corporateLink);
  }

  document.querySelectorAll(".main-nav a").forEach(function (link) {
    link.addEventListener("click", function () {
      if (header) header.classList.remove("nav-open");
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir menú");
        toggle.textContent = "☰";
      }
      dropdowns.forEach(function (dropdown) {
        dropdown.open = false;
      });
    });
  });

  document.addEventListener("click", function (event) {
    dropdowns.forEach(function (dropdown) {
      if (!dropdown.contains(event.target)) dropdown.open = false;
    });
  });
})();
