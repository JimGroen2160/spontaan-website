import assert from 'node:assert/strict';
import {afterEach, before, test} from 'node:test';
import {readFile} from 'node:fs/promises';

const buildModule = await import('../scripts/build-site.mjs');

const {
  fetchHomeCmsContent,
  normalizeHomeContent,
  renderHomePage,
  validateHomeContent,
} = buildModule;

let fallback;
let template;

function assertHomeBuildExports() {
  assert.equal(
    typeof normalizeHomeContent,
    'function',
    'normalizeHomeContent moet worden geëxporteerd',
  );
  assert.equal(
    typeof validateHomeContent,
    'function',
    'validateHomeContent moet worden geëxporteerd',
  );
  assert.equal(
    typeof renderHomePage,
    'function',
    'renderHomePage moet worden geëxporteerd',
  );
  assert.equal(
    typeof fetchHomeCmsContent,
    'function',
    'fetchHomeCmsContent moet worden geëxporteerd',
  );
}

before(async () => {
  fallback = JSON.parse(
    await readFile('data/home-fallback.json', 'utf8'),
  );

  template = await readFile(
    'build/home.template.html',
    'utf8',
  );
});

afterEach(() => {
  delete process.env.HOME_BUILD_FIXTURE;
});

test('schema en singleton registreren homePage-main', async () => {
  const [schema, types, singleton, structure] = await Promise.all([
    readFile('studio/schemaTypes/homePage.ts', 'utf8'),
    readFile('studio/schemaTypes/index.ts', 'utf8'),
    readFile('studio/singletonTypes.ts', 'utf8'),
    readFile('studio/structure.ts', 'utf8'),
  ]);

  assert.match(schema, /name: 'homePage'/);
  assert.match(types, /homePage/);
  assert.match(
    singleton,
    /HOME_PAGE_DOCUMENT_ID = 'homePage-main'/,
  );
  assert.match(singleton, /'homePage'/);
  assert.match(structure, /HOME_PAGE_DOCUMENT_ID/);
  assert.match(
    structure,
    /\.documentId\(documentId\)/,
  );
  assert.match(
    structure,
    /singletonItem\(\s*S,\s*'homePage',\s*'Homepage',\s*'homePage',\s*HOME_PAGE_DOCUMENT_ID\s*\)/,
  );
});

test('Homepage-buildfuncties zijn beschikbaar', () => {
  assertHomeBuildExports();
});

test('normalisatie behoudt geldige inhoud en drie snelkoppelingen', () => {
  assertHomeBuildExports();

  const content = normalizeHomeContent(fallback);

  assert.equal(content.heroTitle, 'Zanggroep Spontaan');
  assert.equal(content.quickLinks.length, 3);
  assert.equal(
    content.welcomeButtonLink,
    'pages/over.html',
  );
  assert.equal(
    content.visitPrimaryButtonLink,
    'pages/contact.html',
  );
  assert.equal(
    content.visitSecondaryButtonLink,
    'pages/agenda.html',
  );
});

test('normalisatie verwijdert onveilige links en afbeeldingen', () => {
  assertHomeBuildExports();

  const content = normalizeHomeContent({
    ...fallback,
    heroImageUrl: 'javascript:alert(1)',
    ctaLabel: 'Onveilige CTA',
    ctaLink: 'javascript:alert(2)',
    quickLinks: fallback.quickLinks.map(
      (item, index) => ({
        ...item,
        imageUrl:
          index === 0
            ? 'data:text/html,gevaarlijk'
            : item.imageUrl,
        buttonLink:
          index === 1
            ? 'javascript:alert(3)'
            : item.buttonLink,
      }),
    ),
  });

  assert.equal(content.heroImageUrl, '');
  assert.equal(content.ctaLink, '');
  assert.equal(content.quickLinks[0].imageUrl, '');
  assert.equal(content.quickLinks[1].buttonLink, '');
});

