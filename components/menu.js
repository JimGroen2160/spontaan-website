// menu.js

// Bepaal juiste pad (homepage vs /pages/)
const isSubPage = window.location.pathname.includes('/pages/');
const navPath = isSubPage ? '../components/nav.html' : './components/nav.html';

// Debug (mag je later verwijderen)
console.log('Nav wordt geladen vanaf:', navPath);

fetch(navPath)
  .then(response => {
    if (!response.ok) {
      throw new Error('Nav laden mislukt: ' + response.status);
    }
    return response.text();
  })
  .then(data => {
    const navContainer = document.getElementById('nav');

    if (!navContainer) {
      console.error('❌ Element met id="nav" niet gevonden');
      return;
    }

    navContainer.innerHTML = data;

    // Hamburger menu (indien aanwezig)
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (hamburger && navMenu) {
      hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
      });
    }
  })
  .catch(error => {
    console.error('❌ Fout bij laden van navigatie:', error);
  });