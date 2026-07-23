import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import test from 'node:test';
import {
  normalizeContent,
  normalizeRepertoireContent,
  renderMediaPage,
  renderRepertoirePage,
  resolveSanityDataset,
  validateRepertoireContent,
} from '../scripts/build-site.mjs';
import {assertNoMojibake} from '../scripts/check-encoding.mjs';

const exec = promisify(execFile);

test('datasetkeuze volgt OTAP en weigert onbekende datasets', () => {
  assert.equal(resolveSanityDataset({}), 'development');
  assert.equal(resolveSanityDataset({VERCEL_ENV: 'preview'}), 'development');
  assert.equal(resolveSanityDataset({VERCEL_ENV: 'production'}), 'production');
  assert.equal(resolveSanityDataset({SANITY_DATASET: 'production'}), 'production');
  assert.throws(
    () => resolveSanityDataset({SANITY_DATASET: 'acceptance'}),
    /Ongeldige Sanity-dataset: acceptance/,
  );
});

test('normalisatie verwijdert onveilige media en links', () => {
  const content = normalizeContent({
    page: {
      heroTitle: 'Veilige titel',
      heroImageUrl: 'javascript:alert(1)',
      primaryButtonLink: 'javascript:alert(2)',
    },
    photoAlbums: [{
      _id: 'test-onveilig-album',
      title: 'Onveilig album',
      coverImageUrl: 'javascript:alert(3)',
    }],
    audioItems: [{
      _id: 'test-onveilige-audio',
      title: 'Onveilige audio',
      audioUrl: 'javascript:alert(4)',
    }],
    videoItems: [{
      _id: 'test-onveilige-video',
      title: 'Onveilige video',
      youtubeUrl: 'https://example.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://cdn.sanity.io/images/u66p1mxm/development/test.jpg',
    }],
  });

  assert.equal(content.page.heroImageUrl, '');
  assert.equal(content.page.primaryButtonLink, '');
  assert.deepEqual(content.photoAlbums, []);
  assert.deepEqual(content.audioItems, []);
  assert.deepEqual(content.videoItems, []);
});

test('renderer escapt CMS-tekst en bevat geen runtime-query', async () => {
  const template = await readFile('build/media.template.html', 'utf8');
  const fallback = normalizeContent(
    JSON.parse(await readFile('data/media-fallback.json', 'utf8')),
  );

  fallback.page.heroTitle = '<script>alert("xss")</script>';
  const html = renderMediaPage(template, fallback, 'fallback');

  assert.match(html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\("xss"\)<\/script>/);
  assert.doesNotMatch(html, /api\.sanity\.io/);
  assert.match(html, /dataset\.mediaSource="fallback"/);
});

test('encodingpoort weigert mojibake uit gerenderde CMS-inhoud', async () => {
  const template = await readFile('build/media.template.html', 'utf8');
  const fallback = normalizeContent(
    JSON.parse(await readFile('data/media-fallback.json', 'utf8')),
  );
  fallback.videoItems = [{
    id: 'test-video-mojibake',
    type: 'video',
    title: `[TEST] Voorbeeldvideo ${String.fromCodePoint(0xc3, 0xa9, 0xc3, 0xa9)}n`,
    summary: 'Af te wijzen testrecord.',
    date: '2026-07-22',
    isFeatured: false,
    youtubeId: 'M7lc1UVf-VE',
    thumbnailUrl: '../images/media/demo-zomerconcert.jpg',
    thumbnailAlt: 'Testafbeelding',
  }];

  const html = renderMediaPage(template, fallback, 'cms');
  assert.match(html, /Voorbeeldvideo/);
  assert.throws(
    () => assertNoMojibake(html, 'gerenderde CMS-inhoud'),
    /Mojibake aangetroffen/,
  );
});

