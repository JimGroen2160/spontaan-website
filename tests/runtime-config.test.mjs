import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {promisify} from 'node:util';
import test from 'node:test';

import {
  resolveRuntimeConfig,
  resolveSupabaseBrowserConfig,
  runtimeConfigSource,
} from '../scripts/build-site.mjs';

const exec = promisify(execFile);

const TEST_BROWSER_SUPABASE_URL =
  'https://synthetic-test-project.supabase.co';
const TEST_BROWSER_SUPABASE_KEY =
  'sb_publishable_synthetic_test_only';

function withBrowserSupabase(environment = {}) {
  return {
    SUPABASE_URL: TEST_BROWSER_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY:
      TEST_BROWSER_SUPABASE_KEY,
    ...environment,
  };
}

test('runtimeconfig volgt development, Preview en Production', () => {
  assert.deepEqual(resolveRuntimeConfig(withBrowserSupabase()), {
    projectId: 'u66p1mxm',
    dataset: 'development',
    apiVersion: '2026-07-06',
    environment: 'development',
    allowDemo: true,
    supabase: {
      url: TEST_BROWSER_SUPABASE_URL,
      publishableKey: TEST_BROWSER_SUPABASE_KEY,
    },
  });

  assert.deepEqual(
    resolveRuntimeConfig(withBrowserSupabase({VERCEL_ENV: 'preview'})),
    {
      projectId: 'u66p1mxm',
      dataset: 'development',
      apiVersion: '2026-07-06',
      environment: 'preview',
      allowDemo: true,
      supabase: {
        url: TEST_BROWSER_SUPABASE_URL,
        publishableKey: TEST_BROWSER_SUPABASE_KEY,
      },
    },
  );

  assert.deepEqual(
    resolveRuntimeConfig(withBrowserSupabase({VERCEL_ENV: 'production'})),
    {
      projectId: 'u66p1mxm',
      dataset: 'production',
      apiVersion: '2026-07-06',
      environment: 'production',
      allowDemo: false,
      supabase: {
        url: TEST_BROWSER_SUPABASE_URL,
        publishableKey: TEST_BROWSER_SUPABASE_KEY,
      },
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
      () => resolveRuntimeConfig(withBrowserSupabase(environment)),
      (error) =>
        error instanceof Error &&
        error.message === message,
    );
  });
});

test('expliciete geldige OTAP-datasets blijven toegestaan', () => {
  assert.equal(
    resolveRuntimeConfig(withBrowserSupabase({
      SANITY_DATASET: 'development',
    })).dataset,
    'development',
  );

  assert.equal(
    resolveRuntimeConfig(withBrowserSupabase({
      VERCEL_ENV: 'preview',
      SANITY_DATASET: 'development',
    })).dataset,
    'development',
  );

  assert.equal(
    resolveRuntimeConfig(withBrowserSupabase({
      VERCEL_ENV: 'production',
      SANITY_DATASET: 'production',
    })).dataset,
    'production',
  );
});

test('runtimeconfig weigert een onbekende dataset', () => {
  assert.throws(
    () =>
      resolveRuntimeConfig(withBrowserSupabase({
        SANITY_DATASET: 'acceptance',
      })),
    /Ongeldige Sanity-dataset: acceptance/,
  );
});

test('Supabase browserconfig vereist URL en publishable key', () => {
  assert.throws(
    () => resolveSupabaseBrowserConfig({}),
    /SUPABASE_URL ontbreekt/,
  );

  assert.throws(
    () =>
      resolveSupabaseBrowserConfig({
        SUPABASE_URL:
          TEST_BROWSER_SUPABASE_URL,
      }),
    /SUPABASE_PUBLISHABLE_KEY ontbreekt/,
  );
});

