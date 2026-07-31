import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {promisify} from 'node:util'
import test from 'node:test'

import {
  CONTACT_QUERY,
  embedSharedComponents,
  normalizeContactContent,
  renderContactPage,
  validateContactContent,
} from '../scripts/build-site.mjs'

const exec = promisify(execFile)
const fallback = JSON.parse(await readFile('data/contact-fallback.json', 'utf8'))
const template = await readFile('build/contact.template.html', 'utf8')

test('schema en singleton registreren contactPage-main', async () => {
  const [schema, types, singleton, structure] = await Promise.all([
    readFile('studio/schemaTypes/contactPage.ts', 'utf8'),
    readFile('studio/schemaTypes/index.ts', 'utf8'),
    readFile('studio/singletonTypes.ts', 'utf8'),
    readFile('studio/structure.ts', 'utf8'),
  ])
  assert.match(schema, /name: 'contactPage'/)
  assert.match(schema, /contactTopics/)
  assert.match(schema, /rule\.required\(\)\.length\(4\)/)
  assert.match(types, /contactPage/)
  assert.match(singleton, /CONTACT_PAGE_DOCUMENT_ID = 'contactPage-main'/)
  assert.match(singleton, /'contactPage'/)
  assert.match(structure, /Pagina Contact/)
})

test('CONTACT_QUERY gebruikt de vaste singleton en beide afbeeldingen', () => {
  assert.match(CONTACT_QUERY, /contactPage-main/)
  assert.match(CONTACT_QUERY, /heroImage\.asset->url/)
  assert.match(CONTACT_QUERY, /welcomeImage\.asset->url/)
  assert.match(CONTACT_QUERY, /contactTopics\[\]/)
})

test('productiefallback normaliseert en valideert alle definitieve content', () => {
  const content = normalizeContactContent(fallback)
  assert.doesNotThrow(() => validateContactContent(content))
  assert.equal(content.contactTopics.length, 4)
  assert.deepEqual(
    content.contactTopics.map(({title}) => title),
    ['Algemene vragen', 'Boekingen', 'Lid worden', 'Repetitie bezoeken'],
  )
  assert.equal(content.emailAddress, 'info@spontaan.nl')
  assert.equal(content.phoneNumber, '[DEMO] +31 6 0000 0000')
  assert.match(content.rehearsalLocation, /^\[DEMO\]/)
})

test('normalisatie accepteert veilige mail-, telefoon- en interne links', () => {
  const content = normalizeContactContent({
    ...fallback,
    emailAddress: ' CONTACT@EXAMPLE.NL ',
    phoneNumber: '+31 (0) 12 345 67 89',
    contactTopics: fallback.contactTopics.map((item, index) => ({
      ...item,
      linkTarget: index === 0 ? 'mailto:contact@example.nl' : index === 1 ? 'tel:+31123456789' : './agenda.html',
    })),
  })
  assert.equal(content.emailAddress, 'contact@example.nl')
  assert.equal(content.phoneNumber, '+31 (0) 12 345 67 89')
  assert.equal(content.contactTopics[0].linkTarget, 'mailto:contact@example.nl')
  assert.equal(content.contactTopics[1].linkTarget, 'tel:+31123456789')
  assert.equal(content.contactTopics[2].linkTarget, './agenda.html')
})

test('normalisatie weigert onveilige links, e-mailadressen en telefoonnummers', () => {
  const content = normalizeContactContent({
    ...fallback,
    emailAddress: 'geen-adres',
    phoneNumber: 'bel mij snel',
    agendaLink: 'javascript:alert(1)',
    contactTopics: fallback.contactTopics.map((item, index) => ({
      ...item,
      linkTarget: index === 0 ? 'javascript:alert(1)' : item.linkTarget,
    })),
  })
  assert.equal(content.emailAddress, '')
  assert.equal(content.phoneNumber, '')
  assert.equal(content.agendaLink, '')
  assert.equal(content.contactTopics[0].linkTarget, '')
  assert.doesNotThrow(() => validateContactContent(content))
  const html = renderContactPage(template, content, 'fallback')
  assert.doesNotMatch(html, /javascript:|geen-adres|bel mij snel/)
})

