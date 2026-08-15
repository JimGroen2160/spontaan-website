import {execFile} from 'node:child_process';
import {mkdir, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

import {
  LIGHTHOUSE_CHROME_FLAGS,
  LIGHTHOUSE_PAGES,
  LIGHTHOUSE_RESULTS_DIR,
} from '../lighthouse.config.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

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
    const absolutePath = path.resolve(outputRoot, reportPath);

    try {
      const file = await statFile(absolutePath);

      if (!file.isFile() || file.size === 0) {
        throw new Error('rapportbestand is geen niet-leeg bestand');
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
  } = {},
) {
  const args = [
    lighthouseCli,
    ...createLighthouseArgs(run),
  ];

  try {
    await execute(process.execPath, args, {
      cwd: repositoryRoot,
      env,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const detail = [error?.stdout, error?.stderr]
      .filter(Boolean)
      .join('\n')
      .trim();

    throw new Error(
      `Lighthouse faalde voor ${run.pageKey}/run-${run.run}` +
        (detail ? `:\n${detail}` : ''),
      {cause: error},
    );
  }

  await validateLighthouseRunOutputs(run, {
    outputRoot,
    statFile,
  });
}

export async function runLighthouse({
  execute = execFileAsync,
  env = process.env,
} = {}) {
  const absoluteResultsDir = path.resolve(
    repositoryRoot,
    LIGHTHOUSE_RESULTS_DIR,
  );

  await rm(absoluteResultsDir, {
    recursive: true,
    force: true,
  });

  await mkdir(absoluteResultsDir, {
    recursive: true,
  });

  const plan = createRunPlan();

  for (const run of plan) {
    await mkdir(
      path.resolve(
        repositoryRoot,
        path.dirname(run.outputBase),
      ),
      {recursive: true},
    );

    await executeLighthouseRun(run, {
      execute,
      env,
    });
  }

  return plan;
}

function isDirectExecution() {
  const entry = process.argv[1];
  return Boolean(
    entry &&
      import.meta.url === pathToFileURL(path.resolve(entry)).href,
  );
}

if (isDirectExecution()) {
  runLighthouse().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
