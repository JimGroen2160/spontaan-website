import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

import {
  resolveBuildHeroImagePresentation,
} from '../scripts/build-site.mjs'

const sanityUrl =
  'https://cdn.sanity.io/images/u66p1mxm/production/test-1920x1080.jpg'

test('crop plus hotspot levert cropped URL en responsive hotspotpositie', () => {
  const result =
    resolveBuildHeroImagePresentation({
      heroImageUrl: sanityUrl,
      heroImageDimensions: {
        width: 1920,
        height: 1080,
      },
      heroImageCrop: {
        left: 0.1,
        right: 0.1,
        top: 0.05,
        bottom: 0.05,
      },
      heroImageHotspot: {
        x: 0.7,
        y: 0.5,
        width: 0.2,
        height: 0.2,
      },
    })

  const url = new URL(result.url)

  assert.equal(
    url.searchParams.get('rect'),
    '192,54,1536,972',
  )

  assert.equal(result.positionCss, '75% 50%')
  assert.equal(result.hasCrop, true)
  assert.equal(result.hasHotspot, true)
})

test('crop zonder hotspot behoudt bestaande CSS-positionering', () => {
  const result =
    resolveBuildHeroImagePresentation({
      heroImageUrl: sanityUrl,
      heroImageDimensions: {
        width: 1920,
        height: 1080,
      },
      heroImageCrop: {
        left: 0.1,
        right: 0.1,
        top: 0.05,
        bottom: 0.05,
      },
    })

  assert.equal(
    new URL(result.url).searchParams.get('rect'),
    '192,54,1536,972',
  )

  assert.equal(result.positionCss, '')
  assert.equal(result.hasCrop, true)
  assert.equal(result.hasHotspot, false)
})

test('hotspot zonder crop levert responsive position zonder vaste viewport-crop', () => {
  const result =
    resolveBuildHeroImagePresentation({
      heroImageUrl: sanityUrl,
      heroImageDimensions: {
        width: 1920,
        height: 1080,
      },
      heroImageHotspot: {
        x: 0.3,
        y: 0.65,
        width: 0.2,
        height: 0.2,
      },
    })

  const url = new URL(result.url)

  assert.equal(result.positionCss, '30% 65%')
  assert.equal(url.searchParams.has('rect'), false)
  assert.equal(url.searchParams.has('w'), false)
  assert.equal(url.searchParams.has('h'), false)
  assert.equal(url.searchParams.has('fit'), false)
})

test('lokale fallback behoudt URL en bestaande CSS-positionering', () => {
  const local =
    '../images/about/over-hero-mannenkoor.jpg'

  const result =
    resolveBuildHeroImagePresentation({
      heroImageUrl: local,
    })

  assert.equal(result.url, local)
  assert.equal(result.positionCss, '')
  assert.equal(result.hasCrop, false)
  assert.equal(result.hasHotspot, false)
})

test('exact zes build-time queries transporteren dimensions crop en hotspot', async () => {
  const source = await readFile(
    new URL(
      '../scripts/build-site.mjs',
      import.meta.url,
    ),
    'utf8',
  )

  assert.equal(
    (
      source.match(
        /"heroImageDimensions": heroImage\.asset->metadata\.dimensions,/g,
      ) ?? []
    ).length,
    6,
  )

  assert.equal(
    (
      source.match(
        /"heroImageCrop": heroImage\.crop,/g,
      ) ?? []
    ).length,
    6,
  )

  assert.equal(
    (
      source.match(
        /"heroImageHotspot": heroImage\.hotspot,/g,
      ) ?? []
    ).length,
    6,
  )
})

test('exact zes normalizers transporteren managed presentationwaarden', async () => {
  const source = await readFile(
    new URL(
      '../scripts/build-site.mjs',
      import.meta.url,
    ),
    'utf8',
  )

  /*
   * Alleen de zes unquoted normalizer-properties.
   * Queryvelden worden in de vorige test afzonderlijk geteld.
   */
  assert.equal(
    (
      source.match(
        /heroImageDimensions:/g,
      ) ?? []
    ).length,
    6,
  )

  assert.equal(
    (
      source.match(
        /heroImageCrop:/g,
      ) ?? []
    ).length,
    6,
  )

  assert.equal(
    (
      source.match(
        /heroImageHotspot:/g,
      ) ?? []
    ).length,
    6,
  )
})

test('zes renderers gebruiken gedeelde presentation adapter', async () => {
  const source = await readFile(
    new URL(
      '../scripts/build-site.mjs',
      import.meta.url,
    ),
    'utf8',
  )

  assert.equal(
    (
      source.match(
        /resolveBuildHeroImagePresentation\(/g,
      ) ?? []
    ).length,
    7,
  )
})

test('positionering is uitsluitend actief bij geldige hotspot', async () => {
  const source = await readFile(
    new URL(
      '../scripts/build-site.mjs',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(
    source,
    /positionCss: managed\.hasHotspot/,
  )

  assert.ok(
    (
      source.match(
        /background-position: \$\{escapeHtml\(heroImage\.positionCss\)\}/g,
      ) ?? []
    ).length >= 2,
  )

  assert.ok(
    (
      source.match(
        /object-position: \$\{escapeHtml\(heroImage\.positionCss\)\}/g,
      ) ?? []
    ).length >= 4,
  )
})

test('P2 contract blijft beperkt tot exact zes build-time hero-contexten', async () => {
  const source =
    await readFile(
      new URL(
        '../scripts/build-site.mjs',
        import.meta.url,
      ),
      'utf8',
    )

  /*
   * P2 borgt uitsluitend de zes build-time hero's.
   * Agenda en Nieuws worden vanaf P3 afzonderlijk
   * als runtime-contexten getest.
   */
  assert.equal(
    (
      source.match(
        /"heroImageDimensions": heroImage\.asset->metadata\.dimensions,/g,
      ) ?? []
    ).length,
    6,
  )

  assert.equal(
    (
      source.match(
        /"heroImageCrop": heroImage\.crop,/g,
      ) ?? []
    ).length,
    6,
  )

  assert.equal(
    (
      source.match(
        /"heroImageHotspot": heroImage\.hotspot,/g,
      ) ?? []
    ).length,
    6,
  )

  assert.equal(
    (
      source.match(
        /resolveBuildHeroImagePresentation\(/g,
      ) ?? []
    ).length,
    7,
  )

  assert.equal(
    source.includes('agendaPage-main'),
    false,
  )

  assert.equal(
    source.includes('newsPage-main'),
    false,
  )
})