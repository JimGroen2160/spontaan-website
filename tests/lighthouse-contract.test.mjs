import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  LIGHTHOUSE_CHROME_FLAGS,
  LIGHTHOUSE_PAGES,
  LIGHTHOUSE_RESULTS_DIR,
  LIGHTHOUSE_VERSION,
} from '../lighthouse.config.mjs';
import {
  optimisticMaxNumericValue,
  optimisticMinScore,
  validateLighthouseResults,
} from '../scripts/check-lighthouse-results.mjs';
import {
  createLighthouseArgs,
  createRunPlan,
  executeLighthouseRun,
} from '../scripts/run-lighthouse.mjs';

function getPage(key) {
  return LIGHTHOUSE_PAGES.find((page) => page.key === key);
}

async function createResultsDir(t) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'spontaan-lighthouse-contract-'),
  );

  t.after(async () => {
    await rm(directory, {recursive: true, force: true});
  });

  return directory;
}

function makeReport(page, {
  performance = 0.6,
  accessibility = 0.8,
  seo = 0.8,
  cls = 0.1,
  version = LIGHTHOUSE_VERSION,
  requestedUrl = page.url,
  finalUrl = page.url,
  runtimeError = null,
  runWarnings = [],
} = {}) {
  const report = {
    lighthouseVersion: version,
    requestedUrl,
    finalDisplayedUrl: finalUrl,
    categories: {
      performance: {score: performance},
      accessibility: {score: accessibility},
      seo: {score: seo},
    },
    audits: {
      'cumulative-layout-shift': {numericValue: cls},
    },
    runWarnings,
  };

  if (runtimeError) {
    report.runtimeError = runtimeError;
  }

  return report;
}

async function writeReport(resultsDir, page, run, report, {
  html = '<html><body>ok</body></html>',
} = {}) {
  const pageDir = path.join(resultsDir, page.key);
  await mkdir(pageDir, {recursive: true});

  const outputBase = path.join(pageDir, `run-${run}`);
  await writeFile(
    `${outputBase}.report.json`,
    `${JSON.stringify(report)}\n`,
    'utf8',
  );
  await writeFile(
    `${outputBase}.report.html`,
    html,
    'utf8',
  );
}

async function writeValidResults(resultsDir, overrides = {}) {
  for (const page of LIGHTHOUSE_PAGES) {
    for (let run = 1; run <= page.runs; run += 1) {
      const pageOverrides = overrides[page.key]?.[run] ?? {};
      await writeReport(
        resultsDir,
        page,
        run,
        makeReport(page, pageOverrides),
      );
    }
  }
}

