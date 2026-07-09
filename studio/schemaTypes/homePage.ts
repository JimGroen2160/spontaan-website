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
      name: 'ctaLabel',
      title: 'Hero knoptekst',
      type: 'string',
      description: 'Optioneel, bijvoorbeeld: Kom eens luisteren.',
    }),
    defineField({
      name: 'ctaLink',
      title: 'Hero knoplink',
      type: 'string',
      description: 'Optioneel, bijvoorbeeld: /pages/contact.html.',
    }),

    defineField({
      name: 'quickLinksTitle',
      title: 'Snel naar titel',
      type: 'string',
      description: 'Titel boven de drie routekaarten, bijvoorbeeld: Snel naar.',
    }),
    defineField({
      name: 'quickLinksIntro',
      title: 'Snel naar intro',
      type: 'text',
      rows: 2,
      description: 'Korte introductieregel boven de routekaarten.',
    }),
    defineField({
      name: 'quickLinks',
      title: 'Snel naar kaarten',
      type: 'array',
      description:
        'Maximaal drie vaste routekaarten, bijvoorbeeld Nieuws, Agenda en Media. De layout blijft vast; de inhoud is beheerbaar.',
      validation: (rule) => rule.max(3),
      of: [
        {
          type: 'object',
          title: 'Snel naar kaart',
          fields: [
            defineField({
              name: 'title',
              title: 'Titel',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'text',
              title: 'Korte tekst',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'image',
              title: 'Afbeelding',
              type: 'image',
              options: {
                hotspot: true,
              },
            }),
            defineField({
              name: 'imageAlt',
              title: 'Alt-tekst afbeelding',
              type: 'string',
            }),
            defineField({
              name: 'buttonLabel',
              title: 'Knoptekst',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'buttonLink',
              title: 'Knoplink',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
          ],
        },
      ],
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
      description:
        'Korte warme introductie. Geen volledige Over Spontaan-tekst; die hoort op de Over-pagina.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'welcomeButtonLabel',
      title: 'Welkom knoptekst',
      type: 'string',
      description: 'Bijvoorbeeld: Lees meer over Spontaan.',
    }),
    defineField({
      name: 'welcomeButtonLink',
      title: 'Welkom knoplink',
      type: 'string',
      description: 'Bijvoorbeeld: /pages/over.html.',
    }),

    defineField({
      name: 'featuredNewsTitle',
      title: 'Uitgelicht nieuws titel',
      type: 'string',
      description: 'Titel boven de uitgelichte nieuwsberichten.',
    }),
    defineField({
      name: 'featuredNewsIntro',
      title: 'Uitgelicht nieuws intro',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'featuredNewsItems',
      title: 'Handmatig uitgelichte nieuwsberichten',
      type: 'array',
      description:
        'Kies maximaal drie nieuwsberichten. Als dit leeg blijft, kan de website later automatisch de nieuwste zichtbare berichten tonen.',
      validation: (rule) => rule.max(3),
      of: [
        {
          type: 'reference',
          to: [{type: 'newsItem'}],
        },
      ],
    }),
    defineField({
      name: 'featuredNewsButtonLabel',
      title: 'Nieuws overzicht knoptekst',
      type: 'string',
      description: 'Bijvoorbeeld: Naar alle nieuwsberichten.',
    }),
    defineField({
      name: 'featuredNewsButtonLink',
      title: 'Nieuws overzicht knoplink',
      type: 'string',
      description: 'Bijvoorbeeld: /pages/nieuws.html.',
    }),

    defineField({
      name: 'visitTitle',
      title: 'Kom eens luisteren titel',
      type: 'string',
      description: 'Titel van de afsluitende uitnodiging.',
    }),
    defineField({
      name: 'visitText',
      title: 'Kom eens luisteren tekst',
      type: 'text',
      rows: 4,
      description:
        'Korte uitnodigende tekst om Spontaan te bezoeken, mee te zingen of contact op te nemen.',
    }),
    defineField({
      name: 'visitPrimaryButtonLabel',
      title: 'Primaire knoptekst',
      type: 'string',
      description: 'Bijvoorbeeld: Contact opnemen.',
    }),
    defineField({
      name: 'visitPrimaryButtonLink',
      title: 'Primaire knoplink',
      type: 'string',
      description: 'Bijvoorbeeld: /pages/contact.html.',
    }),
    defineField({
      name: 'visitSecondaryButtonLabel',
      title: 'Secundaire knoptekst',
      type: 'string',
      description: 'Bijvoorbeeld: Bekijk agenda.',
    }),
    defineField({
      name: 'visitSecondaryButtonLink',
      title: 'Secundaire knoplink',
      type: 'string',
      description: 'Bijvoorbeeld: /pages/agenda.html.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'heroTitle',
      media: 'heroImage',
    },
  },
})
