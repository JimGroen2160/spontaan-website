(() => {
  const config = {
    projectId: 'u66p1mxm',
    dataset: 'development',
    apiVersion: '2026-07-06',
  };

  const query = `*[
    _type == "newsItem" &&
    isVisible == true &&
    slug.current == $slug
  ][0]{
    title,
    "slug": slug.current,
    publishedAt,
    category,
    summary,
    mainImageAlt,
    "imageUrl": mainImage.asset->url,
    body
  }`;

  const categoryLabels = {
    optredens: 'Optredens',
    vereniging: 'Vereniging',
    media: 'Media',
    overig: 'Overig',
  };

  const fallbackItems = {
    'spontaan-zingt-tijdens-een-sfeervolle-zomeravond': {
      title: 'Spontaan zingt tijdens een sfeervolle zomeravond',
      category: 'Optredens',
      publishedAt: '2026-06-21',
      summary:
        'Een avond vol muziek, ontmoeting en bekende nummers die het publiek enthousiast meezong.',
      imageAlt: 'Zanggroep Spontaan tijdens een optreden',
      imageSrc: '../images/news/nieuws-zomeravond.webp',
      body: [
        'Tijdens deze sfeervolle zomeravond bracht Zanggroep Spontaan een afwisselend programma met bekende en verrassende nummers.',
        'Het publiek genoot zichtbaar en zong bij verschillende liedjes enthousiast mee. Het werd een avond vol muziek, plezier en ontmoeting.',
        'Wij kijken met veel plezier terug op dit bijzondere optreden en danken iedereen die erbij was.',
      ],
    },

    'nieuwe-stemmen-zijn-van-harte-welkom': {
      title: 'Nieuwe stemmen zijn van harte welkom',
      category: 'Vereniging',
      publishedAt: '2026-06-14',
      summary:
        'Houd je van zingen en gezelligheid? Kom vrijblijvend kennismaken tijdens een van onze repetities.',
      imageAlt: 'Leden van Zanggroep Spontaan tijdens een repetitie',
      imageSrc: '../images/news/nieuws-nieuwe-stemmen.webp',
      body: [
        'Zanggroep Spontaan verwelkomt graag nieuwe zangers die plezier beleven aan samen muziek maken.',
        'Ervaring is fijn, maar enthousiasme en betrokkenheid zijn minstens zo belangrijk. Tijdens een repetitie kun je rustig kennismaken met de groep en ons repertoire.',
        'Neem vooraf contact met ons op, zodat wij je persoonlijk kunnen ontvangen.',
      ],
    },

    'zo-bereiden-wij-een-nieuw-optreden-voor': {
      title: 'Zo bereiden wij een nieuw optreden voor',
      category: 'Media',
      publishedAt: '2026-06-07',
      summary:
        'Van de eerste repetitie tot het podium: een kijkje achter de schermen bij Zanggroep Spontaan.',
      imageAlt: 'Microfoon en bladmuziek tijdens een repetitie',
      imageSrc: '../images/news/nieuws-optreden-voorbereiden.webp',
      body: [
        'De voorbereiding van een optreden begint meestal weken van tevoren met het kiezen en instuderen van de muziek.',
        'Tijdens de repetities werken we aan samenzang, uitspraak, dynamiek en presentatie. Ook de volgorde van het programma krijgt uitgebreid aandacht.',
        'Zo zorgen we ervoor dat ieder optreden muzikaal én sfeervol een herkenbaar Spontaan-karakter krijgt.',
      ],
    },

    'terugblik-op-een-warm-ontvangen-optreden': {
      title: 'Terugblik op een warm ontvangen optreden',
      category: 'Optredens',
      publishedAt: '2026-05-30',
      summary:
        'Muziek verbindt. Dat bleek opnieuw tijdens een bijzonder optreden voor een enthousiast publiek.',
      imageAlt: 'Zanggroep Spontaan samen op het podium',
      imageSrc: '../images/news/nieuws-terugblik-optreden.webp',
      body: [
        'We kijken terug op een bijzonder optreden waarin muziek en ontmoeting centraal stonden.',
        'De warme reacties uit het publiek maakten de avond extra waardevol voor alle zangers en muzikanten.',
        'Dank aan iedereen die aanwezig was en aan alle vrijwilligers die dit optreden mogelijk maakten.',
      ],
    },

    'samen-zingen-geeft-energie-en-plezier': {
      title: 'Samen zingen geeft energie en plezier',
      category: 'Vereniging',
      publishedAt: '2026-05-18',
      summary:
        'Onze leden vertellen waarom de wekelijkse repetitie voor hen een waardevol moment is.',
      imageAlt: 'Zangers van Spontaan tijdens een gezamenlijke repetitie',
      imageSrc: '../images/news/nieuws-samen-zingen.webp',
      body: [
        'Voor veel leden is de wekelijkse repetitie een moment om naar uit te kijken.',
        'Samen zingen geeft energie, ontspanning en een sterk gevoel van verbondenheid.',
        'Naast het muzikale plezier is er ruimte voor gezelligheid en persoonlijke ontmoeting.',
      ],
    },

    'een-kijkje-in-het-repertoire-van-spontaan': {
      title: 'Een kijkje in het repertoire van Spontaan',
      category: 'Media',
      publishedAt: '2026-05-10',
      summary:
        'Bekende klassiekers, verrassende nummers en muziek die uitnodigt om mee te zingen.',
      imageAlt: 'Bladmuziek en microfoon van Zanggroep Spontaan',
      imageSrc: '../images/news/nieuws-repertoire.webp',
      body: [
        'Het repertoire van Spontaan bestaat uit een afwisselende combinatie van bekende nummers en verrassende muzikale keuzes.',
        'We zoeken liedjes die prettig zijn om te zingen en die ook het publiek weten te raken.',
        'Het repertoire blijft zich ontwikkelen, zodat elk optreden vertrouwd én vernieuwend aanvoelt.',
      ],
    },
  };

  const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const normalizeText = (value) =>
    String(value || '')
      .trim()
      .toLocaleLowerCase('nl-NL');

  function getCategoryLabel(value) {
    const key = normalizeText(value);

    return Object.hasOwn(categoryLabels, key)
      ? categoryLabels[key]
      : categoryLabels.overig;
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

  function getValidDate(value) {
    const dateValue = typeof value === 'string' ? value.trim() : '';
    const date = new Date(dateValue);

    if (!dateValue || Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function getPortableTextParagraphs(blocks) {
    if (!Array.isArray(blocks)) {
      return [];
    }

    return blocks
      .filter(
        (block) =>
          block &&
          block._type === 'block' &&
          Array.isArray(block.children)
      )
      .map((block) =>
        block.children
          .filter(
            (child) =>
              child &&
              child._type === 'span' &&
              typeof child.text === 'string'
          )
          .map((child) => child.text)
          .join('')
          .trim()
      )
      .filter(Boolean);
  }

  function normalizeNewsItem(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const title =
      typeof item.title === 'string' ? item.title.trim() : '';
    const slug =
      typeof item.slug === 'string' ? item.slug.trim() : '';
    const summary =
      typeof item.summary === 'string' ? item.summary.trim() : '';
    const imageAlt =
      typeof item.mainImageAlt === 'string'
        ? item.mainImageAlt.trim()
        : '';
    const imageSrc = getSafeImageUrl(item.imageUrl);
    const publishedDate = getValidDate(item.publishedAt);
    const body = getPortableTextParagraphs(item.body);
    const category = getCategoryLabel(item.category);

    if (
      !title ||
      !slug ||
      !summary ||
      !imageAlt ||
      !imageSrc ||
      !publishedDate ||
      body.length === 0
    ) {
      return null;
    }

    return {
      title,
      slug,
      category,
      summary,
      imageAlt,
      imageSrc,
      publishedAt: publishedDate.toISOString(),
      body,
    };
  }

  async function fetchNewsItem(slug) {
    const encodedQuery = encodeURIComponent(query);
    const encodedSlug = encodeURIComponent(JSON.stringify(slug));
    const url =
      `https://${config.projectId}.apicdn.sanity.io/` +
      `v${config.apiVersion}/data/query/${config.dataset}` +
      `?query=${encodedQuery}&%24slug=${encodedSlug}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Sanity request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    return normalizeNewsItem(data.result);
  }

  function getSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug')?.trim() || '';
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  }

  function renderBody(paragraphs) {
    const container = document.querySelector('[data-news-detail-body]');

    if (!container || !Array.isArray(paragraphs)) {
      return;
    }

    const fragment = document.createDocumentFragment();

    paragraphs.forEach((paragraphText) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = paragraphText;
      fragment.appendChild(paragraph);
    });

    container.textContent = '';
    container.appendChild(fragment);
  }

  function renderItem(item) {
    const title = item.title.trim();
    const category = item.category.trim();
    const summary = item.summary.trim();
    const date = getValidDate(item.publishedAt);
    const time = document.querySelector('[data-news-detail-date]');
    const image = document.querySelector('[data-news-detail-image]');

    document.title = `${title} | Zanggroep Spontaan`;

    setText('[data-news-detail-title]', title);
    setText('[data-news-detail-category]', category);
    setText('[data-news-detail-summary]', summary);

    if (time && date) {
      time.dateTime = item.publishedAt;
      time.textContent = dateFormatter.format(date);
    }

    if (image) {
      image.src = item.imageSrc;
      image.alt = item.imageAlt;
    }

    renderBody(item.body);
  }

  function renderNotFound() {
    setText('[data-news-detail-title]', 'Nieuwsbericht niet gevonden');
    setText('[data-news-detail-category]', 'Nieuws');
    setText(
      '[data-news-detail-summary]',
      'Het opgevraagde nieuwsbericht bestaat niet of is niet meer beschikbaar.'
    );

    const time = document.querySelector('[data-news-detail-date]');
    const media = document.querySelector('.news-detail__media');

    if (time) {
      time.hidden = true;
      time.previousElementSibling?.setAttribute('hidden', '');
    }

    if (media) {
      media.hidden = true;
    }

    renderBody([
      'Ga terug naar het nieuwsoverzicht om de beschikbare nieuwsberichten te bekijken.',
    ]);
  }

  async function initNewsDetail() {
    const slug = getSlug();

    if (!slug) {
      renderNotFound();
      return;
    }

    try {
      const sanityItem = await fetchNewsItem(slug);

      if (sanityItem) {
        renderItem(sanityItem);
        return;
      }
    } catch (error) {
      console.info(
        'Sanity-nieuwsbericht niet geladen; statische detailfallback wordt gebruikt.',
        error
      );
    }

    const fallbackItem = Object.hasOwn(fallbackItems, slug)
      ? fallbackItems[slug]
      : null;

    if (!fallbackItem) {
      renderNotFound();
      return;
    }

    renderItem(fallbackItem);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsDetail, {
      once: true,
    });
  } else {
    initNewsDetail();
  }
})();