test('validatie weigert ontbrekende kerninhoud en onvolledige snelkoppelingen', () => {
  assertHomeBuildExports();

  const missingHero = normalizeHomeContent({
    ...fallback,
    heroTitle: '',
  });

  assert.throws(
    () => validateHomeContent(missingHero),
    /Homepage|hero|verplicht/i,
  );

  const tooFewQuickLinks = normalizeHomeContent({
    ...fallback,
    quickLinks: fallback.quickLinks.slice(0, 2),
  });

  assert.throws(
    () => validateHomeContent(tooFewQuickLinks),
    /snelkoppeling|quick|drie/i,
  );
});

test('renderer escapt CMS-tekst en bouwt volledige statische Homepage', () => {
  assertHomeBuildExports();

  const content = normalizeHomeContent({
    ...fallback,
    heroTitle: '<script>alert("xss")</script>',
    heroImageUrl:
      'images/about/over-intro-mannenkoor.jpg',
    ctaLabel: 'Kom kennismaken',
    ctaLink: 'pages/contact.html',
  });

  validateHomeContent(content);

  const html = renderHomePage(
    template,
    content,
    'cms',
  );

  assert.match(
    html,
    /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/,
  );

  assert.doesNotMatch(
    html,
    /<script>alert\("xss"\)<\/script>/,
  );

  assert.match(
    html,
    /data-home-source="cms"/,
  );

  assert.match(
    html,
    /images\/about\/over-intro-mannenkoor\.jpg/,
  );

  assert.match(
    html,
    /href="pages\/contact\.html"/,
  );

  assert.equal(
    (html.match(/class="homepage-card"/g) || []).length,
    3,
  );

  assert.doesNotMatch(
    html,
    /js\/homepage\.js/,
  );

  assert.doesNotMatch(
    html,
    /api\.sanity\.io|apicdn\.sanity\.io|\/data\/query\//,
  );
});

test('Homepage gebruikt handmatig geselecteerd nieuws met voorrang', () => {
  const content = normalizeHomeContent({
    ...fallback,
    featuredNewsTitle: 'Uitgelicht nieuws',
    featuredNewsIntro: 'Lees onze nieuwste berichten.',
    featuredNewsButtonLabel: 'Bekijk al het nieuws',
    featuredNewsButtonLink: 'pages/nieuws.html',
    manualFeaturedNewsItems: [
      {
        _id: 'news-handmatig-1',
        title: 'Handmatig gekozen bericht',
        slug: 'handmatig-gekozen-bericht',
        publishedAt: '2026-08-01T10:00:00.000Z',
        isVisible: true,
        summary: 'Dit bericht is handmatig geselecteerd.',
        mainImageAlt: 'Zanggroep Spontaan tijdens een optreden',
        imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
      },
    ],
    automaticFeaturedNewsItems: [
      {
        _id: 'news-automatisch-1',
        title: 'Automatisch bericht',
        slug: 'automatisch-bericht',
        publishedAt: '2026-08-05T10:00:00.000Z',
        isVisible: true,
        summary: 'Dit bericht mag niet worden gebruikt.',
        mainImageAlt: 'Voorbereiding op een optreden',
        imageUrl: 'images/news/nieuws-optreden-voorbereiden.webp',
      },
    ],
  });

  assert.equal(content.featuredNews.selectionMode, 'manual');
  assert.equal(content.featuredNews.items.length, 1);
  assert.equal(
    content.featuredNews.items[0].title,
    'Handmatig gekozen bericht',
  );
  assert.equal(
    content.featuredNews.items[0].buttonLink,
    'pages/nieuwsbericht.html?slug=handmatig-gekozen-bericht',
  );

  const html = renderHomePage(template, content, 'cms');

  assert.match(html, /data-homepage-featured-news-mode="manual"/);
  assert.match(html, /Handmatig gekozen bericht/);
  assert.doesNotMatch(html, /Automatisch bericht/);
  assert.match(html, /Bekijk al het nieuws/);
  assert.match(html, /href="pages\/nieuws\.html"/);
});

