import {
  createServer,
} from 'node:http';

import {
  readFile,
  stat,
} from 'node:fs/promises';

import path from 'node:path';

import {
  syntheticReadinessReporterSource,
  syntheticRuntimeConfigSource,
  syntheticSupabaseSdkSource,
} from '../tests/helpers/lighthouse-supabase-stub.mjs';

const LOOPBACK_HOST = '127.0.0.1';

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
});

export const SYNTHETIC_SDK_PATH =
  '/__lighthouse__/supabase.js';

export const SYNTHETIC_RUNTIME_CONFIG_PATH =
  '/__lighthouse__/runtime-config.js';

export const SYNTHETIC_READINESS_SCRIPT_PATH =
  '/__lighthouse__/readiness.js';

export const SYNTHETIC_READINESS_ENDPOINT =
  '/__lighthouse__/readiness';

function contentTypeFor(filePath) {
  return (
    CONTENT_TYPES[
      path.extname(filePath).toLowerCase()
    ] ||
    'application/octet-stream'
  );
}

function safeRelativePath(urlPathname) {
  let decoded;

  try {
    decoded =
      decodeURIComponent(urlPathname);
  } catch {
    return null;
  }

  if (
    decoded.includes('\0') ||
    decoded.includes('\\')
  ) {
    return null;
  }

  const normalized =
    path.posix.normalize(decoded);

  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    return null;
  }

  const withoutLeadingSlash =
    normalized.replace(/^\/+/, '');

  return (
    withoutLeadingSlash || 'index.html'
  );
}

async function readJsonBody(
  request,
  maxBytes = 8192,
) {
  let total = 0;
  const chunks = [];

  for await (const chunk of request) {
    total += chunk.length;

    if (total > maxBytes) {
      throw new Error(
        'Readiness payload is te groot',
      );
    }

    chunks.push(chunk);
  }

  const raw =
    Buffer.concat(chunks)
      .toString('utf8');

  if (!raw.trim()) {
    throw new Error(
      'Readiness payload ontbreekt',
    );
  }

  return JSON.parse(raw);
}

function containsAll(
  observed,
  required,
) {
  return required.every(
    (item) =>
      observed.includes(item),
  );
}

export function validateReadinessReport(
  page,
  payload,
) {
  if (
    page?.pageClass !== 'protected' ||
    !page?.readiness
  ) {
    throw new Error(
      'Readiness is alleen geldig voor protected pagina’s',
    );
  }

  if (
    !payload ||
    payload.pageKey !== page.key ||
    payload.ready !== true
  ) {
    throw new Error(
      'Ongeldig Lighthouse-readinessrapport',
    );
  }

  const observedTables =
    Array.isArray(
      payload.observedTables
    )
      ? payload.observedTables
      : [];

  const observedRpcs =
    Array.isArray(
      payload.observedRpcs
    )
      ? payload.observedRpcs
      : [];

  if (
    !containsAll(
      observedTables,
      page.readiness.requiredTables,
    )
  ) {
    throw new Error(
      'Readiness mist vereiste tabelcalls',
    );
  }

  if (
    !containsAll(
      observedRpcs,
      page.readiness.requiredRpcs,
    )
  ) {
    throw new Error(
      'Readiness mist vereiste RPC-calls',
    );
  }

  if (
    payload.blockedWrites !== 0
  ) {
    throw new Error(
      'Readiness bevat geblokkeerde writepoging',
    );
  }

  return Object.freeze({
    pageKey: payload.pageKey,
    observedTables:
      Object.freeze(
        [...observedTables],
      ),
    observedRpcs:
      Object.freeze(
        [...observedRpcs],
      ),
    blockedWrites: 0,
  });
}

function pagePathFromUrl(page) {
  return new URL(page.url).pathname;
}

function shouldUseSynthetic(page) {
  return (
    page &&
    (
      page.pageClass === 'auth' ||
      page.pageClass === 'protected'
    )
  );
}

function replaceScriptReference(
  html,
  fromPattern,
  replacement,
) {
  const matches =
    html.match(fromPattern);

  if (!matches || matches.length !== 1) {
    throw new Error(
      'Synthetic Lighthouse HTML-rewrite verwacht exact één scriptreferentie',
    );
  }

  return html.replace(
    fromPattern,
    replacement,
  );
}