test('config bevat de volledige Lighthouse-paginamatrix en routeklassen', () => {
  assert.equal(LIGHTHOUSE_VERSION, '13.4.1');
  assert.equal(LIGHTHOUSE_RESULTS_DIR, 'test-output/lighthouse');
  assert.equal(
    LIGHTHOUSE_CHROME_FLAGS,
    '--no-sandbox --disable-dev-shm-usage --headless=new',
  );

  assert.equal(LIGHTHOUSE_PAGES.length, 18);

  const classCounts = LIGHTHOUSE_PAGES.reduce((counts, page) => {
    counts[page.pageClass] = (counts[page.pageClass] || 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(classCounts, {
    public: 9,
    auth: 3,
    protected: 6,
  });

  assert.equal(
    new Set(LIGHTHOUSE_PAGES.map((page) => page.key)).size,
    LIGHTHOUSE_PAGES.length,
  );

  assert.equal(
    new Set(LIGHTHOUSE_PAGES.map((page) => page.url)).size,
    LIGHTHOUSE_PAGES.length,
  );

  for (const page of LIGHTHOUSE_PAGES) {
    assert.deepEqual(page.thresholds.performance, {
      type: 'minScore',
      value: 0.6,
    });
    assert.deepEqual(page.thresholds.accessibility, {
      type: 'minScore',
      value: 0.8,
    });

    if (page.pageClass === 'public') {
      assert.deepEqual(page.thresholds.seo, {
        type: 'minScore',
        value: 0.8,
      });
      assert.equal(page.readiness, undefined);
    } else {
      assert.equal(
        Object.hasOwn(page.thresholds, 'seo'),
        false,
      );
    }

    if (page.pageClass === 'protected') {
      assert.equal(typeof page.readiness?.selector, 'string');
      assert.ok(page.readiness.selector.length > 0);
      assert.ok(Array.isArray(page.readiness.requiredTables));
      assert.ok(Array.isArray(page.readiness.requiredRpcs));
    }
  }

  assert.deepEqual(
    getPage('repertoire').thresholds['cumulative-layout-shift'],
    {type: 'maxNumericValue', value: 0.1},
  );

  assert.equal(
    getPage('news-detail').url,
    'http://localhost:5500/pages/nieuwsbericht.html' +
      '?slug=spontaan-zingt-tijdens-een-sfeervolle-zomeravond',
  );

  assert.equal(
    getPage('admin-members').readiness.selector,
    '#ledenbeheer-lijst-body tr.ledenbeheer-member-row',
  );

  assert.deepEqual(
    getPage('admin-portal').readiness.requiredTables,
    [
      'profiles',
      'member_songs',
      'member_song_links',
      'member_directory',
    ],
  );

  assert.deepEqual(
    getPage('admin-portal').readiness.requiredRpcs,
    [],
  );
  assert.equal(
    getPage('admin-report').readiness.loadedTextSelector,
    '#rapportage-status-title',
  );
  assert.equal(
    getPage('admin-report').readiness.forbiddenLoadedText,
    'wordt geladen',
  );
});

test('runner plant exact twintig Lighthouse-processen', () => {
  const plan = createRunPlan();

  assert.equal(plan.length, 20);

  const counts = plan.reduce((result, run) => {
    result[run.pageKey] = (result[run.pageKey] || 0) + 1;
    return result;
  }, {});

  assert.equal(Object.keys(counts).length, 18);

  for (const page of LIGHTHOUSE_PAGES) {
    assert.equal(counts[page.key], page.runs);
  }

  assert.equal(counts.repertoire, 3);

  for (const page of LIGHTHOUSE_PAGES.filter(
    (candidate) => candidate.key !== 'repertoire',
  )) {
    assert.equal(counts[page.key], 1);
  }
});
test('runner bouwt directe Lighthouse CLI-argumenten zonder thresholdlogica', () => {
  const [run] = createRunPlan();
  const args = createLighthouseArgs(run);

  assert.deepEqual(args, [
    'http://localhost:5500/',
    '--quiet',
    '--chrome-flags=--no-sandbox --disable-dev-shm-usage --headless=new',
    '--output=json',
    '--output=html',
    '--output-path=test-output/lighthouse/home/run-1',
  ]);
});

test('runner faalt gesloten als Lighthouse-proces faalt', async () => {
  const [run] = createRunPlan();

  await assert.rejects(
    executeLighthouseRun(run, {
      lighthouseCli: '/synthetic/lighthouse/cli/index.js',
      execute: async () => {
        const error = new Error('synthetic process failure');
        error.stderr = 'synthetic stderr';
        throw error;
      },
    }),
    /Lighthouse faalde voor home\/run-1:[\s\S]*synthetic stderr/,
  );
});

test('runner faalt gesloten als JSON-output na succesvolle CLI-run ontbreekt', async (t) => {
  const outputRoot = await createResultsDir(t);
  const [run] = createRunPlan({resultsDir: 'synthetic-results'});

  await assert.rejects(
    executeLighthouseRun(run, {
      lighthouseCli: '/synthetic/lighthouse/cli/index.js',
      execute: async () => {},
      outputRoot,
    }),
    /ontbrekend of leeg rapportbestand.*run-1\.report\.json/,
  );
});

test('runner faalt gesloten als JSON-output na succesvolle CLI-run leeg is', async (t) => {
  const outputRoot = await createResultsDir(t);
  const [run] = createRunPlan({resultsDir: 'synthetic-results'});
  const outputBase = path.resolve(outputRoot, run.outputBase);

  await mkdir(path.dirname(outputBase), {recursive: true});
  await writeFile(`${outputBase}.report.json`, '', 'utf8');
  await writeFile(`${outputBase}.report.html`, 'ok', 'utf8');

  await assert.rejects(
    executeLighthouseRun(run, {
      lighthouseCli: '/synthetic/lighthouse/cli/index.js',
      execute: async () => {},
      outputRoot,
    }),
    /ontbrekend of leeg rapportbestand.*run-1\.report\.json/,
  );
});

test('runner faalt gesloten als HTML-output na succesvolle CLI-run ontbreekt', async (t) => {
  const outputRoot = await createResultsDir(t);
  const [run] = createRunPlan({resultsDir: 'synthetic-results'});
  const outputBase = path.resolve(outputRoot, run.outputBase);

  await mkdir(path.dirname(outputBase), {recursive: true});
  await writeFile(`${outputBase}.report.json`, '{}\n', 'utf8');

  await assert.rejects(
    executeLighthouseRun(run, {
      lighthouseCli: '/synthetic/lighthouse/cli/index.js',
      execute: async () => {},
      outputRoot,
    }),
    /ontbrekend of leeg rapportbestand.*run-1\.report\.html/,
  );
});

test('runner faalt gesloten als HTML-output na succesvolle CLI-run leeg is', async (t) => {
  const outputRoot = await createResultsDir(t);
  const [run] = createRunPlan({resultsDir: 'synthetic-results'});
  const outputBase = path.resolve(outputRoot, run.outputBase);

  await mkdir(path.dirname(outputBase), {recursive: true});
  await writeFile(`${outputBase}.report.json`, '{}\n', 'utf8');
  await writeFile(`${outputBase}.report.html`, '', 'utf8');

  await assert.rejects(
    executeLighthouseRun(run, {
      lighthouseCli: '/synthetic/lighthouse/cli/index.js',
      execute: async () => {},
      outputRoot,
    }),
    /ontbrekend of leeg rapportbestand.*run-1\.report\.html/,
  );
});

test('optimistic aggregatie behoudt LHCI-semantiek', () => {
  assert.equal(optimisticMinScore([0.61, 0.72, 0.65]), 0.72);
  assert.equal(
    optimisticMaxNumericValue([0.09, 0.04, 0.08]),
    0.04,
  );
});

test('exacte thresholdgrenzen slagen', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir);

  const result = validateLighthouseResults({resultsDir});

  assert.equal(
    result.summaries.home.metrics.performance.observed,
    0.6,
  );
  assert.equal(
    result.summaries.repertoire.metrics[
      'cumulative-layout-shift'
    ].observed,
    0.1,
  );
});

test('optimistic performance gebruikt hoogste repertoire-run', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    repertoire: {
      1: {performance: 0.4},
      2: {performance: 0.6},
      3: {performance: 0.5},
    },
  });

  const result = validateLighthouseResults({resultsDir});
  assert.equal(
    result.summaries.repertoire.metrics.performance.observed,
    0.6,
  );
});

test('performance onder grens faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    home: {1: {performance: 0.59}},
  });

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /home: threshold performance niet gehaald/,
  );
});

test('optimistic CLS gebruikt laagste repertoire-run', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    repertoire: {
      1: {cls: 0.12},
      2: {cls: 0.1},
      3: {cls: 0.11},
    },
  });

  const result = validateLighthouseResults({resultsDir});
  assert.equal(
    result.summaries.repertoire.metrics[
      'cumulative-layout-shift'
    ].observed,
    0.1,
  );
});

test('CLS boven grens in alle repertoire-runs faalt', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    repertoire: {
      1: {cls: 0.11},
      2: {cls: 0.12},
      3: {cls: 0.13},
    },
  });

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /repertoire: threshold cumulative-layout-shift niet gehaald/,
  );
});

test('ontbrekend JSON-rapport faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir);
  await rm(
    path.join(resultsDir, 'media', 'run-1.report.json'),
    {force: true},
  );

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /Ontbrekend JSON-rapport/,
  );
});

test('onverwacht extra JSON-rapport faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir);
  await writeFile(
    path.join(resultsDir, 'home', 'run-99.report.json'),
    '{}\n',
    'utf8',
  );

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /Onverwacht Lighthouse-rapport:.*run-99\.report\.json/,
  );
});

