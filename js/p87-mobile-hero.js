(() => {
  'use strict';

  const selectors = [
    '.hero',
    '.about-hero',
    '.agenda-hero',
    '.news-hero',
    '.media-hero',
    '.friends-hero',
    '.contact-hero',
    '.repertoire-hero'
  ];

  const mobile = window.matchMedia('(max-width: 768px)');
  const observed = new WeakSet();

  function fullImageUrl(value) {
    if (!value) return null;

    try {
      const url = new URL(value, document.baseURI);

      if (url.hostname.endsWith('.sanity.io')) {
        for (const key of [
          'rect', 'crop', 'hotspot', 'w', 'h', 'fit'
        ]) {
          url.searchParams.delete(key);
        }
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function cssImage(element) {
    if (!element) return null;

    const background =
      element.style.backgroundImage ||
      getComputedStyle(element).backgroundImage;

    const match =
      background.match(/url\(["']?(.+?)["']?\)/);

    return match ? match[1] : null;
  }

  function sourceImage(hero) {
    const existing = Array.from(
      hero.children
    ).find(element =>
      element.matches('img[class*="hero__image"]')
    );

    if (existing) {
      return existing.currentSrc ||
        existing.getAttribute('src');
    }

    const candidates = [
      hero,
      ...Array.from(hero.children)
    ];

    for (const element of candidates) {
      const url = cssImage(element);
      if (url) return url;
    }

    return null;
  }

  function updateHero(hero) {
    if (!mobile.matches) return;

    const source = sourceImage(hero);
    const url = fullImageUrl(source);

    if (!url) return;

    let image = Array.from(hero.children)
      .find(element =>
        element.classList.contains('p87-mobile-photo')
      );

    if (!image) {
      image = document.createElement('img');
      image.className = 'p87-mobile-photo';
      image.alt = '';
      image.decoding = 'async';

      hero.insertBefore(image, hero.firstChild);
    }

    if (image.src !== url) {
      image.src = url;
    }

    hero.classList.add('p87-option-a');
  }

  function update() {
    for (const selector of selectors) {
      for (const hero of document.querySelectorAll(selector)) {
        updateHero(hero);

        if (!observed.has(hero)) {
          observed.add(hero);

          const observer = new MutationObserver(() => {
            updateHero(hero);
          });

          observer.observe(hero, {
            attributes: true,
            attributeFilter: ['style', 'src'],
            subtree: true
          });
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded', update, { once: true }
    );
  } else {
    update();
  }

  mobile.addEventListener('change', update);

  // Dynamisch door CMS-scripts ingestelde hero-afbeeldingen.
  window.addEventListener('load', update);
})();