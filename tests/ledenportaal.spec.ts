import {
  test,
  expect,
  type Page,
} from '@playwright/test';

import AxeBuilder from '@axe-core/playwright';

type AccessProfile = {
  full_name: string;
  role: 'member' | 'contentmanager' | 'admin';
  status: 'active' | 'pending' | 'inactive';
};

type PortalSong = {
  id: string;
  title: string;
  category: 'current' | 'concept' | 'archive';
  description: string;
  lyrics: string;
  is_visible: boolean;
  sort_order: number;
};

type PortalLink = {
  id: string;
  song_id: string;
  label: string;
  link_type: 'audio' | 'video' | 'other';
  url: string;
  sort_order: number;
};

type DirectoryRow = {
  profile_id: string;
  full_name: string;
  memo: string;
  photo_path: string | null;
};

type StubOptions = {
  profile?: AccessProfile | null;
  hasSession?: boolean;
  songs?: PortalSong[];
  links?: PortalLink[];
  directory?: DirectoryRow[];
  failTable?: string;
  directoryRpcError?: boolean;
  signingErrorPaths?: string[];
};

const activeMember: AccessProfile = {
  full_name: 'Testlid Ledenportaal',
  role: 'member',
  status: 'active',
};

const activeContentmanager: AccessProfile = {
  full_name: 'Test Contentmanager',
  role: 'contentmanager',
  status: 'active',
};

const activeAdmin: AccessProfile = {
  full_name: 'Test Administrator',
  role: 'admin',
  status: 'active',
};

const pendingMember: AccessProfile = {
  full_name: 'Pending Testlid',
  role: 'member',
  status: 'pending',
};

const inactiveMember: AccessProfile = {
  full_name: 'Inactief Testlid',
  role: 'member',
  status: 'inactive',
};

const defaultSongs: PortalSong[] = [
  {
    id: 'song-current-1',
    title: 'Samen op weg',
    category: 'current',
    description: 'Huidig repetitielied.',
    lyrics: 'Wij zingen samen, stem voor stem.',
    is_visible: true,
    sort_order: 1,
  },
  {
    id: 'song-current-2',
    title: 'Stemmen in de nacht',
    category: 'current',
    description: 'Oefenen op dynamiek.',
    lyrics: 'Als stemmen in de avond klinken.',
    is_visible: true,
    sort_order: 2,
  },
  {
    id: 'song-current-3',
    title: 'Ritme van vandaag',
    category: 'current',
    description: 'Oefenen op timing.',
    lyrics: 'Een stap, een tel, een nieuw akkoord.',
    is_visible: true,
    sort_order: 3,
  },
  {
    id: 'song-concept-1',
    title: 'Nieuwe horizon',
    category: 'concept',
    description: 'Conceptnummer.',
    lyrics: 'Voorbij de bocht ligt nieuwe ruimte.',
    is_visible: true,
    sort_order: 1,
  },
  {
    id: 'song-concept-2',
    title: 'Eerste versie',
    category: 'concept',
    description: 'Nog in ontwikkeling.',
    lyrics: 'Dit is een eerste versie.',
    is_visible: true,
    sort_order: 2,
  },
  {
    id: 'song-archive-1',
    title: 'Oude favoriet',
    category: 'archive',
    description: 'Eerder gezongen repertoire.',
    lyrics: 'Een oude klank blijft soms dichtbij.',
    is_visible: true,
    sort_order: 1,
  },
  {
    id: 'song-hidden-1',
    title: 'Verborgen repetitielied',
    category: 'current',
    description: 'Mag niet in de ledenweergave verschijnen.',
    lyrics: 'Verborgen inhoud.',
    is_visible: false,
    sort_order: 0,
  },
];

