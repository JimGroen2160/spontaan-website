import {defineArrayMember, defineField, defineType} from 'sanity'

const reference = defineArrayMember({type: 'reference', to: [{type: 'repertoireItem'}]})

export const repertoirePage = defineType({
  name: 'repertoirePage',
  title: 'Pagina Muziek en repertoire',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Interne titel', type: 'string', initialValue: 'Muziek en repertoire', validation: (rule) => rule.required().max(96)}),
    defineField({name: 'isTestData', title: 'Testdata', type: 'boolean', hidden: true, readOnly: true, initialValue: false}),
    defineField({name: 'heroTitle', title: 'Hero-titel', type: 'string', validation: (rule) => rule.required().max(96)}),
    defineField({name: 'heroSubtitle', title: 'Hero-ondertitel', type: 'text', rows: 2, validation: (rule) => rule.required().max(220)}),
    defineField({name: 'heroImage', title: 'Hero-afbeelding', type: 'image', options: {hotspot: true}, validation: (rule) => rule.required()}),
    defineField({name: 'heroImageAlt', title: 'Alt-tekst hero-afbeelding', type: 'string', validation: (rule) => rule.max(160)}),
    defineField({name: 'featuredItem', title: 'Uitgelicht lied', type: 'reference', to: [{type: 'repertoireItem'}], validation: (rule) => rule.required()}),
    defineField({name: 'worldsTitle', title: 'Titel muzikale werelden', type: 'string', validation: (rule) => rule.required().max(120)}),
    defineField({name: 'worldsIntro', title: 'Inleiding muzikale werelden', type: 'text', rows: 2, validation: (rule) => rule.required().max(300)}),
    defineField({
      name: 'worlds', title: 'Muzikale werelden', type: 'array',
      of: [defineArrayMember({
        name: 'repertoireWorld', title: 'Muzikale wereld', type: 'object',
        fields: [
          defineField({name: 'number', title: 'Nummer', type: 'string', validation: (rule) => rule.required().max(3)}),
          defineField({name: 'title', title: 'Titel', type: 'string', validation: (rule) => rule.required().max(80)}),
          defineField({name: 'description', title: 'Beschrijving', type: 'text', rows: 2, validation: (rule) => rule.required().max(220)}),
          defineField({name: 'items', title: 'Liederen', type: 'array', of: [reference], validation: (rule) => rule.required().min(1)}),
        ],
      })],
      validation: (rule) => rule.required().length(3),
    }),
    defineField({name: 'processTitle', title: 'Titel werkproces', type: 'string', validation: (rule) => rule.required().max(120)}),
    defineField({
      name: 'processSteps', title: 'Stappen werkproces', type: 'array',
      of: [defineArrayMember({
        name: 'processStep', title: 'Processtap', type: 'object',
        fields: [
          defineField({name: 'title', title: 'Titel', type: 'string', validation: (rule) => rule.required().max(60)}),
          defineField({name: 'description', title: 'Beschrijving', type: 'text', rows: 2, validation: (rule) => rule.required().max(220)}),
        ],
      })],
      validation: (rule) => rule.required().length(4),
    }),
    defineField({name: 'selectionTitle', title: 'Titel repertoireselectie', type: 'string', validation: (rule) => rule.required().max(120)}),
    defineField({name: 'selectionItems', title: 'Repertoireselectie', type: 'array', of: [reference], validation: (rule) => rule.required().min(1)}),
    defineField({name: 'quote', title: 'Citaat', type: 'text', rows: 2, validation: (rule) => rule.required().max(280)}),
    defineField({name: 'quoteAttribution', title: 'Bron citaat', type: 'string', validation: (rule) => rule.required().max(100)}),
    defineField({name: 'ctaEyebrow', title: 'Bovenregel CTA', type: 'string', validation: (rule) => rule.required().max(80)}),
    defineField({name: 'ctaTitle', title: 'Titel CTA', type: 'string', validation: (rule) => rule.required().max(120)}),
    defineField({name: 'ctaText', title: 'Tekst CTA', type: 'text', rows: 2, validation: (rule) => rule.required().max(280)}),
    defineField({name: 'primaryButtonLabel', title: 'Tekst primaire knop', type: 'string', validation: (rule) => rule.required().max(48)}),
    defineField({name: 'primaryButtonLink', title: 'Link primaire knop', type: 'url', validation: (rule) => rule.required().uri({scheme: ['http', 'https'], allowRelative: true})}),
    defineField({name: 'secondaryButtonLabel', title: 'Tekst secundaire knop', type: 'string', validation: (rule) => rule.required().max(48)}),
    defineField({name: 'secondaryButtonLink', title: 'Link secundaire knop', type: 'url', validation: (rule) => rule.required().uri({scheme: ['http', 'https'], allowRelative: true})}),
  ],
  preview: {select: {title: 'title', subtitle: 'heroSubtitle', media: 'heroImage'}},
})