test('repertoire normaliseert URL’s en koppelt featured verhaal en audio aan één item', async () => {
  const template = await readFile('pages/repertoire.html', 'utf8');
  const fixture = JSON.parse(await readFile('tests/fixtures/repertoire-cms.json', 'utf8')).result;
  const content = normalizeRepertoireContent(fixture);
  const html = renderRepertoirePage(template, content, 'cms');

  assert.match(html, /dataset\.repertoireSource="cms"/);
  assert.match(html, /\[TEST\] The Rose/);
  assert.match(html, /\[TEST\] Het verhaal van The Rose/);
  assert.match(html, /data-audio-url="\.\.\/data\/test-repertoire-warm\.wav"/);
  assert.doesNotMatch(html, /test--repertoire/);
  assert.doesNotMatch(html, /api\.sanity\.io/);

  fixture.items[0].audioUrl = 'javascript:alert(1)';
  const unsafe = normalizeRepertoireContent(fixture);
  assert.equal(unsafe.items[0].audioUrl, '');
  assert.throws(
    () => validateRepertoireContent(unsafe),
    /gekoppeld verhaal en audiofragment/,
  );
});

test('repertoire weigert een ontbrekende featured-koppeling en escapt CMS-tekst', async () => {
  const template = await readFile('pages/repertoire.html', 'utf8');
  const fixture = JSON.parse(await readFile('tests/fixtures/repertoire-cms.json', 'utf8')).result;
  fixture.page.heroTitle = '<script>alert("xss")</script>';
  const content = normalizeRepertoireContent(fixture);
  const html = renderRepertoirePage(template, content, 'cms');
  assert.match(html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\("xss"\)<\/script>/);

  content.page.featuredItemId = 'test-repertoire-ontbreekt';
  assert.throws(
    () => validateRepertoireContent(content),
    /Uitgelicht repertoire-item ontbreekt/,
  );
});

test('mislukte CMS-build levert volledige fallback en herstelt CMS-testbuild', async () => {
  const environment = {...process.env};

  try {
    const fallbackRun = await exec(
      process.execPath,
      ['scripts/build-site.mjs'],
      {
        env: {
          ...environment,
          MEDIA_BUILD_FIXTURE: 'tests/fixtures/media-error.json',
          REPERTOIRE_BUILD_FIXTURE: 'tests/fixtures/media-error.json',
        },
      },
    );

    assert.match(fallbackRun.stderr, /MEDIA BUILD: fallback gebruikt/);
    const fallbackHtml = await readFile('dist/pages/media.html', 'utf8');
    assert.match(fallbackHtml, /dataset\.mediaSource="fallback"/);
    assert.match(fallbackHtml, /Beeld en Geluid/);
    assert.match(fallbackHtml, /fallback-zomerconcert/);
    assert.doesNotMatch(fallbackHtml, /api\.sanity\.io/);
    assert.match(fallbackHtml, /<div id="nav-placeholder">\s*<nav/);
    assert.match(fallbackHtml, /<div id="footer-placeholder">\s*<footer/);
    assert.doesNotMatch(fallbackHtml, /<div id="nav-placeholder"><\/div>/);
    assert.doesNotMatch(fallbackHtml, /<div id="footer-placeholder"><\/div>/);
  } finally {
    await exec(
      process.execPath,
      ['scripts/build-site.mjs'],
      {
        env: {
          ...environment,
          MEDIA_BUILD_FIXTURE: 'tests/fixtures/media-cms.json',
          REPERTOIRE_BUILD_FIXTURE: 'tests/fixtures/repertoire-cms.json',
        },
      },
    );
  }

  const cmsHtml = await readFile('dist/pages/media.html', 'utf8');
  assert.match(cmsHtml, /dataset\.mediaSource="cms"/);
  assert.match(cmsHtml, /CMS Beeld en Geluid/);
  const repertoireHtml = await readFile('dist/pages/repertoire.html', 'utf8');
  assert.match(repertoireHtml, /dataset\.repertoireSource="cms"/);
  assert.match(repertoireHtml, /\[TEST\] Het verhaal van The Rose/);
  assert.doesNotMatch(repertoireHtml, /test--repertoire/);
  assert.match(repertoireHtml, /<div id="nav-placeholder">\s*<nav/);
  assert.match(repertoireHtml, /<div id="footer-placeholder">\s*<footer/);
  assert.doesNotMatch(repertoireHtml, /<div id="nav-placeholder"><\/div>/);
});