test('Homepage beperkt handmatige nieuwsselectie tot drie items', () => {
  const makeItem = (index) => ({
    _id: `news-handmatig-${index}`,
    title: `Handmatig bericht ${index}`,
    slug: `handmatig-bericht-${index}`,
    publishedAt: `2026-08-0${index}T10:00:00.000Z`,
    isVisible: true,
    summary: `Samenvatting ${index}`,
    mainImageAlt: `Afbeelding ${index}`,
    imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
  });

  const content = normalizeHomeContent({
    ...fallback,
    manualFeaturedNewsItems: [
      makeItem(1),
      makeItem(2),
      makeItem(3),
      makeItem(4),
    ],
  });

  assert.equal(content.featuredNews.selectionMode, 'manual');
  assert.equal(content.featuredNews.items.length, 3);
  assert.deepEqual(
    content.featuredNews.items.map((item) => item.slug),
    [
      'handmatig-bericht-1',
      'handmatig-bericht-2',
      'handmatig-bericht-3',
    ],
  );
});

test('Homepage toont geen automatisch nieuws zonder expliciete selectie', () => {
  const content = normalizeHomeContent({
    ...fallback,
    featuredNewsTitle: 'Uitgelicht nieuws',
    manualFeaturedNewsItems: [],
    automaticFeaturedNewsItems: [{
      _id: 'oud-automatisch',
      title: 'Niet handmatig gekozen',
      slug: 'niet-gekozen',
      publishedAt: '2026-08-06T10:00:00.000Z',
      isVisible: true,
      summary: 'Mag niet verschijnen.',
      mainImageAlt: 'Afbeelding',
      imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
    }],
  });
  assert.equal(content.featuredNews.selectionMode, 'empty');
  assert.deepEqual(content.featuredNews.items, []);
  const html = renderHomePage(template, content, 'cms');
  assert.match(html, /data-homepage-featured-news hidden/);
  assert.doesNotMatch(html, /Niet handmatig gekozen/);
});

test('Homepage bewaart bestaande slugs exact in detail-links', () => {
  const makeItem = (slug) => ({
    _id: `news-${slug}`,
    title: 'Historisch nieuwsbericht',
    slug,
    publishedAt: '2026-08-06T10:00:00.000Z',
    isVisible: true,
    summary: 'Een bestaand nieuwsbericht.',
    mainImageAlt: 'Afbeelding',
    imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
  });
  const content = normalizeHomeContent({
    ...fallback,
    manualFeaturedNewsItems: [makeItem('Galluskerk'), makeItem('Laatste korendag')],
  });
  assert.deepEqual(
    content.featuredNews.items.map((item) => item.buttonLink),
    [
      'pages/nieuwsbericht.html?slug=Galluskerk',
      'pages/nieuwsbericht.html?slug=Laatste%20korendag',
    ],
  );
});

test('Homepage filtert onzichtbare en onvolledige nieuwsitems', () => {
  const content = normalizeHomeContent({
    ...fallback,
    manualFeaturedNewsItems: [
      {
        _id: 'news-onzichtbaar',
        title: 'Onzichtbaar bericht',
        slug: 'onzichtbaar-bericht',
        publishedAt: '2026-08-05T10:00:00.000Z',
        isVisible: false,
        summary: 'Mag niet verschijnen.',
        mainImageAlt: 'Afbeelding',
        imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
      },
      {
        _id: 'news-zonder-afbeelding',
        title: 'Onvolledig bericht',
        slug: 'onvolledig-bericht',
        publishedAt: '2026-08-04T10:00:00.000Z',
        isVisible: true,
        summary: 'Mist afbeelding.',
        mainImageAlt: 'Afbeelding',
        imageUrl: '',
      },
    ],
  });

  assert.equal(content.featuredNews.selectionMode, 'empty');
  assert.deepEqual(content.featuredNews.items, []);
});

test('Homepage verbergt nieuwssectie wanneer geen bruikbaar nieuws bestaat', () => {
  const content = normalizeHomeContent({
    ...fallback,
    featuredNewsTitle: 'Uitgelicht nieuws',
    manualFeaturedNewsItems: [],
    automaticFeaturedNewsItems: [],
  });

  assert.equal(content.featuredNews.selectionMode, 'empty');
  assert.deepEqual(content.featuredNews.items, []);

  const html = renderHomePage(template, content, 'cms');

  assert.match(
    html,
    /data-homepage-featured-news hidden/,
  );

  assert.doesNotMatch(
    html,
    /data-homepage-featured-news-mode=/,
  );
});