test('onverwacht extra HTML-rapport faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir);
  await writeFile(
    path.join(resultsDir, 'home', 'run-99.report.html'),
    '<html></html>',
    'utf8',
  );

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /Onverwacht Lighthouse-rapport:.*run-99\.report\.html/,
  );
});

test('ongeldige JSON faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir);
  await writeFile(
    path.join(resultsDir, 'home', 'run-1.report.json'),
    '{invalid',
    'utf8',
  );

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /Kan JSON niet lezen/,
  );
});

test('ontbrekende of niet-finiete score faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir);

  const page = getPage('home');
  const report = makeReport(page);
  report.categories.performance.score = null;
  await writeReport(resultsDir, page, 1, report);

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /ongeldige of ontbrekende performance-score/,
  );
});

test('verkeerde Lighthouse-versie faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    media: {1: {version: '13.4.0'}},
  });

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /Lighthouse-versie 13\.4\.0 != 13\.4\.1/,
  );
});

test('verkeerde requested URL faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    home: {1: {requestedUrl: 'http://localhost:5500/anders'}},
  });

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /requestedUrl/,
  );
});

test('verkeerde final URL faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    media: {1: {finalUrl: 'http://localhost:5500/anders'}},
  });

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /final URL/,
  );
});

test('leeg HTML-rapport faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir);
  await writeFile(
    path.join(resultsDir, 'home', 'run-1.report.html'),
    '',
    'utf8',
  );

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /Ontbrekend of leeg HTML-rapport/,
  );
});

test('runtimeError faalt gesloten', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    home: {1: {runtimeError: {code: 'SYNTHETIC'}}},
  });

  assert.throws(
    () => validateLighthouseResults({resultsDir}),
    /runtimeError/,
  );
});

test('runWarnings worden zichtbaar maar introduceren geen nieuwe blokkade', async (t) => {
  const resultsDir = await createResultsDir(t);
  await writeValidResults(resultsDir, {
    home: {1: {runWarnings: ['synthetic warning']}},
  });

  const result = validateLighthouseResults({resultsDir});
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /synthetic warning/);
});

// LIGHTHOUSE SYNTHETIC SUPABASE CONTRACT

test('synthetische runtimeconfig gebruikt uitsluitend .invalid Supabase-config', async () => {
  const {
    SYNTHETIC_SUPABASE_URL,
    SYNTHETIC_SUPABASE_PUBLISHABLE_KEY,
    syntheticRuntimeConfigSource,
  } = await import(
    './helpers/lighthouse-supabase-stub.mjs'
  );

  const page = getPage('member-music');
  const source = syntheticRuntimeConfigSource(page);

  assert.equal(
    SYNTHETIC_SUPABASE_URL,
    'https://lighthouse-synthetic.supabase.invalid',
  );

  assert.equal(
    SYNTHETIC_SUPABASE_PUBLISHABLE_KEY,
    'sb_publishable_lighthouse_synthetic',
  );

  assert.match(
    source,
    /lighthouse-synthetic\.supabase\.invalid/,
  );

  assert.match(
    source,
    /sb_publishable_lighthouse_synthetic/,
  );

  assert.doesNotMatch(
    source,
    /service[_-]?role/i,
  );

  assert.doesNotMatch(
    source,
    /process\.env/,
  );
});

test('auth-state is uitgelogd en protected-state heeft een actieve rol', async () => {
  const {
    createSyntheticState,
  } = await import(
    './helpers/lighthouse-supabase-stub.mjs'
  );

  const authState =
    createSyntheticState(
      getPage('login'),
    );

  assert.equal(
    authState.session,
    null,
  );

  assert.equal(
    authState.currentProfile,
    null,
  );

  const memberState =
    createSyntheticState(
      getPage('member-music'),
    );

  assert.equal(
    memberState.currentProfile.role,
    'member',
  );

  assert.equal(
    memberState.currentProfile.status,
    'active',
  );

  assert.equal(
    memberState.session.user.id,
    memberState.currentProfile.auth_user_id,
  );

  const adminState =
    createSyntheticState(
      getPage('admin-portal'),
    );

  assert.equal(
    adminState.currentProfile.role,
    'contentmanager',
  );

  assert.equal(
    adminState.currentProfile.status,
    'active',
  );
});

test('synthetische client ondersteunt uitsluitend benodigde read-contracten', async () => {
  const {
    createSyntheticState,
    createSyntheticSupabaseClient,
  } = await import(
    './helpers/lighthouse-supabase-stub.mjs'
  );

  const state =
    createSyntheticState(
      getPage('member-music'),
    );

  const client =
    createSyntheticSupabaseClient(
      state,
    );

  const {
    data: sessionData,
    error: sessionError,
  } =
    await client.auth.getSession();

  assert.equal(
    sessionError,
    null,
  );

  assert.ok(
    sessionData.session,
  );

  const {
    data: profile,
    error: profileError,
  } =
    await client
      .from('profiles')
      .select('*')
      .eq(
        'auth_user_id',
        state.currentProfile.auth_user_id,
      )
      .single();

  assert.equal(
    profileError,
    null,
  );

  assert.equal(
    profile.id,
    state.currentProfile.id,
  );

  const {
    data: songs,
    error: songsError,
  } =
    await client
      .from('member_songs')
      .select('*')
      .eq('is_visible', true)
      .order('sort_order');

  assert.equal(
    songsError,
    null,
  );

  assert.ok(
    songs.length >= 1,
  );

  assert.ok(
    client.__state.calls.some(
      (call) =>
        call.kind === 'table' &&
        call.table === 'profiles',
    ),
  );

  assert.ok(
    client.__state.calls.some(
      (call) =>
        call.kind === 'table' &&
        call.table === 'member_songs',
    ),
  );
});

test('smoelenboek-RPC levert uitsluitend synthetische directorydata', async () => {
  const {
    createSyntheticState,
    createSyntheticSupabaseClient,
  } = await import(
    './helpers/lighthouse-supabase-stub.mjs'
  );

  const state =
    createSyntheticState(
      getPage('member-directory'),
    );

  const client =
    createSyntheticSupabaseClient(
      state,
    );

  const {
    data,
    error,
  } =
    await client.rpc(
      'get_member_directory',
    );

  assert.equal(
    error,
    null,
  );

  assert.ok(
    Array.isArray(data),
  );

  assert.ok(
    data.length >= 1,
  );

  assert.ok(
    client.__state.calls.some(
      (call) =>
        call.kind === 'rpc' &&
        call.name ===
          'get_member_directory',
    ),
  );
});