test('Supabase browserconfig weigert onveilige configuratie', () => {
  assert.throws(
    () =>
      resolveSupabaseBrowserConfig({
        SUPABASE_URL:
          'http://synthetic-test-project.supabase.co',
        SUPABASE_PUBLISHABLE_KEY:
          TEST_BROWSER_SUPABASE_KEY,
      }),
    /SUPABASE_URL moet HTTPS gebruiken/,
  );

  assert.throws(
    () =>
      resolveSupabaseBrowserConfig({
        SUPABASE_URL:
          'https://user:password@synthetic-test-project.supabase.co',
        SUPABASE_PUBLISHABLE_KEY:
          TEST_BROWSER_SUPABASE_KEY,
      }),
    /SUPABASE_URL mag geen credentials bevatten/,
  );

  assert.throws(
    () =>
      resolveSupabaseBrowserConfig({
        SUPABASE_URL:
          TEST_BROWSER_SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY:
          'service_role_mag_niet',
      }),
    /moet een publishable key zijn/,
  );
});
test('runtimeconfig bevat geen geheime omgevingswaarden', () => {
  const source = runtimeConfigSource(withBrowserSupabase({
    VERCEL_ENV: 'production',
    SANITY_API_TOKEN: 'nooit-publiceren',
    SUPABASE_SERVICE_ROLE_KEY:
      'service-role-nooit-publiceren',
  }));

  assert.match(
    source,
    /^window\.SpontaanRuntimeConfig = Object\.freeze\(/,
  );
  assert.match(source, /"dataset":"production"/);
  assert.match(source, /"environment":"production"/);
  assert.match(source, /"allowDemo":false/);
  assert.match(source, /"supabase":/);
  assert.match(
    source,
    /synthetic-test-project\.supabase\.co/,
  );
  assert.match(
    source,
    /sb_publishable_synthetic_test_only/,
  );
  assert.doesNotMatch(source, /SANITY_API_TOKEN/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(
    source,
    /service-role-nooit-publiceren/,
  );
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
          SUPABASE_URL:
            TEST_BROWSER_SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY:
            TEST_BROWSER_SUPABASE_KEY,
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

const allBuildFixtureNames = [
  'MEDIA_BUILD_FIXTURE',
  'REPERTOIRE_BUILD_FIXTURE',
  'FRIENDS_BUILD_FIXTURE',
  'ABOUT_BUILD_FIXTURE',
  'CONTACT_BUILD_FIXTURE',
  'HOME_BUILD_FIXTURE',
];

function productionBuildEnvironment({
  outputDirectory,
  fixtures,
  vercelEnvironment = 'production',
  gitCommitRef,
}) {
  const environment = {...process.env};

  for (const name of [
    ...allBuildFixtureNames,
    'VERCEL_ENV',
    'VERCEL_GIT_COMMIT_REF',
    'SANITY_DATASET',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SITE_OUTPUT_DIR',
    'PRODUCTION_TESTDATA_GUARD_FIXTURE',
    'NODE_ENV',
    'VERCEL',
  ]) {
    delete environment[name];
  }

  return {
    ...environment,
    VERCEL_ENV: vercelEnvironment,
    ...(gitCommitRef
      ? {VERCEL_GIT_COMMIT_REF: gitCommitRef}
      : {}),
    SANITY_DATASET:
      vercelEnvironment === 'production'
        ? 'production'
        : 'development',
    SUPABASE_URL:
      TEST_BROWSER_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY:
      TEST_BROWSER_SUPABASE_KEY,
    SITE_OUTPUT_DIR: outputDirectory,
    ...(vercelEnvironment === 'production'
      ? {
          NODE_ENV: 'test',
          PRODUCTION_TESTDATA_GUARD_FIXTURE:
            'tests/fixtures/production-testdata-clean.json',
        }
      : {}),
    ...fixtures,
  };
}

const validProductionFixtures = {
  MEDIA_BUILD_FIXTURE:
    'tests/fixtures/media-cms.json',
  REPERTOIRE_BUILD_FIXTURE:
    'tests/fixtures/repertoire-cms.json',
  FRIENDS_BUILD_FIXTURE:
    'tests/fixtures/friends-cms.json',
  ABOUT_BUILD_FIXTURE:
    'data/about-fallback.json',
  CONTACT_BUILD_FIXTURE:
    'data/contact-fallback.json',
  HOME_BUILD_FIXTURE:
    'tests/fixtures/home-cms.json',
};

test(
  'Production bouwt uitsluitend met zes geldige CMS-bronnen',
  async () => {
    const outputDirectory =
      'test-output/test-production-cms-gate-success';

    await rm(outputDirectory, {
      recursive: true,
      force: true,
    });

    try {
      const result = await exec(
        process.execPath,
        ['scripts/build-site.mjs'],
        {
          env: productionBuildEnvironment({
            outputDirectory,
            fixtures: validProductionFixtures,
          }),
        },
      );

      for (const name of [
        'MEDIA',
        'REPERTOIRE',
        'FRIENDS',
        'ABOUT',
        'CONTACT',
        'HOME',
      ]) {
        assert.match(
          result.stdout,
          new RegExp(
            `${name} BUILD: cms`,
          ),
        );
      }

      const runtimeConfig = await readFile(
        `${outputDirectory}/js/runtime-config.js`,
        'utf8',
      );

      assert.match(
        runtimeConfig,
        /"dataset":"production"/,
      );

      assert.match(
        runtimeConfig,
        /"environment":"production"/,
      );
    } finally {
      await rm(outputDirectory, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'Production verzamelt zes fouten en behoudt bestaande output',
  async () => {
    const testRoot =
      'test-output/test-production-cms-gate-failure';

    const outputDirectory =
      `${testRoot}/output`;

    const missingFixture =
      `${testRoot}/missing.json`;

    const sentinelFile =
      `${outputDirectory}/bestaande-output.txt`;

    const sentinelText =
      'Deze bestaande output mag niet worden gewijzigd.';

    await rm(testRoot, {
      recursive: true,
      force: true,
    });

    await mkdir(outputDirectory, {
      recursive: true,
    });

    await writeFile(
      missingFixture,
      JSON.stringify({result: null}),
      'utf8',
    );

    await writeFile(
      sentinelFile,
      sentinelText,
      'utf8',
    );

    const missingFixtures =
      Object.fromEntries(
        allBuildFixtureNames.map(
          (name) => [name, missingFixture],
        ),
      );

    try {
      await assert.rejects(
        exec(
          process.execPath,
          ['scripts/build-site.mjs'],
          {
            env: productionBuildEnvironment({
              outputDirectory,
              fixtures: missingFixtures,
            }),
          },
        ),
        (error) => {
          const combined =
            `${error.stdout || ''}\n` +
            `${error.stderr || ''}`;

          assert.match(
            combined,
            /Production-CMS-validatie mislukt/,
          );

          for (const pageName of [
            'Beeld en Geluid',
            'Muziek en repertoire',
            'Vrienden van Spontaan',
            'Over Spontaan',
            'Contact',
            'Homepage',
          ]) {
            assert.match(
              combined,
              new RegExp(pageName),
            );
          }

          assert.doesNotMatch(
            combined,
            /Cannot read properties of null/,
          );

          assert.doesNotMatch(
            combined,
            /BUILD: fallback ->/,
          );

          return true;
        },
      );

      assert.equal(
        await readFile(
          sentinelFile,
          'utf8',
        ),
        sentinelText,
      );

      await assert.rejects(
        readFile(
          `${outputDirectory}/js/runtime-config.js`,
          'utf8',
        ),
        /ENOENT/,
      );
    } finally {
      await rm(testRoot, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'Acceptatie-Preview bouwt uitsluitend met zes geldige CMS-bronnen',
  async () => {
    const outputDirectory =
      'test-output/test-acceptance-cms-gate-success';

    await rm(outputDirectory, {
      recursive: true,
      force: true,
    });

    try {
      const result = await exec(
        process.execPath,
        ['scripts/build-site.mjs'],
        {
          env: productionBuildEnvironment({
            outputDirectory,
            fixtures: validProductionFixtures,
            vercelEnvironment: 'preview',
            gitCommitRef: 'acceptance',
          }),
        },
      );

      for (const name of [
        'MEDIA',
        'REPERTOIRE',
        'FRIENDS',
        'ABOUT',
        'CONTACT',
        'HOME',
      ]) {
        assert.match(
          result.stdout,
          new RegExp(`${name} BUILD: cms`),
        );
      }

      const runtimeConfig = await readFile(
        `${outputDirectory}/js/runtime-config.js`,
        'utf8',
      );

      assert.match(
        runtimeConfig,
        /"dataset":"development"/,
      );

      assert.match(
        runtimeConfig,
        /"environment":"preview"/,
      );
    } finally {
      await rm(outputDirectory, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'Acceptatie-Preview weigert ontbrekende CMS-documenten en behoudt bestaande output',
  async () => {
    const testRoot =
      'test-output/test-acceptance-cms-gate-failure';

    const outputDirectory =
      `${testRoot}/output`;

    const missingFixture =
      `${testRoot}/missing.json`;

    const sentinelFile =
      `${outputDirectory}/bestaande-output.txt`;

    const sentinelText =
      'Deze bestaande output mag niet worden gewijzigd.';

    await rm(testRoot, {
      recursive: true,
      force: true,
    });

    await mkdir(outputDirectory, {
      recursive: true,
    });

    await writeFile(
      missingFixture,
      JSON.stringify({result: null}),
      'utf8',
    );

    await writeFile(
      sentinelFile,
      sentinelText,
      'utf8',
    );

    const missingFixtures =
      Object.fromEntries(
        allBuildFixtureNames.map(
          (name) => [name, missingFixture],
        ),
      );

    try {
      await assert.rejects(
        exec(
          process.execPath,
          ['scripts/build-site.mjs'],
          {
            env: productionBuildEnvironment({
              outputDirectory,
              fixtures: missingFixtures,
              vercelEnvironment: 'preview',
              gitCommitRef: 'acceptance',
            }),
          },
        ),
        (error) => {
          const combined =
            `${error.stdout || ''}\n` +
            `${error.stderr || ''}`;

          assert.match(
            combined,
            /Acceptatie-CMS-validatie mislukt/,
          );

          assert.doesNotMatch(
            combined,
            /BUILD: fallback ->/,
          );

          return true;
        },
      );

      assert.equal(
        await readFile(
          sentinelFile,
          'utf8',
        ),
        sentinelText,
      );

      await assert.rejects(
        readFile(
          `${outputDirectory}/js/runtime-config.js`,
          'utf8',
        ),
        /ENOENT/,
      );
    } finally {
      await rm(testRoot, {
        recursive: true,
        force: true,
      });
    }
  },
);
test(
  'Preview behoudt fallback bij zes ontbrekende CMS-documenten',
  async () => {
    const testRoot =
      'test-output/test-preview-cms-fallback';

    const outputDirectory =
      `${testRoot}/output`;

    const missingFixture =
      `${testRoot}/missing.json`;

    await rm(testRoot, {
      recursive: true,
      force: true,
    });

    await mkdir(testRoot, {
      recursive: true,
    });

    await writeFile(
      missingFixture,
      JSON.stringify({result: null}),
      'utf8',
    );

    const missingFixtures =
      Object.fromEntries(
        allBuildFixtureNames.map(
          (name) => [name, missingFixture],
        ),
      );

    try {
      const result = await exec(
        process.execPath,
        ['scripts/build-site.mjs'],
        {
          env: productionBuildEnvironment({
            outputDirectory,
            fixtures: missingFixtures,
            vercelEnvironment: 'preview',
            gitCommitRef: 'o/test-preview',
          }),
        },
      );

      for (const name of [
        'MEDIA',
        'REPERTOIRE',
        'FRIENDS',
        'ABOUT',
        'CONTACT',
        'HOME',
      ]) {
        assert.match(
          result.stdout,
          new RegExp(
            `${name} BUILD: fallback`,
          ),
        );
      }

      const runtimeConfig = await readFile(
        `${outputDirectory}/js/runtime-config.js`,
        'utf8',
      );

      assert.match(
        runtimeConfig,
        /"dataset":"development"/,
      );

      assert.match(
        runtimeConfig,
        /"environment":"preview"/,
      );
    } finally {
      await rm(testRoot, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'Production weigert onvolledige Media-inhoud en behoudt output',
  async () => {
    const testRoot =
      'test-output/test-production-invalid-media';
    const outputDirectory =
      `${testRoot}/output`;
    const fixtureFile =
      `${testRoot}/media-invalid.json`;
    const sentinelFile =
      `${outputDirectory}/bestaande-output.txt`;
    const sentinelText =
      'Bestaande output blijft behouden.';

    await rm(testRoot, {
      recursive: true,
      force: true,
    });
    await mkdir(outputDirectory, {
      recursive: true,
    });

    const mediaFixture = JSON.parse(
      await readFile(
        'tests/fixtures/media-cms.json',
        'utf8',
      ),
    );
    const mediaDocument =
      mediaFixture.result ?? mediaFixture;
    mediaDocument.page.introTitle = '';

    await writeFile(
      fixtureFile,
      JSON.stringify(mediaFixture),
      'utf8',
    );
    await writeFile(
      sentinelFile,
      sentinelText,
      'utf8',
    );

    try {
      await assert.rejects(
        exec(
          process.execPath,
          ['scripts/build-site.mjs'],
          {
            env: productionBuildEnvironment({
              outputDirectory,
              fixtures: {
                ...validProductionFixtures,
                MEDIA_BUILD_FIXTURE:
                  fixtureFile,
              },
            }),
          },
        ),
        (error) => {
          const combined =
            `${error.stdout || ''}\n` +
            `${error.stderr || ''}`;

          return (
            /Production-CMS-validatie mislukt/.test(
              combined,
            ) &&
            /Beeld en Geluid/.test(combined) &&
            /Verplichte Beeld-en-Geluid-paginavelden ontbreken/.test(
              combined,
            )
          );
        },
      );

      assert.equal(
        await readFile(sentinelFile, 'utf8'),
        sentinelText,
      );
    } finally {
      await rm(testRoot, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'Production weigert mojibake per CMS-pagina vóór outputwijziging',
  async () => {
    const brokenAccent = String.fromCharCode(
      0x00c3,
      0x00a9,
    );
    const cases = [
      {
        label: 'Beeld en Geluid',
        fixtureName: 'MEDIA_BUILD_FIXTURE',
        source: 'tests/fixtures/media-cms.json',
        mutate(value) {
          value.page.introTitle =
            `Muziek ${brokenAccent}n beeld`;
        },
      },
      {
        label: 'Muziek en repertoire',
        fixtureName: 'REPERTOIRE_BUILD_FIXTURE',
        source: 'tests/fixtures/repertoire-cms.json',
        mutate(value) {
          value.page.worldsIntro =
            `Muziek ${brokenAccent}n verhalen`;
        },
      },
      {
        label: 'Vrienden van Spontaan',
        fixtureName: 'FRIENDS_BUILD_FIXTURE',
        source: 'tests/fixtures/friends-cms.json',
        mutate(value) {
          value.page.supportIntro =
            `Steun ${brokenAccent}n verbinding`;
        },
      },
      {
        label: 'Over Spontaan',
        fixtureName: 'ABOUT_BUILD_FIXTURE',
        source: 'data/about-fallback.json',
        mutate(value) {
          value.heroSubtitle =
            `Samen ${brokenAccent}n betrokken`;
        },
      },
      {
        label: 'Contact',
        fixtureName: 'CONTACT_BUILD_FIXTURE',
        source: 'data/contact-fallback.json',
        mutate(value) {
          value.heroIntro =
            `Vragen ${brokenAccent}n contact`;
        },
      },
      {
        label: 'Homepage',
        fixtureName: 'HOME_BUILD_FIXTURE',
        source: 'tests/fixtures/home-cms.json',
        mutate(value) {
          value.heroSubtitle =
            `Zingen ${brokenAccent}n ontmoeten`;
        },
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const testRoot =
        `test-output/test-production-mojibake-${index + 1}`;
      const outputDirectory =
        `${testRoot}/output`;
      const fixtureFile =
        `${testRoot}/fixture.json`;
      const sentinelFile =
        `${outputDirectory}/bestaande-output.txt`;
      const sentinelText =
        `Bestaande output ${testCase.label}`;

      await rm(testRoot, {
        recursive: true,
        force: true,
      });
      await mkdir(outputDirectory, {
        recursive: true,
      });

      const fixture = JSON.parse(
        await readFile(testCase.source, 'utf8'),
      );
      const fixtureDocument =
        fixture.result ?? fixture;
      testCase.mutate(fixtureDocument);

      await writeFile(
        fixtureFile,
        JSON.stringify(fixture),
        'utf8',
      );
      await writeFile(
        sentinelFile,
        sentinelText,
        'utf8',
      );

      try {
        await assert.rejects(
          exec(
            process.execPath,
            ['scripts/build-site.mjs'],
            {
              env: productionBuildEnvironment({
                outputDirectory,
                fixtures: {
                  ...validProductionFixtures,
                  [testCase.fixtureName]: fixtureFile,
                },
              }),
            },
          ),
          (error) => {
            const combined =
              `${error.stdout || ''}\n` +
              `${error.stderr || ''}`;

            return (
              /Production-CMS-validatie mislukt/.test(
                combined,
              ) &&
              combined.includes(testCase.label) &&
              /Mojibake aangetroffen/.test(combined)
            );
          },
        );

        assert.equal(
          await readFile(sentinelFile, 'utf8'),
          sentinelText,
        );
      } finally {
        await rm(testRoot, {
          recursive: true,
          force: true,
        });
      }
    }
  },
);
