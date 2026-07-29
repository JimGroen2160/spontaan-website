import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const require = createRequire(import.meta.url)
const seed = require('../studio/scripts/seedFriendsDevelopment.js')

function mockClient({
  dataset = 'development',
  conflicts = [],
  existingAssets = new Map(),
} = {}) {
  const calls = {
    fetch: [],
    uploads: [],
    created: [],
    commits: 0,
  }

  const client = {
    config: () => ({dataset}),
    fetch: async (query, parameters) => {
      calls.fetch.push({query, parameters})
      if (query.includes('_id in $idsToCheck')) return conflicts
      if (query.includes('sanity.imageAsset')) {
        const asset = existingAssets.get(parameters.sha1hash)
        return asset || null
      }
      throw new Error('Onverwachte mockquery')
    },
    assets: {
      upload: async (type, stream, options) => {
        calls.uploads.push({type, stream, options})
        return {_id: `image-uploaded-${calls.uploads.length}`}
      },
    },
    transaction: () => ({
      createIfNotExists: (document) => {
        calls.created.push(document)
      },
      commit: async () => {
        calls.commits += 1
      },
    }),
  }

  return {client, calls}
}

function minimalPlan() {
  return {
    page: {
      heroTitle: 'Vrienden van Spontaan',
      heroText: 'Intro',
      heroImageAlt: 'Hero',
      heroPrimaryButtonLabel: 'Primair',
      heroPrimaryButtonLink: './contact.html',
      heroSecondaryButtonLabel: 'Secundair',
      heroSecondaryButtonLink: '#vrienden',
      supportTitle: 'Steun',
      supportIntro: 'Steunintro',
      supportItems: Array.from({length: 4}, (_, index) => ({
        title: `Titel ${index + 1}`,
        text: `Tekst ${index + 1}`,
      })),
      friendsTitle: 'Vrienden',
      friendsIntro: '',
      ctaTitle: 'CTA',
      ctaText: 'CTA-tekst',
      ctaBenefits: ['Voordeel'],
      ctaImageAlt: 'CTA',
      ctaPrimaryButtonLabel: 'Primair',
      ctaPrimaryButtonLink: './contact.html',
      ctaSecondaryButtonLabel: 'Secundair',
      ctaSecondaryButtonLink: './contact.html',
    },
    sourceFriends: [
      {
        id: 'demo-een',
        publicName: '[TEST] Demo Een',
        friendType: 'bedrijf',
        imageDisplay: 'logo',
        imageAlt: 'Logo',
        description: 'Demo',
        website: '',
        isFeatured: false,
        sortOrder: 10,
      },
    ],
    imageSources: [
      {
        key: 'page-hero',
        filename: 'hero.webp',
        filePath: 'hero.webp',
        mimeType: 'image/webp',
        sha1hash: 'hero-hash',
      },
      {
        key: 'page-cta',
        filename: 'cta.webp',
        filePath: 'cta.webp',
        mimeType: 'image/webp',
        sha1hash: 'cta-hash',
      },
      {
        key: 'friend-demo-een',
        filename: 'demo-een.webp',
        filePath: 'demo-een.webp',
        mimeType: 'image/webp',
        sha1hash: 'friend-hash',
      },
    ],
    documentIds: ['friendsPage-main', 'friend-demo-een'],
  }
}

function assetMap(plan) {
  return new Map(plan.imageSources.map(({key}) => [key, `image-${key}`]))
}

test('weigert iedere dataset behalve development', () => {
  const {client} = mockClient({dataset: 'production'})
  assert.throws(
    () => seed.assertDevelopmentDataset(client),
    /alleen dataset "development"/
  )
})

for (const conflict of [
  {_id: 'friendsPage-main', _type: 'friendsPage'},
  {_id: 'drafts.friendsPage-main', _type: 'friendsPage'},
  {_id: 'friend-demo-een', _type: 'friendItem'},
  {_id: 'drafts.friend-demo-een', _type: 'friendItem'},
  {_id: 'friend-demo-een', _type: 'newsItem'},
]) {
  test(`stopt bij bestaand document ${conflict._id} (${conflict._type})`, async () => {
    const {client, calls} = mockClient({conflicts: [conflict]})
    await assert.rejects(
      seed.assertNoDocumentConflicts(
        client,
        ['friendsPage-main', 'friend-demo-een']
      ),
      /bestaande documenten/
    )
    assert.equal(calls.uploads.length, 0)
    assert.equal(calls.commits, 0)
  })
}

