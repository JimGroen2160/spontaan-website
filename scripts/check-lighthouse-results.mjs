import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {
  LIGHTHOUSE_PAGES,
  LIGHTHOUSE_RESULTS_DIR,
  LIGHTHOUSE_VERSION,
} from '../lighthouse.config.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function optimisticMinScore(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  if (!values.every(isFiniteNumber)) {
    return null;
  }

  return Math.max(...values);
}

export function optimisticMaxNumericValue(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  if (!values.every(isFiniteNumber)) {
    return null;
  }

  return Math.min(...values);
}

export function normalizeUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      `${parsed.protocol}//${parsed.host}` +
      `${parsed.pathname}${parsed.search}`
    );
  } catch {
    return null;
  }
}

function listReportFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  const files = [];

  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listReportFiles(entryPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.report.json') ||
        entry.name.endsWith('.report.html'))
    ) {
      files.push(path.resolve(entryPath));
    }
  }

  return files.sort();
}

function readReport(jsonPath, errors) {
  try {
    return JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    errors.push(
      `Kan JSON niet lezen: ${jsonPath}: ${error.message}`,
    );
    return null;
  }
}

function expectedFinalUrl(report) {
  return (
    normalizeUrl(report.finalDisplayedUrl) ??
    normalizeUrl(report.finalUrl) ??
    normalizeUrl(report.mainDocumentUrl)
  );
}

export function validateLighthouseResults({
  resultsDir = LIGHTHOUSE_RESULTS_DIR,
  pages = LIGHTHOUSE_PAGES,
  expectedVersion = LIGHTHOUSE_VERSION,
} = {}) {
  const errors = [];
  const warnings = [];
  const summaries = {};
  const absoluteResultsDir = path.resolve(
    repositoryRoot,
    resultsDir,
  );
  const expectedReportPaths = new Set();

  for (const page of pages) {
    for (let run = 1; run <= page.runs; run += 1) {
      const outputBase = path.join(
        absoluteResultsDir,
        page.key,
        `run-${run}`,
      );

      expectedReportPaths.add(`${outputBase}.report.json`);
      expectedReportPaths.add(`${outputBase}.report.html`);
    }
  }

  for (const reportPath of listReportFiles(absoluteResultsDir)) {
    if (!expectedReportPaths.has(reportPath)) {
      errors.push(`Onverwacht Lighthouse-rapport: ${reportPath}`);
    }
  }

  for (const page of pages) {
    const records = [];
    const expectedUrl = normalizeUrl(page.url);

    for (let run = 1; run <= page.runs; run += 1) {
      const outputBase = path.join(
        absoluteResultsDir,
        page.key,
        `run-${run}`,
      );
      const jsonPath = `${outputBase}.report.json`;
      const htmlPath = `${outputBase}.report.html`;

      if (!existsSync(jsonPath)) {
        errors.push(`Ontbrekend JSON-rapport: ${jsonPath}`);
        continue;
      }

      if (!existsSync(htmlPath) || statSync(htmlPath).size === 0) {
        errors.push(`Ontbrekend of leeg HTML-rapport: ${htmlPath}`);
      }

      const report = readReport(jsonPath, errors);
      if (!report) {
        continue;
      }

      if (report.lighthouseVersion !== expectedVersion) {
        errors.push(
          `${page.key}/run-${run}: Lighthouse-versie ` +
            `${report.lighthouseVersion} != ${expectedVersion}`,
        );
      }

      if (report.runtimeError) {
        errors.push(
          `${page.key}/run-${run}: runtimeError: ` +
            JSON.stringify(report.runtimeError),
        );
      }

      if (Array.isArray(report.runWarnings) && report.runWarnings.length > 0) {
        warnings.push(
          `${page.key}/run-${run}: ` +
            JSON.stringify(report.runWarnings),
        );
      }

      const requestedUrl = normalizeUrl(report.requestedUrl);
      if (requestedUrl !== expectedUrl) {
        errors.push(
          `${page.key}/run-${run}: requestedUrl ` +
            `${requestedUrl} != ${expectedUrl}`,
        );
      }

      const finalUrl = expectedFinalUrl(report);
      if (finalUrl !== expectedUrl) {
        errors.push(
          `${page.key}/run-${run}: final URL ` +
            `${finalUrl} != ${expectedUrl}`,
        );
      }

      const scores = {};
      for (const categoryId of [
        'performance',
        'accessibility',
        'seo',
      ]) {
        const score = report?.categories?.[categoryId]?.score;

        if (!isFiniteNumber(score)) {
          errors.push(
            `${page.key}/run-${run}: ongeldige of ontbrekende ` +
              `${categoryId}-score`,
          );
        } else {
          scores[categoryId] = score;
        }
      }

      const cls =
        report?.audits?.['cumulative-layout-shift']?.numericValue;

      if (
        Object.hasOwn(
          page.thresholds,
          'cumulative-layout-shift',
        ) &&
        !isFiniteNumber(cls)
      ) {
        errors.push(
          `${page.key}/run-${run}: ongeldige of ontbrekende ` +
            'cumulative-layout-shift.numericValue',
        );
      }

      records.push({
        scores,
        cls: isFiniteNumber(cls) ? cls : null,
      });
    }

    if (records.length !== page.runs) {
      errors.push(
        `${page.key}: verwacht ${page.runs} geldige JSON-runs, ` +
          `kreeg ${records.length}`,
      );
    }

    const pageSummary = {
      runs: records.length,
      metrics: {},
    };

    for (const [metricId, threshold] of Object.entries(
      page.thresholds,
    )) {
      let values;
      let observed;

      if (threshold.type === 'minScore') {
        values = records.map(
          (record) => record.scores[metricId],
        );
        observed = optimisticMinScore(values);
      } else if (threshold.type === 'maxNumericValue') {
        values = records.map((record) => record.cls);
        observed = optimisticMaxNumericValue(values);
      } else {
        errors.push(
          `${page.key}: onbekend thresholdtype ` +
            `${threshold.type} voor ${metricId}`,
        );
        continue;
      }

      const passed =
        isFiniteNumber(observed) &&
        (threshold.type === 'minScore'
          ? observed >= threshold.value
          : observed <= threshold.value);

      pageSummary.metrics[metricId] = {
        runs: values,
        observed,
        threshold,
        passed,
      };

      if (!passed) {
        errors.push(
          `${page.key}: threshold ${metricId} niet gehaald; ` +
            `observed=${observed}, ` +
            `${threshold.type}=${threshold.value}`,
        );
      }
    }

    summaries[page.key] = pageSummary;
  }

  if (errors.length > 0) {
    const error = new Error(
      `Lighthouse-resultaatcontrole mislukt:\n- ${errors.join('\n- ')}`,
    );
    error.details = {errors, warnings, summaries};
    throw error;
  }

  return {warnings, summaries};
}

function isDirectExecution() {
  const entry = process.argv[1];
  return Boolean(
    entry &&
      import.meta.url === pathToFileURL(path.resolve(entry)).href,
  );
}

if (isDirectExecution()) {
  try {
    const result = validateLighthouseResults();

    for (const [pageKey, summary] of Object.entries(
      result.summaries,
    )) {
      for (const [metricId, metric] of Object.entries(
        summary.metrics,
      )) {
        console.log(
          `${pageKey} ${metricId}: ${metric.observed} - OK`,
        );
      }
    }

    if (result.warnings.length > 0) {
      console.warn(
        `Lighthouse runWarnings: ${result.warnings.length}`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
