import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  resolveStudioDataset,
} from '../studio/environment.ts'

test('Studio gebruikt expliciete development-dataset', () => {
  assert.equal(
    resolveStudioDataset({
      SANITY_STUDIO_DATASET: 'development',
      NODE_ENV: 'development',
    }),
    'development',
  )
})

test('Studio gebruikt expliciete production-dataset', () => {
  assert.equal(
    resolveStudioDataset({
      SANITY_STUDIO_DATASET: 'production',
      NODE_ENV: 'production',
    }),
    'production',
  )
})

test('Studio weigert onbekende dataset', () => {
  assert.throws(
    () =>
      resolveStudioDataset({
        SANITY_STUDIO_DATASET: 'acceptance',
        NODE_ENV: 'production',
      }),
    /Ongeldige Sanity Studio-dataset: acceptance/,
  )
})

test('lokale Studio mag zonder configuratie development gebruiken', () => {
  assert.equal(
    resolveStudioDataset({
      NODE_ENV: 'development',
    }),
    'development',
  )
})

test('Production Studio weigert ontbrekende datasetconfiguratie', () => {
  assert.throws(
    () =>
      resolveStudioDataset({
        NODE_ENV: 'production',
      }),
    /SANITY_STUDIO_DATASET ontbreekt voor Production Studio/,
  )
})

test('.env.production legt production-dataset expliciet vast', () => {
  const productionEnvironment = fs.readFileSync(
    'studio/.env.production',
    'utf8',
  )

  assert.equal(
    productionEnvironment.trim(),
    'SANITY_STUDIO_DATASET=production',
  )
})

test('Studio-configuratie gebruikt centraal resolveStudioDataset', () => {
  const config = fs.readFileSync(
    'studio/sanity.config.ts',
    'utf8',
  )

  const cli = fs.readFileSync(
    'studio/sanity.cli.ts',
    'utf8',
  )

  assert.match(
    config,
    /dataset:\s*resolveStudioDataset\(\)/,
  )

  assert.match(
    cli,
    /dataset:\s*resolveStudioDataset\(\)/,
  )
})