const defaultLinks: PortalLink[] = [
  {
    id: 'link-1',
    song_id: 'song-current-1',
    label: 'Oefenopname',
    link_type: 'audio',
    url: 'https://example.com/oefenopname',
    sort_order: 1,
  },
  {
    id: 'link-2',
    song_id: 'song-current-1',
    label: 'Onveilig voorbeeld',
    link_type: 'other',
    url: 'http://example.com/onveilig',
    sort_order: 2,
  },
];

const defaultDirectory: DirectoryRow[] = [
  {
    profile_id: '10000000-0000-4000-8000-000000000001',
    full_name: 'Jan Jansen',
    memo: 'Zingt graag mee en helpt bij repetities.',
    photo_path: 'members/jan.webp',
  },
  {
    profile_id: '10000000-0000-4000-8000-000000000002',
    full_name: 'Piet de Vries',
    memo: 'Denkt graag mee over repertoire.',
    photo_path: null,
  },
  {
    profile_id: '10000000-0000-4000-8000-000000000003',
    full_name: 'Kees Bos',
    memo: '',
    photo_path: null,
  },
];

async function stubSupabase(
  page: Page,
  options: StubOptions = {},
) {
  const payload = {
    profileValue:
      options.profile === undefined
        ? activeMember
        : options.profile,

    sessionValue:
      options.hasSession === undefined
        ? true
        : options.hasSession,

    songs:
      options.songs === undefined
        ? defaultSongs
        : options.songs,

    links:
      options.links === undefined
        ? defaultLinks
        : options.links,

    directory:
      options.directory === undefined
        ? defaultDirectory
        : options.directory,

    failTable:
      options.failTable || '',

    directoryRpcError:
      Boolean(options.directoryRpcError),

    signingErrorPaths:
      options.signingErrorPaths || [],
  };

  await page.addInitScript(
    (stateValue) => {
      const state: any = {
        ...stateValue,
        session:
          stateValue.sessionValue
            ? {
                user: {
                  id: '00000000-0000-4000-8000-000000000001',
                },
              }
            : null,

        calls: {
          tables: [],
          rpcs: [],
          signed: [],
        },
      };

      (window as any).__LEDENPORTAAL_TEST__ =
        state;
    },
    payload,
  );

  await page.route(
    'https://cdn.jsdelivr.net/**',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType:
          'application/javascript; charset=utf-8',

        body: `
          (function () {
            function makeQuery(table) {
              const state = window.__LEDENPORTAAL_TEST__;
              const equals = {};
              const inValues = {};

              state.calls.tables.push(table);

              function result() {
                if (state.failTable === table) {
                  return {
                    data: null,
                    error: {
                      message: 'Geforceerde tabel-fout voor ' + table
                    }
                  };
                }

                if (table === 'member_songs') {
                  let rows = [...state.songs];

                  for (const [column, value] of Object.entries(equals)) {
                    rows = rows.filter((row) => row[column] === value);
                  }

                  rows.sort((a, b) =>
                    (a.sort_order - b.sort_order) ||
                    String(a.title).localeCompare(String(b.title))
                  );

                  return {
                    data: rows,
                    error: null
                  };
                }

                if (table === 'member_song_links') {
                  let rows = [...state.links];

                  if (Array.isArray(inValues.song_id)) {
                    rows = rows.filter((row) =>
                      inValues.song_id.includes(row.song_id)
                    );
                  }

                  rows.sort((a, b) =>
                    (a.sort_order - b.sort_order) ||
                    String(a.label).localeCompare(String(b.label))
                  );

                  return {
                    data: rows,
                    error: null
                  };
                }

                return {
                  data: [],
                  error: null
                };
              }

              const builder = {
                select: function () {
                  return builder;
                },

                eq: function (column, value) {
                  equals[column] = value;
                  return builder;
                },

                in: function (column, values) {
                  inValues[column] = values;
                  return builder;
                },

                order: function () {
                  return builder;
                },

                single: async function () {
                  if (table === 'profiles') {
                    return {
                      data: state.profileValue,
                      error: null
                    };
                  }

                  const response = result();

                  return {
                    data: Array.isArray(response.data)
                      ? response.data[0] || null
                      : response.data,
                    error: response.error
                  };
                },

                then: function (resolve, reject) {
                  return Promise
                    .resolve(result())
                    .then(resolve, reject);
                }
              };

              return builder;
            }

            window.supabase = {
              createClient: function () {
                const state =
                  window.__LEDENPORTAAL_TEST__;

                return {
                  auth: {
                    getSession: async function () {
                      return {
                        data: {
                          session: state.session
                        },
                        error: null
                      };
                    },

                    signOut: async function () {
                      state.session = null;

                      return {
                        error: null
                      };
                    }
                  },

                  rpc: async function (name) {
                    state.calls.rpcs.push(name);

                    if (
                      name ===
                      'activate_current_user_profile'
                    ) {
                      return {
                        data: state.profileValue
                          ? {
                              ...state.profileValue,
                              status: 'active'
                            }
                          : null,
                        error: null
                      };
                    }

                    if (
                      name ===
                      'get_member_directory'
                    ) {
                      if (state.directoryRpcError) {
                        return {
                          data: null,
                          error: {
                            message:
                              'Geforceerde directory-RPC-fout'
                          }
                        };
                      }

                      return {
                        data: [...state.directory],
                        error: null
                      };
                    }

                    return {
                      data: null,
                      error: null
                    };
                  },

                  from: function (table) {
                    return makeQuery(table);
                  },

                  storage: {
                    from: function (bucket) {
                      return {
                        createSignedUrl:
                          async function (
                            path,
                            expiresIn
                          ) {
                            state.calls.signed.push({
                              bucket,
                              path,
                              expiresIn
                            });

                            if (
                              state.signingErrorPaths
                                .includes(path)
                            ) {
                              return {
                                data: null,
                                error: {
                                  message:
                                    'Geforceerde signing-fout'
                                }
                              };
                            }

                            const encodedPath =
                              String(path)
                                .split('/')
                                .map(encodeURIComponent)
                                .join('/');

                            return {
                              data: {
                                signedUrl:
                                  'https://signed.example/' +
                                  bucket +
                                  '/' +
                                  encodedPath +
                                  '?ttl=' +
                                  expiresIn
                              },
                              error: null
                            };
                          }
                      };
                    }
                  }
                };
              }
            };
          })();
        `,
      });
    },
  );

  await page.route(
    'https://signed.example/**',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/gif',
        body: Buffer.from(
          'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
          'base64',
        ),
      });
    },
  );
}

