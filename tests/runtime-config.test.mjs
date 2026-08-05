import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile, rm} from 'node:fs/promises';
import {promisify} from 'node:util';
import test from 'node:test';

import {
  resolveRuntimeConfig,
  runtimeConfigSource,
} from '../scripts/build-site.mjs';

const exec = promisify(execFile);

test('runtimeconfig volgt development, Preview en Production', () => {
  assert.deepEqual(resolveRuntimeConfig({}), {
    projectId: 'u66p1mxm',
    dataset: 'development',
    apiVersion: '2026-07-06',
    environment: 'development',
    allowDemo: true,
  });

  assert.deepEqual(
    resolveRuntimeConfig({VERCEL_ENV: 'preview'}),
    {
      projectId: 'u66p1mxm',
      dataset: 'development',
      apiVersion: '2026-07-06',
      environment: 'preview',
      allowDemo: true,
    },
  );

  assert.deepEqual(
    resolveRuntimeConfig({VERCEL_ENV: 'production'}),
    {
      projectId: 'u66p1mxm',
      dataset: 'production',
      apiVersion: '2026-07-06',
      environment: 'production',
      allowDemo: false,
    },
  );
});

test('runtimeconfig weigert iedere OTAP-datasetmismatch', () => {
  const invalidCombinations = [
    {
      environment: {
        VERCEL_ENV: 'production',
        SANITY_DATASET: 'development',
      },
      message:
        'Ongeldige OTAP-combinatie: production vereist dataset production, niet development',
    },
    {
      environment: {
        VERCEL_ENV: 'preview',
        SANITY_DATASET: 'production',
      },
      message:
        'Ongeldige OTAP-combinatie: preview vereist dataset development, niet production',
    },
    {
      environment: {
        SANITY_DATASET: 'production',
      },
      message:
        'Ongeldige OTAP-combinatie: development vereist dataset development, niet production',
    },
  ];

  invalidCombinations.forEach(({environment, message}) => {
    assert.throws(
      () => resolveRuntimeConfig(environment),
      (error) =>
        error instanceof Error &&
        error.message === message,
    );
  });
});

test('expliciete geldige OTAP-datasets blijven toegestaan', () => {
  assert.equal(
    resolveRuntimeConfig({
      SANITY_DATASET: 'development',
    }).dataset,
    'development',
  );

  assert.equal(
    resolveRuntimeConfig({
      VERCEL_ENV: 'preview',
      SANITY_DATASET: 'development',
    }).dataset,
    'development',
  );

  assert.equal(
    resolveRuntimeConfig({
      VERCEL_ENV: 'production',
      SANITY_DATASET: 'production',
    }).dataset,
    'production',
  );
});

test('runtimeconfig weigert een onbekende dataset', () => {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        SANITY_DATASET: 'acceptance',
      }),
    /Ongeldige Sanity-dataset: acceptance/,
  );
});

test('runtimeconfig bevat geen geheime omgevingswaarden', () => {
  const source = runtimeConfigSource({
    VERCEL_ENV: 'production',
    SANITY_API_TOKEN: 'nooit-publiceren',
  });

  assert.match(
    source,
    /^window\.SpontaanRuntimeConfig = Object\.freeze\(/,
  );
  assert.match(source, /"dataset":"production"/);
  assert.match(source, /"environment":"production"/);
  assert.match(source, /"allowDemo":false/);
  assert.doesNotMatch(source, /SANITY_API_TOKEN/);
  assert.doesNotMatch(source, /nooit-publiceren/);
});

test('build weigert een ongeldige Production-dataset voor het aanmaken van output', async () => {
  const outputDirectory =
    'dist-invalid-runtime-config-test';

  await rm(outputDirectory, {
    recursive: true,
    force: true,
  });

  try {
    await assert.rejects(
      exec(
        process.execPath,
        ['scripts/build-site.mjs'],
        {
          env: {
            ...process.env,
            SITE_OUTPUT_DIR: outputDirectory,
            VERCEL_ENV: 'production',
            SANITY_DATASET: 'development',
          },
        },
      ),
      (error) => {
        const combinedOutput =
          `${error.stdout || ''}\n${error.stderr || ''}`;

        return (
          error.code !== 0 &&
          combinedOutput.includes(
            'Ongeldige OTAP-combinatie: production vereist dataset production, niet development',
          ) &&
          !combinedOutput.includes('fallback gebruikt')
        );
      },
    );

    await assert.rejects(
      readFile(
        `${outputDirectory}/js/runtime-config.js`,
        'utf8',
      ),
      {
        code: 'ENOENT',
      },
    );
  } finally {
    await rm(outputDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test('build schrijft config en scriptreferenties naar alternatieve output', async () => {
  const outputDirectory = 'dist-runtime-config-test';

  try {
    await exec(
      process.execPath,
      ['scripts/build-site.mjs'],
      {
        env: {
          ...process.env,
          SITE_OUTPUT_DIR: outputDirectory,
          VERCEL_ENV: 'preview',
          MEDIA_BUILD_FIXTURE:
            'tests/fixtures/media-cms.json',
          REPERTOIRE_BUILD_FIXTURE:
            'tests/fixtures/repertoire-cms.json',
          FRIENDS_BUILD_FIXTURE:
            'tests/fixtures/friends-cms.json',
          ABOUT_BUILD_FIXTURE:
            'tests/fixtures/about-cms.json',
          CONTACT_BUILD_FIXTURE:
            'tests/fixtures/contact-cms.json',
          HOME_BUILD_FIXTURE:
            'tests/fixtures/home-cms.json',
        },
      },
    );

    const config = await readFile(
      `${outputDirectory}/js/runtime-config.js`,
      'utf8',
    );

    assert.match(config, /"dataset":"development"/);
    assert.match(config, /"environment":"preview"/);
    assert.match(config, /"allowDemo":true/);

    for (const page of [
      'nieuws.html',
      'nieuwsbericht.html',
      'agenda.html',
    ]) {
      const html = await readFile(
        `${outputDirectory}/pages/${page}`,
        'utf8',
      );

      assert.match(
        html,
        /<script src="\.\.\/js\/runtime-config\.js" defer><\/script>/,
      );
    }
  } finally {
    await rm(outputDirectory, {
      recursive: true,
      force: true,
    });
  }
});
