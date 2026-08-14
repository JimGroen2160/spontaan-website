import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
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

test('config bewaart exact Lighthouse 13.4.1 en bestaand 1/1/3-contract', () => {
  assert.equal(LIGHTHOUSE_VERSION, '13.4.1');
  assert.equal(LIGHTHOUSE_RESULTS_DIR, 'test-output/lighthouse');
  assert.equal(
    LIGHTHOUSE_CHROME_FLAGS,
    '--no-sandbox --disable-dev-shm-usage --headless=new',
  );

  assert.deepEqual(
    LIGHTHOUSE_PAGES.map(({key, url, runs}) => ({key, url, runs})),
    [
      {key: 'home', url: 'http://localhost:5500/', runs: 1},
      {
        key: 'media',
        url: 'http://localhost:5500/pages/media.html',
        runs: 1,
      },
      {
        key: 'repertoire',
        url: 'http://localhost:5500/pages/repertoire.html',
        runs: 3,
      },
    ],
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
    assert.deepEqual(page.thresholds.seo, {
      type: 'minScore',
      value: 0.8,
    });
  }

  assert.deepEqual(
    getPage('repertoire').thresholds['cumulative-layout-shift'],
    {type: 'maxNumericValue', value: 0.1},
  );
});

test('runner plant exact vijf Lighthouse-processen', () => {
  const plan = createRunPlan();

  assert.equal(plan.length, 5);
  assert.deepEqual(
    plan.map(({pageKey, run}) => ({pageKey, run})),
    [
      {pageKey: 'home', run: 1},
      {pageKey: 'media', run: 1},
      {pageKey: 'repertoire', run: 1},
      {pageKey: 'repertoire', run: 2},
      {pageKey: 'repertoire', run: 3},
    ],
  );
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
