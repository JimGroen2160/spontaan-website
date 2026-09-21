import {defineField, defineType} from 'sanity'

export const agendaPage = defineType({
  name: 'agendaPage',
  title: 'Pagina Agenda',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Interne titel',
      type: 'string',
      initialValue: 'Agenda',
      validation: (rule) => rule.required().max(96),
    }),

    defineField({
      name: 'heroTitle',
      title: 'Hero-titel',
      type: 'string',
      initialValue: 'Agenda',
      validation: (rule) => rule.required().max(96),
    }),

    defineField({
      name: 'heroSubtitle',
      title: 'Hero-ondertitel',
      type: 'text',
      rows: 2,
      initialValue:
        'Bekijk waar en wanneer Zanggroep Spontaan te horen is.',
      validation: (rule) => rule.required().max(220),
    }),

    defineField({
      name: 'heroImage',
      title: 'Hero-afbeelding',
      type: 'image',
      description:
        'Gebruik een brede liggende foto. Bij voorkeur 1920 x 1080 pixels of groter. Zet belangrijke personen of onderwerpen niet tegen de randen.',
      options: {
        hotspot: true,
      },
      validation: (rule) => rule.required(),
    }),


    defineField({
      name: 'heroGlow',
      title: 'Gloed over foto',
      type: 'string',
      description:
        'Kies hoe sterk de gekleurde gloed over de grote foto moet zijn.',
      initialValue: 'normal',
      options: {
        list: [
          {title: 'Geen', value: 'none'},
          {title: 'Licht', value: 'light'},
          {title: 'Normaal', value: 'normal'},
          {title: 'Sterk', value: 'strong'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
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
