import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)

const homeSeed = require('../studio/scripts/seedHomeDevelopment.js')
const contactSeed = require('../studio/scripts/seedContactDevelopment.js')

function clientFor(dataset, existing = []) {
  let createCalls = 0

  return {
    config() {
      return {dataset}
    },

    async fetch(query) {
      if (query.includes('_id in [$publishedId, $draftId]')) {
        return existing
      }

      return null
    },

    async createIfNotExists() {
      createCalls += 1
    },

    assets: {
      async upload() {
        throw new Error('Assetupload hoort niet in deze test te worden gebruikt.')
      },
    },

    get createCalls() {
      return createCalls
    },
  }
}

test('Home- en Contactseeds blokkeren production', () => {
  const productionClient = clientFor('production')

  assert.throws(
    () => homeSeed.assertDevelopmentDataset(productionClient),
    /alleen dataset "development"/,
  )

  assert.throws(
    () => contactSeed.assertDevelopmentDataset(productionClient),
    /alleen dataset "development"/,
  )
})

test('Home-seed is idempotent bij bestaand gepubliceerd document', async () => {
  const client = clientFor('development', [
    {_id: 'homePage-main', _type: 'homePage'},
  ])

  const result = await homeSeed.runSeed(client, {
    buildPlan() {
      throw new Error('Buildplan mag niet worden gemaakt.')
    },
    resolveAssets() {
      throw new Error('Assets mogen niet worden verwerkt.')
    },
  })

  assert.equal(result.status, 'existing')
  assert.equal(client.createCalls, 0)
})

test('Contact-seed is idempotent bij bestaand gepubliceerd document', async () => {
  const client = clientFor('development', [
    {_id: 'contactPage-main', _type: 'contactPage'},
  ])

  const result = await contactSeed.runSeed(client, {
    buildPlan() {
      throw new Error('Buildplan mag niet worden gemaakt.')
    },
    resolveAssets() {
      throw new Error('Assets mogen niet worden verwerkt.')
    },
  })

  assert.equal(result.status, 'existing')
  assert.equal(client.createCalls, 0)
})

test('Home- en Contactseeds weigeren bestaande drafts', async () => {
  await assert.rejects(
    homeSeed.runSeed(
      clientFor('development', [
        {_id: 'drafts.homePage-main', _type: 'homePage'},
      ]),
    ),
    /singletondraft bestaat al/,
  )

  await assert.rejects(
    contactSeed.runSeed(
      clientFor('development', [
        {_id: 'drafts.contactPage-main', _type: 'contactPage'},
      ]),
    ),
    /singletondraft bestaat al/,
  )
})

test('Home- en Contactseeds weigeren een verkeerd documenttype', async () => {
  await assert.rejects(
    homeSeed.runSeed(
      clientFor('development', [
        {_id: 'homePage-main', _type: 'contactPage'},
      ]),
    ),
    /heeft type contactPage/,
  )

  await assert.rejects(
    contactSeed.runSeed(
      clientFor('development', [
        {_id: 'contactPage-main', _type: 'homePage'},
      ]),
    ),
    /heeft type homePage/,
  )
})

test('Home-document bevat vaste ID, testmarkering en drie snelkoppelingen', () => {
  const content = {
    heroImageUrl: 'images/hero.jpg',
    heroTitle: 'Hero',
    quickLinks: [
      {title: 'A', imageUrl: 'images/a.jpg', mediaClass: 'a'},
      {title: 'B', imageUrl: 'images/b.jpg', mediaClass: 'b'},
      {title: 'C', imageUrl: 'images/c.jpg', mediaClass: 'c'},
    ],
  }

  const assets = new Map([
    ['hero', 'image-hero'],
    ['quick-1', 'image-a'],
    ['quick-2', 'image-b'],
    ['quick-3', 'image-c'],
  ])

  const document = homeSeed.createDocument(content, assets)

  assert.equal(document._id, 'homePage-main')
  assert.equal(document._type, 'homePage')
  assert.equal(document.isTestData, true)
  assert.equal(document.quickLinks.length, 3)
  assert.equal(document.quickLinks[0]._key, 'quick-link-1')
  assert.equal(document.quickLinks[0].mediaClass, undefined)
})

test('Contact-document bevat vaste ID en vier gekeyde onderwerpen', () => {
  const content = {
    heroImageUrl: '../images/hero.jpg',
    welcomeImageUrl: '../images/welcome.jpg',
    heroTitle: 'Contact',
    contactTopics: [
      {title: 'A'},
      {title: 'B'},
      {title: 'C'},
      {title: 'D'},
    ],
  }

  const assets = new Map([
    ['hero', 'image-hero'],
    ['welcome', 'image-welcome'],
  ])

  const document = contactSeed.createDocument(content, assets)

  assert.equal(document._id, 'contactPage-main')
  assert.equal(document._type, 'contactPage')
  assert.equal(document.isTestData, true)
  assert.equal(document.contactTopics.length, 4)
  assert.equal(document.contactTopics[0]._type, 'contactTopic')
  assert.equal(document.contactTopics[0]._key, 'contact-topic-1')
})

test('Home- en Contactseeds herkennen afbeeldingssignaturen correct', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00])
  const png = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ])
  const webp = Buffer.from('RIFF0000WEBP', 'ascii')
  const invalid = Buffer.from('geen-afbeelding', 'utf8')

  for (const seed of [homeSeed, contactSeed]) {
    assert.equal(
      seed.hasExpectedImageSignature(jpeg, 'image/jpeg'),
      true,
    )
    assert.equal(
      seed.hasExpectedImageSignature(png, 'image/png'),
      true,
    )
    assert.equal(
      seed.hasExpectedImageSignature(webp, 'image/webp'),
      true,
    )
    assert.equal(
      seed.hasExpectedImageSignature(invalid, 'image/jpeg'),
      false,
    )
    assert.equal(
      seed.hasExpectedImageSignature(invalid, 'image/png'),
      false,
    )
    assert.equal(
      seed.hasExpectedImageSignature(invalid, 'image/webp'),
      false,
    )
    assert.equal(
      seed.hasExpectedImageSignature(jpeg, 'image/gif'),
      false,
    )
  }
})