async function waitForSharedLayout(
  page: Page,
) {
  await page
    .locator('#nav-placeholder .main-nav')
    .waitFor({
      state: 'attached',
      timeout: 15_000,
    });

  await page
    .locator('#footer-placeholder .site-footer')
    .waitFor({
      state: 'attached',
      timeout: 15_000,
    });
}

for (
  const path of [
    '/leden/muziek.html',
    '/leden/smoelenboek.html',
  ]
) {
  test(
    `niet-ingelogde bezoeker krijgt geen toegang tot ${path}`,
    async ({ page }) => {
      await stubSupabase(
        page,
        {
          profile: null,
          hasSession: false,
        },
      );

      await page.goto(path);

      await expect(page)
        .toHaveURL(
          /leden\/login\.html/,
        );
    },
  );
}

test(
  'pending lid wordt naar het dashboard gestuurd',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        profile: pendingMember,
      },
    );

    await page.goto(
      '/leden/muziek.html',
    );

    await expect(page)
      .toHaveURL(
        /leden\/dashboard\.html/,
      );
  },
);

test(
  'inactief lid wordt uit de beveiligde ledenomgeving geweerd',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        profile: inactiveMember,
      },
    );

    await page.goto(
      '/leden/smoelenboek.html',
    );

    await expect(page)
      .toHaveURL(
        /leden\/login\.html/,
      );
  },
);

