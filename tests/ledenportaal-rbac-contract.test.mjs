import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const MIGRATION =
  'supabase/migrations/20260821141500_ledenportaal_content.sql';
const DEMO = 'scripts/testdata/ledenportaal-demo.json';
const SEEDER = 'scripts/testdata/seed-ledenportaal.mjs';
const DEPLOY_WORKFLOW = '.github/workflows/supabase-test-deploy.yml';
const TESTDATA_WORKFLOW = '.github/workflows/supabase-testdata.yml';

async function source(path) {
  return readFile(path, 'utf8');
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
  assert.match(deploy, /node --test tests\/ledenportaal-rbac-contract\.test\.mjs/);
  assert.match(deploy, /DEPLOY_SUPABASE_TEST/);
  assert.match(testdata, /APPLY_TESTDATA/);
  assert.match(testdata, /seed-ledenportaal\.mjs --apply/);
  assert.match(testdata, /seed-ledenportaal\.mjs --dry-run/);
});
