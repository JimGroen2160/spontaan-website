import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)

const {
  buildSanityHeroImagePresentation,
} = require('../js/sanity-hero-image.js')

const base =
  'https://cdn.sanity.io/images/u66p1mxm/production/test-1920x1080.jpg'

const dimensions = {
  width: 1920,
  height: 1080,
}

const crop = {
  left: 0.1,
  right: 0.1,
  top: 0.05,
  bottom: 0.05,
}

test('zonder crop of hotspot blijft asset-URL intact en positie gecentreerd', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
    })

  assert.equal(
    result.url,
    base,
  )

  assert.deepEqual(
    result.position,
    {
      x: 0.5,
      y: 0.5,
    },
  )

  assert.equal(result.hasCrop, false)
  assert.equal(result.hasHotspot, false)
})

test('niet-Sanity URL wordt veilig geweigerd', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: 'https://example.com/test.jpg',
      dimensions,
    })

  assert.equal(result.url, '')

  assert.deepEqual(
    result.position,
    {
      x: 0.5,
      y: 0.5,
    },
  )

  assert.equal(result.hasCrop, false)
  assert.equal(result.hasHotspot, false)
})

test('Sanity crop wordt als volledige toegestane rect op CDN-URL gezet', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop,
    })

  const url = new URL(result.url)

  assert.equal(
    url.searchParams.get('rect'),
    '192,54,1536,972',
  )

  assert.equal(
    url.searchParams.get('auto'),
    'format',
  )

  assert.equal(
    url.searchParams.has('w'),
    false,
  )

  assert.equal(
    url.searchParams.has('h'),
    false,
  )

  assert.equal(
    url.searchParams.has('fit'),
    false,
  )

  assert.equal(result.hasCrop, true)
})

test('crop zonder hotspot gebruikt centrum van de gecropte bron', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop,
    })

  assert.deepEqual(
    result.position,
    {
      x: 0.5,
      y: 0.5,
    },
  )
})

test('hotspot zonder crop blijft relatieve positie in volledige bron', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      hotspot: {
        x: 0.25,
        y: 0.7,
        width: 0.2,
        height: 0.2,
      },
    })

  assert.equal(
    result.url,
    base,
  )

  assert.deepEqual(
    result.position,
    {
      x: 0.25,
      y: 0.7,
    },
  )

  assert.equal(result.hasCrop, false)
  assert.equal(result.hasHotspot, true)
})

test('crop en hotspot rekenen hotspot om naar positie binnen crop', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop,
      hotspot: {
        x: 0.7,
        y: 0.5,
        width: 0.2,
        height: 0.2,
      },
    })

  assert.ok(
    Math.abs(
      result.position.x - 0.75,
    ) < 1e-12,
  )

  assert.ok(
    Math.abs(
      result.position.y - 0.5,
    ) < 1e-12,
  )

  assert.equal(result.hasCrop, true)
  assert.equal(result.hasHotspot, true)
})

test('hotspot links buiten crop wordt tot linkergrens begrensd', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop: {
        left: 0.25,
        right: 0.25,
        top: 0,
        bottom: 0,
      },
      hotspot: {
        x: 0.05,
        y: 0.5,
        width: 0.1,
        height: 0.1,
      },
    })

  assert.deepEqual(
    result.position,
    {
      x: 0,
      y: 0.5,
    },
  )
})

test('hotspot rechts buiten crop wordt tot rechtergrens begrensd', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop: {
        left: 0.25,
        right: 0.25,
        top: 0,
        bottom: 0,
      },
      hotspot: {
        x: 0.95,
        y: 0.5,
        width: 0.1,
        height: 0.1,
      },
    })

  assert.deepEqual(
    result.position,
    {
      x: 1,
      y: 0.5,
    },
  )
})

test('ongeldige crop wordt genegeerd terwijl geldige hotspot behouden blijft', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop: {
        left: 0.8,
        right: 0.8,
        top: 0,
        bottom: 0,
      },
      hotspot: {
        x: 0.3,
        y: 0.6,
        width: 0.2,
        height: 0.2,
      },
    })

  const url = new URL(result.url)

  assert.equal(
    url.searchParams.has('rect'),
    false,
  )

  assert.deepEqual(
    result.position,
    {
      x: 0.3,
      y: 0.6,
    },
  )

  assert.equal(result.hasCrop, false)
  assert.equal(result.hasHotspot, true)
})

test('ongeldige hotspot gebruikt centrum terwijl geldige crop behouden blijft', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop,
      hotspot: {
        x: 'fout',
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

  assert.deepEqual(
    result.position,
    {
      x: 0.5,
      y: 0.5,
    },
  )

  assert.equal(result.hasCrop, true)
  assert.equal(result.hasHotspot, false)
})

test('crop zonder brondimensies wordt niet half toegepast', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      crop,
      hotspot: {
        x: 0.7,
        y: 0.6,
        width: 0.2,
        height: 0.2,
      },
    })

  const url = new URL(result.url)

  assert.equal(
    url.searchParams.has('rect'),
    false,
  )

  /*
   * Omdat de crop zonder bronafmetingen niet
   * veilig kan worden toegepast, blijft ook
   * de hotspotpositie relatief aan de volledige bron.
   */
  assert.deepEqual(
    result.position,
    {
      x: 0.7,
      y: 0.6,
    },
  )

  assert.equal(result.hasCrop, false)
  assert.equal(result.hasHotspot, true)
})

test('bestaande veilige queryparameters blijven behouden wanneer crop wordt toegevoegd', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base + '?dl=test.jpg',
      dimensions,
      crop,
    })

  const url = new URL(result.url)

  assert.equal(
    url.searchParams.get('dl'),
    'test.jpg',
  )

  assert.equal(
    url.searchParams.get('rect'),
    '192,54,1536,972',
  )
})

test('helper zet geen vaste viewport-crop of focalpoint-queryparameters', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop,
      hotspot: {
        x: 0.7,
        y: 0.6,
        width: 0.2,
        height: 0.2,
      },
    })

  const url = new URL(result.url)

  for (
    const forbidden of [
      'w',
      'h',
      'fit',
      'crop',
      'fp-x',
      'fp-y',
    ]
  ) {
    assert.equal(
      url.searchParams.has(forbidden),
      false,
      `onverwachte queryparameter: ${forbidden}`,
    )
  }
})

test('responsive positie blijft altijd binnen 0 en 1', () => {
  const result =
    buildSanityHeroImagePresentation({
      url: base,
      dimensions,
      crop: {
        left: 0.4,
        right: 0.4,
        top: 0.4,
        bottom: 0.4,
      },
      hotspot: {
        x: 1,
        y: 0,
        width: 0.1,
        height: 0.1,
      },
    })

  assert.ok(result.position.x >= 0)
  assert.ok(result.position.x <= 1)
  assert.ok(result.position.y >= 0)
  assert.ok(result.position.y <= 1)
})