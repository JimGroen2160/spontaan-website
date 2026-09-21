import test from 'node:test'
import assert from 'node:assert/strict'
import {access, readFile} from 'node:fs/promises'

const read = (file) => readFile(file, 'utf8')

test('alle acht openbare hoofdpaginas hebben hero-beheer', async () => {
  const schemaFiles = [
    'studio/schemaTypes/homePage.ts',
    'studio/schemaTypes/aboutPage.ts',
    'studio/schemaTypes/agendaPage.ts',
    'studio/schemaTypes/mediaPage.ts',
    'studio/schemaTypes/repertoirePage.ts',
    'studio/schemaTypes/newsPage.ts',
    'studio/schemaTypes/friendsPage.ts',
    'studio/schemaTypes/contactPage.ts',
  ]

  for (const file of schemaFiles) {
    const content = await read(file)
    assert.match(content, /name:\s*'heroImage'/)
    assert.match(content, /name:\s*'heroGlow'/)

    for (const value of ['none', 'light', 'normal', 'strong']) {
      assert.match(content, new RegExp(`value:\\s*'${value}'`))
    }
  }
})

test('Agenda en Nieuws zijn vaste beheerpaginas', async () => {
  const singleton = await read('studio/singletonTypes.ts')
  const structure = await read('studio/structure.ts')
  assert.match(singleton, /agendaPage-main/)
  assert.match(singleton, /newsPage-main/)
  assert.match(structure, /Pagina Agenda/)
  assert.match(structure, /Pagina Nieuws/)
})

test('geen openbare hoofdpagina laadt public-hero.js', async () => {
  const files = [
    'build/home.template.html',
    'build/about.template.html',
    'build/contact.template.html',
    'build/friends.template.html',
    'build/media.template.html',
    'build/repertoire.template.html',
    'pages/agenda.html',
    'pages/nieuws.html',
  ]

  for (const file of files) {
    assert.doesNotMatch(await read(file), /public-hero\.js/)
  }

  await assert.rejects(access('js/public-hero.js'))
})

test('Agenda gebruikt een request voor hero en agenda-items', async () => {
  const script = await read('js/agenda.js')
  const page = await read('pages/agenda.html')
  assert.match(script, /agendaPage-main/)
  assert.match(script, /"page":/)
  assert.match(script, /"items":/)
  assert.match(script, /_type == "eventItem"/)
  assert.match(script, /async function fetchAgendaData/)
  assert.match(script, /applyHero\(agendaData\.hero\)/)
  assert.equal((script.match(/\bfetch\s*\(/g) || []).length, 1)
  assert.match(page, /data-public-hero/)
  assert.match(page, /data-hero-glow="normal"/)
  assert.match(page, /data-public-hero-title/)
  assert.match(page, /data-public-hero-subtitle/)
  assert.doesNotMatch(page, /data-public-hero-document/)
})

test('Nieuws gebruikt een request voor hero en nieuwsitems', async () => {
  const script = await read('js/nieuws.js')
  const page = await read('pages/nieuws.html')
  assert.match(script, /newsPage-main/)
  assert.match(script, /"page":/)
  assert.match(script, /"items":/)
  assert.match(script, /_type == "newsItem"/)
  assert.match(script, /async function fetchNewsData/)
  assert.match(script, /applyHero\(newsData\.hero\)/)
  assert.equal((script.match(/\bfetch\s*\(/g) || []).length, 1)
  assert.match(page, /data-public-hero/)
  assert.match(page, /data-hero-glow="normal"/)
  assert.match(page, /data-public-hero-title/)
  assert.match(page, /data-public-hero-subtitle/)
  assert.doesNotMatch(page, /data-public-hero-document/)
})

test('runtime-heros ondersteunen vier gloedstanden en fallback', async () => {
  const agenda = await read('js/agenda.js')
  const news = await read('js/nieuws.js')
  const css = await read('css/style.css')

  for (const value of ['none', 'light', 'normal', 'strong']) {
    assert.match(agenda, new RegExp(`'${value}'`))
    assert.match(news, new RegExp(`'${value}'`))
    assert.match(css, new RegExp(`data-hero-glow="${value}"`))
  }

  assert.match(agenda, /if\s*\(!content\)\s*\{\s*return;\s*\}/)
  assert.match(news, /if\s*\(!content\)\s*\{\s*return;\s*\}/)
})

test('zes build-time paginas behouden het hero-contract', async () => {
  const build = await read('scripts/build-site.mjs')

  for (const file of [
    'build/contact.template.html',
    'build/friends.template.html',
    'build/media.template.html',
  ]) {
    const content = await read(file)
    assert.match(content, /data-public-hero/)
    assert.match(content, /data-hero-glow="normal"/)
    assert.match(content, /public-hero-glow/)
  }

  for (const file of [
    'build/home.template.html',
    'build/about.template.html',
    'build/repertoire.template.html',
  ]) {
    assert.match(await read(file), /public-hero-glow/)
  }

  assert.match(build, /<header class="hero" data-public-hero data-hero-glow=/)
  assert.match(build, /<header class="about-hero" data-about-hero data-public-hero data-hero-glow=/)
  assert.match(build, /<header class="repertoire-hero" data-public-hero data-hero-glow=/)
  assert.match(build, /Vrienden hero-gloed/)
  assert.match(build, /Beeld en Geluid hero-gloed/)
  assert.match(build, /Contact hero-gloed/)
  assert.doesNotMatch(build, /public-hero\.js/)
})
