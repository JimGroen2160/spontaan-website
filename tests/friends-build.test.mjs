import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
  FRIENDS_QUERY,
  fetchFriendsCmsContent,
  normalizeFriendsContent,
  renderFriendsPage,
  validateFriendsContent,
} from '../scripts/build-site.mjs';

const TEST_BROWSER_SUPABASE_ENV = {
  SUPABASE_URL: 'https://synthetic-test-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_only',
};

test('vriendenquery haalt pagina en beheerbare vriendenrecords op', () => {
  assert.match(FRIENDS_QUERY, /friendsPage-main/);
  assert.match(FRIENDS_QUERY, /_type == "friendItem"/);
  assert.match(FRIENDS_QUERY, /isVisible == true/);
  assert.match(FRIENDS_QUERY, /order\(sortOrder asc, publicName asc\)/);
});

test('vriendenlinks accepteren veilige fragmenten en weigeren onveilige protocollen', () => {
  const content = normalizeFriendsContent({
    page: {
      heroSecondaryButtonLink: '#vrienden',
      heroPrimaryButtonLink: './contact.html#direct-contact',
      ctaPrimaryButtonLink: 'javascript:alert(1)',
    },
  });

  assert.equal(
    content.page.heroSecondaryButtonLink,
    '#vrienden',
  );
  assert.equal(
    content.page.heroPrimaryButtonLink,
    './contact.html#direct-contact',
  );
  assert.equal(
    content.page.ctaPrimaryButtonLink,
    '',
  );
});
test('vriendenfallback is volledig en geldig', async () => {
  const fallback = JSON.parse(
    await readFile('data/friends-fallback.json', 'utf8'),
  );

  const content = normalizeFriendsContent(
    fallback,
    Date.parse('2026-07-28T12:00:00.000Z'),
  );

  assert.doesNotThrow(() => validateFriendsContent(content));
  assert.equal(content.page.supportItems.length, 4);
  assert.equal(content.friends.length, 7);

  assert.ok(
    content.friends.some(
      (friend) =>
        friend.id === 'demo-solvane' &&
        friend.imageUrl.endsWith(
          '/demo-solvane.webp',
        ),
    ),
  );
});

test('vriendenfixture sorteert, filtert publicatieperiode en bewaart veilige links', async () => {
  const fixture = JSON.parse(
    await readFile('tests/fixtures/friends-cms.json', 'utf8'),
  );

  const content = normalizeFriendsContent(
    fixture.result,
    Date.parse('2026-07-28T12:00:00.000Z'),
  );

  validateFriendsContent(content);

  assert.deepEqual(
    content.friends.map((friend) => friend.publicName),
    [
      '[TEST] Bedrijf Een',
      '[TEST] Organisatie Twee',
      '[TEST] Lumora',
      '[TEST] Marevia',
      '[TEST] Novaro',
      '[TEST] Velinor',
    ],
  );
  assert.equal(
    content.friends[0].website,
    'https://example.com/',
  );
  assert.equal(
    content.friends.some(
      (friend) => friend.publicName.includes('Verlopen'),
    ),
    false,
  );
});

test('onveilige en onvolledige vriendenrecords worden geweigerd', () => {
  const content = normalizeFriendsContent(
    {
      page: {},
      friends: [
        {
          _id: 'onveilig',
          publicName: 'Onveilig item',
          imageUrl: 'javascript:alert(1)',
          imageAlt: 'Onveilige afbeelding',
          website: 'javascript:alert(1)',
        },
        {
          _id: 'geen-alt',
          publicName: 'Geen alt',
          imageUrl:
            'https://cdn.sanity.io/images/u66p1mxm/development/logo.png',
          imageAlt: '',
        },
      ],
    },
    Date.parse('2026-07-28T12:00:00.000Z'),
  );

  assert.deepEqual(content.friends, []);
});

test('ongeldige publicatieperiode wordt veilig overgeslagen', () => {
  const content = normalizeFriendsContent(
    {
      friends: [
        {
          _id: 'ongeldige-periode',
          publicName: 'Ongeldige periode',
          imageUrl:
            'https://cdn.sanity.io/images/u66p1mxm/development/logo.png',
          imageAlt: 'Testlogo',
          publishFrom: '2026-08-01T00:00:00.000Z',
          publishUntil: '2026-07-01T00:00:00.000Z',
        },
      ],
    },
    Date.parse('2026-07-28T12:00:00.000Z'),
  );

  assert.deepEqual(content.friends, []);
});

test('fixturefetch leest CMS-data en foutfixture geeft een fout', async () => {
  const previousFixture = process.env.FRIENDS_BUILD_FIXTURE;

  try {
    process.env.FRIENDS_BUILD_FIXTURE =
      'tests/fixtures/friends-cms.json';

    const content = await fetchFriendsCmsContent();
    assert.equal(
      content.page.heroTitle,
      '[TEST] Vrienden van Spontaan',
    );

    process.env.FRIENDS_BUILD_FIXTURE =
      'tests/fixtures/friends-error.json';

    await assert.rejects(
      fetchFriendsCmsContent(),
      /Gesimuleerde Sanity-fout/,
    );
  } finally {
    if (previousFixture === undefined) {
      delete process.env.FRIENDS_BUILD_FIXTURE;
    } else {
      process.env.FRIENDS_BUILD_FIXTURE = previousFixture;
    }
  }
});

