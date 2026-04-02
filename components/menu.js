const basePath = window.location.pathname.includes('/pages/') ? '../' : './';

console.log("Nav wordt geladen vanaf:", basePath + 'components/nav.html');

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

    navContainer.innerHTML = data;

    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");

    if (hamburger && navMenu) {
      hamburger.addEventListener("click", () => {
        navMenu.classList.toggle("active");
      });
    }
  })
  .catch(err => console.error(err));
  // ACTIVE MENU ITEM
const currentPath = window.location.pathname;

document.querySelectorAll('nav a').forEach(link => {
  const linkPath = link.getAttribute('href');

  if (currentPath.includes(linkPath)) {
    link.classList.add('active');
  }
});
// FOOTER LOAD
fetch(basePath + 'components/footer.html')
  .then(res => res.text())
  .then(data => {
    const footer = document.getElementById('footer');
    if (footer) {
      footer.innerHTML = data;
    }
  });