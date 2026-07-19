import type {
  StructureBuilder,
  StructureResolver,
} from 'sanity/structure'
import {
  MEDIA_PAGE_DOCUMENT_ID,
  SINGLETON_TYPES,
} from './singletonTypes'

export const structure: StructureResolver = (
  S: StructureBuilder
) =>
  S.list()
    .title('Inhoud')
    .items([
      S.listItem()
        .id('mediaPage')
        .schemaType('mediaPage')
        .title('Pagina Beeld en Geluid')
        .child(
          S.document()
            .id(MEDIA_PAGE_DOCUMENT_ID)
            .schemaType('mediaPage')
            .documentId(MEDIA_PAGE_DOCUMENT_ID)
        ),

      S.divider(),

      ...S.documentTypeListItems().filter(
        (listItem) =>
          !SINGLETON_TYPES.has(listItem.getId() ?? '')
      ),
    ])
