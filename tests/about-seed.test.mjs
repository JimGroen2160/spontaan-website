import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const require = createRequire(import.meta.url)
const seed = require('../studio/scripts/seedAboutDevelopment.js')

function mockClient({dataset = 'development', documents = [], assets = new Map()} = {}) {
  const calls = {fetch: [], uploads: [], creates: []}
  const client = {
    config: () => ({dataset}),
    fetch: async (query, parameters) => {
      calls.fetch.push({query, parameters})
      if (query.includes('sanity.imageAsset')) return assets.get(parameters.sha1hash) || null
      return documents
    },
    assets: {upload: async (type, stream, options) => {
      calls.uploads.push({type, stream, options})
      return {_id: `image-uploaded-${calls.uploads.length}`}
    }},
    createIfNotExists: async (document) => calls.creates.push(document),
  }
  return {client, calls}
}

const minimalPlan = () => ({
  content: {
    timelineItems: Array.from({length: 4}, (_, index) => ({title: `T${index}`, text: `X${index}`})),
    valuesItems: Array.from({length: 4}, (_, index) => ({title: `V${index}`, text: `Y${index}`})),
  },
  imageSources: [
    {key: 'hero', filename: 'hero.jpg', filePath: 'hero.jpg', mimeType: 'image/jpeg', sha1hash: 'a'},
    {key: 'intro', filename: 'intro.jpg', filePath: 'intro.jpg', mimeType: 'image/jpeg', sha1hash: 'b'},
    {key: 'atmosphere', filename: 'atmosphere.jpg', filePath: 'atmosphere.jpg', mimeType: 'image/jpeg', sha1hash: 'c'},
  ],
})

test('seed weigert iedere dataset behalve development', () => {
  assert.throws(() => seed.assertDevelopmentDataset(mockClient({dataset: 'production'}).client), /alleen dataset "development"/)
})

test('seedplan gebruikt fallback en de drie bestaande afbeeldingen', () => {
  const plan = seed.buildSeedPlan()
  assert.equal(plan.imageSources.length, 3)
  assert.deepEqual(plan.imageSources.map(({filename}) => filename), [
    'over-hero-mannenkoor.jpg',
    'over-intro-mannenkoor.jpg',
    'over-sfeer-mannenkoor.jpg',
  ])
})

test('bestaand gepubliceerd document maakt seed idempotent zonder mutaties', async () => {
  const {client, calls} = mockClient({documents: [{_id: 'aboutPage-main', _type: 'aboutPage'}]})
  const result = await seed.runSeed(client, {buildPlan: minimalPlan})
  assert.equal(result.status, 'existing')
  assert.equal(calls.uploads.length, 0)
  assert.equal(calls.creates.length, 0)
})

test('bestaande draft of verkeerd type stopt vóór mutaties', async () => {
  for (const document of [
    {_id: 'drafts.aboutPage-main', _type: 'aboutPage'},
    {_id: 'aboutPage-main', _type: 'newsItem'},
  ]) {
    const {client, calls} = mockClient({documents: [document]})
    await assert.rejects(seed.runSeed(client, {buildPlan: minimalPlan}), /afgebroken/)
    assert.equal(calls.uploads.length, 0)
    assert.equal(calls.creates.length, 0)
  }
})

test('assets worden op bestandsnaam en hash hergebruikt en eenmaal geüpload', async () => {
  const plan = minimalPlan()
  const assets = new Map([['a', {_id: 'image-existing', mimeType: 'image/jpeg'}]])
  const {client, calls} = mockClient({assets})
  const result = await seed.resolveImageAssets(client, plan.imageSources, {openReadStream: (path) => ({path})})
  assert.equal(result.reused, 1)
  assert.equal(result.uploaded, 2)
  assert.equal(calls.uploads.length, 2)
  assert.match(calls.fetch[0].query, /originalFilename/)
})

test('document gebruikt vaste ID, vier arrays en afbeeldingsreferenties', () => {
  const plan = minimalPlan()
  const assets = new Map([['hero', 'image-a'], ['intro', 'image-b'], ['atmosphere', 'image-c']])
  const document = seed.createDocument(plan.content, assets)
  assert.equal(document._id, 'aboutPage-main')
  assert.equal(document._type, 'aboutPage')
  assert.equal(document.isTestData, true)
  assert.equal(document.timelineItems.length, 4)
  assert.equal(document.valuesItems.length, 4)
  assert.equal(document.heroImage.asset._ref, 'image-a')
})

test('nieuwe seed gebruikt uitsluitend createIfNotExists', async () => {
  const plan = minimalPlan()
  const {client, calls} = mockClient()
  await seed.runSeed(client, {
    buildPlan: () => plan,
    resolveAssets: async () => ({
      assetIdsByKey: new Map([['hero', 'image-a'], ['intro', 'image-b'], ['atmosphere', 'image-c']]),
      reused: 3,
      uploaded: 0,
    }),
  })
  assert.equal(calls.creates.length, 1)
  assert.equal(calls.creates[0]._id, 'aboutPage-main')
})

test('bron ondersteunt geen production of overschrijvende documentmutaties', async () => {
  const source = await readFile('studio/scripts/seedAboutDevelopment.js', 'utf8')
  assert.match(source, /createIfNotExists/)
  assert.doesNotMatch(source, /createOrReplace/)
  assert.doesNotMatch(source, /\.patch\s*\(/)
  assert.doesNotMatch(source, /\.delete\s*\(/)
  assert.doesNotMatch(source, /EXPECTED_DATASET\s*=\s*['"]production['"]/)
})
