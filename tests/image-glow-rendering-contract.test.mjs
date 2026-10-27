import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) =>
  fs.readFileSync(path, 'utf8')

test('generieke niet-hero glow heeft vier visuele standen', () => {
  const css = read('css/style.css')

  for (const value of [
    'none',
    'light',
    'normal',
    'strong',
  ]) {
    assert.ok(
      css.includes(
        `[data-image-glow="${value}"]::after`,
      ),
      `CSS mist visuele stand ${value}`,
    )
  }

  assert.match(
    css,
    /rgba\(79, 23, 127, 0\.72\)/,
    'Normal moet bestaande homepagekleur behouden',
  )

  assert.match(
    css,
    /rgba\(217, 13, 135, 0\.50\)/,
    'Normal moet bestaande homepagekleur behouden',
  )
})

test('Homepage rendert quickLinks en nieuws met image glow', () => {
  const source = read('scripts/build-site.mjs')

  assert.match(
    source,
    /homepage-card__media[\s\S]*data-image-glow/,
  )

  assert.match(
    source,
    /homepage-news-card__media[^\n]*data-image-glow/,
  )

  assert.doesNotMatch(
    source,
    /background-image:[\s\S]{0,120}rgba\(79, 23, 127, 0\.72\)[\s\S]{0,120}url/,
    'QuickLink renderer mag de oude vaste gradient niet meer hardcoderen',
  )
})

test('Nieuws en Agenda zetten glow op hun afbeeldingscontainer', () => {
  const nieuws = read('js/nieuws.js')
  const detail = read('js/nieuwsbericht.js')
  const agenda = read('js/agenda.js')

  assert.match(
    nieuws,
    /media\.dataset\.imageGlow = item\.imageGlow/,
  )

  assert.match(
    detail,
    /media\.dataset\.imageGlow = item\.imageGlow/,
  )

  assert.match(
    agenda,
    /media\.dataset\.imageGlow = item\.imageGlow/,
  )
})

test('Media rendert album, video, featured en galerijfoto glow', () => {
  const build = read('scripts/build-site.mjs')
  const gallery = read('js/media-gallery.js')
  const template = read('build/media.template.html')
  const css = read('css/media.css')

  assert.match(
    build,
    /media-highlight-card__image[^\n]*glowAttribute/,
  )

  assert.match(
    build,
    /media-photo-tile[^\n]*data-image-glow/,
  )

  assert.match(
    build,
    /media-video-tile__preview[^\n]*data-image-glow/,
  )

  assert.match(
    gallery,
    /photo\.imageGlow \|\| 'none'/,
  )

  assert.match(
    template,
    /data-media-gallery-image-wrap/,
  )

  assert.match(
    css,
    /media-photo-tile__content[\s\S]*z-index:\s*2/,
  )

  assert.match(
    css,
    /media-photo-tile__button[\s\S]*z-index:\s*3/,
  )

  assert.match(
    css,
    /background: linear-gradient\(transparent, rgba\(27, 10, 51, 0\.94\)\);/,
    'Bestaande leesbaarheidsgradient moet behouden blijven',
  )
})

test('Over Contact en Vrienden renderen de beheerde glowwaarde', () => {
  const build = read('scripts/build-site.mjs')

  for (const field of [
    'introImageGlow',
    'atmosphereImageGlow',
    'welcomeImageGlow',
    'ctaImageGlow',
    'friend.imageGlow',
  ]) {
    assert.ok(
      build.includes(field),
      `Renderer mist ${field}`,
    )
  }

  assert.match(
    build,
    /about-media[^\n]*data-image-glow/,
  )

  assert.match(
    build,
    /contact-welcome__visual[^\n]*data-image-glow/,
  )

  assert.match(
    build,
    /friends-cta__visual[^\n]*data-image-glow/,
  )

  assert.match(
    build,
    /friends-partner-card__visual[\s\S]{0,120}data-image-glow/,
  )
})

test('Repertoire gebruikt afzonderlijke visual wrappers voor glow', () => {
  const build = read('scripts/build-site.mjs')
  const css = read('css/repertoire.css')

  assert.match(
    build,
    /repertoire-feature__visual[^\n]*data-image-glow/,
  )

  assert.match(
    build,
    /repertoire-world__visual[^\n]*data-image-glow/,
  )

  assert.match(
    build,
    /repertoire-quote__visual[^\n]*data-image-glow/,
  )

  assert.match(
    css,
    /repertoire-world__visual/,
  )

  assert.match(
    css,
    /repertoire-quote__visual/,
  )
})

test('Hero glow blijft een apart contract', () => {
  const css = read('css/style.css')

  assert.match(
    css,
    /\[data-public-hero\]\[data-hero-glow="normal"\]/,
  )

  assert.match(
    css,
    /\.public-hero-glow/,
  )

  assert.match(
    css,
    /\[data-image-glow="normal"\]::after/,
  )
})
test('Over hero gebruikt geen vaste gekleurde gradient buiten hero-glowcontract', () => {
  const css = read('css/style.css')

  const aboutHero = css.match(
    /\.about-hero\s*\{([\s\S]*?)\n\}/,
  )

  assert.ok(
    aboutHero,
    'CSS-blok .about-hero ontbreekt',
  )

  assert.doesNotMatch(
    aboutHero[1],
    /(?:linear|radial)-gradient\(/,
    'Over hero mag geen eigen vaste gradient naast de centrale CMS-gloed bevatten',
  )

  assert.match(
    aboutHero[1],
    /var\(--about-hero-image/,
    'Over hero moet de beheerde hero-afbeelding behouden',
  )
})
