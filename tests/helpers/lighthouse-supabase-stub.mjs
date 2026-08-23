export const SYNTHETIC_SUPABASE_URL =
  'https://lighthouse-synthetic.supabase.invalid';

export const SYNTHETIC_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_lighthouse_synthetic';

export const SYNTHETIC_MUTATION_ERROR =
  'Lighthouse synthetic backend blokkeert writes';

function profileForPage(page) {
  if (page?.pageClass !== 'protected') {
    return null;
  }

  const adminPage =
    typeof page.key === 'string' &&
    page.key.startsWith('admin-');

  if (adminPage) {
    return {
      id: 'lh-profile-manager',
      auth_user_id: 'lh-auth-manager',
      full_name: 'Lighthouse Contentmanager',
      email: 'contentmanager@example.invalid',
      street: 'Teststraat',
      house_number: '1',
      postal_code: '1234AB',
      city: 'Testplaats',
      phone: '',
      role: 'contentmanager',
      status: 'active',
    };
  }

  return {
    id: 'lh-profile-member',
    auth_user_id: 'lh-auth-member',
    full_name: 'Lighthouse Lid',
    email: 'lid@example.invalid',
    street: 'Teststraat',
    house_number: '2',
    postal_code: '1234AB',
    city: 'Testplaats',
    phone: '',
    role: 'member',
    status: 'active',
  };
}

export function createSyntheticState(page) {
  if (
    !page ||
    !['auth', 'protected'].includes(page.pageClass)
  ) {
    throw new Error(
      'Synthetic Lighthouse-state is alleen toegestaan voor auth/protected',
    );
  }

  const currentProfile =
    profileForPage(page);

  const session =
    page.pageClass === 'protected'
      ? {
          user: {
            id: currentProfile.auth_user_id,
          },
        }
      : null;

  const profiles = [
    ...(currentProfile ? [currentProfile] : []),
    {
      id: 'lh-member-1',
      auth_user_id: 'lh-auth-member-1',
      full_name: 'Jan Testlid',
      email: 'jan@example.invalid',
      street: 'Dorpsstraat',
      house_number: '10',
      postal_code: '6999AA',
      city: 'Angerlo',
      phone: '',
      role: 'member',
      status: 'active',
    },
    {
      id: 'lh-member-2',
      auth_user_id: 'lh-auth-member-2',
      full_name: 'Piet Testlid',
      email: 'piet@example.invalid',
      street: 'Dorpsstraat',
      house_number: '12',
      postal_code: '6999AA',
      city: 'Angerlo',
      phone: '',
      role: 'member',
      status: 'active',
    },
  ];

  return {
    pageKey: page.key,
    pageClass: page.pageClass,
    session,
    currentProfile,
    profiles,
    songs: [
      {
        id: 'lh-song-1',
        title: 'Aan de Amsterdamse grachten',
        category: 'current',
        description: 'Synthetische Lighthouse-testinhoud.',
        lyrics: 'Synthetische liedtekst.',
        pdf_path: null,
        is_visible: true,
        sort_order: 1,
      },
      {
        id: 'lh-song-2',
        title: 'Bridge Over Troubled Water',
        category: 'current',
        description: 'Tweede synthetisch testlied.',
        lyrics: 'Synthetische liedtekst twee.',
        pdf_path: null,
        is_visible: true,
        sort_order: 2,
      },
    ],
    links: [
      {
        id: 'lh-link-1',
        song_id: 'lh-song-1',
        label: 'Oefenlink',
        link_type: 'audio',
        url: 'https://example.invalid/oefenen',
        sort_order: 0,
      },
    ],
    directory: [
      {
        profile_id: 'lh-member-1',
        full_name: 'Jan Testlid',
        memo: 'Synthetische memo.',
        photo_path: null,
      },
      {
        profile_id: 'lh-member-2',
        full_name: 'Piet Testlid',
        memo: 'Tweede synthetische memo.',
        photo_path: null,
      },
    ],
    calls: [],
  };
}

