document.addEventListener("DOMContentLoaded", async () => {

  console.log("Menu laden gestart");

  // Bepaal pad afhankelijk van pagina
  const path = window.location.pathname;

  let basePath = "";

  if (path.includes("/leden/") || path.includes("/pages/")) {
    basePath = "../";
  }

  try {
    // NAV laden
    const navResponse = await fetch(basePath + "components/nav.html");
    const navHtml = await navResponse.text();

    const navContainer = document.getElementById("nav-placeholder");
    if (navContainer) {
      navContainer.innerHTML = navHtml;
      console.log("Nav geladen");
    } else {
      console.warn("nav-placeholder niet gevonden");
    }

    // FOOTER laden
    const footerResponse = await fetch(basePath + "components/footer.html");
    const footerHtml = await footerResponse.text();

    const footerContainer = document.getElementById("footer-placeholder");
    if (footerContainer) {
      footerContainer.innerHTML = footerHtml;
      console.log("Footer geladen");
    } else {
      console.warn("footer-placeholder niet gevonden");
    }

  } catch (error) {
    console.error("Fout bij laden menu:", error);
  }

});