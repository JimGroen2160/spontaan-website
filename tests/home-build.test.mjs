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