export function createSyntheticSupabaseClient(initialState) {
  const state =
    JSON.parse(
      JSON.stringify(initialState),
    );

  const clone = (value) =>
    JSON.parse(
      JSON.stringify(value),
    );

  function rowsForTable(table) {
    if (table === 'profiles') {
      return state.profiles;
    }

    if (table === 'member_songs') {
      return state.songs;
    }

    if (table === 'member_song_links') {
      return state.links;
    }

    if (table === 'member_directory') {
      return state.directory;
    }

    return [];
  }

  function makeQuery(table) {
    const filters = [];
    let mutation = null;

    state.calls.push({
      kind: 'table',
      table,
    });

    function applyFilters(rows) {
      return rows.filter((row) =>
        filters.every((filter) => {
          if (filter.kind === 'eq') {
            return row[filter.column] === filter.value;
          }

          if (filter.kind === 'in') {
            return filter.values.includes(
              row[filter.column],
            );
          }

          return true;
        }),
      );
    }

    function result() {
      if (mutation) {
        return {
          data: null,
          error: {
            message: SYNTHETIC_MUTATION_ERROR,
          },
        };
      }

      return {
        data: clone(
          applyFilters(
            rowsForTable(table),
          ),
        ),
        error: null,
      };
    }

    const builder = {
      select() {
        return builder;
      },

      eq(column, value) {
        filters.push({
          kind: 'eq',
          column,
          value,
        });

        return builder;
      },

      in(column, values) {
        filters.push({
          kind: 'in',
          column,
          values: Array.isArray(values)
            ? values
            : [],
        });

        return builder;
      },

      order() {
        return builder;
      },

      insert() {
        mutation = 'insert';

        state.calls.push({
          kind: 'blocked-write',
          operation: mutation,
          table,
        });

        return builder;
      },

      update() {
        mutation = 'update';

        state.calls.push({
          kind: 'blocked-write',
          operation: mutation,
          table,
        });

        return builder;
      },

      delete() {
        mutation = 'delete';

        state.calls.push({
          kind: 'blocked-write',
          operation: mutation,
          table,
        });

        return builder;
      },

      upsert() {
        mutation = 'upsert';

        state.calls.push({
          kind: 'blocked-write',
          operation: mutation,
          table,
        });

        return builder;
      },

      async single() {
        if (mutation) {
          return result();
        }

        if (
          table === 'profiles' &&
          state.currentProfile
        ) {
          return {
            data: clone(
              state.currentProfile,
            ),
            error: null,
          };
        }

        const response =
          result();

        return {
          data:
            Array.isArray(response.data)
              ? response.data[0] || null
              : response.data,
          error: response.error,
        };
      },

      then(resolve, reject) {
        return Promise.resolve(
          result(),
        ).then(
          resolve,
          reject,
        );
      },
    };

    return builder;
  }

  const client = {
    __state: state,

    auth: {
      async getSession() {
        state.calls.push({
          kind: 'auth',
          operation: 'getSession',
        });

        return {
          data: {
            session: clone(
              state.session,
            ),
          },
          error: null,
        };
      },

      async signInWithPassword() {
        state.calls.push({
          kind: 'blocked-write',
          operation: 'signInWithPassword',
          table: 'auth',
        });

        return {
          data: null,
          error: {
            message: SYNTHETIC_MUTATION_ERROR,
          },
        };
      },

      async signOut() {
        state.calls.push({
          kind: 'blocked-write',
          operation: 'signOut',
          table: 'auth',
        });

        return {
          error: {
            message: SYNTHETIC_MUTATION_ERROR,
          },
        };
      },
    },

    from(table) {
      return makeQuery(table);
    },

    async rpc(name) {
      state.calls.push({
        kind: 'rpc',
        name,
      });

      if (name === 'get_member_directory') {
        return {
          data: clone(
            state.directory,
          ),
          error: null,
        };
      }

      return {
        data: null,
        error: {
          message:
            `Lighthouse synthetic RPC niet toegestaan: ${name}`,
        },
      };
    },

    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path, expiresIn) {
            state.calls.push({
              kind: 'signed-url',
              bucket,
              path,
              expiresIn,
            });

            return {
              data: {
                signedUrl:
                  'https://lighthouse-asset.invalid/' +
                  encodeURIComponent(bucket) +
                  '/' +
                  encodeURIComponent(path),
              },
              error: null,
            };
          },

          async upload() {
            state.calls.push({
              kind: 'blocked-write',
              operation: 'upload',
              table: `storage:${bucket}`,
            });

            return {
              data: null,
              error: {
                message:
                  SYNTHETIC_MUTATION_ERROR,
              },
            };
          },

          async remove() {
            state.calls.push({
              kind: 'blocked-write',
              operation: 'remove',
              table: `storage:${bucket}`,
            });

            return {
              data: null,
              error: {
                message:
                  SYNTHETIC_MUTATION_ERROR,
              },
            };
          },
        };
      },
    },
  };

  return client;
}

export function syntheticRuntimeConfigSource(page) {
  const state =
    createSyntheticState(page);

  const runtimeConfig = {
    projectId: 'lighthouse-synthetic',
    dataset: 'development',
    apiVersion: '2026-07-06',
    environment: 'development',
    allowDemo: true,
    supabase: {
      url: SYNTHETIC_SUPABASE_URL,
      publishableKey:
        SYNTHETIC_SUPABASE_PUBLISHABLE_KEY,
    },
  };

  const context = {
    pageKey: state.pageKey,
    pageClass: state.pageClass,
    readiness: page.readiness || null,
  };

  return (
    'window.SpontaanRuntimeConfig = ' +
    `Object.freeze(${JSON.stringify(runtimeConfig)});\n` +
    'window.__SPONTAAN_LIGHTHOUSE_CONTEXT__ = ' +
    `Object.freeze(${JSON.stringify(context)});\n`
  );
}