test('Homepage escapt nieuwsinhoud en toont overzichtsknop alleen volledig', () => {
  const unsafeContent = normalizeHomeContent({
    ...fallback,
    featuredNewsTitle: '<b>Nieuws</b>',
    featuredNewsIntro: '<script>alert("intro")</script>',
    featuredNewsButtonLabel: 'Al het nieuws',
    featuredNewsButtonLink: 'pages/nieuws.html',
    manualFeaturedNewsItems: [
      {
        _id: 'news-veiligheid',
        title: '<script>alert("titel")</script>',
        slug: 'veilig-bericht',
        publishedAt: '2026-08-06T10:00:00.000Z',
        isVisible: true,
        summary: '<img src=x onerror=alert(1)>',
        mainImageAlt: '<svg onload=alert(1)>',
        imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
      },
    ],
  });

  const unsafeHtml = renderHomePage(
    template,
    unsafeContent,
    'cms',
  );

  assert.match(unsafeHtml, /&lt;b&gt;Nieuws&lt;\/b&gt;/);
  assert.match(
    unsafeHtml,
    /&lt;script&gt;alert\(&quot;intro&quot;\)&lt;\/script&gt;/,
  );
  assert.match(
    unsafeHtml,
    /&lt;script&gt;alert\(&quot;titel&quot;\)&lt;\/script&gt;/,
  );
  assert.match(
    unsafeHtml,
    /&lt;img src=x onerror=alert\(1\)&gt;/,
  );
  assert.doesNotMatch(
    unsafeHtml,
    /<script>alert\("titel"\)<\/script>/,
  );

  const incompleteOverview = normalizeHomeContent({
    ...fallback,
    featuredNewsButtonLabel: 'Al het nieuws',
    featuredNewsButtonLink: '',
    manualFeaturedNewsItems: [
      {
        _id: 'news-zonder-overzichtsknop',
        title: 'Bericht zonder overzichtsknop',
        slug: 'bericht-zonder-overzichtsknop',
        publishedAt: '2026-08-06T10:00:00.000Z',
        isVisible: true,
        summary: 'Volledig nieuwsbericht.',
        mainImageAlt: 'Zanggroep tijdens optreden',
        imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
      },
    ],
  });

  const incompleteHtml = renderHomePage(
    template,
    incompleteOverview,
    'cms',
  );

  assert.doesNotMatch(
    incompleteHtml,
    />Al het nieuws<\/a>/,
  );
});
test('Homepage laat testnieuws alleen toe wanneer allowDemo expliciet aan staat', () => {
  const demoItem = {
    _id: 'news-demo-contract',
    title: '[DEMO] Contractnieuws',
    slug: 'demo-contractnieuws',
    publishedAt: '2026-08-16T16:00:00.000Z',
    isVisible: true,
    isTestData: true,
    summary: 'Demo voor FAT/GAT.',
    mainImageAlt: 'Zanggroep tijdens een demo-optreden',
    imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
  };

  const production = normalizeHomeContent({
    ...fallback,
    manualFeaturedNewsItems: [demoItem],
    automaticFeaturedNewsItems: [demoItem],
  });

  assert.equal(
    production.featuredNews.selectionMode,
    'empty',
  );
  assert.deepEqual(production.featuredNews.items, []);

  const previewManual = normalizeHomeContent(
    {
      ...fallback,
      manualFeaturedNewsItems: [demoItem],
      automaticFeaturedNewsItems: [],
    },
    {allowDemo: true},
  );

  assert.equal(
    previewManual.featuredNews.selectionMode,
    'manual',
  );
  assert.equal(previewManual.featuredNews.items.length, 1);
  assert.equal(
    previewManual.featuredNews.items[0].slug,
    'demo-contractnieuws',
  );

  const previewAutomatic = normalizeHomeContent(
    {
      ...fallback,
      manualFeaturedNewsItems: [],
      automaticFeaturedNewsItems: [demoItem],
    },
    {allowDemo: true},
  );

  assert.equal(
    previewAutomatic.featuredNews.selectionMode,
    'empty',
  );
  assert.equal(
    previewAutomatic.featuredNews.items.length,
    0,
  );

  const hiddenPreview = normalizeHomeContent(
    {
      ...fallback,
      manualFeaturedNewsItems: [],
      automaticFeaturedNewsItems: [
        {
          ...demoItem,
          isVisible: false,
        },
      ],
    },
    {allowDemo: true},
  );

  assert.equal(
    hiddenPreview.featuredNews.selectionMode,
    'empty',
  );
});

