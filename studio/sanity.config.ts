import {defineConfig, isDev} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {SINGLETON_TYPES} from './singletonTypes'
import {structure} from './structure'

import {resolveStudioDataset} from './environment'

const SINGLETON_DOCUMENT_ACTIONS = new Set([
  'publish',
  'discardChanges',
  'restore',
])

export default defineConfig({
  name: 'default',
  title: 'Spontaan Website',

  projectId: 'u66p1mxm',
  dataset: resolveStudioDataset(),

  plugins: [
    structureTool({
      structure,
    }),
    ...(isDev ? [visionTool()] : []),
  ],

  schema: {
    types: schemaTypes,
    templates: (templates) =>
      templates.filter(
        (template) =>
          !SINGLETON_TYPES.has(template.schemaType)
      ),
  },

  document: {
    actions: (input, context) =>
      SINGLETON_TYPES.has(context.schemaType)
        ? input.filter(
            ({action}) =>
              action &&
              SINGLETON_DOCUMENT_ACTIONS.has(action)
          )
        : input,

    newDocumentOptions: (options) =>
      options.filter(
        (option) =>
          !SINGLETON_TYPES.has(option.templateId)
      ),
  },
})
