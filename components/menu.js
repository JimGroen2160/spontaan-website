const basePath = window.location.pathname.includes('/pages/') ? '../' : './';

fetch(basePath + 'components/nav.html')
  .then(res => {
    if (!res.ok) throw new Error('Nav laden mislukt');
    return res.text();
  })
  .then(data => {
    document.getElementById('nav').innerHTML = data;

    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");

    if (hamburger && navMenu) {
      hamburger.addEventListener("click", () => {
        navMenu.classList.toggle("active");
      });
    }
  })
  .catch(err => console.error(err));