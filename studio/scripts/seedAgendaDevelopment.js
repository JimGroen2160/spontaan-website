const {getCliClient} = require('sanity/cli')

const API_VERSION = '2026-07-06'
const EXPECTED_DATASET = 'development'
const DOCUMENT_TYPE = 'eventItem'

const DEMO_DOCUMENTS = [
  {
    _id: 'eventItem-demo-open-repetitieavond',
    _type: DOCUMENT_TYPE,
    title: '[DEMO] Open repetitieavond',
    startAt: '2027-02-04T19:30:00.000+01:00',
    endAt: '2027-02-04T22:00:00.000+01:00',
    eventType: 'repetitie',
    locationName: 'Clubgebouw Zanggroep Spontaan',
    city: 'Angerlo',
    address: 'Dorpsstraat 1, 6986 AA Angerlo',
    summary:
      'Maak vrijblijvend kennis met Zanggroep Spontaan en zing een avond mee tijdens deze open repetitie.',
    buttonLabel: 'Meer informatie',
    buttonLink: './contact.html',
    isFree: true,
    isFeatured: false,
    isPublic: true,
    isVisible: true,
    isTestData: true,
  },
  {
    _id: 'eventItem-demo-zomerconcert-angerlo',
    _type: DOCUMENT_TYPE,
    title: '[DEMO] Zomerconcert in Angerlo',
    startAt: '2027-06-19T20:00:00.000+02:00',
    endAt: '2027-06-19T22:15:00.000+02:00',
    eventType: 'concert',
    locationName: 'Kerk Angerlo',
    city: 'Angerlo',
    address: 'Kerkstraat 1, 6986 CL Angerlo',
    summary:
      'Een sfeervol zomerconcert met een gevarieerd programma van bekende en verrassende liederen.',
    buttonLabel: 'Bekijk locatie',
    buttonLink: 'https://www.google.com/maps',
    isFree: false,
    isFeatured: true,
    isPublic: true,
    isVisible: true,
    isTestData: true,
  },
  {
    _id: 'eventItem-demo-dorpsfeest',
    _type: DOCUMENT_TYPE,
    title: '[DEMO] Optreden tijdens het dorpsfeest',
    startAt: '2027-08-28T15:00:00.000+02:00',
    endAt: '2027-08-28T16:00:00.000+02:00',
    eventType: 'optreden',
    locationName: 'Dorpsplein',
    city: 'Angerlo',
    summary:
      'Zanggroep Spontaan verzorgt een toegankelijk optreden tijdens het jaarlijkse dorpsfeest.',
    isFree: true,
    isFeatured: false,
    isPublic: true,
    isVisible: true,
    isTestData: true,
  },
  {
    _id: 'eventItem-demo-muzikale-middag',
    _type: DOCUMENT_TYPE,
    title: '[DEMO] Muzikale middag in Doetinchem',
    startAt: '2027-10-10T14:30:00.000+02:00',
    endAt: '2027-10-10T16:30:00.000+02:00',
    eventType: 'optreden',
    locationName: 'Amphion Cultuurbedrijf',
    city: 'Doetinchem',
    address: 'Hofstraat 159, 7001 JD Doetinchem',
    summary:
      'Een muzikale middag waarin Zanggroep Spontaan samen met andere regionale artiesten optreedt.',
    buttonLabel: 'Meer informatie',
    buttonLink: 'https://www.amphion.nl',
    isFree: false,
    isFeatured: false,
    isPublic: true,
    isVisible: true,
    isTestData: true,
  },
  {
    _id: 'eventItem-demo-kerstconcert',
    _type: DOCUMENT_TYPE,
    title: '[DEMO] Kerstconcert',
    startAt: '2027-12-18T20:00:00.000+01:00',
    endAt: '2027-12-18T22:00:00.000+01:00',
    eventType: 'concert',
    locationName: 'Martinuskerk',
    city: 'Doesburg',
    summary:
      'Een warm kerstconcert met vertrouwde kerstliederen en sfeervolle koormuziek.',
    buttonLabel: 'Meer informatie',
    buttonLink: './contact.html',
    isFree: false,
    isFeatured: true,
    isPublic: true,
    isVisible: true,
    isTestData: true,
  },
]

