import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_TEST_ORIGIN = 'https://lldmyfvhjypomxfpltlx.supabase.co';
const EXPECTED_BUCKET = Object.freeze({
  id: 'member-photos',
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: Object.freeze([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
});

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Omgevingsvariabele ontbreekt: ${name}`);
  }

  return value;
}

function assertTestOrigin(url) {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error('SUPABASE_URL is ongeldig.');
  }

  assert.equal(
    parsed.origin,
    EXPECTED_TEST_ORIGIN,
    `STOP: verifier mag alleen ${EXPECTED_TEST_ORIGIN} lezen.`,
  );
}

function createReadClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function verifyTable(client, table, column) {
  const { error, count } = await client
    .from(table)
    .select(column, { count: 'exact', head: true });

  if (error) {
    throw new Error(`Live tabelcontrole faalde voor ${table}: ${error.message}`);
  }

  console.log(`table:${table}:present:rows=${count ?? 'unknown'}`);
}

async function verifyBucket(client) {
  const { data: bucket, error } = await client.storage.getBucket(
    EXPECTED_BUCKET.id,
  );

  if (error || !bucket) {
    throw new Error(
      `Live bucketcontrole faalde: ${error?.message ?? 'bucket ontbreekt'}`,
    );
  }

  assert.equal(bucket.id, EXPECTED_BUCKET.id);
  assert.equal(bucket.name, EXPECTED_BUCKET.id);
  assert.equal(bucket.public, EXPECTED_BUCKET.public);
  assert.equal(bucket.file_size_limit, EXPECTED_BUCKET.fileSizeLimit);
  assert.deepEqual(
    [...(bucket.allowed_mime_types ?? [])].sort(),
    [...EXPECTED_BUCKET.allowedMimeTypes].sort(),
  );

  console.log('bucket:member-photos:present');
  console.log('bucket:member-photos:public=false');
  console.log(`bucket:member-photos:file-size-limit=${EXPECTED_BUCKET.fileSizeLimit}`);
  console.log(`bucket:member-photos:mime-types=${EXPECTED_BUCKET.allowedMimeTypes.join(',')}`);
}

function assertDirectoryShape(rows) {
  assert.ok(
    rows.length > 0,
    'get_member_directory() moet voor het actieve TEST-member minimaal één actief profiel retourneren.',
  );

  const expectedKeys = ['full_name', 'memo', 'photo_path', 'profile_id'];
  const forbiddenKeys = [
    'email',
    'phone',
    'street',
    'house_number',
    'postal_code',
    'city',
    'auth_user_id',
  ];

  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), expectedKeys);

    for (const key of forbiddenKeys) {
      assert.equal(
        Object.hasOwn(row, key),
        false,
        `Verboden smoelenboekveld aangetroffen: ${key}`,
      );
    }
  }
}

async function verifyDirectoryRpc(url, publishableKey, email, password) {
  const memberClient = createReadClient(url, publishableKey);

  const { data: authData, error: authError } =
    await memberClient.auth.signInWithPassword({ email, password });

  if (authError || !authData?.session?.access_token) {
    throw new Error(
      `TEST-member login voor read-only RPC-controle faalde: ${authError?.message ?? 'geen sessie'}`,
    );
  }

  const { data: directory, error: rpcError } =
    await memberClient.rpc('get_member_directory');

  if (rpcError) {
    throw new Error(`get_member_directory() faalde: ${rpcError.message}`);
  }

  assert.ok(Array.isArray(directory));
  assertDirectoryShape(directory);

  const anonymousClient = createReadClient(url, publishableKey);
  const { error: anonymousError } =
    await anonymousClient.rpc('get_member_directory');

  assert.ok(
    anonymousError,
    'get_member_directory() mag niet anoniem uitvoerbaar zijn.',
  );

  console.log('rpc:get_member_directory:active-member=allowed');
  console.log('rpc:get_member_directory:anonymous=blocked');
  console.log('rpc:get_member_directory:shape=minimal');
}

const supabaseUrl = requiredEnv('SUPABASE_URL');
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const publishableKey = requiredEnv('SUPABASE_PUBLISHABLE_KEY');
const memberEmail = requiredEnv('TEST_MEMBER_EMAIL');
const memberPassword = requiredEnv('TEST_MEMBER_PASSWORD');

assertTestOrigin(supabaseUrl);

const serviceClient = createReadClient(supabaseUrl, serviceRoleKey);

await verifyTable(serviceClient, 'member_songs', 'id');
await verifyTable(serviceClient, 'member_song_links', 'id');
await verifyTable(serviceClient, 'member_directory', 'profile_id');
await verifyBucket(serviceClient);
await verifyDirectoryRpc(
  supabaseUrl,
  publishableKey,
  memberEmail,
  memberPassword,
);

console.log('LEDENPORTAAL LIVE READ-ONLY BACKEND VERIFY — PASS');