export function rewriteHtmlForSyntheticHarness(
  html,
  {
    includeReadiness = false,
  } = {},
) {
  let result =
    replaceScriptReference(
      html,
      /<script\s+src=["'][^"']*js\/runtime-config\.js["'][^>]*><\/script>/i,
      `<script src="${SYNTHETIC_RUNTIME_CONFIG_PATH}"></script>`,
    );

  result =
    replaceScriptReference(
      result,
      /<script\s+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2["'][^>]*><\/script>/i,
      includeReadiness
        ? (
            `<script src="${SYNTHETIC_SDK_PATH}"></script>` +
            `<script src="${SYNTHETIC_READINESS_SCRIPT_PATH}"></script>`
          )
        : `<script src="${SYNTHETIC_SDK_PATH}"></script>`,
    );

  return result;
}

export function createLighthouseTestServer({
  distRoot,
  page,
  host = LOOPBACK_HOST,
  port = 0,
} = {}) {
  if (!distRoot) {
    throw new Error(
      'distRoot is verplicht',
    );
  }

  if (!page?.url || !page?.pageClass) {
    throw new Error(
      'Lighthouse page-config is verplicht',
    );
  }

  if (host !== LOOPBACK_HOST) {
    throw new Error(
      'Lighthouse-testserver mag alleen op 127.0.0.1 binden',
    );
  }

  const absoluteDistRoot =
    path.resolve(distRoot);

  const synthetic =
    shouldUseSynthetic(page);

  const allowedPagePath =
    pagePathFromUrl(page);

  let readinessReport =
    null;

  const server =
    createServer(
      async (request, response) => {
        try {
          const requestUrl =
            new URL(
              request.url || '/',
              `http://${host}`,
            );

          if (
            requestUrl.pathname ===
              SYNTHETIC_READINESS_ENDPOINT &&
            request.method === 'POST'
          ) {
            if (
              page.pageClass !==
                'protected'
            ) {
              response.writeHead(
                404,
                {
                  'Content-Type':
                    'text/plain; charset=utf-8',
                },
              );

              response.end(
                'Not Found',
              );

              return;
            }

            const contentType =
              String(
                request.headers[
                  'content-type'
                ] || '',
              ).toLowerCase();

            if (
              !contentType.startsWith(
                'application/json',
              )
            ) {
              response.writeHead(
                415,
                {
                  'Content-Type':
                    'text/plain; charset=utf-8',
                },
              );

              response.end(
                'Unsupported Media Type',
              );

              return;
            }

            let payload;

            try {
              payload =
                await readJsonBody(
                  request,
                );

              readinessReport =
                validateReadinessReport(
                  page,
                  payload,
                );
            } catch {
              response.writeHead(
                400,
                {
                  'Content-Type':
                    'text/plain; charset=utf-8',
                },
              );

              response.end(
                'Invalid readiness report',
              );

              return;
            }

            response.writeHead(
              204,
              {
                'Cache-Control':
                  'no-store',
              },
            );

            response.end();

            return;
          }

          if (
            request.method !== 'GET' &&
            request.method !== 'HEAD'
          ) {
            response.writeHead(
              405,
              {
                Allow: 'GET, HEAD',
                'Content-Type':
                  'text/plain; charset=utf-8',
              },
            );

            response.end(
              'Method Not Allowed',
            );

            return;
          }

          if (
            synthetic &&
            requestUrl.pathname ===
              SYNTHETIC_RUNTIME_CONFIG_PATH
          ) {
            const body =
              syntheticRuntimeConfigSource(
                page,
              );

            response.writeHead(
              200,
              {
                'Content-Type':
                  'application/javascript; charset=utf-8',
                'Cache-Control':
                  'no-store',
              },
            );

            response.end(
              request.method === 'HEAD'
                ? undefined
                : body,
            );

            return;
          }

          if (
            synthetic &&
            requestUrl.pathname ===
              SYNTHETIC_SDK_PATH
          ) {
            const body =
              syntheticSupabaseSdkSource(
                page,
              );

            response.writeHead(
              200,
              {
                'Content-Type':
                  'application/javascript; charset=utf-8',
                'Cache-Control':
                  'no-store',
              },
            );

            response.end(
              request.method === 'HEAD'
                ? undefined
                : body,
            );

            return;
          }

          if (
            page.pageClass ===
              'protected' &&
            requestUrl.pathname ===
              SYNTHETIC_READINESS_SCRIPT_PATH
          ) {
            const body =
              syntheticReadinessReporterSource(
                page,
              );

            response.writeHead(
              200,
              {
                'Content-Type':
                  'application/javascript; charset=utf-8',
                'Cache-Control':
                  'no-store',
              },
            );

            response.end(
              request.method === 'HEAD'
                ? undefined
                : body,
            );

            return;
          }

          if (
            requestUrl.pathname.startsWith(
              '/__lighthouse__/',
            )
          ) {
            response.writeHead(
              404,
              {
                'Content-Type':
                  'text/plain; charset=utf-8',
              },
            );

            response.end('Not Found');
            return;
          }

          const relative =
            safeRelativePath(
              requestUrl.pathname,
            );

          if (!relative) {
            response.writeHead(
              400,
              {
                'Content-Type':
                  'text/plain; charset=utf-8',
              },
            );

            response.end('Bad Request');
            return;
          }

          const absoluteFile =
            path.resolve(
              absoluteDistRoot,
              relative,
            );

          const relativeCheck =
            path.relative(
              absoluteDistRoot,
              absoluteFile,
            );

          if (
            relativeCheck.startsWith('..') ||
            path.isAbsolute(relativeCheck)
          ) {
            response.writeHead(
              403,
              {
                'Content-Type':
                  'text/plain; charset=utf-8',
              },
            );

            response.end('Forbidden');
            return;
          }

          let fileStat;

          try {
            fileStat =
              await stat(absoluteFile);
          } catch {
            response.writeHead(
              404,
              {
                'Content-Type':
                  'text/plain; charset=utf-8',
              },
            );

            response.end('Not Found');
            return;
          }

          if (!fileStat.isFile()) {
            response.writeHead(
              404,
              {
                'Content-Type':
                  'text/plain; charset=utf-8',
              },
            );

            response.end('Not Found');
            return;
          }

          let body =
            await readFile(absoluteFile);

          if (
            synthetic &&
            requestUrl.pathname ===
              allowedPagePath &&
            path.extname(
              absoluteFile,
            ).toLowerCase() === '.html'
          ) {
            body =
              Buffer.from(
                rewriteHtmlForSyntheticHarness(
                  body.toString('utf8'),
                  {
                    includeReadiness:
                      page.pageClass ===
                        'protected',
                  },
                ),
                'utf8',
              );
          }

          response.writeHead(
            200,
            {
              'Content-Type':
                contentTypeFor(
                  absoluteFile,
                ),
              'Content-Length':
                body.byteLength,
              'Cache-Control':
                'no-store',
            },
          );

          response.end(
            request.method === 'HEAD'
              ? undefined
              : body,
          );
        } catch (error) {
          response.writeHead(
            500,
            {
              'Content-Type':
                'text/plain; charset=utf-8',
            },
          );

          response.end(
            'Lighthouse testserver error',
          );
        }
      },
    );

  return {
    host,
    page,
    server,

    async start() {
      await new Promise(
        (resolve, reject) => {
          server.once(
            'error',
            reject,
          );

          server.listen(
            port,
            host,
            () => {
              server.removeListener(
                'error',
                reject,
              );

              resolve();
            },
          );
        },
      );

      const address =
        server.address();

      if (
        !address ||
        typeof address === 'string'
      ) {
        throw new Error(
          'Lighthouse-testserver kreeg geen TCP-adres',
        );
      }

      return {
        host,
        port: address.port,
        origin:
          `http://${host}:${address.port}`,
      };
    },

    getReadiness() {
      return readinessReport;
    },

    assertReadiness() {
      if (
        page.pageClass !==
          'protected'
      ) {
        return {
          required: false,
        };
      }

      if (!readinessReport) {
        throw new Error(
          `Lighthouse-readiness ontbreekt voor ${page.key}`,
        );
      }

      return {
        required: true,
        report: readinessReport,
      };
    },

    resetReadiness() {
      readinessReport =
        null;
    },

    async stop() {
      if (!server.listening) {
        return;
      }

      await new Promise(
        (resolve, reject) => {
          server.close(
            (error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            },
          );
        },
      );
    },
  };
}