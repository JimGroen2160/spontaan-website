import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_TEST_ORIGIN = 'https://lldmyfvhjypomxfpltlx.supabase.co';
const mode = process.argv[2] ?? '--dry-run';

if (!['--dry-run', '--apply'].includes(mode)) {
  throw new Error('Gebruik --dry-run of --apply.');
}

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.');
}

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  throw new Error('SUPABASE_URL is ongeldig.');
}

if (parsedUrl.origin !== EXPECTED_TEST_ORIGIN) {
  throw new Error(
    `STOP: ledenportaal-testdata mag alleen naar ${EXPECTED_TEST_ORIGIN}.`,
  );
}

const manifest = JSON.parse(
  await readFile(new URL('./manifest.json', import.meta.url), 'utf8'),
);
const demo = JSON.parse(
  await readFile(new URL('./ledenportaal-demo.json', import.meta.url), 'utf8'),
);

if (!Array.isArray(demo.songs) || demo.songs.length !== 6) {
  throw new Error('Verwacht exact zes demoliedjes.');
}

if (!Array.isArray(demo.directory) || demo.directory.length !== 3) {
  throw new Error('Verwacht exact drie smoelenboekmemo\'s.');
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function unique(values) {
  return [...new Set(values)];
}

function getManifestUser(manifestUserId) {
  const user = manifest.users.find((candidate) => candidate.id === manifestUserId);

  if (!user) {
    throw new Error(`Onbekende manifest-user: ${manifestUserId}`);
  }

  const email = process.env[user.emailEnvKey]?.trim().toLowerCase();

  if (!email) {
    throw new Error(`Omgevingsvariabele ontbreekt: ${user.emailEnvKey}`);
  }

  return { ...user, email };
}

async function resolveDirectoryRows() {
  const targets = demo.directory.map((item) => ({
    ...item,
    user: getManifestUser(item.manifestUserId),
  }));

  const emails = unique(targets.map((item) => item.user.email));
  const { data: profiles, error } = await client
    .from('profiles')
    .select('id, email, status')
    .in('email', emails);

  if (error) {
    throw error;
  }

  const byEmail = new Map(
    (profiles ?? []).map((profile) => [profile.email.toLowerCase(), profile]),
  );

  return targets.map((item) => {
    const profile = byEmail.get(item.user.email);

    if (!profile) {
      throw new Error(`Testprofiel ontbreekt voor ${item.manifestUserId}.`);
    }

    if (profile.status !== 'active') {
      throw new Error(`Testprofiel is niet actief: ${item.manifestUserId}.`);
    }

    return {
      profile_id: profile.id,
      memo: item.memo,
      photo_path: null,
    };
  });
}

function songRows() {
  return demo.songs.map((song) => ({
    id: song.id,
    title: song.title,
    category: song.category,
    description: song.description,
    lyrics: song.lyrics,
    is_visible: song.is_visible,
    sort_order: song.sort_order,
  }));
}

function linkRows() {
  return demo.songs.flatMap((song) =>
    (song.links ?? []).map((link) => ({
      id: link.id,
      song_id: song.id,
      label: link.label,
      link_type: link.link_type,
      url: link.url,
      sort_order: link.sort_order,
    })),
  );
}

async function existingIds(table, column, values) {
  const { data, error } = await client
    .from(table)
    .select(column)
    .in(column, values);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row[column]));
}

async function inspect() {
  const songs = songRows();
  const links = linkRows();
  const directory = await resolveDirectoryRows();

  const songIds = await existingIds(
    'member_songs',
    'id',
    songs.map((row) => row.id),
  );
  const linkIds = await existingIds(
    'member_song_links',
    'id',
    links.map((row) => row.id),
  );
  const directoryIds = await existingIds(
    'member_directory',
    'profile_id',
    directory.map((row) => row.profile_id),
  );

  return {
    songs,
    links,
    directory,
    missingSongs: songs.filter((row) => !songIds.has(row.id)),
    missingLinks: links.filter((row) => !linkIds.has(row.id)),
    missingDirectory: directory.filter((row) => !directoryIds.has(row.profile_id)),
  };
}

function printDryRun(state) {
  console.log('mode: dry-run');
  console.log(`songs-missing: ${state.missingSongs.length}`);
  console.log(`songs-existing: ${state.songs.length - state.missingSongs.length}`);
  console.log(`links-missing: ${state.missingLinks.length}`);
  console.log(`links-existing: ${state.links.length - state.missingLinks.length}`);
  console.log(`directory-missing: ${state.missingDirectory.length}`);
  console.log(`directory-existing: ${state.directory.length - state.missingDirectory.length}`);
}

async function insertMissing(table, rows) {
  if (rows.length === 0) {
    return 0;
  }

  const { error } = await client.from(table).insert(rows);

  if (error) {
    throw error;
  }

  return rows.length;
}

const state = await inspect();

if (mode === '--dry-run') {
  printDryRun(state);
  process.exit(0);
}

let created = 0;
created += await insertMissing('member_songs', state.missingSongs);
created += await insertMissing('member_song_links', state.missingLinks);
created += await insertMissing('member_directory', state.missingDirectory);

const total = state.songs.length + state.links.length + state.directory.length;

console.log('mode: apply');
console.log(`created: ${created}`);
console.log(`existing: ${total - created}`);
console.log('updated: 0');
console.log('failed: 0');