test('vriendenrenderer escapt CMS-tekst en bevat geen runtime-Sanity-query', async () => {
  const template = await readFile(
    'build/friends.template.html',
    'utf8',
  );

  const fallback = JSON.parse(
    await readFile(
      'data/friends-fallback.json',
      'utf8',
    ),
  );

  fallback.page.heroTitle =
    '<script>alert("xss")</script>';

  const content = normalizeFriendsContent(
    fallback,
    Date.parse('2026-07-28T12:00:00.000Z'),
  );

  const html = renderFriendsPage(
    template,
    content,
    'fallback',
  );

  assert.match(
    html,
    /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/,
  );

  assert.doesNotMatch(
    html,
    /<script>alert\("xss"\)<\/script>/,
  );

  assert.doesNotMatch(html, /api\.sanity\.io/);
  assert.match(
    html,
    /dataset\.friendsSource="fallback"/,
  );
  assert.match(html, /Uw steun maakt dit mogelijk/);
  assert.match(html, /Onze vrienden en sponsors/);
  assert.match(html, /Word ook vriend van Spontaan/);
});

test('vriendenrenderer toont veilige sponsorlinks en afbeeldingsmodi', async () => {
  const template = await readFile(
    'build/friends.template.html',
    'utf8',
  );

  const fixture = JSON.parse(
    await readFile(
      'tests/fixtures/friends-cms.json',
      'utf8',
    ),
  );

  const content = normalizeFriendsContent(
    fixture.result,
    Date.parse('2026-07-28T12:00:00.000Z'),
  );

  const html = renderFriendsPage(
    template,
    content,
    'cms',
  );

  assert.match(html, /\[TEST\] Bedrijf Een/);
  assert.match(html, /\[TEST\] Organisatie Twee/);
  assert.match(
    html,
    /friends-partner-card--logo/,
  );
  assert.match(
    html,
    /friends-partner-card--logo/,
  );
  assert.match(
    html,
    /demo-aurello\.webp/,
  );
  assert.match(
    html,
    /demo-velinor\.webp/,
  );

  assert.match(
    html,
    /href="https:\/\/example\.com\/"/,
  );
  assert.match(
    html,
    /rel="noopener noreferrer"/,
  );
  assert.doesNotMatch(html, /Verlopen sponsor/);
});

test('vriendencarrousel initialiseert expliciet aan het begin en gebruikt randtolerantie', async () => {
  const script = await readFile(
    'js/friends.js',
    'utf8',
  );

  assert.match(
    script,
    /viewport\.scrollLeft = 0/,
  );

  assert.match(
    script,
    /viewport\.scrollTo\(/,
  );

  assert.match(
    script,
    /viewport\.scrollWidth - viewport\.clientWidth/,
  );

  assert.doesNotMatch(
    script,
    /viewport\.scrollBy\(/,
  );

  const carouselCss = await readFile(
    resolve(process.cwd(), 'css/friends.css'),
    'utf8',
  );

  assert.match(
    carouselCss,
    /\.friends-partners__viewport\s*>\s*\*/,
  );

  assert.match(
    carouselCss,
    /scroll-snap-align:\s*start/,
  );

  assert.doesNotMatch(
    carouselCss,
    /\.friends-partner-link\s*\{[^}]*scroll-snap-align/s,
  );

  assert.match(
    script,
    /const edgeTolerance = Math\.max/,
  );

  assert.match(
    script,
    /previousButton\.disabled =\s*viewport\.scrollLeft <= edgeTolerance/,
  );

  assert.match(
    script,
    /nextButton\.disabled =\s*viewport\.scrollLeft >=\s*maximumScroll - edgeTolerance/,
  );
});
test('volledige build genereert vriendenpagina met CMS en gedeelde componenten', async () => {
  const {execFile} = await import(
    'node:child_process'
  );
  const {promisify} = await import('node:util');
  const exec = promisify(execFile);

  const environment = {
    ...process.env,
    ...TEST_BROWSER_SUPABASE_ENV,
  };

  await exec(
    process.execPath,
    ['scripts/build-site.mjs'],
    {
      env: {
        ...environment,
        MEDIA_BUILD_FIXTURE:
          'tests/fixtures/media-cms.json',
        REPERTOIRE_BUILD_FIXTURE:
          'tests/fixtures/repertoire-cms.json',
        FRIENDS_BUILD_FIXTURE:
          'tests/fixtures/friends-cms.json',
      },
    },
  );

  const html = await readFile(
    'dist/pages/vrienden.html',
    'utf8',
  );

  assert.match(
    html,
    /dataset\.friendsSource="cms"/,
  );
  assert.match(
    html,
    /\[TEST\] Vrienden van Spontaan/,
  );
  assert.match(
    html,
    /<div id="nav-placeholder">\s*<nav/,
  );
  assert.match(
    html,
    /<div id="footer-placeholder">\s*<footer/,
  );
  assert.doesNotMatch(
    html,
    /<div id="nav-placeholder"><\/div>/,
  );
  assert.doesNotMatch(
    html,
    /<div id="footer-placeholder"><\/div>/,
  );
  assert.doesNotMatch(html, /api\.sanity\.io/);
});