test('alle synthetische mutaties falen gesloten en veranderen data niet', async () => {
  const {
    SYNTHETIC_MUTATION_ERROR,
    createSyntheticState,
    createSyntheticSupabaseClient,
  } = await import(
    './helpers/lighthouse-supabase-stub.mjs'
  );

  const state =
    createSyntheticState(
      getPage('admin-portal'),
    );

  const client =
    createSyntheticSupabaseClient(
      state,
    );

  const beforeSongs =
    JSON.stringify(
      client.__state.songs,
    );

  const operations = [
    client
      .from('member_songs')
      .insert({title: 'Niet opslaan'}),
    client
      .from('member_songs')
      .update({title: 'Niet wijzigen'})
      .eq('id', 'lh-song-1'),
    client
      .from('member_songs')
      .delete()
      .eq('id', 'lh-song-1'),
    client
      .from('member_directory')
      .upsert({
        profile_id: 'lh-member-1',
        memo: 'Niet opslaan',
      }),
  ];

  for (const operation of operations) {
    const result =
      await operation;

    assert.equal(
      result.data,
      null,
    );

    assert.equal(
      result.error.message,
      SYNTHETIC_MUTATION_ERROR,
    );
  }

  const uploadResult =
    await client.storage
      .from('member-photos')
      .upload(
        'test.webp',
        new Uint8Array([1]),
      );

  assert.equal(
    uploadResult.data,
    null,
  );

  assert.equal(
    uploadResult.error.message,
    SYNTHETIC_MUTATION_ERROR,
  );

  assert.equal(
    JSON.stringify(
      client.__state.songs,
    ),
    beforeSongs,
  );

  assert.ok(
    client.__state.calls.filter(
      (call) =>
        call.kind === 'blocked-write',
    ).length >= 5,
  );
});

test('gegenereerde Supabase SDK is test-only en bevat geen omgevingscredentials', async () => {
  const {
    syntheticSupabaseSdkSource,
  } = await import(
    './helpers/lighthouse-supabase-stub.mjs'
  );

  const source =
    syntheticSupabaseSdkSource(
      getPage('admin-portal'),
    );

  assert.match(
    source,
    /window\.supabase/,
  );

  assert.match(
    source,
    /__SPONTAAN_LIGHTHOUSE_STATE__/,
  );

  assert.doesNotMatch(
    source,
    /process\.env/,
  );

  assert.doesNotMatch(
    source,
    /service[_-]?role/i,
  );

  assert.doesNotMatch(
    source,
    /supabase\.co/,
  );
});

// LIGHTHOUSE TEST SERVER CONTRACT