for (
  const profile of [
    activeMember,
    activeContentmanager,
    activeAdmin,
  ]
) {
  test(
    `actieve rol ${profile.role} kan Muziek en Smoelenboek read-only openen`,
    async ({ page }) => {
      await stubSupabase(
        page,
        {
          profile,
        },
      );

      await page.goto(
        '/leden/muziek.html',
      );

      await expect(
        page.locator(
          '[data-leden-protected]',
        ),
      ).toBeVisible();

      await expect(
        page.locator('.song-card'),
      ).toHaveCount(3);

      await page.goto(
        '/leden/smoelenboek.html',
      );

      await expect(
        page.locator(
          '[data-leden-protected]',
        ),
      ).toBeVisible();

      await expect(
        page.locator(
          '.member-directory-card',
        ),
      ).toHaveCount(3);
    },
  );
}

test(
  'dashboardlinks worden daadwerkelijk gevolgd naar Muziek en Smoelenboek',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        profile: activeMember,
      },
    );

    await page.goto(
      '/leden/dashboard.html',
    );

    const destinations =
      page.locator(
        '#portal-destinations',
      );

    await expect(
      destinations,
    ).toBeVisible();

    await destinations
      .getByRole(
        'link',
        { name: /Muziek/ },
      )
      .click();

    await expect(page)
      .toHaveURL(
        /leden\/muziek\.html/,
      );

    await expect(
      page.locator('.song-card'),
    ).toHaveCount(3);

    await page.goto(
      '/leden/dashboard.html',
    );

    await expect(
      page.locator(
        '#portal-destinations',
      ),
    ).toBeVisible();

    await page
      .locator(
        '#portal-destinations',
      )
      .getByRole(
        'link',
        { name: /Smoelenboek/ },
      )
      .click();

    await expect(page)
      .toHaveURL(
        /leden\/smoelenboek\.html/,
      );

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toHaveCount(3);
  },
);

test(
  'Muziek leest live Supabase-data, filtert verborgen items en ondersteunt categorieen en zoeken',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        profile: activeAdmin,
      },
    );

    await page.goto(
      '/leden/muziek.html',
    );

    await expect(
      page.getByRole(
        'heading',
        {
          name: 'Muziek',
          level: 1,
        },
      ),
    ).toBeVisible();

    await expect(
      page.locator('.song-card'),
    ).toHaveCount(3);

    await expect(
      page.locator(
        '.song-card',
        {
          hasText:
            'Verborgen repetitielied',
        },
      ),
    ).toHaveCount(0);

    const safeLink =
      page.getByRole(
        'link',
        {
          name: 'Oefenopname',
        },
      );

    await expect(
      safeLink,
    ).toHaveAttribute(
      'href',
      'https://example.com/oefenopname',
    );

    await expect(
      page.getByRole(
        'link',
        {
          name: 'Onveilig voorbeeld',
        },
      ),
    ).toHaveCount(0);

    await page
      .getByRole(
        'button',
        {
          name: 'Concept',
        },
      )
      .click();

    await expect(
      page.locator('.song-card'),
    ).toHaveCount(2);

    await page
      .getByRole(
        'button',
        {
          name: 'Archief',
        },
      )
      .click();

    await expect(
      page.locator('.song-card'),
    ).toHaveCount(1);

    await page
      .getByRole(
        'button',
        {
          name: 'Huidig',
        },
      )
      .click();

    await page
      .getByLabel('Zoek een lied')
      .fill('nacht');

    await expect(
      page.locator('.song-card'),
    ).toHaveCount(1);

    await expect(
      page.locator('.song-card'),
    ).toContainText(
      'Stemmen in de nacht',
    );

    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Download liedblad (PDF)',
        },
      ).first(),
    ).toBeDisabled();
  },
);

