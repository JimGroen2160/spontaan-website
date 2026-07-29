import type {
  StructureBuilder,
  StructureResolver,
} from 'sanity/structure'
import {
  FRIENDS_PAGE_DOCUMENT_ID,
  MEDIA_PAGE_DOCUMENT_ID,
  REPERTOIRE_PAGE_DOCUMENT_ID,
  SINGLETON_TYPES,
} from './singletonTypes'

export const structure: StructureResolver = (
  S: StructureBuilder
) =>
  S.list()
    .title('Inhoud')
    .items([
      S.listItem()
        .id('friendsPage')
        .schemaType('friendsPage')
        .title('Pagina Vrienden van Spontaan')
        .child(
          S.document()
            .id(FRIENDS_PAGE_DOCUMENT_ID)
            .schemaType('friendsPage')
            .documentId(FRIENDS_PAGE_DOCUMENT_ID)
        ),

      S.listItem()
        .id('friendItem')
        .schemaType('friendItem')
        .title('Vrienden en sponsors')
        .child(
          S.documentTypeList('friendItem')
            .id('friendItem-list')
            .title('Vrienden en sponsors')
            .defaultOrdering([
              {
                field: 'sortOrder',
                direction: 'asc',
              },
              {
                field: 'publicName',
                direction: 'asc',
              },
            ])
        ),

      S.divider(),

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

      S.listItem()
        .id('repertoirePage')
        .schemaType('repertoirePage')
        .title('Pagina Muziek en repertoire')
        .child(
          S.document()
            .id(REPERTOIRE_PAGE_DOCUMENT_ID)
            .schemaType('repertoirePage')
            .documentId(REPERTOIRE_PAGE_DOCUMENT_ID)
        ),

      S.divider(),

      ...S.documentTypeListItems().filter(
        (listItem) =>
          !SINGLETON_TYPES.has(listItem.getId() ?? '') &&
          listItem.getId() !== 'friendItem'
      ),
    ])
