(() => {
  'use strict';

  const selectors = [
    '.hero', '.about-hero', '.agenda-hero', '.news-hero',
    '.media-hero', '.friends-hero', '.contact-hero',
    '.repertoire-hero'
  ];

  const mobile = window.matchMedia('(max-width: 768px)');
  const observed = new WeakSet();
  const originals = new WeakMap();

  function cssImage(element) {
    if (!element) return null;

    const background =
      element.style.backgroundImage ||
      getComputedStyle(element).backgroundImage;

    const match = background.match(/url\(["']?(.+?)["']?\)/);
    return match ? match[1] : null;
  }

  function sourceImage(hero) {
    const image = Array.from(hero.children).find(
      element => element.matches('img[class*="hero__image"]')
    );

    if (image) {
      return image.getAttribute('src') || image.currentSrc;
    }

    for (const element of [hero, ...Array.from(hero.children)]) {
      const url = cssImage(element);
      if (url) return url;
    }

    return null;
  }

  function imageInfo(value) {
    if (!value) return null;

    try {
      const url = new URL(value, document.baseURI);

      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'cdn.sanity.io' ||
        !url.pathname.startsWith('/images/')
      ) {
        return null;
      }

      const filename = url.pathname.split('/').pop();
      const match = filename.match(
        /-(\d+)x(\d+)\.(?:jpg|jpeg|png|webp|avif|gif)$/i
      );

      if (!match) return null;

      const width = Number(match[1]);
      const height = Number(match[2]);

      if (
        !Number.isSafeInteger(width) ||
        !Number.isSafeInteger(height) ||
        width < 1 ||
        height < 1
      ) {
        return null;
      }

      for (const key of [
        'rect', 'crop', 'hotspot', 'w', 'h', 'fit'
      ]) {
        url.searchParams.delete(key);
      }

      url.searchParams.set('auto', 'format');
      url.searchParams.set('q', '80');

      return {url, width, height};
    } catch {
      return null;
    }
  }

  function sized(info, width) {
    const url = new URL(info.url.href);

    url.searchParams.set(
      'w',
      String(Math.min(width, info.width))
    );

    return url.href;
  }

  function updateHero(hero) {
    if (!mobile.matches) return;

    const detected = sourceImage(hero);

    if (detected) {
      originals.set(hero, detected);
    }

    const info = imageInfo(
      detected || originals.get(hero)
    );

    if (!info) {
      const source = detected || originals.get(hero);
      if (!source) return;

      let url;
      try {
        url = new URL(source, document.baseURI);
      } catch {
        return;
      }

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== document.location.origin
      ) {
        return;
      }

      let image = Array.from(hero.children).find(
        element => element.classList.contains('p87-mobile-photo')
      );

      if (!image) {
        image = document.createElement('img');
        image.className = 'p87-mobile-photo';
        image.alt = '';
        image.decoding = 'async';
        hero.insertBefore(image, hero.firstChild);
      }

      const original = Array.from(hero.children).find(
        element => element.matches('img[class*="hero__image"]')
      );

      if (original && original.complete &&
          original.naturalWidth > 0 &&
          original.naturalHeight > 0) {
        image.width = original.naturalWidth;
        image.height = original.naturalHeight;
      }

      image.onload = () => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          image.width = image.naturalWidth;
          image.height = image.naturalHeight;
          image.style.setProperty(
            '--p87-photo-ratio',
            `${image.naturalWidth} / ${image.naturalHeight}`
          );
        }
      };

      if (image.getAttribute('src') !== url.href) {
        image.removeAttribute('srcset');
        image.setAttribute('src', url.href);
      }

      image.loading = 'eager';
      hero.classList.add('p87-option-a');
      return;
    }

    let image = Array.from(hero.children).find(
      element => element.classList.contains('p87-mobile-photo')
    );

    if (!image) {
      image = document.createElement('img');
      image.className = 'p87-mobile-photo';
      image.alt = '';
      image.decoding = 'async';
      hero.insertBefore(image, hero.firstChild);
    }

    image.width = info.width;
    image.height = info.height;

    image.style.setProperty(
      '--p87-photo-ratio',
      `${info.width} / ${info.height}`
    );

    image.sizes = '100vw';

    const widths = [
      ...new Set(
        [320, 480, 640, 768, 960, 1200]
          .filter(w => w < info.width)
          .concat(Math.min(info.width, 1200))
      )
    ].sort((a, b) => a - b);

    const srcset = widths.map(
      w => `${sized(info, w)} ${w}w`
    ).join(', ');

    if (image.getAttribute('srcset') !== srcset) {
      image.setAttribute('srcset', srcset);
    }

    const src = sized(info, 960);

    if (image.getAttribute('src') !== src) {
      image.setAttribute('src', src);
    }

    image.loading = 'eager';
    image.setAttribute('fetchpriority', 'high');

    hero.classList.add('p87-option-a');
  }

  function update() {
    for (const selector of selectors) {
      for (const hero of document.querySelectorAll(selector)) {
        updateHero(hero);

        if (!observed.has(hero)) {
          observed.add(hero);

          const observer = new MutationObserver(records => {
            const mobilePhoto = Array.from(hero.children).find(
              el => el.classList.contains('p87-mobile-photo')
            );

            if (records.some(
              record => record.target !== mobilePhoto
            )) {
              updateHero(hero);
            }
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
      'DOMContentLoaded',
      update,
      {once: true}
    );
  } else {
    update();
  }

  mobile.addEventListener('change', update);
  window.addEventListener('load', update);
})();