export function syntheticSupabaseSdkSource(page) {
  const state =
    createSyntheticState(page);

  return `
(function () {
  'use strict';

  const SYNTHETIC_MUTATION_ERROR =
    ${JSON.stringify(SYNTHETIC_MUTATION_ERROR)};

  const createSyntheticSupabaseClient =
    ${createSyntheticSupabaseClient.toString()};

  const state =
    ${JSON.stringify(state)};

  const client =
    createSyntheticSupabaseClient(state);

  window.__SPONTAAN_LIGHTHOUSE_STATE__ =
    client.__state;

  window.supabase = Object.freeze({
    createClient: function () {
      return client;
    },
  });
})();
`.trimStart();
}

export function syntheticReadinessReporterSource(page) {
  if (
    !page ||
    page.pageClass !== 'protected' ||
    !page.readiness
  ) {
    throw new Error(
      'Readiness reporter is alleen toegestaan voor protected pagina’s',
    );
  }

  const config = {
    pageKey: page.key,
    selector: page.readiness.selector,
    requiredTables:
      page.readiness.requiredTables || [],
    requiredRpcs:
      page.readiness.requiredRpcs || [],
    loadedTextSelector:
      page.readiness.loadedTextSelector || '',
    forbiddenLoadedText:
      page.readiness.forbiddenLoadedText || '',
  };

  return `
(function () {
  'use strict';

  const config =
    ${JSON.stringify(config)};

  let reported = false;

  function calls() {
    return Array.isArray(
      window.__SPONTAAN_LIGHTHOUSE_STATE__?.calls
    )
      ? window.__SPONTAAN_LIGHTHOUSE_STATE__.calls
      : [];
  }

  function observedTables() {
    return Array.from(
      new Set(
        calls()
          .filter((call) => call.kind === 'table')
          .map((call) => call.table)
          .filter(Boolean)
      )
    );
  }

  function observedRpcs() {
    return Array.from(
      new Set(
        calls()
          .filter((call) => call.kind === 'rpc')
          .map((call) => call.name)
          .filter(Boolean)
      )
    );
  }

  function blockedWrites() {
    return calls().filter(
      (call) => call.kind === 'blocked-write'
    ).length;
  }

  function selectorReady() {
    return Boolean(
      document.querySelector(config.selector)
    );
  }

  function loadedTextReady() {
    if (!config.loadedTextSelector) {
      return true;
    }

    const element =
      document.querySelector(
        config.loadedTextSelector
      );

    if (!element) {
      return false;
    }

    const current =
      String(element.textContent || '')
        .trim()
        .toLowerCase();

    const forbidden =
      String(config.forbiddenLoadedText || '')
        .trim()
        .toLowerCase();

    return (
      current.length > 0 &&
      (
        !forbidden ||
        !current.includes(forbidden)
      )
    );
  }

  function containsAll(
    observed,
    required
  ) {
    return required.every(
      (item) => observed.includes(item)
    );
  }

  async function evaluateReadiness() {
    if (reported) {
      return;
    }

    const tables =
      observedTables();

    const rpcs =
      observedRpcs();

    const blocked =
      blockedWrites();

    const ready =
      selectorReady() &&
      loadedTextReady() &&
      containsAll(
        tables,
        config.requiredTables
      ) &&
      containsAll(
        rpcs,
        config.requiredRpcs
      ) &&
      blocked === 0;

    if (!ready) {
      return;
    }

    reported = true;

    const payload = {
      pageKey: config.pageKey,
      ready: true,
      observedTables: tables,
      observedRpcs: rpcs,
      blockedWrites: blocked,
    };

    try {
      const response =
        await fetch(
          '/__lighthouse__/readiness',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify(payload),
            cache: 'no-store',
            keepalive: true,
          },
        );

      if (!response.ok) {
        reported = false;
      }
    } catch {
      reported = false;
    }
  }

  const observer =
    new MutationObserver(
      () => {
        void evaluateReadiness();
      },
    );

  function start() {
    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      },
    );

    void evaluateReadiness();

    const timer =
      window.setInterval(
        () => {
          if (reported) {
            window.clearInterval(timer);
            observer.disconnect();
            return;
          }

          void evaluateReadiness();
        },
        50,
      );

    window.setTimeout(
      () => {
        window.clearInterval(timer);
        observer.disconnect();
      },
      15000,
    );
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      {once: true},
    );
  } else {
    start();
  }
})();
`.trimStart();
}
