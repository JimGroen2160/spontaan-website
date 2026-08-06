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
}) {
  const environment = {...process.env};

  for (const name of [
    ...allBuildFixtureNames,
    'VERCEL_ENV',
    'SANITY_DATASET',
    'SITE_OUTPUT_DIR',
  ]) {
    delete environment[name];
  }

  return {
    ...environment,
    VERCEL_ENV: vercelEnvironment,
    SANITY_DATASET:
      vercelEnvironment === 'production'
        ? 'production'
        : 'development',
    SITE_OUTPUT_DIR: outputDirectory,
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
      'Downloads/test-production-cms-gate-success';

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
      'Downloads/test-production-cms-gate-failure';

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
  'Preview behoudt fallback bij zes ontbrekende CMS-documenten',
  async () => {
    const testRoot =
      'Downloads/test-preview-cms-fallback';

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
      'Downloads/test-production-invalid-media';
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
        `Downloads/test-production-mojibake-${index + 1}`;
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
