const {createHash} = require('node:crypto')
const {createReadStream, readFileSync} = require('node:fs')
const {basename, extname, resolve, sep} = require('node:path')
const {getCliClient} = require('sanity/cli')

const API_VERSION = '2026-07-06'
const EXPECTED_DATASET = 'development'
const PAGE_DOCUMENT_ID = 'friendsPage-main'
const PROJECT_ROOT = resolve(__dirname, '../..')
const FALLBACK_PATH = resolve(PROJECT_ROOT, 'data/friends-fallback.json')
const IMAGES_ROOT = resolve(PROJECT_ROOT, 'images')

const IMAGE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function assertDevelopmentDataset(client) {
  const dataset = client.config().dataset

  if (dataset !== EXPECTED_DATASET) {
    throw new Error(
      `Friends-seed afgebroken: alleen dataset "${EXPECTED_DATASET}" is toegestaan.`
    )
  }

  return dataset
}

function hasExpectedImageSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
  }

  if (mimeType === 'image/png') {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
  }

  if (mimeType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }

  return false
}

function localImage(relativeUrl, readFile = readFileSync) {
  if (
    typeof relativeUrl !== 'string' ||
    !relativeUrl.startsWith('../images/')
  ) {
    throw new Error(`Ongeldig lokaal afbeeldingspad: ${String(relativeUrl)}`)
  }

  const filePath = resolve(PROJECT_ROOT, relativeUrl.slice(3))
  const expectedPrefix = `${IMAGES_ROOT}${sep}`

  if (!filePath.startsWith(expectedPrefix)) {
    throw new Error(`Afbeeldingspad valt buiten images/: ${relativeUrl}`)
  }

  const extension = extname(filePath).toLowerCase()
  const mimeType = IMAGE_TYPES[extension]

  if (!mimeType) {
    throw new Error(`Niet-ondersteunde afbeeldingsextensie: ${extension}`)
  }

  let buffer
  try {
    buffer = readFile(filePath)
  } catch {
    throw new Error(`Verplicht afbeeldingsbestand ontbreekt: ${relativeUrl}`)
  }

  if (!hasExpectedImageSignature(buffer, mimeType)) {
    throw new Error(
      `Afbeeldingsinhoud komt niet overeen met ${mimeType}: ${relativeUrl}`
    )
  }

  return {
    filePath,
    filename: basename(filePath),
    mimeType,
    sha1hash: createHash('sha1').update(buffer).digest('hex'),
  }
}

function visibleName(publicName) {
  return String(publicName || '').replace(/^\[TEST\]\s*/u, '').trim()
}

function friendDocumentId(sourceId) {
  if (!/^[a-z0-9-]+$/.test(sourceId)) {
    throw new Error(`Ongeldig vast friendItem-ID-fragment: ${sourceId}`)
  }

  return `friend-${sourceId}`
}

function buildSeedPlan({
  fallbackPath = FALLBACK_PATH,
  readFile = readFileSync,
} = {}) {
  let fallback
  try {
    fallback = JSON.parse(readFile(fallbackPath, 'utf8'))
  } catch {
    throw new Error('Friends-fallback kon niet veilig worden gelezen.')
  }

  const page = fallback?.page
  const sourceFriends = fallback?.friends

  if (!page || !Array.isArray(sourceFriends) || sourceFriends.length === 0) {
    throw new Error('Friends-fallback bevat geen volledige seedbron.')
  }

  const imageSources = [
    {
      key: 'page-hero',
      ...localImage(page.heroImageUrl, readFile),
    },
    {
      key: 'page-cta',
      ...localImage(page.ctaImageUrl, readFile),
    },
    ...sourceFriends.map((friend) => ({
      key: `friend-${friend.id}`,
      ...localImage(friend.imageUrl, readFile),
    })),
  ]

  const documentIds = [
    PAGE_DOCUMENT_ID,
    ...sourceFriends.map(({id}) => friendDocumentId(id)),
  ]

  if (new Set(documentIds).size !== documentIds.length) {
    throw new Error('Dubbele friends-document-ID’s in de seedbron.')
  }

  return {
    page,
    sourceFriends,
    imageSources,
    documentIds,
  }
}

async function assertNoDocumentConflicts(client, documentIds) {
  assertDevelopmentDataset(client)

  const idsToCheck = documentIds.flatMap((documentId) => [
    documentId,
    `drafts.${documentId}`,
  ])
  const conflicts = await client.fetch(
    `*[_id in $idsToCheck] {
      _id,
      _type
    }`,
    {idsToCheck}
  )

  if (conflicts.length > 0) {
    const conflictSummary = conflicts
      .map(({_id, _type}) => `${_id} (${_type})`)
      .join(', ')

    throw new Error(
      `Friends-seed afgebroken wegens bestaande documenten: ${conflictSummary}`
    )
  }
}

