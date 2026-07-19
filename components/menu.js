document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname;
  const basePath =
    path.includes('/leden/') ||
    path.includes('/pages/') ||
    path.includes('/admin/')
      ? '../'
      : '';

  try {
    const navContainer = document.getElementById('nav-placeholder');

    if (navContainer) {
      await ensureComponent(
        navContainer,
        `${basePath}components/nav.html`,
        '.main-nav',
        'Nav',
      );
      initializeActiveNavigation(navContainer);
      initializeMobileMenu(navContainer);
    }

    const footerContainer = document.getElementById(
      'footer-placeholder',
    );

    if (footerContainer) {
      await ensureComponent(
        footerContainer,
        `${basePath}components/footer.html`,
        '.site-footer',
        'Footer',
      );
    }
  } catch (error) {
    console.error('Fout bij laden menu:', error);
  }
});

async function ensureComponent(container, url, selector, label) {
  if (container.querySelector(selector)) {
    return;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `${label} kon niet geladen worden: ` +
        `${response.status} ${response.statusText}`,
    );
  }

  container.innerHTML = await response.text();
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/index.html') {
    return '/';
  }

  return pathname.replace(/\/+$/, '') || '/';
}

function initializeActiveNavigation(navContainer) {
  const currentPath = normalizePathname(window.location.pathname);

  navContainer.querySelectorAll('.nav-menu a').forEach((link) => {
    const targetPath = normalizePathname(
      new URL(link.href, window.location.href).pathname,
    );
    const isCurrentPage = targetPath === currentPath;

    link.classList.toggle('active', isCurrentPage);

    if (isCurrentPage) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function initializeMobileMenu(navContainer) {
  const hamburger = navContainer.querySelector('#hamburger');
  const navMenu = navContainer.querySelector('#navMenu');

  if (!hamburger || !navMenu) {
    return;
  }

  const closeMenu = () => {
    navMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Menu openen');
  };

  hamburger.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    hamburger.setAttribute(
      'aria-label',
      isOpen ? 'Menu sluiten' : 'Menu openen',
    );
  });

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navMenu.classList.contains('open')) {
      closeMenu();
      hamburger.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (
      navMenu.classList.contains('open') &&
      !navContainer.contains(event.target)
    ) {
      closeMenu();
    }
  });
}
