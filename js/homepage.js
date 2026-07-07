(() => {
  const config = {
    projectId: 'u66p1mxm',
    dataset: 'development',
    apiVersion: '2026-07-06',
  };

  const selectors = {
    heroTitle: '[data-homepage-hero-title]',
    heroSubtitle: '[data-homepage-hero-subtitle]',
    welcomeTitle: '[data-homepage-welcome-title]',
    welcomeText: '[data-homepage-welcome-text]',
    ctaContainer: '[data-homepage-cta-container]',
  };

  const query = `*[_type == "homePage"][0]{
    heroTitle,
    heroSubtitle,
    welcomeTitle,
    welcomeText,
    ctaLabel,
    ctaLink
  }`;

  function setText(selector, value) {
    const element = document.querySelector(selector);
    const text = typeof value === 'string' ? value.trim() : '';

    if (!element || !text) {
      return;
    }

    element.textContent = text;
  }

  function getSafeLink(value) {
    const link = typeof value === 'string' ? value.trim() : '';

    if (!link) {
      return '';
    }

    if (
      link.startsWith('/') ||
      link.startsWith('./') ||
      link.startsWith('../') ||
      /^https?:\/\//i.test(link) ||
      /^mailto:/i.test(link)
    ) {
      return link;
    }

    return '';
  }

  function renderCta(label, link) {
    const container = document.querySelector(selectors.ctaContainer);
    const text = typeof label === 'string' ? label.trim() : '';
    const href = getSafeLink(link);

    if (!container || !text || !href) {
      return;
    }

    const cta = document.createElement('a');
    cta.className = 'btn';
    cta.href = href;
    cta.textContent = text;

    container.textContent = '';
    container.appendChild(cta);
    container.hidden = false;
  }

  async function fetchHomePage() {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://${config.projectId}.apicdn.sanity.io/v${config.apiVersion}/data/query/${config.dataset}?query=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Sanity request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  }

  async function initHomePage() {
    try {
      const homePage = await fetchHomePage();

      if (!homePage || typeof homePage !== 'object') {
        return;
      }

      setText(selectors.heroTitle, homePage.heroTitle);
      setText(selectors.heroSubtitle, homePage.heroSubtitle);
      setText(selectors.welcomeTitle, homePage.welcomeTitle);
      setText(selectors.welcomeText, homePage.welcomeText);
      renderCta(homePage.ctaLabel, homePage.ctaLink);
    } catch (error) {
      console.info('Sanity-content niet geladen; statische homepage-fallback blijft zichtbaar.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomePage, { once: true });
  } else {
    initHomePage();
  }
})();