test('Lighthouse-testserver weigert niet-loopback binding', async () => {
  const {
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  assert.throws(
    () =>
      createLighthouseTestServer({
        distRoot: '.',
        page: getPage('home'),
        host: '0.0.0.0',
      }),
    /alleen op 127\.0\.0\.1/,
  );
});

test('Lighthouse-testserver serveert publieke assets bytegetrouw', async (t) => {
  const {
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const root =
    await createResultsDir(t);

  await writeFile(
    path.join(root, 'index.html'),
    '<html><body>publiek</body></html>',
    'utf8',
  );

  await writeFile(
    path.join(root, 'asset.txt'),
    'exact-byte-content',
    'utf8',
  );

  const server =
    createLighthouseTestServer({
      distRoot: root,
      page: getPage('home'),
    });

  const address =
    await server.start();

  t.after(
    () => server.stop(),
  );

  const response =
    await fetch(
      `${address.origin}/asset.txt`,
    );

  assert.equal(
    response.status,
    200,
  );

  assert.equal(
    await response.text(),
    'exact-byte-content',
  );
});

test('Lighthouse-testserver blokkeert onbekende interne routes en methoden', async (t) => {
  const {
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const root =
    await createResultsDir(t);

  await writeFile(
    path.join(root, 'index.html'),
    '<html></html>',
    'utf8',
  );

  const server =
    createLighthouseTestServer({
      distRoot: root,
      page: getPage('login'),
    });

  const address =
    await server.start();

  t.after(
    () => server.stop(),
  );

  const internal =
    await fetch(
      `${address.origin}/__lighthouse__/unknown`,
    );

  assert.equal(
    internal.status,
    404,
  );

  const post =
    await fetch(
      `${address.origin}/`,
      {
        method: 'POST',
      },
    );

  assert.equal(
    post.status,
    405,
  );
});

test('AUTH response vervangt uitsluitend runtimeconfig en Supabase SDK in memory', async (t) => {
  const {
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const root =
    await createResultsDir(t);

  const html = [
    '<html><body>',
    '<script src="../js/runtime-config.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
    '<script src="../js/auth.js"></script>',
    '</body></html>',
  ].join('');

  const pageDir =
    path.join(root, 'leden');

  await mkdir(
    pageDir,
    {recursive: true},
  );

  const file =
    path.join(
      pageDir,
      'login.html',
    );

  await writeFile(
    file,
    html,
    'utf8',
  );

  const before =
    await readFile(
      file,
      'utf8',
    );

  const server =
    createLighthouseTestServer({
      distRoot: root,
      page: getPage('login'),
    });

  const address =
    await server.start();

  t.after(
    () => server.stop(),
  );

  const response =
    await fetch(
      `${address.origin}/leden/login.html`,
    );

  const served =
    await response.text();

  assert.match(
    served,
    /\/__lighthouse__\/runtime-config\.js/,
  );

  assert.match(
    served,
    /\/__lighthouse__\/supabase\.js/,
  );

  assert.match(
    served,
    /\.\.\/js\/auth\.js/,
  );

  assert.doesNotMatch(
    served,
    /cdn\.jsdelivr\.net/,
  );

  const after =
    await readFile(
      file,
      'utf8',
    );

  assert.equal(
    after,
    before,
  );
});

test('synthetische runtimeconfig en SDK worden alleen bij AUTH/PROTECTED aangeboden', async (t) => {
  const {
    SYNTHETIC_RUNTIME_CONFIG_PATH,
    SYNTHETIC_SDK_PATH,
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const root =
    await createResultsDir(t);

  await writeFile(
    path.join(root, 'index.html'),
    '<html></html>',
    'utf8',
  );

  const publicServer =
    createLighthouseTestServer({
      distRoot: root,
      page: getPage('home'),
    });

  const publicAddress =
    await publicServer.start();

  const runtimePublic =
    await fetch(
      publicAddress.origin +
      SYNTHETIC_RUNTIME_CONFIG_PATH,
    );

  assert.equal(
    runtimePublic.status,
    404,
  );

  await publicServer.stop();

  const authServer =
    createLighthouseTestServer({
      distRoot: root,
      page: getPage('login'),
    });

  const authAddress =
    await authServer.start();

  t.after(
    () => authServer.stop(),
  );

  const runtimeAuth =
    await fetch(
      authAddress.origin +
      SYNTHETIC_RUNTIME_CONFIG_PATH,
    );

  assert.equal(
    runtimeAuth.status,
    200,
  );

  const runtimeSource =
    await runtimeAuth.text();

  assert.match(
    runtimeSource,
    /lighthouse-synthetic\.supabase\.invalid/,
  );

  const sdkAuth =
    await fetch(
      authAddress.origin +
      SYNTHETIC_SDK_PATH,
    );

  assert.equal(
    sdkAuth.status,
    200,
  );

  assert.match(
    await sdkAuth.text(),
    /window\.supabase/,
  );
});

test('Lighthouse-testserver schrijft niets naar dist tijdens requests', async (t) => {
  const {
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const root =
    await createResultsDir(t);

  const pageDir =
    path.join(root, 'leden');

  const jsDir =
    path.join(root, 'js');

  await mkdir(
    pageDir,
    {recursive: true},
  );

  await mkdir(
    jsDir,
    {recursive: true},
  );

  const htmlFile =
    path.join(
      pageDir,
      'login.html',
    );

  const runtimeFile =
    path.join(
      jsDir,
      'runtime-config.js',
    );

  await writeFile(
    htmlFile,
    [
      '<script src="../js/runtime-config.js"></script>',
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
    ].join(''),
    'utf8',
  );

  await writeFile(
    runtimeFile,
    'window.REAL_CONFIG = true;',
    'utf8',
  );

  const htmlBefore =
    await readFile(
      htmlFile,
      'utf8',
    );

  const runtimeBefore =
    await readFile(
      runtimeFile,
      'utf8',
    );

  const server =
    createLighthouseTestServer({
      distRoot: root,
      page: getPage('login'),
    });

  const address =
    await server.start();

  t.after(
    () => server.stop(),
  );

  await fetch(
    `${address.origin}/leden/login.html`,
  );

  await fetch(
    `${address.origin}/__lighthouse__/runtime-config.js`,
  );

  assert.equal(
    await readFile(
      htmlFile,
      'utf8',
    ),
    htmlBefore,
  );

  assert.equal(
    await readFile(
      runtimeFile,
      'utf8',
    ),
    runtimeBefore,
  );
});

// LIGHTHOUSE READINESS CONTRACT

test('protected readiness-reporter gebruikt uitsluitend synthetic state en localhost-endpoint', async () => {
  const {
    syntheticReadinessReporterSource,
  } = await import(
    './helpers/lighthouse-supabase-stub.mjs'
  );

  const source =
    syntheticReadinessReporterSource(
      getPage('member-music'),
    );

  assert.match(
    source,
    /__SPONTAAN_LIGHTHOUSE_STATE__/,
  );

  assert.match(
    source,
    /\/__lighthouse__\/readiness/,
  );

  assert.match(
    source,
    /blocked-write/,
  );

  assert.doesNotMatch(
    source,
    /process\.env/,
  );

  assert.doesNotMatch(
    source,
    /supabase\.co/,
  );
});

test('readiness-reporter wordt alleen in protected HTML geïnjecteerd', async () => {
  const {
    SYNTHETIC_READINESS_SCRIPT_PATH,
    rewriteHtmlForSyntheticHarness,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const html = [
    '<script src="../js/runtime-config.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
  ].join('');

  const auth =
    rewriteHtmlForSyntheticHarness(
      html,
      {
        includeReadiness: false,
      },
    );

  assert.doesNotMatch(
    auth,
    /readiness\.js/,
  );

  const protectedHtml =
    rewriteHtmlForSyntheticHarness(
      html,
      {
        includeReadiness: true,
      },
    );

  assert.match(
    protectedHtml,
    new RegExp(
      SYNTHETIC_READINESS_SCRIPT_PATH
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    ),
  );
});

test('protected server faalt gesloten zolang readiness niet is bewezen', async (t) => {
  const {
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const root =
    await createResultsDir(t);

  await mkdir(
    path.join(root, 'leden'),
    {recursive: true},
  );

  await writeFile(
    path.join(
      root,
      'leden',
      'muziek.html',
    ),
    [
      '<script src="../js/runtime-config.js"></script>',
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
    ].join(''),
    'utf8',
  );

  const server =
    createLighthouseTestServer({
      distRoot: root,
      page: getPage('member-music'),
    });

  await server.start();

  t.after(
    () => server.stop(),
  );

  assert.throws(
    () => server.assertReadiness(),
    /readiness ontbreekt/,
  );
});

test('readiness-endpoint accepteert alleen volledig protected callcontract', async (t) => {
  const {
    SYNTHETIC_READINESS_ENDPOINT,
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const root =
    await createResultsDir(t);

  await mkdir(
    path.join(root, 'leden'),
    {recursive: true},
  );

  await writeFile(
    path.join(
      root,
      'leden',
      'muziek.html',
    ),
    '<html></html>',
    'utf8',
  );

  const page =
    getPage('member-music');

  const server =
    createLighthouseTestServer({
      distRoot: root,
      page,
    });

  const address =
    await server.start();

  t.after(
    () => server.stop(),
  );

  const incomplete =
    await fetch(
      address.origin +
        SYNTHETIC_READINESS_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          pageKey: page.key,
          ready: true,
          observedTables: [
            'profiles',
          ],
          observedRpcs: [],
          blockedWrites: 0,
        }),
      },
    );

  assert.equal(
    incomplete.status,
    400,
  );

  assert.throws(
    () => server.assertReadiness(),
    /readiness ontbreekt/,
  );

  const complete =
    await fetch(
      address.origin +
        SYNTHETIC_READINESS_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          pageKey: page.key,
          ready: true,
          observedTables:
            [...page.readiness.requiredTables],
          observedRpcs:
            [...page.readiness.requiredRpcs],
          blockedWrites: 0,
        }),
      },
    );

  assert.equal(
    complete.status,
    204,
  );

  const readiness =
    server.assertReadiness();

  assert.equal(
    readiness.required,
    true,
  );

  assert.equal(
    readiness.report.pageKey,
    page.key,
  );
});

test('readiness-endpoint weigert writes, verkeerd contenttype en niet-protected gebruik', async (t) => {
  const {
    SYNTHETIC_READINESS_ENDPOINT,
    createLighthouseTestServer,
  } = await import(
    '../scripts/lighthouse-test-server.mjs'
  );

  const root =
    await createResultsDir(t);

  await mkdir(
    path.join(root, 'admin'),
    {recursive: true},
  );

  await writeFile(
    path.join(
      root,
      'admin',
      'ledenportaal.html',
    ),
    '<html></html>',
    'utf8',
  );

  await writeFile(
    path.join(root, 'index.html'),
    '<html></html>',
    'utf8',
  );

  const page =
    getPage('admin-portal');

  const protectedServer =
    createLighthouseTestServer({
      distRoot: root,
      page,
    });

  const protectedAddress =
    await protectedServer.start();

  const wrongType =
    await fetch(
      protectedAddress.origin +
        SYNTHETIC_READINESS_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'text/plain',
        },
        body: '{}',
      },
    );

  assert.equal(
    wrongType.status,
    415,
  );

  const blockedWrite =
    await fetch(
      protectedAddress.origin +
        SYNTHETIC_READINESS_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          pageKey: page.key,
          ready: true,
          observedTables:
            [...page.readiness.requiredTables],
          observedRpcs:
            [...page.readiness.requiredRpcs],
          blockedWrites: 1,
        }),
      },
    );

  assert.equal(
    blockedWrite.status,
    400,
  );

  await protectedServer.stop();

  const publicServer =
    createLighthouseTestServer({
      distRoot: root,
      page: getPage('home'),
    });

  const publicAddress =
    await publicServer.start();

  t.after(
    () => publicServer.stop(),
  );

  const publicPost =
    await fetch(
      publicAddress.origin +
        SYNTHETIC_READINESS_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: '{}',
      },
    );

  assert.equal(
    publicPost.status,
    404,
  );
});

