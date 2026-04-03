const basePath = window.location.pathname.includes('/pages/') ? '../' : './';

console.log("Nav wordt geladen vanaf:", basePath + 'components/nav.html');

// NAV + LOGICA SAMEN (BELANGRIJK: alles in dezelfde flow)
fetch(basePath + 'components/nav.html')
  .then(res => {
    if (!res.ok) throw new Error('Nav laden mislukt');
    return res.text();
  })
  .then(data => {
    const navContainer = document.getElementById('nav');

    if (!navContainer) {
      console.error('Element met id="nav" niet gevonden');
      return;
    }

    // 1. Inject nav
    navContainer.innerHTML = data;

    // 2. Hamburger menu
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");

    if (hamburger && navMenu) {
      hamburger.addEventListener("click", () => {
        navMenu.classList.toggle("active");
      });
    }

    // 3. ACTIVE MENU ITEM (NU PAS NA LOAD)
    const currentPath = window.location.pathname;

    document.querySelectorAll('nav a').forEach(link => {
      const linkPath = link.getAttribute('href');

      if (linkPath && currentPath.includes(linkPath)) {
        link.classList.add('active');
      }
    });
  })
  .catch(err => console.error(err));


// FOOTER (apart maar geen impact op nav timing)
fetch(basePath + 'components/footer.html')
  .then(res => res.text())
  .then(data => {
    const footer = document.getElementById('footer');
    if (footer) {
      footer.innerHTML = data;
    }
  });