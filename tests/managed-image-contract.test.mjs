import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const managedImagePath =
  'studio/schemaTypes/managedImage.ts'

const imageGlowPath =
  'studio/schemaTypes/imageGlow.ts'

const managedImage = fs.readFileSync(
  managedImagePath,
  'utf8',
)

const imageGlow = fs.readFileSync(
  imageGlowPath,
  'utf8',
)

test('managed image blijft een native Sanity image field', () => {
  assert.match(
    managedImage,
    /type:\s*'image'/,
  )

  assert.match(
    managedImage,
    /hotspot:\s*true/,
  )

  assert.doesNotMatch(
    managedImage,
    /type:\s*'object'/,
    'Managed image mag geen extra wrapper-object introduceren',
  )
})

test('alt en glow staan binnen dezelfde afbeelding', () => {
  assert.match(
    managedImage,
    /fields:\s*\[/,
  )

  assert.match(
    managedImage,
    /name:\s*'alt'/,
  )

  assert.match(
    managedImage,
    /imageGlowField\(\{\s*name:\s*'glow'/s,
  )
})

test('alt-tekst heeft een maximale lengte van 160 tekens', () => {
  assert.match(
    managedImage,
    /rule\.required\(\)\.max\(160\)/,
  )

  assert.match(
    managedImage,
    /rule\.max\(160\)/,
  )
})

test('managed image gebruikt het bestaande glow-contract', () => {
  assert.match(
    managedImage,
    /type ImageGlowValue/,
  )

  assert.match(
    managedImage,
    /initialGlow\s*=\s*'none'/,
  )

  assert.match(
    managedImage,
    /initialValue:\s*initialGlow/,
  )

  assert.match(
    imageGlow,
    /\|\s*'none'/,
  )

  assert.match(
    imageGlow,
    /\|\s*'light'/,
  )

  assert.match(
    imageGlow,
    /\|\s*'normal'/,
  )

  assert.match(
    imageGlow,
    /\|\s*'strong'/,
  )
})

test('managed image maakt alt verplicht configureerbaar', () => {
  assert.match(
    managedImage,
    /altRequired\s*=\s*true/,
  )

  assert.match(
    managedImage,
    /altRequired\s*\?/,
  )
})

test('managed image maakt afbeelding verplicht configureerbaar', () => {
  assert.match(
    managedImage,
    /required\s*=\s*false/,
  )

  assert.match(
    managedImage,
    /validation:\s*\(rule\)\s*=>\s*rule\.required\(\)/,
  )
})