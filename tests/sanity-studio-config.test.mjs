import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const sanityConfigPath = 'studio/sanity.config.ts'
const singletonTypesPath = 'studio/singletonTypes.ts'
const ciPath = '.github/workflows/ci.yml'
const structurePath = 'studio/structure.ts'
const ledenadministratiePanePath =
  'studio/components/LedenadministratiePane.tsx'

const expectedSingletonTypes = [
  'aboutPage',
  'contactPage',
  'friendsPage',
  'homePage',
  'mediaPage',
  'repertoirePage',
]

test('singletonset bevat exact de zes vaste CMS-paginatypen', async () => {
  const source = await readFile(singletonTypesPath, 'utf8')

  const setBlock = source.match(
    /SINGLETON_TYPES\s*=\s*new Set\(\[([\s\S]*?)\]\)/
  )

  assert.ok(setBlock, 'SINGLETON_TYPES-set ontbreekt')

  const actual = [
    ...setBlock[1].matchAll(/'([^']+)'/g),
  ].map((match) => match[1])

  assert.deepEqual(actual, expectedSingletonTypes)
})

test('singletons behouden uitsluitend veilige documentacties', async () => {
  const source = await readFile(sanityConfigPath, 'utf8')

  const actionBlock = source.match(
    /SINGLETON_DOCUMENT_ACTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/
  )

  assert.ok(
    actionBlock,
    'SINGLETON_DOCUMENT_ACTIONS-set ontbreekt'
  )

  const actions = [
    ...actionBlock[1].matchAll(/'([^']+)'/g),
  ].map((match) => match[1])

  assert.deepEqual(
    actions,
    ['publish', 'discardChanges', 'restore']
  )

  for (const blockedAction of [
    'delete',
    'duplicate',
    'unpublish',
  ]) {
    assert.equal(
      actions.includes(blockedAction),
      false,
      `${blockedAction} mag niet voor singletons beschikbaar zijn`
    )
  }

  assert.match(
    source,
    /SINGLETON_TYPES\.has\(context\.schemaType\)/
  )

  assert.match(
    source,
    /SINGLETON_DOCUMENT_ACTIONS\.has\(action\)/
  )

  assert.match(
    source,
    /:\s*input,\s*\n/
  )
})

test('singleton create-opties blijven geblokkeerd', async () => {
  const source = await readFile(sanityConfigPath, 'utf8')

  assert.match(
    source,
    /templates:\s*\(templates\)[\s\S]*?!SINGLETON_TYPES\.has\(template\.schemaType\)/
  )

  assert.match(
    source,
    /newDocumentOptions:\s*\(options\)[\s\S]*?!SINGLETON_TYPES\.has\(option\.templateId\)/
  )
})

test('Vision is uitsluitend in development beschikbaar', async () => {
  const source = await readFile(sanityConfigPath, 'utf8')

  assert.match(
    source,
    /import\s+\{defineConfig,\s*isDev\}\s+from\s+'sanity'/
  )

  assert.match(
    source,
    /\.\.\.\(isDev\s*\?\s*\[visionTool\(\)\]\s*:\s*\[\]\)/
  )

  assert.equal(
    (source.match(/visionTool\(\)/g) || []).length,
    1
  )
})

test('CI valideert contract en bouwt Sanity Studio', async () => {
  const source = (
    await readFile(ciPath, 'utf8')
  ).replace(/\r\n/g, '\n')

  const rootInstall = source.indexOf(
    '      - name: Install dependencies\n' +
    '        run: npm ci'
  )

  const studioInstall = source.indexOf(
    '      - name: Install Studio dependencies\n' +
    '        run: npm --prefix studio ci'
  )

  const contractTest = source.indexOf(
    '      - name: Validate Sanity Studio configuration contract\n' +
    '        run: node --test tests/sanity-studio-config.test.mjs'
  )

  const studioBuild = source.indexOf(
    '      - name: Build Sanity Studio\n' +
    '        run: npm --prefix studio run build'
  )

  const playwrightInstall = source.indexOf(
    '      - name: Install Playwright browsers'
  )

  for (const [name, index] of [
    ['root install', rootInstall],
    ['Studio install', studioInstall],
    ['Studio contracttest', contractTest],
    ['Studio build', studioBuild],
    ['Playwright browserinstall', playwrightInstall],
  ]) {
    assert.notEqual(index, -1, `${name} ontbreekt`)
  }

  assert.ok(rootInstall < studioInstall)
  assert.ok(studioInstall < contractTest)
  assert.ok(contractTest < studioBuild)
  assert.ok(studioBuild < playwrightInstall)
})

test('repertoirePage vereist alt-tekst voor verplichte hero-afbeelding', async () => {
  const source = await readFile(
    new URL('../studio/schemaTypes/repertoirePage.ts', import.meta.url),
    'utf8'
  )

  assert.match(
    source,
    /defineField\(\{name:\s*'heroImageAlt',[^\r\n]*validation:\s*\(rule\)\s*=>\s*rule\.required\(\)\.max\(160\)[^\r\n]*\}\),/
  )
})

test('Structure biedt veilige ingang naar Ledenadministratie TEST', async () => {
  const [structureSource, paneSource] = await Promise.all([
    readFile(structurePath, 'utf8'),
    readFile(ledenadministratiePanePath, 'utf8'),
  ])

  const itemId = ".id('ledenadministratie')"

  assert.equal(
    structureSource.split(itemId).length - 1,
    1,
    'Ledenadministratie-item moet exact eenmaal voorkomen'
  )

  assert.ok(
    structureSource.includes(
      "import {LedenadministratiePane} from './components/LedenadministratiePane'"
    ),
    'LedenadministratiePane-import ontbreekt'
  )

  const friendItemIndex =
    structureSource.indexOf(".id('friendItem')")

  const ledenadministratieIndex =
    structureSource.indexOf(itemId)

  const firstDividerIndex =
    structureSource.indexOf('S.divider()')

  assert.ok(friendItemIndex >= 0)
  assert.ok(ledenadministratieIndex > friendItemIndex)
  assert.ok(firstDividerIndex > ledenadministratieIndex)

  const ledenadministratieBlock =
    structureSource.slice(
      ledenadministratieIndex,
      firstDividerIndex
    )

  assert.ok(
    ledenadministratieBlock.includes(
      ".title('Ledenadministratie')"
    )
  )

  assert.ok(
    ledenadministratieBlock.includes(
      'S.component(LedenadministratiePane)'
    )
  )

  assert.ok(
    ledenadministratieBlock.includes(
      ".id('ledenadministratie-pane')"
    )
  )

  const expectedUrl =
    'https://spontaan-website-git-acceptance-jimgroen2160s-projects.vercel.app/leden/login.html'

  assert.ok(
    paneSource.includes(expectedUrl),
    'Exacte acceptance-ledenlogin ontbreekt'
  )

  assert.ok(
    paneSource.includes('target="_blank"'),
    'Ledenadministratie moet in een nieuw tabblad openen'
  )

  assert.ok(
    paneSource.includes('rel="noopener noreferrer"'),
    'Veilige externe linkrelatie ontbreekt'
  )

  assert.match(
    paneSource,
    /niet in Sanity beheerd/i
  )

  assert.match(
    paneSource,
    /TEST \/ FAT\/GAT/
  )

  assert.doesNotMatch(
    paneSource,
    /@supabase\/supabase-js|createClient\s*\(/i,
    'De Studio-pane mag geen Supabase-client bevatten'
  )

  assert.doesNotMatch(
    paneSource,
    /\bfetch\s*\(/,
    'De Studio-pane mag geen runtime API-call uitvoeren'
  )
})
