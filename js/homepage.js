(() => {
  const config = {
    projectId: 'u66p1mxm',
    dataset: 'development',
    apiVersion: '2026-07-06',
  };

  const selectors = {
    hero: '.hero',
    heroTitle: '[data-homepage-hero-title]',
    heroSubtitle: '[data-homepage-hero-subtitle]',
    heroCta: '[data-homepage-cta-container]',
    quickLinksTitle: '[data-homepage-quicklinks-title]',
    quickLinksIntro: '[data-homepage-quicklinks-intro]',
    quickLinks: '[data-homepage-quicklinks]',
    welcomeTitle: '[data-homepage-welcome-title]',
    welcomeText: '[data-homepage-welcome-text]',
    welcomeCta: '[data-homepage-welcome-cta]',
    visitTitle: '[data-homepage-visit-title]',
    visitText: '[data-homepage-visit-text]',
    visitCta: '[data-homepage-visit-cta]',
  };

  const query = `*[_type == "homePage"][0]{
    heroTitle,
    heroSubtitle,
    "heroImageUrl": heroImage.asset->url,
    ctaLabel,
    ctaLink,
    quickLinksTitle,
    quickLinksIntro,
    quickLinks[]{
      title,
      text,
      "imageUrl": image.asset->url,
      buttonLabel,
      buttonLink
    },
    welcomeTitle,
    welcomeText,
    welcomeButtonLabel,
    welcomeButtonLink,
    visitTitle,
    visitText,
    visitPrimaryButtonLabel,
    visitPrimaryButtonLink,
    visitSecondaryButtonLabel,
    visitSecondaryButtonLink
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

  function renderButtons(selector, buttons) {
    const container = document.querySelector(selector);

    if (!container || !Array.isArray(buttons)) {
      return;
    }

    const validButtons = buttons
      .map((button) => ({
        label: typeof button.label === 'string' ? button.label.trim() : '',
        href: getSafeLink(button.link),
        className: typeof button.className === 'string' ? button.className.trim() : '',
      }))
      .filter((button) => button.label && button.href);

    if (validButtons.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();

    validButtons.forEach((button) => {
      const link = document.createElement('a');
      link.className = button.className ? `btn ${button.className}` : 'btn';
      link.href = button.href;
      link.textContent = button.label;
      fragment.appendChild(link);
    });

    container.textContent = '';
    container.appendChild(fragment);
    container.hidden = false;
  }

  function renderQuickLinks(items) {
    const container = document.querySelector(selectors.quickLinks);

    if (!container || !Array.isArray(items)) {
      return;
    }

    const validItems = items
      .slice(0, 3)
      .map((item) => ({
        title: typeof item?.title === 'string' ? item.title.trim() : '',
        text: typeof item?.text === 'string' ? item.text.trim() : '',
        imageUrl: getSafeImageUrl(item?.imageUrl),
        buttonLabel:
          typeof item?.buttonLabel === 'string' ? item.buttonLabel.trim() : '',
        buttonLink: getSafeLink(item?.buttonLink),
      }))
      .filter(
        (item) =>
          item.title &&
          item.text &&
          item.buttonLabel &&
          item.buttonLink
      );

    if (validItems.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();

    validItems.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'homepage-card';

      const media = document.createElement('div');
      media.className = 'homepage-card__media';

      if (item.imageUrl) {
        media.style.backgroundImage = [
          'linear-gradient(135deg, rgba(79, 23, 127, 0.72), rgba(217, 13, 135, 0.5))',
          `url("${item.imageUrl}")`,
        ].join(', ');
      }

      media.setAttribute('aria-hidden', 'true');

      const cardContent = document.createElement('div');
      cardContent.className = 'homepage-card__content';

      const title = document.createElement('h3');
      title.textContent = item.title;

      const text = document.createElement('p');
      text.textContent = item.text;

      const link = document.createElement('a');
      link.className = 'btn';
      link.href = item.buttonLink;
      link.textContent = item.buttonLabel;

      cardContent.append(title, text, link);
      article.append(media, cardContent);
      fragment.appendChild(article);
    });

    container.textContent = '';
    container.appendChild(fragment);
  }
  function getSafeImageUrl(value) {
    const imageUrl = typeof value === 'string' ? value.trim() : '';

    if (!imageUrl) {
      return '';
    }

    try {
      const parsedUrl = new URL(imageUrl);

      if (parsedUrl.protocol !== 'https:') {
        return '';
      }

      return parsedUrl.href;
    } catch {
      return '';
    }
  }

  function renderHeroImage(value) {
    const hero = document.querySelector(selectors.hero);
    const imageUrl = getSafeImageUrl(value);

    if (!hero || !imageUrl) {
      return;
    }

    hero.style.backgroundImage = [
      'linear-gradient(135deg, rgba(79, 23, 127, 0.78), rgba(217, 13, 135, 0.57))',
      `url("${imageUrl}")`,
    ].join(', ');
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
      renderHeroImage(homePage.heroImageUrl);
      renderButtons(selectors.heroCta, [
        {
          label: homePage.ctaLabel,
          link: homePage.ctaLink,
        },
      ]);

      setText(selectors.quickLinksTitle, homePage.quickLinksTitle);
      setText(selectors.quickLinksIntro, homePage.quickLinksIntro);
      renderQuickLinks(homePage.quickLinks);

      setText(selectors.welcomeTitle, homePage.welcomeTitle);
      setText(selectors.welcomeText, homePage.welcomeText);
      renderButtons(selectors.welcomeCta, [
        {
          label: homePage.welcomeButtonLabel,
          link: homePage.welcomeButtonLink,
        },
      ]);

      setText(selectors.visitTitle, homePage.visitTitle);
      setText(selectors.visitText, homePage.visitText);
      renderButtons(selectors.visitCta, [
        {
          label: homePage.visitPrimaryButtonLabel,
          link: homePage.visitPrimaryButtonLink,
        },
        {
          label: homePage.visitSecondaryButtonLabel,
          link: homePage.visitSecondaryButtonLink,
          className: 'btn--secondary',
        },
      ]);
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
