import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {promisify} from 'node:util'
import test from 'node:test'

import {
  ABOUT_QUERY,
  normalizeAboutContent,
  renderAboutPage,
  validateAboutContent,
} from '../scripts/build-site.mjs'

const exec = promisify(execFile)

const TEST_BROWSER_SUPABASE_ENV = {
  SUPABASE_URL: 'https://synthetic-test-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_only',
}

const fallback = JSON.parse(await readFile('data/about-fallback.json', 'utf8'))

test('schema en singleton registreren aboutPage-main', async () => {
  const [schema, types, singleton, structure] = await Promise.all([
    readFile('studio/schemaTypes/aboutPage.ts', 'utf8'),
    readFile('studio/schemaTypes/index.ts', 'utf8'),
    readFile('studio/singletonTypes.ts', 'utf8'),
    readFile('studio/structure.ts', 'utf8'),
  ])
  assert.match(schema, /name: 'aboutPage'/)
  assert.match(schema, /timelineItems/)
  assert.match(schema, /rule\.required\(\)\.length\(4\)/)
  assert.match(types, /aboutPage/)
  assert.match(singleton, /ABOUT_PAGE_DOCUMENT_ID = 'aboutPage-main'/)
  assert.match(singleton, /'aboutPage'/)
  assert.match(structure, /Pagina Over Spontaan/)
})

test('query gebruikt de vaste singleton en alle drie afbeeldingen', () => {
  assert.match(ABOUT_QUERY, /aboutPage-main/)
  assert.match(ABOUT_QUERY, /heroImage\.asset->url/)
  assert.match(ABOUT_QUERY, /introImage\.asset->url/)
  assert.match(ABOUT_QUERY, /atmosphereImage\.asset->url/)
})

test('fallback normaliseert en valideert exact vier tijdlijnitems', () => {
  const content = normalizeAboutContent(fallback)
  assert.doesNotThrow(() => validateAboutContent(content))
  assert.equal(content.timelineItems.length, 4)
  assert.equal(content.valuesItems.length, 4)
})

test('ontbrekende kerncontent en verkeerd aantal tijdlijnitems worden geweigerd', () => {
  const missing = normalizeAboutContent({...fallback, heroTitle: ''})
  assert.throws(() => validateAboutContent(missing), /verplichte Over-paginavelden/i)
  const wrongTimeline = normalizeAboutContent({...fallback, timelineItems: fallback.timelineItems.slice(0, 3)})
  assert.throws(() => validateAboutContent(wrongTimeline), /exact vier/)
})

test('normalisatie weigert onveilige links en accepteert veilige links', () => {
  const unsafe = normalizeAboutContent({...fallback, primaryButtonLink: 'javascript:alert(1)'})
  assert.equal(unsafe.primaryButtonLink, '')
  const safe = normalizeAboutContent({...fallback, primaryButtonLink: './contact.html'})
  assert.equal(safe.primaryButtonLink, './contact.html')
})

test('renderer escapt tekst en bouwt SEO, afbeeldingen, CTA en bronmarkering', async () => {
  const template = await readFile('build/about.template.html', 'utf8')
  const content = normalizeAboutContent({...fallback, heroTitle: '<script>alert(1)</script>'})
  const html = renderAboutPage(template, content, 'cms')
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.match(html, /data-content-source="cms"/)
  assert.match(html, /Over Spontaan \| Zanggroep Spontaan/)
  assert.match(html, /over-intro-mannenkoor\.jpg/)
  assert.match(html, /over-sfeer-mannenkoor\.jpg/)
  assert.match(html, /Neem contact op/)
  assert.doesNotMatch(html, /api\.sanity\.io/)
})

test('build maakt CMS- en fallbackvariant zonder runtime Sanity-fetch', async () => {
  const common = {
    ...process.env,
    ...TEST_BROWSER_SUPABASE_ENV,
    MEDIA_BUILD_FIXTURE: 'tests/fixtures/media-cms.json',
    REPERTOIRE_BUILD_FIXTURE: 'tests/fixtures/repertoire-cms.json',
    FRIENDS_BUILD_FIXTURE: 'tests/fixtures/friends-cms.json',
  }
  const cms = await exec(process.execPath, ['scripts/build-site.mjs'], {
    env: {...common, ABOUT_BUILD_FIXTURE: 'data/about-fallback.json'},
  })
  assert.match(cms.stdout, /ABOUT BUILD: cms -> dist\/pages\/over\.html/)
  let html = await readFile('dist/pages/over.html', 'utf8')
  assert.match(html, /data-content-source="cms"/)
  assert.doesNotMatch(html, /api\.sanity\.io/)
  const fallbackRun = await exec(process.execPath, ['scripts/build-site.mjs'], {
    env: {...common, ABOUT_BUILD_FIXTURE: 'tests/fixtures/media-error.json'},
  })
  assert.match(fallbackRun.stdout, /ABOUT BUILD: fallback -> dist\/pages\/over\.html/)
  html = await readFile('dist/pages/over.html', 'utf8')
  assert.match(html, /data-content-source="fallback"/)
})
