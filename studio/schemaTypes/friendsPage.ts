import {defineArrayMember, defineField, defineType} from 'sanity'

export const friendsPage = defineType({
  name: 'friendsPage',
  title: 'Pagina Vrienden van Spontaan',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Interne titel',
      type: 'string',
      initialValue: 'Vrienden van Spontaan',
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
      initialValue: 'Vrienden van Spontaan',
      validation: (rule) => rule.required().max(96),
    }),

    defineField({
      name: 'heroText',
      title: 'Hero-tekst',
      type: 'text',
      rows: 3,
      initialValue:
        'Met de steun van onze vrienden kan Zanggroep Spontaan blijven zingen, groeien en mensen verbinden.',
      validation: (rule) => rule.required().max(280),
    }),

    defineField({
      name: 'heroImage',
      title: 'Hero-afbeelding',
      type: 'image',
      description:
        'Gebruik een brede foto van Zanggroep Spontaan die aansluit op het goedgekeurde wireframe.',
      options: {
        hotspot: true,
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'heroImageAlt',
      title: 'Alt-tekst hero-afbeelding',
      type: 'string',
      validation: (rule) => rule.required().max(160),
    }),

    defineField({
      name: 'heroPrimaryButtonLabel',
      title: 'Tekst primaire hero-knop',
      type: 'string',
      initialValue: 'Word vriend van Spontaan',
      validation: (rule) => rule.required().max(48),
    }),

    defineField({
      name: 'heroPrimaryButtonLink',
      title: 'Link primaire hero-knop',
      type: 'url',
      initialValue: './contact.html',
      validation: (rule) =>
        rule.required().uri({
          scheme: ['http', 'https'],
          allowRelative: true,
        }),
    }),

    defineField({
      name: 'heroSecondaryButtonLabel',
      title: 'Tekst secundaire hero-knop',
      type: 'string',
      initialValue: 'Meer informatie',
      validation: (rule) => rule.required().max(48),
    }),

    defineField({
      name: 'heroSecondaryButtonLink',
      title: 'Link secundaire hero-knop',
      type: 'url',
      initialValue: '#vrienden',
      validation: (rule) =>
        rule.required().uri({
          scheme: ['http', 'https'],
          allowRelative: true,
        }),
    }),

    defineField({
      name: 'supportTitle',
      title: 'Titel steunsectie',
      type: 'string',
      initialValue: 'Uw steun maakt dit mogelijk',
      validation: (rule) => rule.required().max(120),
    }),

    defineField({
      name: 'supportIntro',
      title: 'Introductie steunsectie',
      type: 'text',
      rows: 3,
      initialValue:
        'Dankzij de vrienden van Spontaan kan Zanggroep Spontaan blijven investeren in muziek, optredens, nieuwe projecten en mooie zangmomenten.',
      validation: (rule) => rule.required().max(360),
    }),

    defineField({
      name: 'supportItems',
      title: 'Ondersteuningsonderdelen',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'supportItem',
          title: 'Ondersteuningsonderdeel',
          type: 'object',

          fields: [
            defineField({
              name: 'title',
              title: 'Titel',
              type: 'string',
              validation: (rule) => rule.required().max(80),
            }),

            defineField({
              name: 'text',
              title: 'Tekst',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required().max(260),
            }),
          ],

          preview: {
            select: {
              title: 'title',
              subtitle: 'text',
            },
          },
        }),
      ],
      initialValue: [
        {
          _type: 'supportItem',
          title: 'Muziek maken',
          text:
            'Zanggroep Spontaan blijft werken aan mooie muziek en bijzondere optredens.',
        },
        {
          _type: 'supportItem',
          title: 'Groei en ontwikkeling',
          text:
            'Het mannenkoor investeert in repetities, muzikale begeleiding en verdere ontwikkeling.',
        },
        {
          _type: 'supportItem',
          title: 'Verbinden',
          text:
            'Zanggroep Spontaan brengt mensen samen door muziek en ontmoeting.',
        },
        {
          _type: 'supportItem',
          title: 'Cultuur in de regio',
          text:
            'De zanggroep draagt bij aan een rijk en levendig cultureel leven in de regio.',
        },
      ],
      validation: (rule) => rule.required().length(4),
    }),

    defineField({
      name: 'friendsTitle',
      title: 'Titel vrienden- en sponsorsectie',
      type: 'string',
      initialValue: 'Onze vrienden en sponsors',
      validation: (rule) => rule.required().max(120),
    }),

    defineField({
      name: 'friendsIntro',
      title: 'Introductie vrienden- en sponsorsectie',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(360),
    }),

    defineField({
      name: 'ctaTitle',
      title: 'Titel afsluitend blok',
      type: 'string',
      initialValue: 'Word ook vriend van Spontaan',
      validation: (rule) => rule.required().max(120),
    }),

    defineField({
      name: 'ctaText',
      title: 'Tekst afsluitend blok',
      type: 'text',
      rows: 3,
      initialValue:
        'Met uw bijdrage ondersteunt u Zanggroep Spontaan bij muzikale activiteiten, optredens en verdere ontwikkeling.',
      validation: (rule) => rule.required().max(360),
    }),

    defineField({
      name: 'ctaBenefits',
      title: 'Voordelen en betrokkenheid',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'string',
          validation: (rule) => rule.required().max(160),
        }),
      ],
      initialValue: [
        'U steunt een actief en enthousiast mannenkoor.',
        'Uw bijdrage helpt muzikale activiteiten mogelijk te maken.',
        'U blijft betrokken bij Zanggroep Spontaan.',
      ],
      validation: (rule) => rule.required().min(1).max(5),
    }),

    defineField({
      name: 'ctaImage',
      title: 'Afbeelding afsluitend blok',
      type: 'image',
      description:
        'Gebruik de koorfoto uit het goedgekeurde wireframe of een overeenkomstige mannenkoorfoto.',
      options: {
        hotspot: true,
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'ctaImageAlt',
      title: 'Alt-tekst afbeelding afsluitend blok',
      type: 'string',
      validation: (rule) => rule.required().max(160),
    }),

    defineField({
      name: 'ctaPrimaryButtonLabel',
      title: 'Tekst primaire CTA-knop',
      type: 'string',
      initialValue: 'Word vriend van Spontaan',
      validation: (rule) => rule.required().max(48),
    }),

    defineField({
      name: 'ctaPrimaryButtonLink',
      title: 'Link primaire CTA-knop',
      type: 'url',
      initialValue: './contact.html',
      validation: (rule) =>
        rule.required().uri({
          scheme: ['http', 'https'],
          allowRelative: true,
        }),
    }),

    defineField({
      name: 'ctaSecondaryButtonLabel',
      title: 'Tekst secundaire CTA-knop',
      type: 'string',
      initialValue: 'Neem contact op',
      validation: (rule) => rule.required().max(48),
    }),

    defineField({
      name: 'ctaSecondaryButtonLink',
      title: 'Link secundaire CTA-knop',
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
      subtitle: 'heroText',
      media: 'heroImage',
    },
  },
})
