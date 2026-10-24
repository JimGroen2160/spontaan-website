import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeAboutContent,
  normalizeHomeContent,
} from '../scripts/build-site.mjs'

function normalizeAbout(overrides = {}) {
  return normalizeAboutContent({
    heroImageAltManaged: 'Managed hero alt',
    heroImageAlt: 'Legacy hero alt',
    heroGlowManaged: 'strong',
    heroGlow: 'light',

    introImageAltManaged: 'Managed intro alt',
    introImageAlt: 'Legacy intro alt',
    introImageGlowManaged: 'strong',
    introImageGlow: 'light',

    ...overrides,
  })
}

test('managed alt wint van legacy alt', () => {
  const content = normalizeAbout()

  assert.equal(
    content.introImageAlt,
    'Managed intro alt',
  )
})

test('lege managed alt valt terug op legacy alt', () => {
  const content = normalizeAbout({
    introImageAltManaged: '   ',
    introImageAlt: 'Legacy intro alt',
  })

  assert.equal(
    content.introImageAlt,
    'Legacy intro alt',
  )
})

test('geldige managed glow wint van legacy glow', () => {
  const content = normalizeAbout({
    introImageGlowManaged: 'strong',
    introImageGlow: 'light',
  })

  assert.equal(
    content.introImageGlow,
    'strong',
  )
})

test('ontbrekende managed glow valt terug op geldige legacy glow', () => {
  const content = normalizeAbout({
    introImageGlowManaged: undefined,
    introImageGlow: 'light',
  })

  assert.equal(
    content.introImageGlow,
    'light',
  )
})

test('ongeldige managed glow valt terug op geldige legacy glow', () => {
  const content = normalizeAbout({
    introImageGlowManaged: 'ongeldig',
    introImageGlow: 'light',
  })

  assert.equal(
    content.introImageGlow,
    'light',
  )
})

test('gewone afbeelding zonder managed of legacy glow valt terug op none', () => {
  const content = normalizeAbout({
    introImageGlowManaged: undefined,
    introImageGlow: undefined,
  })

  assert.equal(
    content.introImageGlow,
    'none',
  )
})

test('hero zonder managed of legacy glow behoudt default normal', () => {
  const content = normalizeAbout({
    heroGlowManaged: undefined,
    heroGlow: undefined,
  })

  assert.equal(
    content.heroGlow,
    'normal',
  )
})

test('homepage quickLink zonder managed of legacy glow behoudt default normal', () => {
  const content = normalizeHomeContent({
    quickLinks: [
      {
        title: 'Agenda',
        text: 'Bekijk onze agenda.',
        imageUrl: 'images/test.jpg',
        imageGlowManaged: undefined,
        imageGlow: undefined,
        mediaClass: 'agenda',
        buttonLabel: 'Bekijk agenda',
        buttonLink: 'pages/agenda.html',
      },
    ],
  })

  assert.equal(
    content.quickLinks.length,
    1,
  )

  assert.equal(
    content.quickLinks[0].imageGlow,
    'normal',
  )
})