// LIGHTHOUSE RUNNER SERVER CONTRACT

test('runplan bewaart volledige page-config voor serverisolatie', () => {
  const plan =
    createRunPlan();

  assert.equal(
    plan.length,
    20,
  );

  for (const run of plan) {
    assert.ok(
      run.page,
    );

    assert.equal(
      run.page.key,
      run.pageKey,
    );

    assert.equal(
      run.page.url,
      run.url,
    );
  }
});

test('runner start en stopt per run exact één page-specifieke server', async () => {
  const {
    executeLighthouseRunWithServer,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const run =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
    })[0];

  const calls = [];

  const fakeServer = {
    async start() {
      calls.push('start');

      return {
        host: '127.0.0.1',
        port: 5500,
        origin:
          'http://127.0.0.1:5500',
      };
    },

    assertReadiness() {
      calls.push(
        'readiness',
      );

      return {
        required: false,
      };
    },

    async stop() {
      calls.push('stop');
    },
  };

  const result =
    await executeLighthouseRunWithServer(
      run,
      {
        createServer(options) {
          assert.equal(
            options.page.key,
            'home',
          );

          assert.equal(
            options.port,
            5500,
          );

          calls.push(
            'create',
          );

          return fakeServer;
        },

        async executeRun(
          actualRun,
        ) {
          assert.equal(
            actualRun.pageKey,
            'home',
          );

          calls.push(
            'execute',
          );
        },
      },
    );

  assert.deepEqual(
    calls,
    [
      'create',
      'start',
      'execute',
      'readiness',
      'stop',
    ],
  );

  assert.deepEqual(
    result,
    {
      required: false,
    },
  );
});