test(
  'printactie roept window.print aan en ruimt het printblad op',
  async ({ page }) => {
    await stubSupabase(page);

    await page.goto(
      '/leden/muziek.html',
    );

    await expect(
      page.locator('.song-card'),
    ).toHaveCount(3);

    await page.evaluate(() => {
      (window as any).__PRINT_CALLED__ =
        false;

      window.print = () => {
        (window as any).__PRINT_CALLED__ =
          true;
      };
    });

    await page
      .getByRole(
        'button',
        {
          name: 'Print liedblad',
        },
      )
      .first()
      .click();

    const printSheet =
      page.locator(
        '#song-print-sheet',
      );

    await expect(
      page.locator('body'),
    ).toHaveClass(
      /is-printing-song/,
    );

    await expect(
      printSheet,
    ).toHaveAttribute(
      'aria-hidden',
      'false',
    );

    await expect(
      page.locator(
        '#print-song-title',
      ),
    ).toHaveText(
      'Samen op weg',
    );

    await expect(
      page.locator(
        '#print-song-lyrics',
      ),
    ).toContainText(
      'Wij zingen samen',
    );

    expect(
      await page.evaluate(
        () =>
          (window as any)
            .__PRINT_CALLED__,
      ),
    ).toBe(true);

    await page.evaluate(() => {
      window.dispatchEvent(
        new Event('afterprint'),
      );
    });

    await expect(
      page.locator('body'),
    ).not.toHaveClass(
      /is-printing-song/,
    );

    await expect(
      printSheet,
    ).toBeHidden();

    await expect(
      printSheet,
    ).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  },
);

test(
  'Muziek toont een veilige lege toestand',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        songs: [],
        links: [],
      },
    );

    await page.goto(
      '/leden/muziek.html',
    );

    await expect(
      page.locator('.song-card'),
    ).toHaveCount(0);

    await expect(
      page.locator(
        '.member-empty-state',
      ),
    ).toContainText(
      'Geen liedjes gevonden',
    );
  },
);

test(
  'Muziek toont een veilige foutmelding bij backendfout',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        failTable:
          'member_songs',
      },
    );

    await page.goto(
      '/leden/muziek.html',
    );

    await expect(
      page.locator('#song-list'),
    ).toHaveText(
      'De muziekinhoud kon niet worden geladen.',
    );
  },
);

test(
  'Smoelenboek gebruikt RPC en tijdelijke signed URL voor private ledenfoto',
  async ({ page }) => {
    await stubSupabase(page);

    await page.goto(
      '/leden/smoelenboek.html',
    );

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toHaveCount(3);

    const image =
      page.locator(
        '.member-directory-card img',
      );

    await expect(
      image,
    ).toHaveCount(1);

    await expect(
      image,
    ).toHaveAttribute(
      'src',
      /https:\/\/signed\.example\/member-photos\/members\/jan\.webp\?ttl=300/,
    );

    const calls =
      await page.evaluate(
        () =>
          (window as any)
            .__LEDENPORTAAL_TEST__
            .calls,
      );

    expect(
      calls.rpcs,
    ).toContain(
      'get_member_directory',
    );

    expect(
      calls.signed,
    ).toContainEqual({
      bucket: 'member-photos',
      path: 'members/jan.webp',
      expiresIn: 300,
    });

    await page
      .getByLabel('Zoek een lid')
      .fill('Piet');

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toHaveCount(1);

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toContainText(
      'Piet de Vries',
    );
  },
);