test('Homepage CMS-query zet allowDemo expliciet per OTAP-omgeving', async () => {
  const originalFetch = globalThis.fetch;

  const originalEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    SANITY_DATASET: process.env.SANITY_DATASET,
    SANITY_PROJECT_ID: process.env.SANITY_PROJECT_ID,
    SANITY_API_VERSION: process.env.SANITY_API_VERSION,
  };

  try {
    process.env.SANITY_PROJECT_ID = 'u66p1mxm';
    process.env.SANITY_API_VERSION = '2026-07-06';

    let capturedUrl = '';

    globalThis.fetch = async (url) => {
      capturedUrl = String(url);

      return {
        ok: true,
        async json() {
          return {result: {}};
        },
      };
    };

    process.env.VERCEL_ENV = 'preview';
    process.env.SANITY_DATASET = 'development';

    await fetchHomeCmsContent();

    const previewUrl = decodeURIComponent(capturedUrl);

    assert.match(previewUrl, /manualFeaturedNewsItems/);
    assert.doesNotMatch(previewUrl, /automaticFeaturedNewsItems/);
    assert.match(
      previewUrl,
      /\$allowDemo=true/,
    );

    process.env.VERCEL_ENV = 'production';
    process.env.SANITY_DATASET = 'production';

    await fetchHomeCmsContent();

    const productionUrl = decodeURIComponent(capturedUrl);

    assert.match(productionUrl, /manualFeaturedNewsItems/);
    assert.doesNotMatch(productionUrl, /automaticFeaturedNewsItems/);
    assert.match(
      productionUrl,
      /\$allowDemo=false/,
    );
  } finally {
    globalThis.fetch = originalFetch;

    for (
      const [name, value] of
      Object.entries(originalEnvironment)
    ) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});
test('CMS-fixture wordt deterministisch opgehaald', async () => {
  assertHomeBuildExports();

  process.env.HOME_BUILD_FIXTURE =
    'tests/fixtures/home-cms.json';

  const content = await fetchHomeCmsContent();

  assert.equal(
    content.heroTitle,
    '[TEST] Zanggroep Spontaan',
  );

  assert.equal(
    content.quickLinks.length,
    3,
  );

  assert.equal(
    content.quickLinks[0].buttonLink,
    'pages/nieuws.html',
  );
});

test('errorfixture veroorzaakt een gecontroleerde buildfout', async () => {
  assertHomeBuildExports();

  process.env.HOME_BUILD_FIXTURE =
    'tests/fixtures/home-error.json';

  await assert.rejects(
    fetchHomeCmsContent(),
    /Gesimuleerde Sanity-fout voor Homepage/,
  );
});

test('renderer weigert mojibake in gerenderde inhoud', () => {
  assertHomeBuildExports();

  const content = normalizeHomeContent({
    ...fallback,
    welcomeText:
      'Onjuiste codering: Zanggroep Spontaan ' +
      String.fromCharCode(0x00c3, 0x00a9),
  });

  assert.throws(
    () => renderHomePage(template, content, 'cms'),
    /encoding|mojibake|UTF-8/i,
  );
});


test('Sanity nieuwsselectie is uitsluitend via Homepage beschikbaar', async () => {
  const [newsSchema, homeSchema, buildSource] = await Promise.all([
    readFile('studio/schemaTypes/newsItem.ts', 'utf8'),
    readFile('studio/schemaTypes/homePage.ts', 'utf8'),
    readFile('scripts/build-site.mjs', 'utf8'),
  ]);
  assert.doesNotMatch(newsSchema, /name: 'isFeatured'/);
  assert.match(homeSchema, /name: 'featuredNewsItems'/);
  assert.match(homeSchema, /Zonder selectie verschijnt er geen nieuwssectie/);
  assert.doesNotMatch(buildSource, /automaticFeaturedNewsItems/);
});
