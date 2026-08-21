import assert from 'node:assert/strict';
import {
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);

const PRODUCTION_OUTPUT =
  'test-output/production-maintenance/output';

const PREVIEW_OUTPUT =
  'test-output/production-maintenance/preview';

function runBuild(environment) {
  const result = spawnSync(
    process.execPath,
    ['scripts/build-site.mjs'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        ...environment,
      },
      encoding: 'utf8',
    },
  );

  assert.equal(
    result.status,
    0,
    [
      'Build faalde.',
      result.stdout,
      result.stderr,
    ].join('\n'),
  );

  return result;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test(
  'Production bouwt uitsluitend maintenance-output',
  async () => {
    const output = resolve(
      ROOT,
      PRODUCTION_OUTPUT,
    );

    await rm(
      output,
      {recursive: true, force: true},
    );

    try {
      const result = runBuild({
        VERCEL_ENV: 'production',
        SITE_OUTPUT_DIR: PRODUCTION_OUTPUT,

        SUPABASE_URL: '',
        SUPABASE_PUBLISHABLE_KEY: '',
        SANITY_DATASET: '',

        MEDIA_BUILD_FIXTURE: '',
        REPERTOIRE_BUILD_FIXTURE: '',
        FRIENDS_BUILD_FIXTURE: '',
        ABOUT_BUILD_FIXTURE: '',
        CONTACT_BUILD_FIXTURE: '',
        HOME_BUILD_FIXTURE: '',

        PRODUCTION_TESTDATA_GUARD_FIXTURE: '',
      });

      assert.match(
        result.stdout,
        /PRODUCTION MAINTENANCE BUILD: actief/,
      );

      const entries = (
        await readdir(output)
      ).sort();

      assert.deepEqual(
        entries,
        [
          '404.html',
          'index.html',
          'robots.txt',
        ],
      );

      const index = await readFile(
        resolve(output, 'index.html'),
        'utf8',
      );

      const notFound = await readFile(
        resolve(output, '404.html'),
        'utf8',
      );

      const robots = await readFile(
        resolve(output, 'robots.txt'),
        'utf8',
      );

      assert.equal(
        notFound,
        index,
      );

      assert.match(
        index,
        /Spontaan krijgt een nieuwe website/,
      );

      assert.match(
        index,
        /noindex,nofollow/,
      );

      assert.doesNotMatch(
        index,
        /<script\b/i,
      );

      assert.doesNotMatch(
        index,
        /https?:\/\//i,
      );

      assert.equal(
        robots,
        'User-agent: *\nDisallow: /\n',
      );

      for (const blockedPath of [
        'admin',
        'components',
        'css',
        'data',
        'images',
        'js',
        'leden',
        'pages',
        '_redirects',
      ]) {
        assert.equal(
          await exists(
            resolve(output, blockedPath),
          ),
          false,
          'Production bevat onverwacht ' + blockedPath,
        );
      }
    } finally {
      await rm(
        output,
        {recursive: true, force: true},
      );
    }
  },
);

test(
  'Preview blijft de volledige website bouwen',
  async () => {
    const output = resolve(
      ROOT,
      PREVIEW_OUTPUT,
    );

    await rm(
      output,
      {recursive: true, force: true},
    );

    try {
      runBuild({
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: '',
        SANITY_DATASET: 'development',
        SITE_OUTPUT_DIR: PREVIEW_OUTPUT,

        SUPABASE_URL:
          'https://synthetic-test-project.supabase.co',

        SUPABASE_PUBLISHABLE_KEY:
          'sb_publishable_synthetic_test_only',

        MEDIA_BUILD_FIXTURE:
          'data/media-fallback.json',

        REPERTOIRE_BUILD_FIXTURE:
          'data/repertoire-fallback.json',

        FRIENDS_BUILD_FIXTURE:
          'data/friends-fallback.json',

        ABOUT_BUILD_FIXTURE:
          'data/about-fallback.json',

        CONTACT_BUILD_FIXTURE:
          'data/contact-fallback.json',

        HOME_BUILD_FIXTURE:
          'data/home-fallback.json',

        PRODUCTION_TESTDATA_GUARD_FIXTURE: '',
      });

      const index = await readFile(
        resolve(output, 'index.html'),
        'utf8',
      );

      assert.doesNotMatch(
        index,
        /Spontaan krijgt een nieuwe website/,
      );

      for (const expectedPath of [
        'admin',
        'components',
        'css',
        'data',
        'images',
        'js',
        'leden',
        'pages',
      ]) {
        assert.equal(
          await exists(
            resolve(output, expectedPath),
          ),
          true,
          'Preview mist website-output: ' + expectedPath,
        );
      }

      assert.equal(
        await exists(
          resolve(
            output,
            'pages',
            'contact.html',
          ),
        ),
        true,
      );

      assert.equal(
        await exists(
          resolve(
            output,
            'js',
            'runtime-config.js',
          ),
        ),
        true,
      );
    } finally {
      await rm(
        output,
        {recursive: true, force: true},
      );
    }
  },
);