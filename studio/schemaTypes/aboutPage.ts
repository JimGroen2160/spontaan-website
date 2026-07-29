import {defineArrayMember, defineField, defineType} from 'sanity'

const requiredLink = (rule: any) =>
  rule.required().uri({scheme: ['http', 'https'], allowRelative: true})

const paragraphs = (name: string, title: string, group: string) =>
  defineField({
    name,
    title,
    group,
    type: 'array',
    of: [defineArrayMember({type: 'text', rows: 3, validation: (rule) => rule.required().max(500)})],
    validation: (rule) => rule.required().min(1).max(3),
  })

const cardItems = (name: string, title: string, group: string) =>
  defineField({
    name,
    title,
    group,
    type: 'array',
    of: [defineArrayMember({
      type: 'object',
      fields: [
        defineField({name: 'title', title: 'Titel', type: 'string', validation: (rule) => rule.required().max(80)}),
        defineField({name: 'text', title: 'Tekst', type: 'text', rows: 3, validation: (rule) => rule.required().max(300)}),
      ],
    })],
    validation: (rule) => rule.required().length(4),
  })

export const aboutPage = defineType({
  name: 'aboutPage',
  title: 'Pagina Over Spontaan',
  type: 'document',
  groups: [
    {name: 'seo', title: 'SEO'},
    {name: 'hero', title: 'Hero'},
    {name: 'intro', title: 'Introductie'},
    {name: 'timeline', title: 'Tijdlijn'},
    {name: 'values', title: 'Missie en waarden'},
    {name: 'quote', title: 'Citaat'},
    {name: 'atmosphere', title: 'Sfeer en verhaal'},
    {name: 'cta', title: 'CTA'},
  ],
  fields: [
    defineField({name: 'title', title: 'Interne titel', type: 'string', initialValue: 'Over Spontaan', validation: (rule) => rule.required().max(96)}),
    defineField({name: 'isTestData', title: 'Testdata', type: 'boolean', hidden: true, readOnly: true, initialValue: false}),
    defineField({name: 'seoTitle', title: 'SEO-titel', type: 'string', group: 'seo', validation: (rule) => rule.required().max(70)}),
    defineField({name: 'seoDescription', title: 'SEO-beschrijving', type: 'text', rows: 3, group: 'seo', validation: (rule) => rule.required().max(170)}),
    defineField({name: 'heroTitle', title: 'Hero-titel', type: 'string', group: 'hero', validation: (rule) => rule.required().max(96)}),
    defineField({name: 'heroSubtitle', title: 'Hero-ondertitel', type: 'text', rows: 3, group: 'hero', validation: (rule) => rule.required().max(240)}),
    defineField({name: 'heroImage', title: 'Hero-afbeelding', type: 'image', group: 'hero', options: {hotspot: true}, validation: (rule) => rule.required()}),
    defineField({name: 'heroImageAlt', title: 'Alt-tekst hero', type: 'string', group: 'hero', validation: (rule) => rule.required().max(160)}),
    defineField({name: 'introEyebrow', title: 'Bovenregel introductie', type: 'string', group: 'intro', validation: (rule) => rule.required().max(80)}),
    defineField({name: 'introTitle', title: 'Titel introductie', type: 'string', group: 'intro', validation: (rule) => rule.required().max(120)}),
    paragraphs('introText', 'Teksten introductie', 'intro'),
    defineField({name: 'introImage', title: 'Afbeelding introductie', type: 'image', group: 'intro', options: {hotspot: true}, validation: (rule) => rule.required()}),
    defineField({name: 'introImageAlt', title: 'Alt-tekst introductie', type: 'string', group: 'intro', validation: (rule) => rule.required().max(160)}),
    defineField({name: 'timelineEyebrow', title: 'Bovenregel tijdlijn', type: 'string', group: 'timeline', validation: (rule) => rule.required().max(80)}),
    defineField({name: 'timelineTitle', title: 'Titel tijdlijn', type: 'string', group: 'timeline', validation: (rule) => rule.required().max(120)}),
    defineField({name: 'timelineIntro', title: 'Introductie tijdlijn', type: 'text', rows: 2, group: 'timeline', validation: (rule) => rule.max(300)}),
    cardItems('timelineItems', 'Tijdlijnonderdelen', 'timeline'),
    defineField({name: 'valuesEyebrow', title: 'Bovenregel waarden', type: 'string', group: 'values', validation: (rule) => rule.required().max(80)}),
    defineField({name: 'valuesTitle', title: 'Titel waarden', type: 'string', group: 'values', validation: (rule) => rule.required().max(120)}),
    cardItems('valuesItems', 'Waarden', 'values'),
    defineField({name: 'quote', title: 'Citaat', type: 'text', rows: 3, group: 'quote', validation: (rule) => rule.required().max(280)}),
    defineField({name: 'quoteAttribution', title: 'Bron citaat', type: 'string', group: 'quote', validation: (rule) => rule.max(100)}),
    defineField({name: 'atmosphereEyebrow', title: 'Bovenregel sfeer', type: 'string', group: 'atmosphere', validation: (rule) => rule.required().max(80)}),
    defineField({name: 'atmosphereTitle', title: 'Titel sfeer', type: 'string', group: 'atmosphere', validation: (rule) => rule.required().max(120)}),
    paragraphs('atmosphereText', 'Teksten sfeer', 'atmosphere'),
    defineField({name: 'atmosphereImage', title: 'Afbeelding sfeer', type: 'image', group: 'atmosphere', options: {hotspot: true}, validation: (rule) => rule.required()}),
    defineField({name: 'atmosphereImageAlt', title: 'Alt-tekst sfeer', type: 'string', group: 'atmosphere', validation: (rule) => rule.required().max(160)}),
    defineField({name: 'ctaEyebrow', title: 'Bovenregel CTA', type: 'string', group: 'cta', validation: (rule) => rule.required().max(80)}),
    defineField({name: 'ctaTitle', title: 'Titel CTA', type: 'string', group: 'cta', validation: (rule) => rule.required().max(120)}),
    defineField({name: 'ctaText', title: 'Tekst CTA', type: 'text', rows: 3, group: 'cta', validation: (rule) => rule.required().max(300)}),
    defineField({name: 'primaryButtonLabel', title: 'Tekst primaire knop', type: 'string', group: 'cta', validation: (rule) => rule.required().max(48)}),
    defineField({name: 'primaryButtonLink', title: 'Link primaire knop', type: 'url', group: 'cta', validation: requiredLink}),
    defineField({name: 'secondaryButtonLabel', title: 'Tekst secundaire knop', type: 'string', group: 'cta', validation: (rule) => rule.required().max(48)}),
    defineField({name: 'secondaryButtonLink', title: 'Link secundaire knop', type: 'url', group: 'cta', validation: requiredLink}),
  ],
  preview: {select: {title: 'title', subtitle: 'heroSubtitle', media: 'heroImage'}},
})