test('renderer escapt CMS-tekst en bevat alle definitieve secties zonder formulier', () => {
  const content = normalizeContactContent({
    ...fallback,
    heroTitle: '<script>alert("xss")</script>',
  })
  const html = renderContactPage(template, content, 'cms')
  assert.match(html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>alert\("xss"\)<\/script>/)
  assert.equal((html.match(/class="contact-topic-card"/g) || []).length, 4)
  assert.match(html, /contact-welcome/)
  assert.match(html, /contact-direct/)
  assert.match(html, /contact-practical/)
  assert.match(html, /contact-faq/)
  assert.doesNotMatch(html, /<form\b/i)
  assert.doesNotMatch(html, /#formulier|id="formulier"/)
  assert.doesNotMatch(html, /api\.sanity\.io/)
})

test('renderer maakt toegankelijke mail- en telefoonlinks wanneer gegevens bestaan', () => {
  const content = normalizeContactContent({
    ...fallback,
    phoneNumber: '+31 12 345 67 89',
  })
  const html = renderContactPage(template, content, 'cms')
  assert.match(html, /href="mailto:info@spontaan\.nl"/)
  assert.match(html, /href="tel:\+31123456789"/)
  assert.doesNotMatch(html, /data-contact-phone-unavailable/)
})

test('renderer verbergt ontbrekende optionele gegevens volledig', () => {
  const content = normalizeContactContent({
    ...fallback,
    heroEyebrow: '',
    emailAddress: '',
    phoneNumber: '',
    availabilityText: '',
    rehearsalInvitation: '',
    rehearsalTimes: '',
    rehearsalLocation: '',
    address: '',
    agendaLinkLabel: '',
    agendaLink: '',
    aboutLinkLabel: '',
    aboutLink: '',
    closingCtaText: '',
  })
  const html = renderContactPage(template, content, 'fallback')
  assert.doesNotMatch(html, /tel:/)
  assert.doesNotMatch(html, /data-contact-hero-actions|data-contact-direct-options/)
  assert.doesNotMatch(html, /data-contact-availability|data-contact-rehearsal-invitation/)
  assert.doesNotMatch(html, /data-contact-welcome-links|data-contact-practical-links/)
  assert.doesNotMatch(html, /Repetitietijden|Locatie|Adres/)
  assert.doesNotMatch(html, /data-contact-closing-cta/)
  assert.doesNotMatch(html, /nog niet gepubliceerd/i)
})

test('onderwerp zonder veilig linkdoel wordt zonder lege link gerenderd', () => {
  const content = normalizeContactContent({
    ...fallback,
    contactTopics: fallback.contactTopics.map((item, index) => (
      index === 0 ? {...item, linkTarget: 'javascript:alert(1)'} : item
    )),
  })
  const html = renderContactPage(template, content, 'cms')
  const firstCard = html.match(/<article class="contact-topic-card">[\s\S]*?<\/article>/)?.[0] ?? ''
  assert.match(firstCard, /Algemene vragen/)
  assert.doesNotMatch(firstCard, /<a\b/)
  assert.equal((html.match(/class="contact-topic-card__link"/g) || []).length, 3)
  assert.equal((html.match(/class="contact-topic-card__icon"/g) || []).length, 4)
})

test('hero en welkomstafbeelding hebben vaste dimensies en juiste laadprioriteit', () => {
  const html = renderContactPage(template, normalizeContactContent(fallback), 'fallback')
  const heroImage = html.match(/<img(?=[^>]*data-contact-hero-image)[^>]*>/)?.[0] ?? ''
  const welcomeImage = html.match(/<img(?=[^>]*data-contact-welcome-image)[^>]*>/)?.[0] ?? ''
  for (const attribute of ['class="contact-hero__image"', 'width="1672"', 'height="941"', 'loading="eager"', 'fetchpriority="high"']) {
    assert.match(heroImage, new RegExp(attribute))
  }
  for (const attribute of ['width="1672"', 'height="941"', 'loading="lazy"']) {
    assert.match(welcomeImage, new RegExp(attribute))
  }
})

test('gedeelde navigatie en footer worden elk precies eenmaal ingebed', async () => {
  const rendered = renderContactPage(template, normalizeContactContent(fallback), 'cms')
  const html = embedSharedComponents(
    rendered,
    await readFile('components/nav.html', 'utf8'),
    await readFile('components/footer.html', 'utf8'),
  )
  assert.equal((html.match(/<nav id="nav"/g) || []).length, 1)
  assert.equal((html.match(/<footer class="site-footer"/g) || []).length, 1)
  assert.doesNotMatch(html, /<div id="nav-placeholder"><\/div>/)
  assert.doesNotMatch(html, /<div id="footer-placeholder"><\/div>/)
})

test('gerichte build levert CMS- en fallbackoutput zonder runtime-Sanity-fetch', async () => {
  const common = {
    ...process.env,
    MEDIA_BUILD_FIXTURE: 'tests/fixtures/media-cms.json',
    REPERTOIRE_BUILD_FIXTURE: 'tests/fixtures/repertoire-cms.json',
    FRIENDS_BUILD_FIXTURE: 'tests/fixtures/friends-cms.json',
    ABOUT_BUILD_FIXTURE: 'data/about-fallback.json',
  }
  const cmsRun = await exec(process.execPath, ['scripts/build-site.mjs'], {
    env: {...common, CONTACT_BUILD_FIXTURE: 'data/contact-fallback.json'},
  })
  assert.match(cmsRun.stdout, /CONTACT BUILD: cms -> dist\/pages\/contact\.html/)
  let html = await readFile('dist/pages/contact.html', 'utf8')
  assert.match(html, /data-contact-source="cms"/)
  assert.match(html, /dataset\.contactSource="cms"/)
  assert.doesNotMatch(html, /api\.sanity\.io/)
  assert.equal((html.match(/<nav id="nav"/g) || []).length, 1)
  assert.equal((html.match(/<footer class="site-footer"/g) || []).length, 1)

  const fallbackRun = await exec(process.execPath, ['scripts/build-site.mjs'], {
    env: {...common, CONTACT_BUILD_FIXTURE: 'tests/fixtures/media-error.json'},
  })
  assert.match(fallbackRun.stdout, /CONTACT BUILD: fallback -> dist\/pages\/contact\.html/)
  html = await readFile('dist/pages/contact.html', 'utf8')
  assert.match(html, /data-contact-source="fallback"/)
  assert.match(html, /dataset\.contactSource="fallback"/)
  assert.doesNotMatch(html, /<form\b|#formulier|api\.sanity\.io/i)
})
