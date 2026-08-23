import {execFile} from 'node:child_process';
import {mkdir, readFile, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

import {
  LIGHTHOUSE_CHROME_FLAGS,
  LIGHTHOUSE_PAGES,
  LIGHTHOUSE_RESULTS_DIR,
  LIGHTHOUSE_VERSION,
} from '../lighthouse.config.mjs';

import {
  createLighthouseTestServer,
} from './lighthouse-test-server.mjs';

const execFileAsync = promisify(execFile);

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const LIGHTHOUSE_SERVER_PORT = 5500;

export function createRunPlan({
  pages = LIGHTHOUSE_PAGES,
  resultsDir = LIGHTHOUSE_RESULTS_DIR,
} = {}) {
  return pages.flatMap((page) =>
    Array.from({length: page.runs}, (_, index) => {
      const run = index + 1;

      const outputBase = path.posix.join(
        resultsDir,
        page.key,
        `run-${run}`,
      );

      return Object.freeze({
        pageKey: page.key,
        page,
        url: page.url,
        run,
        outputBase,
      });
    }),
  );
}

export function createLighthouseArgs(run, {
  chromeFlags = LIGHTHOUSE_CHROME_FLAGS,
} = {}) {
  return [
    run.url,
    '--quiet',
    `--chrome-flags=${chromeFlags}`,
    '--output=json',
    '--output=html',
    `--output-path=${run.outputBase}`,
  ];
}

export async function validateLighthouseRunOutputs(
  run,
  {
    outputRoot = repositoryRoot,
    statFile = stat,
  } = {},
) {
  const reportPaths = [
    `${run.outputBase}.report.json`,
    `${run.outputBase}.report.html`,
  ];

  for (const reportPath of reportPaths) {
    const absolutePath =
      path.resolve(
        outputRoot,
        reportPath,
      );

    try {
      const file =
        await statFile(
          absolutePath,
        );

      if (
        !file.isFile() ||
        file.size === 0
      ) {
        throw new Error(
          'rapportbestand is geen niet-leeg bestand',
        );
      }
    } catch (error) {
      throw new Error(
        `Lighthouse-output ongeldig voor ${run.pageKey}/run-${run.run}: ` +
          `ontbrekend of leeg rapportbestand ${absolutePath}`,
        {cause: error},
      );
    }
  }
}

function normalizeAuditUrl(value) {
  try {
    const url =
      new URL(value);

    return (
      `${url.protocol}//${url.host}` +
      `${url.pathname}${url.search}`
    );
  } catch {
    return null;
  }
}

export function isRecoverableChromeLauncherCleanupError(
  error,
) {
  const stderr =
    String(
      error?.stderr || '',
    );

  return (
    /\bEPERM\b/.test(stderr) &&
    /Launcher\.destroyTmp/.test(stderr) &&
    /lighthouse\.\d+/.test(stderr)
  );
}

export async function validateRecoverableCleanupReport(
  run,
  {
    outputRoot = repositoryRoot,
    statFile = stat,
    readReportFile = readFile,
    expectedVersion = LIGHTHOUSE_VERSION,
  } = {},
) {
  await validateLighthouseRunOutputs(
    run,
    {
      outputRoot,
      statFile,
    },
  );

  const jsonPath =
    path.resolve(
      outputRoot,
      `${run.outputBase}.report.json`,
    );

  let report;

  try {
    const raw =
      await readReportFile(
        jsonPath,
        'utf8',
      );

    report =
      JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Cleanup-herstel geweigerd voor ${run.pageKey}/run-${run.run}: ` +
        'JSON-rapport is niet geldig',
      {cause: error},
    );
  }

  if (
    report.lighthouseVersion !==
      expectedVersion
  ) {
    throw new Error(
      `Cleanup-herstel geweigerd voor ${run.pageKey}/run-${run.run}: ` +
        `Lighthouse-versie ${report.lighthouseVersion} != ${expectedVersion}`,
    );
  }

  if (report.runtimeError) {
    throw new Error(
      `Cleanup-herstel geweigerd voor ${run.pageKey}/run-${run.run}: ` +
        `runtimeError aanwezig: ${JSON.stringify(report.runtimeError)}`,
    );
  }

  const expectedUrl =
    normalizeAuditUrl(
      run.url,
    );

  const requestedUrl =
    normalizeAuditUrl(
      report.requestedUrl,
    );

  const finalUrl =
    normalizeAuditUrl(
      report.finalDisplayedUrl ??
      report.finalUrl,
    );

  if (
    !expectedUrl ||
    requestedUrl !== expectedUrl
  ) {
    throw new Error(
      `Cleanup-herstel geweigerd voor ${run.pageKey}/run-${run.run}: ` +
        `requestedUrl ${requestedUrl} != ${expectedUrl}`,
    );
  }

  if (
    finalUrl !== expectedUrl
  ) {
    throw new Error(
      `Cleanup-herstel geweigerd voor ${run.pageKey}/run-${run.run}: ` +
        `final URL ${finalUrl} != ${expectedUrl}`,
    );
  }

  return Object.freeze({
    recovered:
      true,
    reason:
      'chrome-launcher-destroyTmp-EPERM',
    lighthouseVersion:
      report.lighthouseVersion,
    requestedUrl,
    finalUrl,
  });
}

export async function executeLighthouseRun(
  run,
  {
    execute = execFileAsync,
    lighthouseCli = path.join(
      repositoryRoot,
      'node_modules',
      'lighthouse',
      'cli',
      'index.js',
    ),
    env = process.env,
    outputRoot = repositoryRoot,
    statFile = stat,
    readReportFile = readFile,
  } = {},
) {
  const args = [
    lighthouseCli,
    ...createLighthouseArgs(run),
  ];

  try {
    await execute(
      process.execPath,
      args,
      {
        cwd: repositoryRoot,
        env,
        windowsHide: true,
        maxBuffer:
          10 * 1024 * 1024,
      },
    );
  } catch (error) {
    if (
      isRecoverableChromeLauncherCleanupError(
        error,
      )
    ) {
      await validateRecoverableCleanupReport(
        run,
        {
          outputRoot,
          statFile,
          readReportFile,
        },
      );

      console.warn(
        `Lighthouse ${run.pageKey}/run-${run.run}: ` +
          'audit geldig; chrome-launcher destroyTmp EPERM als cleanupwaarschuwing geclassificeerd.',
      );
    } else {
      const detail = [
        error?.stdout,
        error?.stderr,
      ]
        .filter(Boolean)
        .join('\n')
        .trim();

      throw new Error(
        `Lighthouse faalde voor ${run.pageKey}/run-${run.run}` +
          (
            detail
              ? `:\n${detail}`
              : ''
          ),
        {cause: error},
      );
    }
  }

  /*
   * Ook na een toegelaten cleanupfout blijft de normale
   * outputvalidatie verplicht.
   */
  await validateLighthouseRunOutputs(
    run,
    {
      outputRoot,
      statFile,
    },
  );
}

export async function executeLighthouseRunWithServer(
  run,
  {
    executeRun = executeLighthouseRun,
    createServer =
      createLighthouseTestServer,
    distRoot =
      path.join(
        repositoryRoot,
        'dist',
      ),
    port =
      LIGHTHOUSE_SERVER_PORT,
    execute = execFileAsync,
    env = process.env,
  } = {},
) {
  if (!run?.page) {
    throw new Error(
      `Lighthouse-run mist page-config: ${run?.pageKey || 'onbekend'}`,
    );
  }

  const configuredUrl =
    new URL(run.url);

  if (
    configuredUrl.protocol !== 'http:' ||
    configuredUrl.hostname !== 'localhost' ||
    configuredUrl.port !==
      String(port)
  ) {
    throw new Error(
      `Lighthouse-run gebruikt onverwachte lokale URL: ${run.url}`,
    );
  }

  const testServer =
    createServer({
      distRoot,
      page: run.page,
      port,
    });

  let started =
    false;

  try {
    const address =
      await testServer.start();

    started =
      true;

    if (
      address.host !== '127.0.0.1' ||
      address.port !== port
    ) {
      throw new Error(
        `Lighthouse-testserver startte op onverwacht adres ` +
        `${address.host}:${address.port}`,
      );
    }

    await executeRun(
      run,
      {
        execute,
        env,
      },
    );

    return testServer.assertReadiness();
  } finally {
    if (started) {
      await testServer.stop();
    }
  }
}

export async function runLighthouse({
  execute = execFileAsync,
  env = process.env,
  executeWithServer =
    executeLighthouseRunWithServer,
} = {}) {
  const absoluteResultsDir =
    path.resolve(
      repositoryRoot,
      LIGHTHOUSE_RESULTS_DIR,
    );

  await rm(
    absoluteResultsDir,
    {
      recursive: true,
      force: true,
    },
  );

  await mkdir(
    absoluteResultsDir,
    {
      recursive: true,
    },
  );

  const plan =
    createRunPlan();

  for (const run of plan) {
    await mkdir(
      path.resolve(
        repositoryRoot,
        path.dirname(
          run.outputBase,
        ),
      ),
      {recursive: true},
    );

    await executeWithServer(
      run,
      {
        execute,
        env,
      },
    );
  }

  return plan;
}

function isDirectExecution() {
  const entry =
    process.argv[1];

  return Boolean(
    entry &&
      import.meta.url ===
        pathToFileURL(
          path.resolve(entry),
        ).href,
  );
}

if (isDirectExecution()) {
  runLighthouse()
    .catch((error) => {
      console.error(
        error.message,
      );

      process.exitCode = 1;
    });
}