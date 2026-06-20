document.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;
  const basePath = path.includes("/leden/") || path.includes("/pages/") || path.includes("/admin/")
    ? "../"
    : "";

  try {
    const navResponse = await fetch(basePath + "components/nav.html");
    if (!navResponse.ok) {
      throw new Error(`Nav kon niet geladen worden: ${navResponse.status} ${navResponse.statusText}`);
    }

    const navContainer = document.getElementById("nav-placeholder");
    if (navContainer) {
      navContainer.innerHTML = await navResponse.text();
      initializeActiveNavigation(navContainer);
      initializeMobileMenu(navContainer);
    }

    const footerResponse = await fetch(basePath + "components/footer.html");
    if (!footerResponse.ok) {
      throw new Error(`Footer kon niet geladen worden: ${footerResponse.status} ${footerResponse.statusText}`);
    }

    const footerContainer = document.getElementById("footer-placeholder");
    if (footerContainer) {
      footerContainer.innerHTML = await footerResponse.text();
    }
  } catch (error) {
    console.error("Fout bij laden menu:", error);
  }
});

function normalizePathname(pathname) {
  if (!pathname || pathname === "/index.html") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function initializeActiveNavigation(navContainer) {
  const currentPath = normalizePathname(window.location.pathname);

  navContainer.querySelectorAll(".nav-menu a").forEach((link) => {
    const targetPath = normalizePathname(new URL(link.href, window.location.href).pathname);
    const isCurrentPage = targetPath === currentPath;

    link.classList.toggle("active", isCurrentPage);

    if (isCurrentPage) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function initializeMobileMenu(navContainer) {
  const hamburger = navContainer.querySelector("#hamburger");
  const navMenu = navContainer.querySelector("#navMenu");

  if (!hamburger || !navMenu) {
    return;
  }

  const closeMenu = () => {
    navMenu.classList.remove("open");
    hamburger.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "Menu openen");
  };

  hamburger.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("open");
    hamburger.classList.toggle("open", isOpen);
    hamburger.setAttribute("aria-expanded", String(isOpen));
    hamburger.setAttribute("aria-label", isOpen ? "Menu sluiten" : "Menu openen");
  });

  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navMenu.classList.contains("open")) {
      closeMenu();
      hamburger.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (
      navMenu.classList.contains("open") &&
      !navContainer.contains(event.target)
    ) {
      closeMenu();
    }
  });
}