function assertDevelopmentDataset(client) {
  const dataset = client.config().dataset

  if (dataset !== EXPECTED_DATASET) {
    throw new Error(
      `Agenda-seed afgebroken: alleen dataset "${EXPECTED_DATASET}" is toegestaan.`,
    )
  }

  return dataset
}

function validateDemoDocuments(documents = DEMO_DOCUMENTS) {
  if (!Array.isArray(documents) || documents.length !== 5) {
    throw new Error('Agenda-seed vereist exact vijf demo-items.')
  }

  const ids = new Set()

  for (const document of documents) {
    if (
      typeof document._id !== 'string' ||
      !document._id.startsWith('eventItem-demo-')
    ) {
      throw new Error('Agenda-seed bevat een ongeldig document-ID.')
    }

    if (ids.has(document._id)) {
      throw new Error(`Dubbel Agenda-document-ID: ${document._id}`)
    }

    ids.add(document._id)

    if (document._type !== DOCUMENT_TYPE) {
      throw new Error(`Ongeldig documenttype voor ${document._id}.`)
    }

    if (
      typeof document.title !== 'string' ||
      !document.title.startsWith('[DEMO] ')
    ) {
      throw new Error(`Demomarkering ontbreekt bij ${document._id}.`)
    }

    if (document.isTestData !== true) {
      throw new Error(`isTestData ontbreekt bij ${document._id}.`)
    }

    if (
      document.isPublic !== true ||
      document.isVisible !== true ||
      document.eventType === 'besloten'
    ) {
      throw new Error(`Niet-publiceerbaar demo-item: ${document._id}.`)
    }

    if (
      !document.startAt ||
      !document.endAt ||
      new Date(document.endAt) <= new Date(document.startAt)
    ) {
      throw new Error(`Ongeldige datumvolgorde bij ${document._id}.`)
    }
  }

  return documents
}

async function findExistingDocuments(client, documents = DEMO_DOCUMENTS) {
  assertDevelopmentDataset(client)

  const publishedIds = documents.map(({_id}) => _id)
  const draftIds = publishedIds.map((_id) => `drafts.${_id}`)

  return client.fetch(
    '*[_id in $ids] {_id, _type}',
    {
      ids: [...publishedIds, ...draftIds],
    },
  )
}

function assertSafeExistingDocuments(existing, documents = DEMO_DOCUMENTS) {
  const expectedIds = new Set(documents.map(({_id}) => _id))

  for (const item of existing) {
    const publishedId = item._id.startsWith('drafts.')
      ? item._id.slice('drafts.'.length)
      : item._id

    if (!expectedIds.has(publishedId)) {
      throw new Error(`Onverwacht bestaand document: ${item._id}`)
    }

    if (item._type !== DOCUMENT_TYPE) {
      throw new Error(
        `Agenda-seed afgebroken: ${item._id} heeft type ${item._type}.`,
      )
    }

    if (item._id.startsWith('drafts.')) {
      throw new Error(
        `Agenda-seed afgebroken: draft bestaat voor ${publishedId}.`,
      )
    }
  }
}

async function runSeed(client, {documents = DEMO_DOCUMENTS} = {}) {
  const dataset = assertDevelopmentDataset(client)
  const validatedDocuments = validateDemoDocuments(documents)
  const existing = await findExistingDocuments(client, validatedDocuments)

  assertSafeExistingDocuments(existing, validatedDocuments)

  const existingIds = new Set(existing.map(({_id}) => _id))
  let created = 0
  let skipped = 0

  for (const document of validatedDocuments) {
    if (existingIds.has(document._id)) {
      skipped += 1
      continue
    }

    assertDevelopmentDataset(client)
    await client.createIfNotExists(document)
    created += 1
  }

  console.log(`Dataset: ${dataset}`)
  console.log(`Demo-items aangemaakt: ${created}`)
  console.log(`Demo-items bestaand: ${skipped}`)
  console.log(`Demo-items totaal: ${validatedDocuments.length}`)

  return {
    status: created === 0 ? 'existing' : 'created',
    created,
    skipped,
    total: validatedDocuments.length,
  }
}

async function main() {
  const client = getCliClient({
    apiVersion: API_VERSION,
    perspective: 'raw',
  })

  await runSeed(client)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

module.exports = {
  DEMO_DOCUMENTS,
  assertDevelopmentDataset,
  validateDemoDocuments,
  findExistingDocuments,
  assertSafeExistingDocuments,
  runSeed,
}
