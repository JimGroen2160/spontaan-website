import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const MIGRATION =
  'supabase/migrations/20260821141500_ledenportaal_content.sql';
const PDF_MIGRATION =
  'supabase/migrations/20260822204500_ledenportaal_song_pdfs.sql';
const DEMO = 'scripts/testdata/ledenportaal-demo.json';
const SEEDER = 'scripts/testdata/seed-ledenportaal.mjs';
const DEPLOY_WORKFLOW = '.github/workflows/supabase-test-deploy.yml';
const TESTDATA_WORKFLOW = '.github/workflows/supabase-testdata.yml';
const VERIFY_SCRIPT = 'scripts/testdata/verify-ledenportaal-backend.mjs';
const LEGACY_VERIFY_WORKFLOW = '.github/workflows/supabase-test-verify.yml';

async function source(path) {
  return readFile(path, 'utf8');
}

function workflowJob(workflow, jobName) {
  const lines = workflow.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line === `  ${jobName}:`);

  assert.notEqual(start, -1, `Workflowjob ontbreekt: ${jobName}`);

  let end = lines.length;

  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:$/.test(lines[index])) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

test('ledenportaalmigratie maakt drie RLS-tabellen zonder profiles uit te breiden', async () => {
  const sql = await source(MIGRATION);

  for (const table of ['member_songs', 'member_song_links', 'member_directory']) {
    assert.match(sql, new RegExp(`create table public\\.${table} \\(`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`));
  }

  assert.doesNotMatch(sql, /alter table public\.profiles\s+add\s+(column\s+)?/i);
  assert.doesNotMatch(sql, /\[DEMO\]/);
});

test('actieve leden lezen alleen ledenportaalcontent en managers beheren', async () => {
  const sql = await source(MIGRATION);

  assert.match(sql, /is_current_user_active_portal_user/);
  assert.match(sql, /status = 'active'/);
  assert.match(sql, /Active portal users can read visible songs/);
  assert.match(sql, /Managers can insert songs/);
  assert.match(sql, /Managers can update songs/);
  assert.match(sql, /Managers can delete songs/);
  assert.match(sql, /Active portal users can read visible song links/);
  assert.match(sql, /is_current_user_manager\(\)/);

  assert.doesNotMatch(sql, /grant\s+[^;]+\s+to\s+anon\s*;/is);
});

test('smoelenboek expose alleen minimale velden via beveiligde RPC', async () => {
  const sql = await source(MIGRATION);

  assert.match(sql, /create or replace function public\.get_member_directory\(\)/);
  assert.match(
    sql,
    /returns table \(\s*profile_id uuid,\s*full_name text,\s*memo text,\s*photo_path text\s*\)/s,
  );
  assert.match(sql, /profile\.status = 'active'/);
  assert.match(sql, /public\.is_current_user_active_portal_user\(\)/);
  assert.doesNotMatch(
    sql,
    /returns table \([^)]*(email|phone|street|postal_code|city)/s,
  );
});

test('member-photos bucket is private, begrensd en manager-only voor writes', async () => {
  const sql = await source(MIGRATION);

  assert.match(sql, /'member-photos'/);
  assert.match(sql, /5242880/);
  assert.match(sql, /'image\/jpeg'/);
  assert.match(sql, /'image\/png'/);
  assert.match(sql, /'image\/webp'/);
  assert.match(sql, /public\.can_current_user_read_member_photo\(name\)/);
  assert.match(sql, /Managers can insert member photos/);
  assert.match(sql, /Managers can update member photos/);
  assert.match(sql, /Managers can delete member photos/);
  assert.match(sql, /lower\(storage\.extension\(name\)\)/);
});

test('liedblad-PDF bucket is private, begrensd en alleen managers schrijven', async () => {
  const sql = await source(PDF_MIGRATION);

  assert.match(
    sql,
    /alter table public\.member_songs\s+add column pdf_path text null;/s,
  );

  assert.match(
    sql,
    /member_songs_pdf_path_check/,
  );

  assert.match(
    sql,
    /lower\(pdf_path\) ~ '\\\.pdf\$'/,
  );

  assert.match(
    sql,
    /'member-song-sheets'/,
  );

  assert.match(
    sql,
    /5242880/,
  );

  assert.match(
    sql,
    /array\['application\/pdf'\]::text\[\]/,
  );

  assert.match(
    sql,
    /'member-song-sheets'\s*,\s*'member-song-sheets'\s*,\s*false\s*,/s,
  );

  assert.match(
    sql,
    /Active portal users can read visible song sheets/,
  );

  assert.match(
    sql,
    /public\.is_current_user_active_portal_user\(\)/,
  );

  assert.match(
    sql,
    /song\.pdf_path = storage\.objects\.name/,
  );

  assert.match(
    sql,
    /song\.is_visible/,
  );

  assert.match(
    sql,
    /Managers can read song sheets/,
  );

  assert.match(
    sql,
    /Managers can upload song sheets/,
  );

  assert.match(
    sql,
    /Managers can update song sheets/,
  );

  assert.match(
    sql,
    /Managers can delete song sheets/,
  );

  assert.doesNotMatch(
    sql,
    /grant\s+[^;]+\s+to\s+anon\s*;/is,
  );

  assert.doesNotMatch(
    sql,
    /service_role/,
  );
});

test('TEST-demo is herkenbaar en de seeder overschrijft contentmanagerwijzigingen niet', async () => {
  const demo = JSON.parse(await source(DEMO));
  const seeder = await source(SEEDER);

  assert.equal(demo.songs.length, 6);
  assert.equal(demo.directory.length, 3);
  assert.ok(demo.songs.every((song) => song.title.startsWith('[DEMO]')));
  assert.deepEqual(
    [...new Set(demo.songs.map((song) => song.category))].sort(),
    ['archive', 'concept', 'current'],
  );

  assert.match(seeder, /EXPECTED_TEST_ORIGIN = 'https:\/\/lldmyfvhjypomxfpltlx\.supabase\.co'/);
  assert.match(seeder, /\.from\('profiles'\)\s*\.select\(/s);
  assert.doesNotMatch(
    seeder,
    /\.from\('profiles'\)[\s\S]{0,300}\.(insert|upsert|update|delete)\s*\(/,
  );
  assert.doesNotMatch(seeder, /\.update\s*\(/);
  assert.doesNotMatch(seeder, /\.upsert\s*\(/);
  assert.doesNotMatch(seeder, /\.delete\s*\(/);
});

test('workflows valideren migratiecontract en houden remote writes handmatig', async () => {
  const deploy = await source(DEPLOY_WORKFLOW);
  const testdata = await source(TESTDATA_WORKFLOW);

  assert.match(deploy, /LEDENPORTAAL_MIGRATION: supabase\/migrations\/20260821141500_ledenportaal_content\.sql/);
  assert.match(deploy, /LEDENPORTAAL_PDF_MIGRATION: supabase\/migrations\/20260822204500_ledenportaal_song_pdfs\.sql/);
  assert.match(deploy, /node --test tests\/ledenportaal-rbac-contract\.test\.mjs/);
  assert.match(deploy, /DEPLOY_SUPABASE_TEST/);
  assert.match(testdata, /APPLY_TESTDATA/);
  assert.match(testdata, /seed-ledenportaal\.mjs --apply/);
  assert.match(testdata, /seed-ledenportaal\.mjs --dry-run/);
});


test('live PDF CRUD-verifier gebruikt alleen TEST en normale manager/member-sessies', async () => {
  const verifier = await source(
    'scripts/testdata/verify-ledenportaal-pdf-crud.mjs',
  );

  assert.match(
    verifier,
    /EXPECTED_TEST_ORIGIN =\s*'https:\/\/lldmyfvhjypomxfpltlx\.supabase\.co'/,
  );

  assert.match(
    verifier,
    /TEST_CONTENTMANAGER_EMAIL/,
  );

  assert.match(
    verifier,
    /TEST_MEMBER_EMAIL/,
  );

  assert.match(
    verifier,
    /signInWithPassword/,
  );

  assert.match(
    verifier,
    /member-song-sheets/,
  );

  assert.match(
    verifier,
    /createSignedUrl/,
  );

  assert.match(
    verifier,
    /contentType:\s*'application\/pdf'/,
  );

  assert.match(
    verifier,
    /contentType:\s*'text\/plain'/,
  );

  assert.match(
    verifier,
    /\.update\(\{\s*pdf_path:/s,
  );

  assert.match(
    verifier,
    /\.remove\(/,
  );

  assert.match(
    verifier,
    /finally\s*\{/,
  );

  assert.doesNotMatch(
    verifier,
    /SERVICE_ROLE/i,
  );

  assert.doesNotMatch(
    verifier,
    /service_role/i,
  );
});

test('TEST-deployworkflow houdt PDF CRUD in een aparte handmatige mode', async () => {
  const workflow = await source(DEPLOY_WORKFLOW);
  const crud = workflowJob(
    workflow,
    'crud-verify-test',
  );

  assert.match(
    workflow,
    /-\s*crud-verify/,
  );

  assert.match(
    workflow,
    /VERIFY_LEDENPORTAAL_PDF_CRUD_TEST/,
  );

  assert.match(
    crud,
    /inputs\.mode == 'crud-verify'/,
  );

  assert.match(
    crud,
    /^    needs: validate$/m,
  );

  assert.match(
    crud,
    /^    environment: supabase-test$/m,
  );

  assert.match(
    crud,
    /TEST_CONTENTMANAGER_EMAIL/,
  );

  assert.match(
    crud,
    /TEST_MEMBER_EMAIL/,
  );

  assert.match(
    crud,
    /verify-ledenportaal-pdf-crud\.mjs/,
  );

  assert.doesNotMatch(
    crud,
    /SUPABASE_SERVICE_ROLE_KEY/,
  );

  assert.doesNotMatch(
    crud,
    /supabase db push/,
  );

  assert.doesNotMatch(
    crud,
    /supabase functions deploy/,
  );
});


test('live TEST-backendverifier is hard read-only en vastgepind op TEST', async () => {
  const verifier = await source(VERIFY_SCRIPT);

  assert.match(
    verifier,
    /EXPECTED_TEST_ORIGIN = 'https:\/\/lldmyfvhjypomxfpltlx\.supabase\.co'/,
  );

  for (const table of ['member_songs', 'member_song_links', 'member_directory']) {
    assert.match(verifier, new RegExp(`verifyTable\\(serviceClient, '${table}'`));
  }

  assert.match(verifier, /storage\.getBucket\(/);
  assert.match(verifier, /rpc\('get_member_directory'\)/);
  assert.match(verifier, /auth\.signInWithPassword\(/);
  assert.doesNotMatch(verifier, /\.from\('profiles'\)/);

  const authCalls = [
    ...verifier.matchAll(/auth\.([A-Za-z0-9_]+)\s*\(/g),
  ].map((match) => match[1]);

  assert.deepEqual(authCalls, ['signInWithPassword']);

  const storageCalls = [
    ...verifier.matchAll(/storage\.([A-Za-z0-9_]+)\s*\(/g),
  ].map((match) => match[1]);

  assert.deepEqual(storageCalls, ['getBucket']);

  for (const mutation of [
    /\.insert\s*\(/,
    /\.update\s*\(/,
    /\.upsert\s*\(/,
    /\.delete\s*\(/,
    /\.upload\s*\(/,
    /\.remove\s*\(/,
    /\.move\s*\(/,
    /\.copy\s*\(/,
    /\.createBucket\s*\(/,
    /\.updateBucket\s*\(/,
    /\.deleteBucket\s*\(/,
    /auth\.admin/,
    /auth\.signUp\s*\(/,
  ]) {
    assert.doesNotMatch(verifier, mutation);
  }
});

test('bestaande TEST-deployworkflow bevat een afgescheiden read-only verify-route', async () => {
  const workflow = await source(DEPLOY_WORKFLOW);
  const verify = workflowJob(workflow, 'verify-test');
  const preview = workflowJob(workflow, 'preview-test');
  const deployDb = workflowJob(workflow, 'deploy-db-test');
  const deploy = workflowJob(workflow, 'deploy-test');

  assert.match(workflow, /^\s*workflow_dispatch:$/m);
  assert.match(workflow, /-\s*verify/);
  assert.match(workflow, /VERIFY_SUPABASE_TEST_READONLY/);
  assert.match(verify, /inputs\.mode == 'verify'/);
  assert.match(verify, /^    needs: validate$/m);
  assert.match(verify, /^    environment: supabase-test$/m);
  assert.match(
    verify,
    /node scripts\/testdata\/verify-ledenportaal-backend\.mjs/,
  );

  for (const mutation of [
    /APPLY_TESTDATA/,
    /seed-ledenportaal\.mjs --apply/,
    /supabase db push/,
    /supabase functions deploy/,
  ]) {
    assert.doesNotMatch(verify, mutation);
  }

  assert.doesNotMatch(preview, /inputs\.mode == 'verify'/);
  assert.doesNotMatch(deployDb, /inputs\.mode == 'verify'/);
  assert.doesNotMatch(deploy, /inputs\.mode == 'verify'/);

  await assert.rejects(
    () => source(LEGACY_VERIFY_WORKFLOW),
    (error) => error?.code === 'ENOENT',
  );
});

test('testdataworkflow scheidt ledenportaal-only writes van volledige testdata', async () => {
  const workflow = await source(TESTDATA_WORKFLOW);
  const ledenportaal = workflowJob(workflow, 'apply-ledenportaal-testdata');
  const all = workflowJob(workflow, 'apply-testdata');

  assert.match(workflow, /-\s*ledenportaal/);
  assert.match(workflow, /-\s*all/);
  assert.match(workflow, /APPLY_LEDENPORTAAL_TESTDATA/);
  assert.match(workflow, /APPLY_TESTDATA/);

  assert.match(ledenportaal, /inputs\.mode == 'ledenportaal'/);
  assert.match(ledenportaal, /^    environment: supabase-test$/m);
  assert.match(
    ledenportaal,
    /SUPABASE_URL: \$\{\{ secrets\.SUPABASE_URL \}\}/,
  );
  assert.match(
    ledenportaal,
    /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/,
  );
  assert.match(
    ledenportaal,
    /TEST_MEMBER_EMAIL: \$\{\{ secrets\.TEST_MEMBER_EMAIL \}\}/,
  );
  assert.match(
    ledenportaal,
    /TEST_STATUS_MEMBER_EMAIL: \$\{\{ secrets\.TEST_STATUS_MEMBER_EMAIL \}\}/,
  );
  assert.match(
    ledenportaal,
    /TEST_PROFILE_MEMBER_EMAIL: \$\{\{ secrets\.TEST_PROFILE_MEMBER_EMAIL \}\}/,
  );
  assert.match(ledenportaal, /seed-ledenportaal\.mjs --dry-run/);
  assert.match(ledenportaal, /seed-ledenportaal\.mjs --apply/);

  for (const forbidden of [
    /seed-test-users\.mjs/,
    /TEST_ADMIN_/,
    /TEST_MEMBER_PASSWORD/,
    /TEST_MEMBER_DISPLAY_NAME/,
    /TEST_MEMBER_PENDING_/,
    /TEST_MEMBER_INACTIVE_/,
    /TEST_STATUS_MEMBER_PASSWORD/,
    /TEST_STATUS_MEMBER_DISPLAY_NAME/,
    /TEST_PROFILE_MEMBER_PASSWORD/,
    /TEST_PROFILE_MEMBER_DISPLAY_NAME/,
    /TEST_CONTENTMANAGER_/,
  ]) {
    assert.doesNotMatch(ledenportaal, forbidden);
  }

  assert.match(all, /inputs\.mode == 'all'/);
  assert.match(all, /seed-test-users\.mjs --apply/);
  assert.match(all, /seed-test-users\.mjs --profiles-apply/);
  assert.doesNotMatch(all, /inputs\.mode == 'ledenportaal'/);
});
test('ledenportaalfrontend leest live beveiligde backenddata zonder publieke demo of directe profiles-query', async () => {
  const [
    shared,
    music,
    directory,
    musicHtml,
    directoryHtml,
  ] = await Promise.all([
    source('js/leden-portaal.js'),
    source('js/leden-muziek.js'),
    source('js/leden-smoelenboek.js'),
    source('leden/muziek.html'),
    source('leden/smoelenboek.html'),
  ]);

  assert.match(
    shared,
    /\.from\('member_songs'\)/,
  );

  assert.match(
    shared,
    /\.eq\('is_visible', true\)/,
  );

  assert.match(
    shared,
    /\.from\('member_song_links'\)/,
  );

  assert.match(
    shared,
    /\.rpc\(\s*'get_member_directory'/,
  );

  assert.match(
    shared,
    /const PHOTO_URL_TTL_SECONDS = 300;/,
  );

  assert.match(
    shared,
    /\.from\(PHOTO_BUCKET\)[\s\S]*\.createSignedUrl\(\s*photoPath,\s*PHOTO_URL_TTL_SECONDS,/,
  );

  for (
    const frontendSource of [
      shared,
      music,
      directory,
    ]
  ) {
    assert.doesNotMatch(
      frontendSource,
      /\.from\('profiles'\)/,
    );

    assert.doesNotMatch(
      frontendSource,
      /ledenportaal-demo\.json/,
    );
  }

  for (
    const publicSource of [
      shared,
      music,
      directory,
      musicHtml,
      directoryHtml,
    ]
  ) {
    assert.doesNotMatch(
      publicSource,
      /\[DEMO\]/,
    );
  }

  await assert.rejects(
    () =>
      source(
        'data/ledenportaal-demo.json',
      ),

    (error) =>
      error?.code === 'ENOENT',
  );
});
test('ledenportaalbeheer gebruikt bestaande manager-RBAC en private Storage zonder service-role in de browser', async () => {
  const [html, script, style, adminIndex] = await Promise.all([
    source('admin/ledenportaal.html'),
    source('admin/ledenportaal.js'),
    source('css/ledenportaal-beheer.css'),
    source('admin/index.html'),
  ]);

  assert.match(adminIndex, /href="\.\/ledenportaal\.html"/);
  assert.match(html, /Muziek en smoelenboek beheren/);
  assert.match(html, /meta name="robots" content="noindex,nofollow"/);
  assert.match(style, /over-hero-mannenkoor\.jpg/);

  assert.match(script, /\['admin', 'contentmanager'\]\.includes\(profile\.role\)/);
  assert.match(script, /\.from\('member_songs'\)/);
  assert.match(script, /\.from\('member_song_links'\)/);
  assert.match(script, /\.from\('member_directory'\)/);
  assert.match(script, /\.from\('profiles'\)[\s\S]*\.select\('id,full_name,role,status'\)[\s\S]*\.eq\('status', 'active'\)/);
  assert.match(script, /const PHOTO_BUCKET = 'member-photos';/);
  assert.match(script, /const PHOTO_MAX_BYTES = 5 \* 1024 \* 1024;/);
  assert.match(script, /'image\/jpeg': 'jpg'/);
  assert.match(script, /'image\/png': 'png'/);
  assert.match(script, /'image\/webp': 'webp'/);
  assert.match(script, /\.createSignedUrl\(safePath, PHOTO_SIGNED_TTL_SECONDS\)/);
  assert.match(script, /\.upload\(newPath, file,/);
  assert.match(script, /\.remove\(\[oldPath\]\)/);

  for (const sourceText of [html, script]) {
    assert.doesNotMatch(sourceText, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(sourceText, /service_role/);
    assert.doesNotMatch(sourceText, /auth\.admin/);
  }
});
