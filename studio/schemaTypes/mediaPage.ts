import {defineField, defineType} from 'sanity'

export const mediaPage = defineType({
  name: 'mediaPage',
  title: 'Pagina Beeld en Geluid',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Interne titel',
      type: 'string',
      initialValue: 'Beeld en Geluid',
      validation: (rule) => rule.required().max(96),
    }),

    defineField({
      name: 'isTestData',
      title: 'Testdata',
      type: 'boolean',
      hidden: true,
      readOnly: true,
      initialValue: false,
    }),
    defineField({
      name: 'heroTitle',
      title: 'Hero-titel',
      type: 'string',
      validation: (rule) => rule.required().max(96),
    }),

    defineField({
      name: 'heroSubtitle',
      title: 'Hero-ondertitel',
      type: 'text',
      rows: 2,
      validation: (rule) => rule.required().max(180),
    }),

    defineField({
      name: 'heroImage',
      title: 'Hero-afbeelding',
      type: 'image',
      description:
        'Gebruik een afbeelding die duidelijk verwijst naar foto, muziek of video.',
      options: {
        hotspot: true,
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'heroImageAlt',
      title: 'Alt-tekst hero-afbeelding',
      type: 'string',
      description:
        'Beschrijf kort wat op de afbeelding te zien is.',
      validation: (rule) => rule.required().max(160),
    }),

    defineField({
      name: 'introTitle',
      title: 'Titel introductie',
      type: 'string',
      validation: (rule) => rule.required().max(120),
    }),

    defineField({
      name: 'introText',
      title: 'Introductietekst',
      type: 'text',
      rows: 4,
      validation: (rule) => rule.required().max(500),
    }),

    defineField({
      name: 'ctaEyebrow',
      title: 'Bovenregel afsluitend blok',
      type: 'string',
      initialValue: 'Zelf Spontaan beleven?',
      validation: (rule) => rule.required().max(80),
    }),

    defineField({
      name: 'ctaTitle',
      title: 'Titel afsluitend blok',
      type: 'string',
      initialValue: 'Kom luisteren bij Zanggroep Spontaan',
      validation: (rule) => rule.required().max(120),
    }),

    defineField({
      name: 'ctaText',
      title: 'Tekst afsluitend blok',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required().max(280),
    }),

    defineField({
      name: 'primaryButtonLabel',
      title: 'Tekst primaire knop',
      type: 'string',
      initialValue: 'Bekijk de agenda',
      validation: (rule) => rule.required().max(48),
    }),

    defineField({
      name: 'primaryButtonLink',
      title: 'Link primaire knop',
      type: 'url',
      initialValue: './agenda.html',
      validation: (rule) =>
        rule.required().uri({
          scheme: ['http', 'https'],
          allowRelative: true,
        }),
    }),

    defineField({
      name: 'secondaryButtonLabel',
      title: 'Tekst secundaire knop',
      type: 'string',
      initialValue: 'Neem contact op',
      validation: (rule) => rule.required().max(48),
    }),

    defineField({
      name: 'secondaryButtonLink',
      title: 'Link secundaire knop',
      type: 'url',
      initialValue: './contact.html',
      validation: (rule) =>
        rule.required().uri({
          scheme: ['http', 'https'],
          allowRelative: true,
        }),
    }),
  ],

  preview: {
    select: {
      title: 'title',
      subtitle: 'heroSubtitle',
      media: 'heroImage',
    },
  },
})
