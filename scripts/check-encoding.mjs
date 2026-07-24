import {readdir, readFile} from 'node:fs/promises';
import {extname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.mjs', '.sql', '.ts', '.txt', '.yml', '.yaml',
]);
const EXCLUDED_DIRECTORIES = new Set([
  '.git', '.lighthouseci', 'Downloads', 'dist', 'node_modules', 'playwright-report', 'test-results',
]);

const SUSPICIOUS_SEQUENCES = [
  {label: 'UTF-8 als Latin-1 (C3)', expression: /\u00c3[\u0080-\u00bf]/u},
  {label: 'UTF-8 als Windows-1252 (E2)', expression: /\u00e2[\u0080-\u00bf\u20ac-\u2122]/u},
  {label: 'onnodige Latin-1-prefix', expression: /\u00c2[\u0080-\u00bf\u00a0-\u00ff]/u},
  {label: 'verkeerd gedecodeerde emoji', expression: /\u00f0[\u0080-\u00bf\u0178]/u},
  {label: 'Unicode-vervangingsteken', expression: /\ufffd/u},
];

export function findMojibake(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return SUSPICIOUS_SEQUENCES
    .filter(({expression}) => expression.test(text))
    .map(({label}) => label);
}

export function assertNoMojibake(value, label = 'tekst') {
  const findings = findMojibake(value);
  if (findings.length) {
    throw new Error(`Mojibake aangetroffen in ${label}: ${findings.join(', ')}`);
  }
}

async function collectTextFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTextFiles(path));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(path);
  }
  return files;
}

export async function checkProjectEncoding(root = ROOT) {
  const findings = [];
  for (const path of await collectTextFiles(root)) {
    const content = await readFile(path, 'utf8');
    const labels = findMojibake(content);
    if (labels.length) findings.push(`${relative(root, path)}: ${labels.join(', ')}`);
  }
  if (findings.length) throw new Error(`Encodingcontrole mislukt:\n${findings.join('\n')}`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkProjectEncoding()
    .then(() => console.log('ENCODING CHECK: geen mojibake aangetroffen'))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
