const ALLOWED_SANITY_DATASETS = new Set(['development', 'production'])

type StudioEnvironment = Record<string, string | undefined>

export function resolveStudioDataset(
  environment?: StudioEnvironment
) {
  const configuredDataset = (
    environment?.SANITY_STUDIO_DATASET ??
    process.env.SANITY_STUDIO_DATASET
  )?.trim()

  const nodeEnvironment = (
    environment?.NODE_ENV ??
    process.env.NODE_ENV
  )?.trim()

  if (configuredDataset) {
    if (!ALLOWED_SANITY_DATASETS.has(configuredDataset)) {
      throw new Error(
        `Ongeldige Sanity Studio-dataset: ${configuredDataset}`
      )
    }

    return configuredDataset
  }

  if (nodeEnvironment === 'production') {
    throw new Error(
      'SANITY_STUDIO_DATASET ontbreekt voor Production Studio'
    )
  }

  return 'development'
}
