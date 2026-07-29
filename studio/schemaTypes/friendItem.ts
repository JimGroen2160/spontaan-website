import {defineField, defineType} from 'sanity'

export const friendItem = defineType({
  name: 'friendItem',
  title: 'Vriend of sponsor',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Interne titel',
      type: 'string',
      description:
        'Alleen zichtbaar in Sanity Studio. Gebruik bijvoorbeeld de bedrijfsnaam.',
      validation: (rule) => rule.required().max(120),
    }),

    defineField({
      name: 'publicName',
      title: 'Publieke naam',
      type: 'string',
      description:
        'De naam die op de website bij het logo of de foto wordt getoond.',
      validation: (rule) => rule.required().max(120),
    }),

    defineField({
      name: 'friendType',
      title: 'Type vriend',
      type: 'string',
      initialValue: 'bedrijf',
      options: {
        list: [
          {title: 'Bedrijf', value: 'bedrijf'},
          {title: 'Organisatie', value: 'organisatie'},
          {title: 'Particulier', value: 'particulier'},
          {title: 'Overige ondersteuner', value: 'overig'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'image',
      title: 'Logo of foto',
      type: 'image',
      description:
        'Upload het bedrijfslogo of een passende foto van deze vriend van Spontaan.',
      options: {
        hotspot: true,
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'imageDisplay',
      title: 'Afbeelding weergeven als',
      type: 'string',
      initialValue: 'logo',
      options: {
        list: [
          {title: 'Logo', value: 'logo'},
          {title: 'Foto', value: 'foto'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'imageAlt',
      title: 'Alt-tekst logo of foto',
      type: 'string',
      description:
        'Beschrijf de afbeelding kort en duidelijk voor bezoekers die deze niet kunnen zien.',
      validation: (rule) => rule.required().max(160),
    }),

    defineField({
      name: 'description',
      title: 'Korte omschrijving',
      type: 'text',
      rows: 3,
      description:
        'Optionele korte toelichting bij deze vriend of sponsor.',
      validation: (rule) => rule.max(320),
    }),

    defineField({
      name: 'website',
      title: 'Website',
      type: 'url',
      description:
        'Optioneel. Alleen veilige relatieve links en http- of https-adressen worden toegestaan.',
      validation: (rule) =>
        rule.uri({
          scheme: ['http', 'https'],
          allowRelative: true,
        }),
    }),

    defineField({
      name: 'isVisible',
      title: 'Zichtbaar op de website',
      type: 'boolean',
      initialValue: true,
      description:
        'Schakel dit uit om het item tijdelijk te verbergen zonder het te verwijderen.',
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'isFeatured',
      title: 'Uitgelicht',
      type: 'boolean',
      initialValue: false,
      description:
        'Kan later worden gebruikt om een vriend extra nadruk te geven.',
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'sortOrder',
      title: 'Sorteervolgorde',
      type: 'number',
      initialValue: 100,
      description:
        'Een lager nummer wordt eerder op de pagina getoond.',
      validation: (rule) => rule.required().integer().min(0).max(9999),
    }),

    defineField({
      name: 'publishFrom',
      title: 'Tonen vanaf',
      type: 'datetime',
      description:
        'Optioneel. Laat leeg om het item direct te kunnen tonen.',
    }),

    defineField({
      name: 'publishUntil',
      title: 'Tonen tot',
      type: 'datetime',
      description:
        'Optioneel. Laat leeg wanneer geen einddatum nodig is.',
      validation: (rule) =>
        rule.custom((value, context) => {
          const publishFrom = context.document?.publishFrom

          if (
            value &&
            publishFrom &&
            new Date(String(value)).getTime() <=
              new Date(String(publishFrom)).getTime()
          ) {
            return 'De einddatum moet na de begindatum liggen.'
          }

          return true
        }),
    }),
  ],

  orderings: [
    {
      title: 'Sorteervolgorde',
      name: 'sortOrderAscending',
      by: [
        {field: 'sortOrder', direction: 'asc'},
        {field: 'publicName', direction: 'asc'},
      ],
    },
    {
      title: 'Naam',
      name: 'publicNameAscending',
      by: [{field: 'publicName', direction: 'asc'}],
    },
  ],

  preview: {
    select: {
      title: 'publicName',
      friendType: 'friendType',
      visible: 'isVisible',
      media: 'image',
    },

    prepare({title, friendType, visible, media}) {
      const typeLabels: Record<string, string> = {
        bedrijf: 'Bedrijf',
        organisatie: 'Organisatie',
        particulier: 'Particulier',
        overig: 'Overige ondersteuner',
      }

      const visibility = visible ? 'zichtbaar' : 'verborgen'
      const typeLabel = typeLabels[friendType] ?? 'Vriend'

      return {
        title,
        subtitle: `${typeLabel} · ${visibility}`,
        media,
      }
    },
  },
})
