const {createHash} = require('node:crypto')
const {createReadStream, readFileSync} = require('node:fs')
const {basename, extname, resolve, sep} = require('node:path')
const {getCliClient} = require('sanity/cli')

const API_VERSION = '2026-07-06'
const EXPECTED_DATASET = 'development'
const PAGE_DOCUMENT_ID = 'aboutPage-main'
const PROJECT_ROOT = resolve(__dirname, '../..')
const FALLBACK_PATH = resolve(PROJECT_ROOT, 'data/about-fallback.json')
const IMAGES_ROOT = resolve(PROJECT_ROOT, 'images')
const MIME_TYPES = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}

function hasExpectedImageSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  return false
}

function assertDevelopmentDataset(client) {
  const dataset = client.config().dataset
  if (dataset !== EXPECTED_DATASET) {
    throw new Error(`Over-seed afgebroken: alleen dataset "${EXPECTED_DATASET}" is toegestaan.`)
  }
  return dataset
}

function localImage(relativeUrl, readFile = readFileSync) {
  if (typeof relativeUrl !== 'string' || !relativeUrl.startsWith('../images/')) {
    throw new Error(`Ongeldig lokaal afbeeldingspad: ${String(relativeUrl)}`)
  }
  const filePath = resolve(PROJECT_ROOT, relativeUrl.slice(3))
  if (!filePath.startsWith(`${IMAGES_ROOT}${sep}`)) throw new Error(`Afbeeldingspad valt buiten images/: ${relativeUrl}`)
  const mimeType = MIME_TYPES[extname(filePath).toLowerCase()]
  if (!mimeType) throw new Error(`Niet-ondersteunde afbeelding: ${relativeUrl}`)
  let buffer
  try {
    buffer = readFile(filePath)
  } catch {
    throw new Error(`Verplicht afbeeldingsbestand ontbreekt: ${relativeUrl}`)
  }
  if (!hasExpectedImageSignature(buffer, mimeType)) {
    throw new Error(`Afbeeldingsinhoud komt niet overeen met ${mimeType}: ${relativeUrl}`)
  }
  return {filePath, filename: basename(filePath), mimeType, sha1hash: createHash('sha1').update(buffer).digest('hex')}
}

function buildSeedPlan({readFile = readFileSync} = {}) {
  let content
  try {
    content = JSON.parse(readFile(FALLBACK_PATH, 'utf8'))
  } catch {
    throw new Error('Over-fallback kon niet veilig worden gelezen.')
  }
  const imageSources = [
    {key: 'hero', ...localImage(content.heroImageUrl, readFile)},
    {key: 'intro', ...localImage(content.introImageUrl, readFile)},
    {key: 'atmosphere', ...localImage(content.atmosphereImageUrl, readFile)},
  ]
  if (new Set(imageSources.map(({filename}) => filename)).size !== 3) throw new Error('Over-seed vereist drie unieke afbeeldingen.')
  return {content, imageSources}
}

async function findExistingPage(client) {
  assertDevelopmentDataset(client)
  return client.fetch(
    `*[_id in [$publishedId, $draftId]] {_id, _type}`,
    {publishedId: PAGE_DOCUMENT_ID, draftId: `drafts.${PAGE_DOCUMENT_ID}`}
  )
}

async function resolveImageAssets(client, imageSources, {openReadStream = createReadStream} = {}) {
  const assetIdsByKey = new Map()
  let reused = 0
  let uploaded = 0
  for (const source of imageSources) {
    assertDevelopmentDataset(client)
    const existing = await client.fetch(
      `*[_type == "sanity.imageAsset" && originalFilename == $filename && sha1hash == $sha1hash][0] {_id, mimeType}`,
      {filename: source.filename, sha1hash: source.sha1hash}
    )
    if (existing) {
      if (existing.mimeType !== source.mimeType) throw new Error(`Bestaand asset heeft onverwacht MIME-type: ${source.filename}`)
      assetIdsByKey.set(source.key, existing._id)
      reused += 1
      continue
    }
    assertDevelopmentDataset(client)
    const asset = await client.assets.upload('image', openReadStream(source.filePath), {
      filename: source.filename,
      contentType: source.mimeType,
    })
    assetIdsByKey.set(source.key, asset._id)
    uploaded += 1
  }
  return {assetIdsByKey, reused, uploaded}
}

const imageReference = (assetId) => ({_type: 'image', asset: {_type: 'reference', _ref: assetId}})

function createDocument(content, assets) {
  const fields = Object.fromEntries(
    Object.entries(content).filter(
      ([key]) => !['heroImageUrl', 'introImageUrl', 'atmosphereImageUrl'].includes(key)
    )
  )
  const keyed = (items, prefix) => items.map((item, index) => ({
    _type: 'aboutCard',
    _key: `${prefix}-${index + 1}`,
    title: item.title,
    text: item.text,
  }))
  return {
    _id: PAGE_DOCUMENT_ID,
    _type: 'aboutPage',
    title: '[TEST] Over Spontaan',
    isTestData: true,
    ...fields,
    heroImage: imageReference(assets.get('hero')),
    introImage: imageReference(assets.get('intro')),
    atmosphereImage: imageReference(assets.get('atmosphere')),
    timelineItems: keyed(fields.timelineItems, 'timeline'),
    valuesItems: keyed(fields.valuesItems, 'value'),
  }
}

async function runSeed(client, {buildPlan = buildSeedPlan, resolveAssets = resolveImageAssets} = {}) {
  const dataset = assertDevelopmentDataset(client)
  const plan = buildPlan()
  const existing = await findExistingPage(client)
  const wrongType = existing.find(({_type}) => _type !== 'aboutPage')
  if (wrongType) throw new Error(`Over-seed afgebroken: ${wrongType._id} heeft type ${wrongType._type}.`)
  if (existing.some(({_id}) => _id === `drafts.${PAGE_DOCUMENT_ID}`)) throw new Error('Over-seed afgebroken: singletondraft bestaat al.')
  if (existing.some(({_id}) => _id === PAGE_DOCUMENT_ID)) {
    console.log(`Dataset: ${dataset}`)
    console.log('Documentstatus: bestaat al; niets gewijzigd')
    console.log(`Document-ID: ${PAGE_DOCUMENT_ID}`)
    return {status: 'existing', reused: 0, uploaded: 0}
  }
  const resolved = await resolveAssets(client, plan.imageSources)
  const document = createDocument(plan.content, resolved.assetIdsByKey)
  assertDevelopmentDataset(client)
  await client.createIfNotExists(document)
  console.log(`Dataset: ${dataset}`)
  console.log(`Assets hergebruikt: ${resolved.reused}`)
  console.log(`Assets geüpload: ${resolved.uploaded}`)
  console.log(`Assetbestanden: ${plan.imageSources.map(({filename}) => filename).join(', ')}`)
  console.log('Documentstatus: aangemaakt')
  console.log(`Document-ID: ${PAGE_DOCUMENT_ID}`)
  return {status: 'created', reused: resolved.reused, uploaded: resolved.uploaded}
}

async function main() {
  const client = getCliClient({apiVersion: API_VERSION, perspective: 'raw'})
  await runSeed(client)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

module.exports = {
  assertDevelopmentDataset,
  buildSeedPlan,
  createDocument,
  findExistingPage,
  resolveImageAssets,
  runSeed,
}
