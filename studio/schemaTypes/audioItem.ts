import {defineField, defineType} from 'sanity'

export const audioItem = defineType({
  name: 'audioItem',
  title: 'Muziekopname',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Titel',
      type: 'string',
      validation: (rule) => rule.required().max(96),
    }),

    defineField({
      name: 'recordedAt',
      title: 'Opnamedatum',
      type: 'date',
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'summary',
      title: 'Korte omschrijving',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required().max(280),
    }),

    defineField({
      name: 'audioFile',
      title: 'MP3-bestand',
      type: 'file',
      description:
        'Upload bij voorkeur een geoptimaliseerd MP3-bestand. Het bestand start nooit automatisch.',
      options: {
        accept: 'audio/mpeg,.mp3',
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'isFeatured',
      title: 'Uitgelicht op mediapagina',
      type: 'boolean',
      initialValue: false,
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
      title: 'Nieuwste eerst',
      name: 'recordedAtDesc',
      by: [{field: 'recordedAt', direction: 'desc'}],
    },
  ],

  preview: {
    select: {
      title: 'title',
      recordedAt: 'recordedAt',
      subtitle: 'summary',
    },

    prepare({title, recordedAt, subtitle}) {
      const formattedDate = recordedAt
        ? new Intl.DateTimeFormat('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(recordedAt))
        : 'Datum ontbreekt'

      return {
        title,
        subtitle: `${formattedDate} · ${subtitle || 'Omschrijving ontbreekt'}`,
      }
    },
  },
})