test(
  'Smoelenboek toont veilige placeholders voor ongeldige of niet-te-signen fotopaden',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        directory: [
          {
            profile_id:
              '20000000-0000-4000-8000-000000000001',
            full_name:
              'Ongeldig Pad',
            memo: '',
            photo_path:
              '../verborgen.jpg',
          },
          {
            profile_id:
              '20000000-0000-4000-8000-000000000002',
            full_name:
              'Signing Fout',
            memo: '',
            photo_path:
              'members/fout.jpg',
          },
        ],

        signingErrorPaths: [
          'members/fout.jpg',
        ],
      },
    );

    await page.goto(
      '/leden/smoelenboek.html',
    );

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toHaveCount(2);

    await expect(
      page.locator(
        '.member-directory-card img',
      ),
    ).toHaveCount(0);

    await expect(
      page.locator(
        '.member-directory-card__placeholder',
      ),
    ).toHaveCount(2);

    const signedCalls =
      await page.evaluate(
        () =>
          (window as any)
            .__LEDENPORTAAL_TEST__
            .calls
            .signed,
      );

    expect(
      signedCalls,
    ).toEqual([
      {
        bucket:
          'member-photos',
        path:
          'members/fout.jpg',
        expiresIn: 300,
      },
    ]);
  },
);

test(
  'Smoelenboek toont een veilige lege toestand',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        directory: [],
      },
    );

    await page.goto(
      '/leden/smoelenboek.html',
    );

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toHaveCount(0);

    await expect(
      page.locator(
        '.member-empty-state',
      ),
    ).toContainText(
      'Geen leden gevonden',
    );
  },
);

test(
  'Smoelenboek toont een veilige foutmelding bij RPC-fout',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        directoryRpcError: true,
      },
    );

    await page.goto(
      '/leden/smoelenboek.html',
    );

    await expect(
      page.locator(
        '#member-grid',
      ),
    ).toHaveText(
      'Het smoelenboek kon niet worden geladen.',
    );
  },
);

test(
  'publieke ledenportaal-demobron is verwijderd',
  async ({ request }) => {
    const demoResponse =
      await request.get(
        '/data/ledenportaal-demo.json',
      );

    expect(
      demoResponse.status(),
    ).toBe(404);

    for (
      const path of [
        '/leden/muziek.html',
        '/leden/smoelenboek.html',
      ]
    ) {
      const response =
        await request.get(path);

      expect(
        response.ok(),
      ).toBe(true);

      const html =
        await response.text();

      expect(html)
        .not.toContain('[DEMO]');

      expect(html)
        .not.toContain(
          'ledenportaal-demo.json',
        );
    }
  },
);

for (
  const target of [
    {
      name: 'Muziek',
      path: '/leden/muziek.html',
    },
    {
      name: 'Smoelenboek',
      path: '/leden/smoelenboek.html',
    },
  ]
) {
  test(
    `${target.name} gebruikt de mannenkoor-hero en heeft geen Axe-overtredingen`,
    async ({ page }) => {
      test.setTimeout(45_000);

      await stubSupabase(page);

      await page.goto(
        target.path,
      );

      await waitForSharedLayout(
        page,
      );

      const hero =
        page.locator(
          '.member-hero',
        );

      await expect(
        hero,
      ).toBeVisible();

      await expect(
        hero,
      ).toContainText(
        'mannenkoor',
      );

      const backgroundImage =
        await hero.evaluate(
          (element) =>
            getComputedStyle(
              element,
            ).backgroundImage,
        );

      expect(
        backgroundImage,
      ).toContain(
        'over-hero-mannenkoor.jpg',
      );

      const results =
        await new AxeBuilder({
          page,
        }).analyze();

      expect(
        results.violations,
        `Toegankelijkheidsproblemen op ${target.path}`,
      ).toEqual([]);
    },
  );

  test(
    `${target.name} heeft op 390px geen horizontale pagina-overflow`,
    async ({ page }) => {
      await page.setViewportSize({
        width: 390,
        height: 844,
      });

      await stubSupabase(page);

      await page.goto(
        target.path,
      );

      await expect(
        page.locator(
          '[data-leden-protected]',
        ),
      ).toBeVisible();

      const dimensions =
        await page.evaluate(
          () => ({
            innerWidth:
              window.innerWidth,

            scrollWidth:
              document
                .documentElement
                .scrollWidth,
          }),
        );

      expect(
        dimensions.scrollWidth,
      ).toBeLessThanOrEqual(
        dimensions.innerWidth + 1,
      );
    },
  );
}