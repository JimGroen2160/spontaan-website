const path = window.location.pathname;

// Bepaal niveau (root vs subfolder)
let basePath = './';

if (path.includes('/pages/') || path.includes('/leden/')) {
  basePath = '../';
}

console.log("Huidig pad:", path);
console.log("Nav wordt geladen vanaf:", basePath + 'components/nav.html');

// NAV
fetch(basePath + 'components/nav.html')
  .then(res => {
    if (!res.ok) throw new Error(`Nav laden mislukt (${res.status})`);
    return res.text();
  })
  .then(data => {
    const navContainer = document.getElementById('nav');

    if (!navContainer) {
      console.error('Element met id="nav" niet gevonden');
      return;
    }

    navContainer.innerHTML = data;

    // Hamburger
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");

    if (hamburger && navMenu) {
      hamburger.addEventListener("click", () => {
        navMenu.classList.toggle("active");
      });
    }

    // Active link
    const currentPath = window.location.pathname;

    document.querySelectorAll('nav a').forEach(link => {
      const linkPath = link.getAttribute('href');

      if (linkPath && currentPath.includes(linkPath)) {
        link.classList.add('active');
      }
    });
  })
  .catch(err => console.error(err));


// FOOTER
fetch(basePath + 'components/footer.html')
  .then(res => {
    if (!res.ok) throw new Error(`Footer laden mislukt (${res.status})`);
    return res.text();
  })
  .then(data => {
    const footer = document.getElementById('footer');
    if (footer) {
      footer.innerHTML = data;
    }
  })
  .catch(err => console.error(err));