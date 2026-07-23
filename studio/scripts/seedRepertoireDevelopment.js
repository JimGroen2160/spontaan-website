import {createReadStream} from 'node:fs'
import {resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-07-06'})
const EXPECTED_DATASET = 'development'

const item = (id, title, fields = {}) => ({
  _id: id,
  _type: 'repertoireItem',
  title: `[TEST] ${title}`,
  isVisible: true,
  isTestData: true,
  ...fields,
})

async function uploadAudio(filename) {
  const existing = await client.fetch(
    '*[_type == "sanity.fileAsset" && originalFilename == $filename][0]._id',
    {filename},
  )
  if (existing) return existing
  const asset = await client.assets.upload(
    'file',
    createReadStream(resolve(process.cwd(), `../data/${filename}`)),
    {filename, contentType: 'audio/wav'},
  )
  return asset._id
}

async function uploadHeroImage() {
  const filename = 'muziek-repertoire-hero.jpg'
  const existing = await client.fetch(
    '*[_type == "sanity.imageAsset" && originalFilename == $filename][0]._id',
    {filename},
  )
  if (existing) return existing
  const asset = await client.assets.upload(
    'image',
    createReadStream(resolve(process.cwd(), '../images/repertoire/muziek-repertoire-hero.jpg')),
    {filename},
  )
  return asset._id
}

const reference = (_ref, _key) => ({_type: 'reference', _ref, _key})

async function main() {
  if (client.config().dataset !== EXPECTED_DATASET) {
    throw new Error(`Seed afgebroken: alleen dataset "${EXPECTED_DATASET}" is toegestaan.`)
  }

  const warmAsset = await uploadAudio('test-repertoire-warm.wav')
  const helderAsset = await uploadAudio('test-repertoire-helder.wav')
  const heroAsset = await uploadHeroImage()
  const rose = item('test-repertoire-the-rose', 'The Rose', {
    summary: 'Een ode aan liefde en hoop.',
    story: '[TEST] Het verhaal en de sfeer van The Rose binnen onze samenzang.',
    audioDescription: '[TEST] Fragment van The Rose',
    audioFile: {_type: 'file', asset: {_type: 'reference', _ref: warmAsset}},
  })
  const avond = item('test-repertoire-avond', 'Avond', {
    audioDescription: '[TEST] Fragment van Avond',
    audioFile: {_type: 'file', asset: {_type: 'reference', _ref: helderAsset}},
  })
  const hallelujah = item('test-repertoire-hallelujah', 'Hallelujah', {
    audioDescription: '[TEST] Fragment van Hallelujah',
    audioFile: {_type: 'file', asset: {_type: 'reference', _ref: warmAsset}},
  })
  const page = {
    _id: 'repertoirePage-main',
    _type: 'repertoirePage',
    title: '[TEST] Muziek en repertoire',
    isTestData: true,
    heroTitle: '[TEST] Muziek die verbindt',
    heroSubtitle: '[TEST] Ontdek de muziek van Zanggroep Spontaan.',
    heroImage: {_type: 'image', asset: {_type: 'reference', _ref: heroAsset}},
    heroImageAlt: '',
    featuredItem: reference(rose._id),
    worldsTitle: '[TEST] Drie smaken, één klank',
    worldsIntro: '[TEST] Eén herkenbare koorklank.',
    worlds: [
      {_type: 'repertoireWorld', _key: 'world-1', number: '01', title: '[TEST] Krachtig', description: 'Klassiek en gedragen.', items: [reference(rose._id, 'rose')]},
      {_type: 'repertoireWorld', _key: 'world-2', number: '02', title: '[TEST] Warm', description: 'Dichtbij en herkenbaar.', items: [reference(avond._id, 'avond')]},
      {_type: 'repertoireWorld', _key: 'world-3', number: '03', title: '[TEST] Feestelijk', description: 'Ritme en energie.', items: [reference(hallelujah._id, 'hallelujah')]},
    ],
    processTitle: '[TEST] Van repetitie tot uitvoering',
    processSteps: ['Kiezen', 'Instuderen', 'Samenklank', 'Optreden'].map((title, index) => ({_type: 'processStep', _key: `step-${index + 1}`, title, description: `[TEST] Stap ${index + 1} van het muzikale proces.`})),
    selectionTitle: '[TEST] Een greep uit ons repertoire',
    selectionItems: [reference(rose._id, 'selection-rose'), reference(avond._id, 'selection-avond'), reference(hallelujah._id, 'selection-hallelujah')],
    quote: '[TEST] Samen geven we een lied betekenis.',
    quoteAttribution: '[TEST] Muzikale leiding',
    ctaEyebrow: '[TEST] Nieuwsgierig?',
    ctaTitle: '[TEST] Kom onze muziek beleven',
    ctaText: '[TEST] Luister of zing mee.',
    primaryButtonLabel: 'Kom kennismaken',
    primaryButtonLink: './contact.html',
    secondaryButtonLabel: 'Bekijk Beeld en Geluid',
    secondaryButtonLink: './media.html',
  }

  await client.transaction().createOrReplace(rose).createOrReplace(avond).createOrReplace(hallelujah).createOrReplace(page).commit()
  console.log('Repertoire-testdata idempotent geplaatst in development.')
}

main().catch((error) => {
  console.error('Repertoire-seed mislukt:', error)
  process.exitCode = 1
})
