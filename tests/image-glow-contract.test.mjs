import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) =>
  fs.readFileSync(path, 'utf8')

test('gedeelde afbeelding-gloed ondersteunt vier niveaus', () => {
  const source = read(
    'studio/schemaTypes/imageGlow.ts',
  )

  for (const value of [
    'none',
    'light',
    'normal',
    'strong',
  ]) {
    assert.match(
      source,
      new RegExp(`value: '${value}'`),
    )
  }

  assert.doesNotMatch(
    source,
    /validation:\s*\(rule\).*required/,
    'Nieuwe velden mogen bestaande documenten niet ongeldig maken',
  )
})

test('ieder niet-hero CMS-afbeeldingstype heeft een gloedveld', () => {
  const checks = [
    [
      'studio/schemaTypes/homePage.ts',
      "imageGlowField({",
    ],
    [
      'studio/schemaTypes/aboutPage.ts',
      "name: 'introImageGlow'",
    ],
    [
      'studio/schemaTypes/aboutPage.ts',
      "name: 'atmosphereImageGlow'",
    ],
    [
      'studio/schemaTypes/contactPage.ts',
      "name: 'welcomeImageGlow'",
    ],
    [
      'studio/schemaTypes/friendsPage.ts',
      "name: 'ctaImageGlow'",
    ],
    [
      'studio/schemaTypes/newsItem.ts',
      "name: 'mainImageGlow'",
    ],
    [
      'studio/schemaTypes/eventItem.ts',
      "name: 'mainImageGlow'",
    ],
    [
      'studio/schemaTypes/photoAlbum.ts',
      "name: 'coverImageGlow'",
    ],
    [
      'studio/schemaTypes/photoAlbum.ts',
      'imageGlowField()',
    ],
    [
      'studio/schemaTypes/videoItem.ts',
      "name: 'thumbnailGlow'",
    ],
    [
      'studio/schemaTypes/friendItem.ts',
      'imageGlowField()',
    ],
    [
      'studio/schemaTypes/repertoirePage.ts',
      "name: 'featuredImageGlow'",
    ],
    [
      'studio/schemaTypes/repertoirePage.ts',
      'imageGlowField()',
    ],
    [
      'studio/schemaTypes/repertoirePage.ts',
      "name: 'quoteImageGlow'",
    ],
  ]

  for (const [path, marker] of checks) {
    assert.ok(
      read(path).includes(marker),
      `${path} mist ${marker}`,
    )
  }
})

test('build-dataflow transporteert alle niet-hero gloedwaarden', () => {
  const source = read('scripts/build-site.mjs')

  for (const field of [
    'imageGlow',
    'mainImageGlow',
    'coverImageGlow',
    'thumbnailGlow',
    'introImageGlow',
    'atmosphereImageGlow',
    'welcomeImageGlow',
    'ctaImageGlow',
    'featuredImageGlow',
    'quoteImageGlow',
  ]) {
    assert.ok(
      source.includes(field),
      `build-site mist ${field}`,
    )
  }

  assert.match(
    source,
    /function normalizeImageGlow\(/,
  )

  assert.match(
    source,
    /preferredImageGlow\(\s*item\?\.imageGlowManaged,\s*item\?\.imageGlow,\s*'normal',\s*\)/,
    'Homepage quickLinks moeten managed glow eerst gebruiken, legacy imageGlow als fallback behouden en normal als standaard gebruiken',
  )
})

test('Nieuws en Agenda gebruiken managed-first alt en glow tijdens runtime', () => {
  for (const path of [
    'js/nieuws.js',
    'js/nieuwsbericht.js',
    'js/agenda.js',
  ]) {
    const source = read(path)

    for (const marker of [
      '"mainImageAltManaged": mainImage.alt',
      '"mainImageGlowManaged": mainImage.glow',
      'mainImageAlt',
      'mainImageGlow',
      'preferredImageAlt',
      'preferredImageGlow',
      'normalizeImageGlow',
      'media.dataset.imageGlow = item.imageGlow',
      'image.alt = item.imageAlt',
    ]) {
      assert.ok(
        source.includes(marker),
        `${path} mist runtime-contractmarker ${marker}`,
      )
    }

    assert.match(
      source,
      /preferredImageAlt\(\s*item\.mainImageAltManaged,\s*item\.mainImageAlt,\s*\)/,
      `${path} gebruikt niet managed alt met legacy fallback`,
    )

    assert.match(
      source,
      /preferredImageGlow\(\s*item\.mainImageGlowManaged,\s*item\.mainImageGlow,\s*\)/,
      `${path} gebruikt niet managed glow met legacy fallback`,
    )
  }
})

test('Nieuws en Agenda gebruiken managed-first hero-gloed tijdens runtime', () => {
  for (const path of [
    'js/nieuws.js',
    'js/agenda.js',
  ]) {
    const source = read(path)

    assert.ok(
      source.includes('"heroGlowManaged": heroImage.glow'),
      `${path} vraagt managed hero-gloed niet op`,
    )

    assert.ok(
      source.includes('heroGlow'),
      `${path} behoudt legacy heroGlow niet als fallback`,
    )

    assert.match(
      source,
      /preferredImageGlow\(\s*value\.heroGlowManaged,\s*value\.heroGlow,\s*\)/,
      `${path} gebruikt niet managed-first hero-gloed met legacy fallback`,
    )
  }
})

test('bestaande hero-gloed blijft beschikbaar', () => {
  const build = read('scripts/build-site.mjs')

  assert.match(
    build,
    /function normalizeHeroGlow\(/,
  )

  assert.match(
    build,
    /normalizeImageGlow\(value, 'normal'\)/,
  )
})
