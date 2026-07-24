import {defineField, defineType} from 'sanity'

export const repertoireItem = defineType({
  name: 'repertoireItem',
  title: 'Repertoire-item',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Titel', type: 'string', validation: (rule) => rule.required().max(120)}),
    defineField({name: 'summary', title: 'Korte omschrijving', type: 'text', rows: 2, validation: (rule) => rule.max(240)}),
    defineField({name: 'story', title: 'Verhaal bij het lied', type: 'text', rows: 5, validation: (rule) => rule.max(800)}),
    defineField({name: 'audioFile', title: 'Audiofragment', type: 'file', options: {accept: 'audio/*'}}),
    defineField({name: 'audioDescription', title: 'Beschrijving audiofragment', type: 'string', validation: (rule) => rule.max(160)}),
    defineField({name: 'isVisible', title: 'Zichtbaar', type: 'boolean', initialValue: true}),
    defineField({name: 'isTestData', title: 'Testdata', type: 'boolean', hidden: true, readOnly: true, initialValue: false}),
  ],
  preview: {select: {title: 'title', subtitle: 'summary'}},
})