test('runner controleert protected readiness na Lighthouse en voor server-stop', async () => {
  const {
    executeLighthouseRunWithServer,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const run =
    createRunPlan({
      pages: [
        getPage(
          'member-music',
        ),
      ],
    })[0];

  const calls = [];

  const readiness = {
    required: true,
    report: {
      pageKey:
        'member-music',
    },
  };

  const result =
    await executeLighthouseRunWithServer(
      run,
      {
        createServer() {
          return {
            async start() {
              calls.push('start');

              return {
                host:
                  '127.0.0.1',
                port: 5500,
              };
            },

            assertReadiness() {
              calls.push(
                'readiness',
              );

              return readiness;
            },

            async stop() {
              calls.push('stop');
            },
          };
        },

        async executeRun() {
          calls.push(
            'execute',
          );
        },
      },
    );

  assert.deepEqual(
    calls,
    [
      'start',
      'execute',
      'readiness',
      'stop',
    ],
  );

  assert.equal(
    result,
    readiness,
  );
});

test('runner stopt server ook wanneer Lighthouse-proces faalt', async () => {
  const {
    executeLighthouseRunWithServer,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const run =
    createRunPlan({
      pages: [
        getPage('login'),
      ],
    })[0];

  let stopped =
    false;

  await assert.rejects(
    executeLighthouseRunWithServer(
      run,
      {
        createServer() {
          return {
            async start() {
              return {
                host:
                  '127.0.0.1',
                port: 5500,
              };
            },

            assertReadiness() {
              throw new Error(
                'mag niet worden bereikt',
              );
            },

            async stop() {
              stopped =
                true;
            },
          };
        },

        async executeRun() {
          throw new Error(
            'synthetic lighthouse failure',
          );
        },
      },
    ),
    /synthetic lighthouse failure/,
  );

  assert.equal(
    stopped,
    true,
  );
});

test('runner stopt server ook wanneer protected readiness ontbreekt', async () => {
  const {
    executeLighthouseRunWithServer,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const run =
    createRunPlan({
      pages: [
        getPage(
          'admin-members',
        ),
      ],
    })[0];

  let stopped =
    false;

  await assert.rejects(
    executeLighthouseRunWithServer(
      run,
      {
        createServer() {
          return {
            async start() {
              return {
                host:
                  '127.0.0.1',
                port: 5500,
              };
            },

            assertReadiness() {
              throw new Error(
                'Lighthouse-readiness ontbreekt voor admin-members',
              );
            },

            async stop() {
              stopped =
                true;
            },
          };
        },

        async executeRun() {},
      },
    ),
    /readiness ontbreekt/,
  );

  assert.equal(
    stopped,
    true,
  );
});

test('runner weigert onverwachte serverbinding of niet-lokale URL', async () => {
  const {
    executeLighthouseRunWithServer,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const validRun =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
    })[0];

  await assert.rejects(
    executeLighthouseRunWithServer(
      validRun,
      {
        createServer() {
          return {
            async start() {
              return {
                host:
                  '0.0.0.0',
                port: 5500,
              };
            },

            assertReadiness() {
              return {
                required: false,
              };
            },

            async stop() {},
          };
        },

        async executeRun() {},
      },
    ),
    /onverwacht adres/,
  );

  const invalidRun = {
    ...validRun,
    url:
      'https://example.com/',
  };

  await assert.rejects(
    executeLighthouseRunWithServer(
      invalidRun,
      {
        createServer() {
          throw new Error(
            'server mag niet starten',
          );
        },
      },
    ),
    /onverwachte lokale URL/,
  );
});

test('runLighthouse gebruikt server-orchestratie sequentieel voor opgegeven plan', async (t) => {
  const {
    runLighthouse,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const calls = [];

  const originalPages =
    LIGHTHOUSE_PAGES;

  assert.ok(
    originalPages.length >= 1,
  );

  /*
   * Geen echte Lighthouse-processen:
   * executeWithServer wordt geïnjecteerd.
   */
  const result =
    await runLighthouse({
      async executeWithServer(
        run,
      ) {
        calls.push(
          run.pageKey,
        );
      },
    });

  assert.equal(
    result.length,
    20,
  );

  assert.deepEqual(
    calls,
    result.map(
      (run) => run.pageKey,
    ),
  );
});

// LIGHTHOUSE CLEANUP RECOVERY CONTRACT

function createCleanupError(
  stderr = [
    'Runtime error encountered: EPERM, Permission denied:',
    'C:\\Users\\test\\AppData\\Local\\Temp\\lighthouse.12345678',
    'at Launcher.destroyTmp (chrome-launcher.js:367:9)',
  ].join('\n'),
) {
  const error =
    new Error(
      'Command failed',
    );

  error.stderr =
    stderr;

  return error;
}

async function writeCleanupReports(
  root,
  run,
  overrides = {},
) {
  const jsonPath =
    path.resolve(
      root,
      `${run.outputBase}.report.json`,
    );

  const htmlPath =
    path.resolve(
      root,
      `${run.outputBase}.report.html`,
    );

  await mkdir(
    path.dirname(jsonPath),
    {recursive: true},
  );

  const report = {
    lighthouseVersion:
      LIGHTHOUSE_VERSION,
    requestedUrl:
      run.url,
    finalDisplayedUrl:
      run.url,
    runtimeError:
      null,
    ...overrides,
  };

  await writeFile(
    jsonPath,
    JSON.stringify(report),
    'utf8',
  );

  await writeFile(
    htmlPath,
    '<html>valid lighthouse report</html>',
    'utf8',
  );

  return {
    jsonPath,
    htmlPath,
  };
}

test('cleanupclassifier accepteert uitsluitend EPERM + Launcher.destroyTmp + lighthouse tempmap', async () => {
  const {
    isRecoverableChromeLauncherCleanupError,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  assert.equal(
    isRecoverableChromeLauncherCleanupError(
      createCleanupError(),
    ),
    true,
  );

  assert.equal(
    isRecoverableChromeLauncherCleanupError(
      createCleanupError(
        [
          'EPERM',
          'C:\\Temp\\lighthouse.123',
        ].join('\n'),
      ),
    ),
    false,
  );

  assert.equal(
    isRecoverableChromeLauncherCleanupError(
      createCleanupError(
        [
          'Launcher.destroyTmp',
          'C:\\Temp\\lighthouse.123',
        ].join('\n'),
      ),
    ),
    false,
  );

  assert.equal(
    isRecoverableChromeLauncherCleanupError(
      createCleanupError(
        [
          'EPERM',
          'Launcher.destroyTmp',
          'C:\\Temp\\other-folder',
        ].join('\n'),
      ),
    ),
    false,
  );
});

test('geldige destroyTmp EPERM wordt uitsluitend na volledig geldig rapport hersteld', async (t) => {
  const {
    executeLighthouseRun,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const root =
    await createResultsDir(t);

  const run =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-valid',
    })[0];

  await writeCleanupReports(
    root,
    run,
  );

  await executeLighthouseRun(
    run,
    {
      outputRoot:
        root,

      async execute() {
        throw createCleanupError();
      },
    },
  );
});

test('destroyTmp EPERM zonder volledige niet-lege rapportoutput blijft hard FAIL', async (t) => {
  const {
    executeLighthouseRun,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const root =
    await createResultsDir(t);

  const runMissing =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-missing',
    })[0];

  await assert.rejects(
    executeLighthouseRun(
      runMissing,
      {
        outputRoot:
          root,

        async execute() {
          throw createCleanupError();
        },
      },
    ),
    /ontbrekend of leeg rapportbestand/,
  );

  const runEmpty =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-empty',
    })[0];

  const files =
    await writeCleanupReports(
      root,
      runEmpty,
    );

  await writeFile(
    files.htmlPath,
    '',
    'utf8',
  );

  await assert.rejects(
    executeLighthouseRun(
      runEmpty,
      {
        outputRoot:
          root,

        async execute() {
          throw createCleanupError();
        },
      },
    ),
    /ontbrekend of leeg rapportbestand/,
  );
});