async function resolveImageAssets(
  client,
  imageSources,
  {
    openReadStream = createReadStream,
  } = {}
) {
  const assetIdsByKey = new Map()
  let reused = 0
  let uploaded = 0

  for (const imageSource of imageSources) {
    assertDevelopmentDataset(client)

    const existingAsset = await client.fetch(
      `*[
        _type == "sanity.imageAsset" &&
        sha1hash == $sha1hash
      ][0] {
        _id,
        mimeType
      }`,
      {sha1hash: imageSource.sha1hash}
    )

    if (existingAsset) {
      if (existingAsset.mimeType !== imageSource.mimeType) {
        throw new Error(
          `Bestaand asset heeft onverwacht MIME-type: ${imageSource.filename}`
        )
      }

      assetIdsByKey.set(imageSource.key, existingAsset._id)
      reused += 1
      continue
    }

    assertDevelopmentDataset(client)
    const asset = await client.assets.upload(
      'image',
      openReadStream(imageSource.filePath),
      {
        filename: imageSource.filename,
        contentType: imageSource.mimeType,
      }
    )

    assetIdsByKey.set(imageSource.key, asset._id)
    uploaded += 1
  }

  return {
    assetIdsByKey,
    reused,
    uploaded,
  }
}

function imageReference(assetId) {
  return {
    _type: 'image',
    asset: {
      _type: 'reference',
      _ref: assetId,
    },
  }
}

function createDocuments(plan, assetIdsByKey) {
  const supportItems = plan.page.supportItems.map((item, index) => ({
    _type: 'supportItem',
    _key: `support-${index + 1}`,
    title: item.title,
    text: item.text,
  }))

  const pageDocument = {
    _id: PAGE_DOCUMENT_ID,
    _type: 'friendsPage',
    title: '[TEST] Vrienden van Spontaan',
    isTestData: true,
    heroTitle: plan.page.heroTitle,
    heroText: plan.page.heroText,
    heroImage: imageReference(assetIdsByKey.get('page-hero')),
    heroImageAlt: plan.page.heroImageAlt,
    heroPrimaryButtonLabel: plan.page.heroPrimaryButtonLabel,
    heroPrimaryButtonLink: plan.page.heroPrimaryButtonLink,
    heroSecondaryButtonLabel: plan.page.heroSecondaryButtonLabel,
    heroSecondaryButtonLink: plan.page.heroSecondaryButtonLink,
    supportTitle: plan.page.supportTitle,
    supportIntro: plan.page.supportIntro,
    supportItems,
    friendsTitle: plan.page.friendsTitle,
    friendsIntro: plan.page.friendsIntro,
    ctaTitle: plan.page.ctaTitle,
    ctaText: plan.page.ctaText,
    ctaBenefits: plan.page.ctaBenefits,
    ctaImage: imageReference(assetIdsByKey.get('page-cta')),
    ctaImageAlt: plan.page.ctaImageAlt,
    ctaPrimaryButtonLabel: plan.page.ctaPrimaryButtonLabel,
    ctaPrimaryButtonLink: plan.page.ctaPrimaryButtonLink,
    ctaSecondaryButtonLabel: plan.page.ctaSecondaryButtonLabel,
    ctaSecondaryButtonLink: plan.page.ctaSecondaryButtonLink,
  }

  const friendDocuments = plan.sourceFriends.map((friend) => {
    const publicName = visibleName(friend.publicName)

    if (!publicName) {
      throw new Error(`Publieke naam ontbreekt voor friendItem: ${friend.id}`)
    }

    return {
      _id: friendDocumentId(friend.id),
      _type: 'friendItem',
      title: `[TEST] ${publicName}`,
      publicName,
      friendType: friend.friendType,
      image: imageReference(
        assetIdsByKey.get(`friend-${friend.id}`)
      ),
      imageDisplay: friend.imageDisplay,
      imageAlt: friend.imageAlt,
      description: friend.description,
      website: friend.website || undefined,
      isVisible: true,
      isFeatured: friend.isFeatured === true,
      sortOrder: friend.sortOrder,
    }
  })

  return [pageDocument, ...friendDocuments]
}

async function createDocumentsAtomically(client, documents) {
  assertDevelopmentDataset(client)
  const transaction = client.transaction()

  for (const document of documents) {
    transaction.createIfNotExists(document)
  }

  assertDevelopmentDataset(client)
  await transaction.commit()
}

async function runSeed(
  client,
  {
    buildPlan = buildSeedPlan,
    resolveAssets = resolveImageAssets,
  } = {}
) {
  const dataset = assertDevelopmentDataset(client)
  const plan = buildPlan()

  await assertNoDocumentConflicts(client, plan.documentIds)

  const assets = await resolveAssets(client, plan.imageSources)
  const documents = createDocuments(plan, assets.assetIdsByKey)

  if (documents.length !== plan.documentIds.length) {
    throw new Error('Aantal friends-documenten wijkt af van het seedplan.')
  }

  await createDocumentsAtomically(client, documents)

  console.log(`Dataset: ${dataset}`)
  console.log(`Assets hergebruikt: ${assets.reused}`)
  console.log(`Assets geüpload: ${assets.uploaded}`)
  console.log(
    `Assetbestanden: ${plan.imageSources
      .map(({filename}) => filename)
      .join(', ')}`
  )
  console.log(`Documenten aangemaakt: ${documents.length}`)
  console.log(
    `Document-ID’s: ${documents.map(({_id}) => _id).join(', ')}`
  )
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
  assertDevelopmentDataset,
  assertNoDocumentConflicts,
  buildSeedPlan,
  createDocuments,
  createDocumentsAtomically,
  resolveImageAssets,
  runSeed,
}
