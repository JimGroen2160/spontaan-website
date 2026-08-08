import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

import {
  normalizeHomeContent,
} from '../scripts/build-site.mjs'

const validNewsItem = (overrides = {}) => ({
  _id: 'news-geldig',
  title: 'Geldig nieuwsbericht',
  slug: 'geldig-nieuwsbericht',
  publishedAt: '2026-08-06T10:00:00.000Z',
  isVisible: true,
  summary: 'Een geldig nieuwsbericht.',
  mainImageAlt: 'Zanggroep Spontaan tijdens een optreden',
  imageUrl: 'images/news/nieuws-terugblik-optreden.webp',
  ...overrides,
})

test('newsItem-schema bevat verborgen alleen-lezen isTestData-markering', async () => {
  const source = await readFile(
    'studio/schemaTypes/newsItem.ts',
    'utf8',
  )

  assert.match(source, /name:\s*'isTestData'/)
  assert.match(source, /initialValue:\s*false/)
  assert.match(source, /hidden:\s*true/)
  assert.match(source, /readOnly:\s*true/)
})

test('publieke runtimequeries sluiten technisch gemarkeerde testdata uit', async () => {
  for (const file of [
    'js/nieuws.js',
    'js/nieuwsbericht.js',
    'js/agenda.js',
  ]) {
    const source = await readFile(file, 'utf8')

    assert.match(
      source,
      /isTestData\s*!=\s*true/,
      `${file} moet isTestData == true uitsluiten`,
    )
  }
})

test('Homepage-query sluit automatische testdata uit en haalt handmatige markering op', async () => {
  const source = await readFile(
    'scripts/build-site.mjs',
    'utf8',
  )

  assert.match(
    source,
    /"manualFeaturedNewsItems":[\s\S]*?isTestData,/,
  )

  assert.match(
    source,
    /"automaticFeaturedNewsItems":[\s\S]*?isTestData\s*!=\s*true/,
  )
})

test('Homepage weigert handmatig geselecteerde testdata', () => {
  const content = normalizeHomeContent({
    manualFeaturedNewsItems: [
      validNewsItem({
        _id: 'news-test-handmatig',
        slug: 'test-handmatig',
        isTestData: true,
      }),
    ],
    automaticFeaturedNewsItems: [
      validNewsItem({
        _id: 'news-geldig-automatisch',
        slug: 'geldig-automatisch',
      }),
    ],
  })

  assert.equal(content.featuredNews.selectionMode, 'featured')
  assert.equal(content.featuredNews.items.length, 1)
  assert.equal(
    content.featuredNews.items[0].slug,
    'geldig-automatisch',
  )
})

test('Homepage weigert automatische testdata', () => {
  const content = normalizeHomeContent({
    manualFeaturedNewsItems: [],
    automaticFeaturedNewsItems: [
      validNewsItem({
        _id: 'news-test-automatisch',
        slug: 'test-automatisch',
        isTestData: true,
      }),
    ],
  })

  assert.equal(content.featuredNews.selectionMode, 'empty')
  assert.deepEqual(content.featuredNews.items, [])
})

test('bestaand nieuws zonder isTestData-veld blijft backward compatible', () => {
  const content = normalizeHomeContent({
    manualFeaturedNewsItems: [
      validNewsItem({
        _id: 'news-bestaand',
        slug: 'bestaand-nieuwsbericht',
      }),
    ],
    automaticFeaturedNewsItems: [],
  })

  assert.equal(content.featuredNews.selectionMode, 'manual')
  assert.equal(content.featuredNews.items.length, 1)
  assert.equal(
    content.featuredNews.items[0].slug,
    'bestaand-nieuwsbericht',
  )
})