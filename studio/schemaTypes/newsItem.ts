import {defineField, defineType} from 'sanity'

export const newsItem = defineType({
  name: 'newsItem',
  title: 'Nieuwsbericht',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Titel',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'URL-vriendelijke naam voor het nieuwsbericht.',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Publicatiedatum',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'isVisible',
      title: 'Zichtbaar op website',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'isFeatured',
      title: 'Uitgelicht op homepage',
      type: 'boolean',
      description: 'Gebruik dit om nieuws op de homepage uit te lichten als er geen handmatige selectie is ingesteld.',
      initialValue: false,
    }),
    defineField({
      name: 'mainImage',
      title: 'Hoofdafbeelding',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'mainImageAlt',
      title: 'Alt-tekst hoofdafbeelding',
      type: 'string',
      description: 'Korte omschrijving van de afbeelding voor toegankelijkheid.',
    }),
    defineField({
      name: 'summary',
      title: 'Samenvatting',
      type: 'text',
      rows: 3,
      description: 'Korte tekst voor nieuwskaarten en overzichten.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Volledige tekst',
      type: 'array',
      of: [{type: 'block'}],
    }),
    defineField({
      name: 'audioFiles',
      title: 'Audio / mp3',
      type: 'array',
      of: [
        {
          type: 'file',
          options: {
            accept: 'audio/*',
          },
        },
      ],
    }),
    defineField({
      name: 'videoUrl',
      title: 'Video-url',
      type: 'url',
      description: 'Bijvoorbeeld een YouTube- of Vimeo-link.',
    }),
    defineField({
      name: 'attachments',
      title: 'Bijlagen / downloads',
      type: 'array',
      of: [{type: 'file'}],
    }),
  ],
  orderings: [
    {
      title: 'Nieuwste eerst',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'summary',
      media: 'mainImage',
    },
  },
})
