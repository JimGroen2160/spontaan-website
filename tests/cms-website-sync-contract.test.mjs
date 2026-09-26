import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const read = (file) => readFile(file, 'utf8')

test('Websitebeheer behoudt exact de afgesproken hoofdvolgorde', async () => {
  const source = await read('studio/structure.ts')
  const tokens = [
    "'homePage',",
    "'aboutPage',",
    "'agendaPage',",
    "'eventItem',",
    "'mediaPage',",
    "'photoAlbum',",
    "'audioItem',",
    "'videoItem',",
    "'repertoirePage',",
    "'repertoireItem',",
    "'newsPage',",
    "'newsItem',",
    "'friendsPage',",
    ".id('friendItem')",
    "'contactPage',",
    ".id('ledenadministratie')",
  ]

  let previous = -1

  for (const token of tokens) {
    const position = source.indexOf(token)
    assert.notEqual(position, -1, `Studio-onderdeel ontbreekt: ${token}`)
    assert.ok(position > previous, `Studio-volgorde fout bij: ${token}`)
    previous = position
  }
})

test('Pagina Agenda bevat alle publieke hero-velden', async () => {
  const source = await read('studio/schemaTypes/agendaPage.ts')

  for (const field of ['heroTitle', 'heroSubtitle', 'heroImage', 'heroGlow']) {
    assert.match(source, new RegExp(`name:\\s*'${field}'`))
  }
})

test('Agenda-item afbeelding loopt van CMS-query tot zichtbare eventkaart', async () => {
  const source = await read('js/agenda.js')

  assert.match(source, /"imageUrl": mainImage\.asset->url/)
  assert.match(source, /mainImageAlt/)

  const start = source.indexOf('function createEventCard(item)')
  const end = source.indexOf('function sortEventsForDisplay')

  assert.ok(start >= 0 && end > start, 'createEventCard kon niet worden afgebakend')

  const renderer = source.slice(start, end)

  assert.match(renderer, /item\.imageUrl/, 'Agenda-renderer gebruikt de CMS-afbeelding niet')
  assert.match(renderer, /createElement\(['"]img['"]\)/, 'Agenda-renderer maakt geen img-element')
  assert.match(renderer, /item\.imageAlt/, 'Agenda-renderer gebruikt de alt-tekst niet')
})

test('Agenda hero wordt daadwerkelijk vanuit dezelfde CMS-response toegepast', async () => {
  const source = await read('js/agenda.js')

  assert.match(source, /"page":/)
  assert.match(source, /"heroImageUrl": heroImage\.asset->url/)
  assert.match(source, /heroGlow/)
  assert.match(source, /applyHero\(agendaData\.hero\)/)
  assert.match(source, /hero\.style\.backgroundImage/)
})
