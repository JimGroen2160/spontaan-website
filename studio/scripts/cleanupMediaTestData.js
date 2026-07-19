import {getCliClient} from 'sanity/cli'

const API_VERSION = '2026-07-06'
const EXPECTED_DATASET = 'development'

const client = getCliClient({apiVersion: API_VERSION})

async function deleteDocuments(documentIds) {
  if (documentIds.length === 0) {
    return
  }

  const transaction = client.transaction()

  documentIds.forEach((documentId) => {
    transaction.delete(documentId)
  })

  await transaction.commit()
}

async function deleteUnusedTestAssets() {
  const assetIds = await client.fetch(
    `*[
      _type in ["sanity.fileAsset", "sanity.imageAsset"] &&
      originalFilename match "test-media-*"
    ]._id`
  )

  for (const assetId of assetIds) {
    const referenceCount = await client.fetch(
      'count(*[references($assetId)])',
      {assetId}
    )

    if (referenceCount === 0) {
      await client.delete(assetId)
      console.log(`Ongebruikt testasset verwijderd: ${assetId}`)
    }
  }
}

async function main() {
  const dataset = client.config().dataset

  if (dataset !== EXPECTED_DATASET) {
    throw new Error(
      `Cleanup afgebroken: verwacht dataset "${EXPECTED_DATASET}", ` +
      `maar CLI gebruikt "${dataset}".`
    )
  }

  const documentIds = await client.fetch(
    `*[
      _id match "test-*" ||
      (
        _id == "mediaPage-main" &&
        _type == "mediaPage" &&
        isTestData == true
      )
    ]._id`
  )

  console.log(
    `${documentIds.length} testdocument(en) gevonden.`
  )

  await deleteDocuments(documentIds)
  await deleteUnusedTestAssets()

  const remainingTestDocuments = await client.fetch(
    `count(*[
      _id match "test-*" ||
      (
        _id == "mediaPage-main" &&
        _type == "mediaPage" &&
        isTestData == true
      )
    ])`
  )

  console.log(
    `Cleanup afgerond. Resterende testdocumenten: ` +
    `${remainingTestDocuments}`
  )
}

main().catch((error) => {
  console.error('Cleanup mislukt:', error)
  process.exitCode = 1
})
