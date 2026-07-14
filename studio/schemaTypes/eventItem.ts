import {defineField, defineType} from 'sanity'

export const eventItem = defineType({
  name: 'eventItem',
  title: 'Agenda-item',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Titel',
      type: 'string',
      validation: (rule) => rule.required().max(96),
    }),

    defineField({
      name: 'startAt',
      title: 'Startdatum en -tijd',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'endAt',
      title: 'Einddatum en -tijd',
      type: 'datetime',
      validation: (rule) =>
        rule.required().custom((endAt, context) => {
          const startAt = context.parent?.startAt

          if (!endAt || typeof startAt !== 'string') {
            return true
          }

          return new Date(endAt) > new Date(startAt)
            ? true
            : 'De einddatum en -tijd moeten na de start liggen.'
        }),
    }),

    defineField({
      name: 'eventType',
      title: 'Soort evenement',
      type: 'string',
      initialValue: 'optreden',
      options: {
        list: [
          {title: 'Optreden', value: 'optreden'},
          {title: 'Concert', value: 'concert'},
          {title: 'Repetitie', value: 'repetitie'},
          {title: 'Besloten', value: 'besloten'},
          {title: 'Overig', value: 'overig'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'locationName',
      title: 'Locatienaam',
      type: 'string',
      validation: (rule) => rule.required().max(120),
    }),

    defineField({
      name: 'city',
      title: 'Plaats',
      type: 'string',
      validation: (rule) => rule.required().max(80),
    }),

    defineField({
      name: 'address',
      title: 'Adres',
      type: 'string',
      description: 'Optioneel volledig adres van de activiteit.',
      validation: (rule) => rule.max(160),
    }),

    defineField({
      name: 'mapUrl',
      title: 'Route- of kaartlink',
      type: 'url',
      description: 'Bijvoorbeeld een link naar Google Maps.',
      validation: (rule) =>
        rule.uri({
          scheme: ['https'],
        }),
    }),

    defineField({
      name: 'summary',
      title: 'Korte omschrijving',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required().max(280),
    }),

    defineField({
      name: 'mainImage',
      title: 'Afbeelding',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),

    defineField({
      name: 'mainImageAlt',
      title: 'Alt-tekst afbeelding',
      type: 'string',
      description: 'Vul dit in wanneer een afbeelding wordt gebruikt.',
      validation: (rule) =>
        rule.custom((altText, context) => {
          const hasImage = Boolean(context.parent?.mainImage)

          if (!hasImage) {
            return true
          }

          return typeof altText === 'string' && altText.trim()
            ? true
            : 'Een alt-tekst is verplicht wanneer een afbeelding is ingesteld.'
        }).max(160),
    }),

    defineField({
      name: 'buttonLabel',
      title: 'Tekst actieknop',
      type: 'string',
      description: 'Bijvoorbeeld Reserveer, Meer informatie of Bekijk locatie.',
      validation: (rule) => rule.max(48),
    }),

    defineField({
      name: 'buttonLink',
      title: 'Link actieknop',
      type: 'url',
      validation: (rule) =>
        rule.uri({
          scheme: ['http', 'https'],
          allowRelative: true,
        }),
    }),

    defineField({
      name: 'isFree',
      title: 'Toegang vrij',
      type: 'boolean',
      initialValue: false,
    }),

    defineField({
      name: 'isFeatured',
      title: 'Uitgelicht evenement',
      type: 'boolean',
      initialValue: false,
    }),

    defineField({
      name: 'isPublic',
      title: 'Openbaar evenement',
      type: 'boolean',
      description: 'Niet-openbare activiteiten worden niet op de website getoond.',
      initialValue: true,
    }),

    defineField({
      name: 'isVisible',
      title: 'Zichtbaar op website',
      type: 'boolean',
      initialValue: true,
    }),
  ],

  orderings: [
    {
      title: 'Eerstvolgende activiteit',
      name: 'startAtAsc',
      by: [{field: 'startAt', direction: 'asc'}],
    },
  ],

  preview: {
    select: {
      title: 'title',
      startAt: 'startAt',
      locationName: 'locationName',
      media: 'mainImage',
    },

    prepare({title, startAt, locationName, media}) {
      const formattedDate = startAt
        ? new Intl.DateTimeFormat('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(startAt))
        : 'Datum ontbreekt'

      return {
        title,
        subtitle: `${formattedDate} · ${locationName || 'Locatie ontbreekt'}`,
        media,
      }
    },
  },
})
