import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'

const require =
  createRequire(import.meta.url)

const agendaFile =
  new URL('../js/agenda.js', import.meta.url)

const newsFile =
  new URL('../js/nieuws.js', import.meta.url)

const agendaPageFile =
  new URL('../pages/agenda.html', import.meta.url)

const newsPageFile =
  new URL('../pages/nieuws.html', import.meta.url)

test(
  'gedeelde helper behoudt bewezen CommonJS API',
  () => {
    const api =
      require('../js/sanity-hero-image.js')

    assert.equal(
      typeof api.buildSanityHeroImagePresentation,
      'function',
    )
  },
)

for (
  const [label, file] of [
    ['Agenda', agendaFile],
    ['Nieuws', newsFile],
  ]
) {
  test(
    `${label} queryt dimensions crop en hotspot exact één keer`,
    async () => {
      const source =
        await readFile(file, 'utf8')

      assert.equal(
        (
          source.match(
            /"heroImageDimensions": heroImage\.asset->metadata\.dimensions,/g,
          ) ?? []
        ).length,
        1,
      )

      assert.equal(
        (
          source.match(
            /"heroImageCrop": heroImage\.crop,/g,
          ) ?? []
        ).length,
        1,
      )

      assert.equal(
        (
          source.match(
            /"heroImageHotspot": heroImage\.hotspot,/g,
          ) ?? []
        ).length,
        1,
      )
    },
  )

  test(
    `${label} gebruikt gedeelde hero helper`,
    async () => {
      const source =
        await readFile(file, 'utf8')

      assert.match(
        source,
        /window\.SpontaanSanityHeroImage/,
      )

      assert.equal(
        (
          source.match(
            /getHeroImagePresentation\(\{/g,
          ) ?? []
        ).length,
        1,
      )
    },
  )

  test(
    `${label} past hotspot-position alleen conditioneel toe`,
    async () => {
      const source =
        await readFile(file, 'utf8')

      assert.match(
        source,
        /if \(content\.positionCss\)/,
      )

      assert.equal(
        (
          source.match(
            /hero\.style\.backgroundPosition =/g,
          ) ?? []
        ).length,
        1,
      )

      assert.match(
        source,
        /presentation\.hasHotspot/,
      )
    },
  )

  test(
    `${label} behoudt managed glow new-first legacy-fallback`,
    async () => {
      const source =
        await readFile(file, 'utf8')

      assert.match(
        source,
        /value\.heroGlowManaged/,
      )

      assert.match(
        source,
        /value\.heroGlow/,
      )

      assert.match(
        source,
        /preferredImageGlow/,
      )
    },
  )
}

for (
  const [label, file, app] of [
    [
      'Agenda',
      agendaPageFile,
      'agenda.js',
    ],
    [
      'Nieuws',
      newsPageFile,
      'nieuws.js',
    ],
  ]
) {
  test(
    `${label} laadt helper vóór runtime-app`,
    async () => {
      const source =
        await readFile(file, 'utf8')

      const helperIndex =
        source.indexOf(
          '../js/sanity-hero-image.js',
        )

      const appIndex =
        source.indexOf(
          `../js/${app}`,
        )

      assert.ok(helperIndex >= 0)
      assert.ok(appIndex >= 0)
      assert.ok(helperIndex < appIndex)
    },
  )
}