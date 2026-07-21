const ALLOWED_SANITY_DATASETS = new Set(['development', 'production'])

export function resolveStudioDataset(environment = process.env) {
  const configuredDataset = environment.SANITY_STUDIO_DATASET?.trim()
  const dataset = configuredDataset || 'development'

  if (!ALLOWED_SANITY_DATASETS.has(dataset)) {
    throw new Error(`Ongeldige Sanity Studio-dataset: ${dataset}`)
  }

  return dataset
}
