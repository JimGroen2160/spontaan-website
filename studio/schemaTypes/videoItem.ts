import {defineField, defineType} from 'sanity'
import {imageGlowField} from './imageGlow'
import {managedImageField} from './managedImage'

export const videoItem = defineType({
  name: 'videoItem',
  title: 'Video',
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
      name: 'youtubeUrl',
      title: 'YouTube-link',
      type: 'url',
      description:
        'Gebruik een volledige YouTube- of youtu.be-link.',
      validation: (rule) =>
        rule
          .required()
          .uri({
            scheme: ['https'],
          })
          .custom((value) => {
            if (typeof value !== 'string') {
              return true
            }

            try {
              const hostname = new URL(value).hostname
                .toLowerCase()
                .replace(/^www\./, '')

              return [
                'youtube.com',
                'm.youtube.com',
                'youtu.be',
              ].includes(hostname)
                ? true
                : 'Gebruik alleen een geldige YouTube-link.'
            } catch {
              return 'Gebruik alleen een geldige YouTube-link.'
            }
          }),
    }),

    managedImageField({name: 'thumbnail', title: 'Voorbeeldafbeelding', description: 'Deze afbeelding wordt getoond voordat de bezoeker de video afspeelt.', required: true, altRequired: false}),

    defineField({
      name: 'thumbnailAlt',
      title: 'Alt-tekst voorbeeldafbeelding',
      type: 'string',
      validation: (rule) => rule.required().max(160),
    }),

    imageGlowField({name: 'thumbnailGlow'}),

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
      media: 'thumbnail',
    },

    prepare({title, recordedAt, media}) {
      const formattedDate = recordedAt
        ? new Intl.DateTimeFormat('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(recordedAt))
        : 'Datum ontbreekt'

      return {
        title,
        subtitle: formattedDate,
        media,
      }
    },
  },
})