test('destroyTmp EPERM met verkeerde Lighthouse-versie blijft hard FAIL', async (t) => {
  const {
    executeLighthouseRun,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const root =
    await createResultsDir(t);

  const run =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-version',
    })[0];

  await writeCleanupReports(
    root,
    run,
    {
      lighthouseVersion:
        '0.0.0-wrong',
    },
  );

  await assert.rejects(
    executeLighthouseRun(
      run,
      {
        outputRoot:
          root,

        async execute() {
          throw createCleanupError();
        },
      },
    ),
    /Lighthouse-versie/,
  );
});

test('destroyTmp EPERM met verkeerde requested of final URL blijft hard FAIL', async (t) => {
  const {
    executeLighthouseRun,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const root =
    await createResultsDir(t);

  const requestedRun =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-requested-url',
    })[0];

  await writeCleanupReports(
    root,
    requestedRun,
    {
      requestedUrl:
        'http://localhost:5500/verkeerd',
    },
  );

  await assert.rejects(
    executeLighthouseRun(
      requestedRun,
      {
        outputRoot:
          root,

        async execute() {
          throw createCleanupError();
        },
      },
    ),
    /requestedUrl/,
  );

  const finalRun =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-final-url',
    })[0];

  await writeCleanupReports(
    root,
    finalRun,
    {
      finalDisplayedUrl:
        'http://localhost:5500/verkeerd',
    },
  );

  await assert.rejects(
    executeLighthouseRun(
      finalRun,
      {
        outputRoot:
          root,

        async execute() {
          throw createCleanupError();
        },
      },
    ),
    /final URL/,
  );
});

test('destroyTmp EPERM met runtimeError blijft hard FAIL', async (t) => {
  const {
    executeLighthouseRun,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const root =
    await createResultsDir(t);

  const run =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-runtime-error',
    })[0];

  await writeCleanupReports(
    root,
    run,
    {
      runtimeError: {
        code:
          'ERRORED_DOCUMENT_REQUEST',
        message:
          'synthetic runtime failure',
      },
    },
  );

  await assert.rejects(
    executeLighthouseRun(
      run,
      {
        outputRoot:
          root,

        async execute() {
          throw createCleanupError();
        },
      },
    ),
    /runtimeError aanwezig/,
  );
});

test('gewone Lighthouse-procesfout blijft hard FAIL ook als rapporten bestaan', async (t) => {
  const {
    executeLighthouseRun,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const root =
    await createResultsDir(t);

  const run =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-ordinary-error',
    })[0];

  await writeCleanupReports(
    root,
    run,
  );

  await assert.rejects(
    executeLighthouseRun(
      run,
      {
        outputRoot:
          root,

        async execute() {
          const error =
            new Error(
              'ordinary Lighthouse failure',
            );

          error.stderr =
            'Chrome failed to start';

          throw error;
        },
      },
    ),
    /Lighthouse faalde/,
  );
});

test('cleanup-validatie accepteert geen ongeldige JSON ondanks aanwezige HTML-output', async (t) => {
  const {
    executeLighthouseRun,
  } = await import(
    '../scripts/run-lighthouse.mjs'
  );

  const root =
    await createResultsDir(t);

  const run =
    createRunPlan({
      pages: [
        getPage('home'),
      ],
      resultsDir:
        'cleanup-invalid-json',
    })[0];

  const files =
    await writeCleanupReports(
      root,
      run,
  );

  await writeFile(
    files.jsonPath,
    '{geen-geldige-json',
    'utf8',
  );

  await assert.rejects(
    executeLighthouseRun(
      run,
      {
        outputRoot:
          root,

        async execute() {
          throw createCleanupError();
        },
      },
    ),
    /JSON-rapport is niet geldig/,
  );
});

// LIGHTHOUSE CI RUNNER-OWNED SERVER CONTRACT

test('CI gebruikt uitsluitend de runner-owned Lighthouse-testserver', async () => {
  const {
    readFile,
  } = await import(
    'node:fs/promises'
  );

  const ci =
    await readFile(
      '.github/workflows/ci.yml',
      'utf8',
    );

  assert.match(
    ci,
    /Run Lighthouse 13 with runner-owned server/,
  );

  assert.match(
    ci,
    /node scripts\/run-lighthouse\.mjs/,
  );

  assert.match(
    ci,
    /node scripts\/check-lighthouse-results\.mjs/,
  );

  assert.doesNotMatch(
    ci,
    /npx http-server dist -p 5500/,
  );

  assert.doesNotMatch(
    ci,
    /npx wait-on http:\/\/localhost:5500/,
  );

  assert.doesNotMatch(
    ci,
    /name:\s*Start local server/,
  );
});

test('CI behoudt build, contracttest, Chrome-resolutie en rapportupload rond Lighthouse', async () => {
  const {
    readFile,
  } = await import(
    'node:fs/promises'
  );

  const ci =
    await readFile(
      '.github/workflows/ci.yml',
      'utf8',
    );

  const requiredFragments = [
    'Build production-like site',
    'Validate Lighthouse runner contract',
    'Resolve Chrome for Lighthouse',
    'Run Lighthouse 13 with runner-owned server',
    'Validate Lighthouse results',
    'Upload Lighthouse reports',
  ];

  let previousIndex = -1;

  for (const fragment of requiredFragments) {
    const index =
      ci.indexOf(fragment);

    assert.ok(
      index >= 0,
      `CI mist vereiste Lighthouse-stap: ${fragment}`,
    );

    assert.ok(
      index > previousIndex,
      `CI Lighthouse-volgorde ongeldig bij: ${fragment}`,
    );

    previousIndex =
      index;
  }
});

test('member-dashboard readiness volgt huidige dashboard-loadstate', () => {
  const readiness =
    getPage('member-dashboard').readiness;

  assert.equal(
    readiness.selector,
    '#status',
  );

  assert.deepEqual(
    [...readiness.requiredTables],
    ['profiles'],
  );

  assert.deepEqual(
    [...readiness.requiredRpcs],
    [],
  );

  assert.equal(
    readiness.loadedTextSelector,
    '#status',
  );

  assert.equal(
    readiness.forbiddenLoadedText,
    'Controleren...',
  );
});
