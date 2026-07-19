import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {SINGLETON_TYPES} from './singletonTypes'
import {structure} from './structure'

export default defineConfig({
  name: 'default',
  title: 'Spontaan Website',

  projectId: 'u66p1mxm',
  dataset: 'development',

  plugins: [
    structureTool({
      structure,
    }),
    visionTool(),
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
    newDocumentOptions: (options) =>
      options.filter(
        (option) =>
          !SINGLETON_TYPES.has(option.templateId)
      ),
  },
})
