import assert from 'node:assert/strict'
import test from 'node:test'
import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'

const require = createRequire(import.meta.url)
const seed = require('../studio/scripts/seedAgendaDevelopment.js')

function mockClient({
  dataset = 'development',
  documents = [],
} = {}) {
  const created = []

  return {
    created,
    client: {
      config() {
        return {dataset}
      },

      async fetch() {
        return documents
      },

      async createIfNotExists(document) {
        created.push(document)
        return document
      },
    },
  }
}

test('Agenda-seed weigert iedere dataset behalve development', () => {
  const {client} = mockClient({dataset: 'production'})

  assert.throws(
    () => seed.assertDevelopmentDataset(client),
    /alleen dataset "development"/,
  )
})

test('Agenda-seed bevat exact vijf geldige en herkenbare demo-items', () => {
  const documents = seed.validateDemoDocuments()

  assert.equal(documents.length, 5)
  assert.equal(new Set(documents.map(({_id}) => _id)).size, 5)

  for (const document of documents) {
    assert.equal(document._type, 'eventItem')
    assert.match(document._id, /^eventItem-demo-/)
    assert.match(document.title, /^\[DEMO\] /)
    assert.equal(document.isTestData, true)
    assert.equal(document.isPublic, true)
    assert.equal(document.isVisible, true)
    assert.notEqual(document.eventType, 'besloten')
    assert.ok(new Date(document.endAt) > new Date(document.startAt))
  }
})

test('Agenda-seed maakt ontbrekende documenten met createIfNotExists', async () => {
  const {client, created} = mockClient()

  const result = await seed.runSeed(client)

  assert.deepEqual(result, {
    status: 'created',
    created: 5,
    skipped: 0,
    total: 5,
  })

  assert.equal(created.length, 5)
})

test('Agenda-seed is idempotent wanneer alle documenten al bestaan', async () => {
  const existing = seed.DEMO_DOCUMENTS.map(({_id, _type}) => ({
    _id,
    _type,
  }))

  const {client, created} = mockClient({documents: existing})
  const result = await seed.runSeed(client)

  assert.deepEqual(result, {
    status: 'existing',
    created: 0,
    skipped: 5,
    total: 5,
  })

  assert.equal(created.length, 0)
})

test('Agenda-seed maakt alleen ontbrekende documenten aan', async () => {
  const existing = seed.DEMO_DOCUMENTS.slice(0, 2).map(
    ({_id, _type}) => ({_id, _type}),
  )

  const {client, created} = mockClient({documents: existing})
  const result = await seed.runSeed(client)

  assert.equal(result.created, 3)
  assert.equal(result.skipped, 2)
  assert.equal(created.length, 3)
})

test('Agenda-seed weigert een bestaand document met verkeerd type', async () => {
  const {client} = mockClient({
    documents: [
      {
        _id: seed.DEMO_DOCUMENTS[0]._id,
        _type: 'newsItem',
      },
    ],
  })

  await assert.rejects(
    () => seed.runSeed(client),
    /heeft type newsItem/,
  )
})

test('Agenda-seed weigert drafts voor vaste demo-ID’s', async () => {
  const document = seed.DEMO_DOCUMENTS[0]
  const {client} = mockClient({
    documents: [
      {
        _id: `drafts.${document._id}`,
        _type: 'eventItem',
      },
    ],
  })

  await assert.rejects(
    () => seed.runSeed(client),
    /draft bestaat/,
  )
})

test('Agenda-seed gebruikt geen overschrijvende documentmutaties', async () => {
  const source = await readFile(
    'studio/scripts/seedAgendaDevelopment.js',
    'utf8',
  )

  assert.match(source, /createIfNotExists/)
  assert.doesNotMatch(source, /createOrReplace/)
  assert.doesNotMatch(source, /\.patch\s*\(/)
  assert.doesNotMatch(
    source,
    /EXPECTED_DATASET\s*=\s*['"]production['"]/,
  )
})

test('eventItem-schema bevat verborgen alleen-lezen isTestData-markering', async () => {
  const source = await readFile(
    'studio/schemaTypes/eventItem.ts',
    'utf8',
  )

  assert.match(source, /name:\s*'isTestData'/)
  assert.match(source, /hidden:\s*true/)
  assert.match(source, /readOnly:\s*true/)
})
