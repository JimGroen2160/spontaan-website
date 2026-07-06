import {defineField, defineType} from 'sanity'

export const homePage = defineType({
  name: 'homePage',
  title: 'Homepage',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Interne titel',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'heroTitle',
      title: 'Hero titel',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'heroSubtitle',
      title: 'Hero subtitel',
      type: 'string',
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero achtergrondafbeelding',
      type: 'image',
      description:
        'Brede foto voor de homepage-hero. Later te vervangen door een recente koorfoto in de kleuren en uitstraling van de nieuwe website.',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'heroImageAlt',
      title: 'Alt-tekst hero afbeelding',
      type: 'string',
      description: 'Korte omschrijving van de afbeelding voor toegankelijkheid.',
    }),
    defineField({
      name: 'welcomeTitle',
      title: 'Welkom titel',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'welcomeText',
      title: 'Welkom tekst',
      type: 'text',
      rows: 5,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'ctaLabel',
      title: 'Knoptekst',
      type: 'string',
      description: 'Optioneel, bijvoorbeeld: Neem contact op.',
    }),
    defineField({
      name: 'ctaLink',
      title: 'Knoplink',
      type: 'string',
      description: 'Optioneel, bijvoorbeeld: /pages/contact.html.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'heroTitle',
    },
  },
})
