import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-07-06'})
const EXPECTED_DATASET = 'development'
const DOCUMENT_IDS = [
  'test-repertoire-the-rose',
  'test-repertoire-avond',
  'test-repertoire-hallelujah',
]

async function main() {
  if (client.config().dataset !== EXPECTED_DATASET) {
    throw new Error(`Cleanup afgebroken: alleen dataset "${EXPECTED_DATASET}" is toegestaan.`)
  }
  const pageIsTestData = await client.fetch(
    '*[_id == "repertoirePage-main" && _type == "repertoirePage"][0].isTestData',
  )
  const ids = pageIsTestData ? [...DOCUMENT_IDS, 'repertoirePage-main'] : DOCUMENT_IDS
  const transaction = client.transaction()
  ids.forEach((id) => transaction.delete(id))
  await transaction.commit()
  console.log(`Repertoire-cleanup afgerond voor ${ids.length} exact begrensde documenten.`)
}

main().catch((error) => {
  console.error('Repertoire-cleanup mislukt:', error)
  process.exitCode = 1
})
