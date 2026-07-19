import {defineArrayMember, defineField, defineType} from 'sanity'

export const photoAlbum = defineType({
  name: 'photoAlbum',
  title: 'Fotoalbum',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Titel',
      type: 'string',
      validation: (rule) => rule.required().max(96),
    }),

    defineField({
      name: 'eventDate',
      title: 'Datum',
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
      name: 'coverImage',
      title: 'Omslagafbeelding',
      type: 'image',
      options: {
        hotspot: true,
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'coverImageAlt',
      title: 'Alt-tekst omslagafbeelding',
      type: 'string',
      description:
        'Korte beschrijving van de omslagafbeelding voor toegankelijkheid.',
      validation: (rule) => rule.required().max(160),
    }),

    defineField({
      name: 'photos',
      title: 'Foto’s',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'albumPhoto',
          title: 'Foto',
          type: 'object',

          fields: [
            defineField({
              name: 'image',
              title: 'Afbeelding',
              type: 'image',
              options: {
                hotspot: true,
              },
              validation: (rule) => rule.required(),
            }),

            defineField({
              name: 'alt',
              title: 'Alt-tekst',
              type: 'string',
              description:
                'Beschrijf kort wat op de foto te zien is.',
              validation: (rule) => rule.required().max(160),
            }),

            defineField({
              name: 'caption',
              title: 'Bijschrift',
              type: 'string',
              validation: (rule) => rule.max(240),
            }),
          ],

          preview: {
            select: {
              title: 'caption',
              subtitle: 'alt',
              media: 'image',
            },

            prepare({title, subtitle, media}) {
              return {
                title: title || 'Foto zonder bijschrift',
                subtitle,
                media,
              }
            },
          },
        }),
      ],
      validation: (rule) => rule.required().min(1).max(60),
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
      name: 'eventDateDesc',
      by: [{field: 'eventDate', direction: 'desc'}],
    },
  ],

  preview: {
    select: {
      title: 'title',
      eventDate: 'eventDate',
      media: 'coverImage',
    },

    prepare({title, eventDate, media}) {
      const formattedDate = eventDate
        ? new Intl.DateTimeFormat('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(eventDate))
        : 'Datum ontbreekt'

      return {
        title,
        subtitle: formattedDate,
        media,
      }
    },
  },
})