test('ontbrekend lokaal afbeeldingsbestand stopt vóór Sanity-acties', () => {
  const {client, calls} = mockClient()
  assert.throws(
    () =>
      seed.buildSeedPlan({
        readFile: (path) => {
          if (String(path).endsWith('friends-fallback.json')) {
            return JSON.stringify({
              page: {
                heroImageUrl: '../images/ontbreekt.webp',
                ctaImageUrl: '../images/ontbreekt-ook.webp',
              },
              friends: [{id: 'demo-een', imageUrl: '../images/logo.webp'}],
            })
          }
          throw new Error('ENOENT')
        },
      }),
    /afbeeldingsbestand ontbreekt/
  )
  assert.equal(calls.fetch.length, 0)
  assert.equal(calls.uploads.length, 0)
  assert.equal(calls.commits, 0)
  assert.equal(client.config().dataset, 'development')
})

test('hergebruikt bestaande assets en uploadt ontbrekende assets één keer', async () => {
  const plan = minimalPlan()
  const existingAssets = new Map([
    ['hero-hash', {_id: 'image-existing-hero', mimeType: 'image/webp'}],
  ])
  const {client, calls} = mockClient({existingAssets})
  const result = await seed.resolveImageAssets(client, plan.imageSources, {
    openReadStream: (filePath) => ({filePath}),
  })

  assert.equal(result.reused, 1)
  assert.equal(result.uploaded, 2)
  assert.equal(calls.uploads.length, 2)
  assert.deepEqual(
    calls.uploads.map(({options}) => options.filename),
    ['cta.webp', 'demo-een.webp']
  )
})

test('documenten gebruiken vaste unieke ID’s en geen zichtbare TEST-prefix', () => {
  const plan = minimalPlan()
  const documents = seed.createDocuments(plan, assetMap(plan))
  const ids = documents.map(({_id}) => _id)

  assert.deepEqual(ids, ['friendsPage-main', 'friend-demo-een'])
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(documents[0].isTestData, true)
  assert.equal(documents[1].title, '[TEST] Demo Een')
  assert.equal(documents[1].publicName, 'Demo Een')
})

test('fallback is de inhoudsbron en bevat alleen de zeven goedgekeurde sponsors', () => {
  const plan = seed.buildSeedPlan()
  const ids = plan.sourceFriends.map(({id}) => id)
  const expectedDocumentIds = [
    'friendsPage-main',
    'friend-demo-aurello',
    'friend-demo-korenveld',
    'friend-demo-lumora',
    'friend-demo-marevia',
    'friend-demo-novaro',
    'friend-demo-velinor',
    'friend-demo-solvane',
  ]

  assert.equal(plan.sourceFriends.length, 7)
  assert.equal(new Set(ids).size, 7)
  assert.equal(ids.filter((id) => id === 'demo-solvane').length, 1)
  assert.equal(ids.some((id) => id.includes('verlopen')), false)
  assert.equal(plan.page.heroTitle, 'Vrienden van Spontaan')
  assert.deepEqual(plan.documentIds, expectedDocumentIds)
  assert.equal(new Set(plan.documentIds).size, plan.documentIds.length)
})

test('documentmutatie gebruikt uitsluitend createIfNotExists in één transaction', async () => {
  const plan = minimalPlan()
  const documents = seed.createDocuments(plan, assetMap(plan))
  const {client, calls} = mockClient()

  await seed.createDocumentsAtomically(client, documents)

  assert.equal(calls.commits, 1)
  assert.deepEqual(
    calls.created.map(({_id}) => _id),
    ['friendsPage-main', 'friend-demo-een']
  )
})

test('bron bevat geen overschrijvende mutaties of production-doeldataset', async () => {
  const source = await readFile(
    'studio/scripts/seedFriendsDevelopment.js',
    'utf8'
  )

  assert.doesNotMatch(source, /createOrReplace/)
  assert.doesNotMatch(source, /\.patch\s*\(/)
  assert.doesNotMatch(source, /\.delete\s*\(/)
  assert.doesNotMatch(source, /\.mutate\s*\(/)
  assert.doesNotMatch(source, /EXPECTED_DATASET\s*=\s*['"]production['"]/)
  assert.match(source, /createIfNotExists/)
  assert.match(source, /data\/friends-fallback\.json/)
})

test('runSeed stopt bij conflict voordat assets of documenten muteren', async () => {
  const plan = minimalPlan()
  const {client, calls} = mockClient({
    conflicts: [{_id: 'friendsPage-main', _type: 'friendsPage'}],
  })
  let resolveAssetsCalled = false

  await assert.rejects(
    seed.runSeed(client, {
      buildPlan: () => plan,
      resolveAssets: async () => {
        resolveAssetsCalled = true
      },
    }),
    /bestaande documenten/
  )

  assert.equal(resolveAssetsCalled, false)
  assert.equal(calls.commits, 0)
})
