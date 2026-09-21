import type {
  StructureBuilder,
  StructureResolver,
} from 'sanity/structure'
import {LedenadministratiePane} from './components/LedenadministratiePane'
import {
  ABOUT_PAGE_DOCUMENT_ID,
  AGENDA_PAGE_DOCUMENT_ID,
  CONTACT_PAGE_DOCUMENT_ID,
  FRIENDS_PAGE_DOCUMENT_ID,
  HOME_PAGE_DOCUMENT_ID,
  MEDIA_PAGE_DOCUMENT_ID,
  NEWS_PAGE_DOCUMENT_ID,
  REPERTOIRE_PAGE_DOCUMENT_ID,
} from './singletonTypes'

const singletonItem = (
  S: StructureBuilder,
  id: string,
  title: string,
  schemaType: string,
  documentId: string
) =>
  S.listItem()
    .id(id)
    .schemaType(schemaType)
    .title(title)
    .child(
      S.document()
        .id(documentId)
        .schemaType(schemaType)
        .documentId(documentId)
    )

const listItem = (
  S: StructureBuilder,
  id: string,
  title: string,
  schemaType: string
) =>
  S.listItem()
    .id(id)
    .schemaType(schemaType)
    .title(title)
    .child(
      S.documentTypeList(schemaType)
        .id(`${id}-list`)
        .title(title)
    )

export const structure: StructureResolver = (
  S: StructureBuilder
) =>
  S.list()
    .title('Inhoud')
    .items([
      singletonItem(
        S,
        'homePage',
        'Homepage',
        'homePage',
        HOME_PAGE_DOCUMENT_ID
      ),

      singletonItem(
        S,
        'aboutPage',
        'Pagina Over Spontaan',
        'aboutPage',
        ABOUT_PAGE_DOCUMENT_ID
      ),

      singletonItem(
        S,
        'agendaPage',
        'Pagina Agenda',
        'agendaPage',
        AGENDA_PAGE_DOCUMENT_ID
      ),
      listItem(
        S,
        'eventItem',
        'Agenda-items',
        'eventItem'
      ),

      S.divider(),

      singletonItem(
        S,
        'mediaPage',
        'Pagina Beeld en Geluid',
        'mediaPage',
        MEDIA_PAGE_DOCUMENT_ID
      ),
      listItem(S, 'photoAlbum', 'Fotoalbums', 'photoAlbum'),
      listItem(S, 'audioItem', 'Muziekopnamen', 'audioItem'),
      listItem(S, 'videoItem', 'Video’s', 'videoItem'),

      S.divider(),

      singletonItem(
        S,
        'repertoirePage',
        'Pagina Muziek en repertoire',
        'repertoirePage',
        REPERTOIRE_PAGE_DOCUMENT_ID
      ),
      listItem(
        S,
        'repertoireItem',
        'Repertoire-items',
        'repertoireItem'
      ),

      S.divider(),

      singletonItem(
        S,
        'newsPage',
        'Pagina Nieuws',
        'newsPage',
        NEWS_PAGE_DOCUMENT_ID
      ),
      listItem(
        S,
        'newsItem',
        'Nieuwsberichten',
        'newsItem'
      ),

      S.divider(),

      singletonItem(
        S,
        'friendsPage',
        'Pagina Vrienden van Spontaan',
        'friendsPage',
        FRIENDS_PAGE_DOCUMENT_ID
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

      singletonItem(
        S,
        'contactPage',
        'Pagina Contact',
        'contactPage',
        CONTACT_PAGE_DOCUMENT_ID
      ),

      S.divider(),

      S.listItem()
        .id('ledenadministratie')
        .title('Ledenadministratie')
        .child(
          S.component(LedenadministratiePane)
            .id('ledenadministratie-pane')
            .title('Ledenadministratie')
        ),
    ])
