import {
  test,
  expect,
  type Page,
} from '@playwright/test';

import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// B4.1f VISUAL FIXTURE
const visualDemo = JSON.parse(
  readFileSync(
    `${process.cwd()}/tests/fixtures/ledenportaal-visual-demo.json`,
    'utf8',
  ),
) as {
  songs: PortalSong[];
  links: PortalLink[];
  directory: DirectoryRow[];
};


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
  pdf_path?: string | null;
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
  'PDF-download vraagt pas op klik een private signed URL aan',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        songs: [
          {
            id: 'song-pdf-1',
            title: 'Lied met PDF',
            category: 'current',
            description: 'Beveiligd liedblad.',
            lyrics: 'Testtekst.',
            pdf_path: 'songs/song-pdf-1.pdf',
            is_visible: true,
            sort_order: 1,
          },
        ],
        links: [],
      },
    );

    await page.addInitScript(() => {
      (
        window as any
      ).__PDF_ANCHOR_CLICKS__ = [];

      HTMLAnchorElement.prototype.click =
        function () {
          (
            window as any
          ).__PDF_ANCHOR_CLICKS__.push(
            this.href,
          );
        };
    });

    await page.goto(
      '/leden/muziek.html',
    );

    const pdfButton =
      page.getByRole(
        'button',
        {
          name:
            'Download liedblad (PDF)',
        },
      );

    await expect(
      pdfButton,
    ).toBeEnabled();

    const before =
      await page.evaluate(
        () =>
          (
            window as any
          ).__LEDENPORTAAL_TEST__
            .calls.signed.length,
      );

    expect(before).toBe(0);

    await pdfButton.click();

    const state =
      await page.evaluate(
        () => ({
          signed:
            (
              window as any
            ).__LEDENPORTAAL_TEST__
              .calls.signed,

          clicks:
            (
              window as any
            ).__PDF_ANCHOR_CLICKS__,
        }),
      );

    expect(
      state.signed,
    ).toContainEqual({
      bucket:
        'member-song-sheets',
      path:
        'songs/song-pdf-1.pdf',
      expiresIn: 300,
    });

    expect(
      state.clicks,
    ).toHaveLength(1);

    expect(
      state.clicks[0],
    ).toContain(
      'https://signed.example/member-song-sheets/songs/song-pdf-1.pdf',
    );
  },
);

test(
  'PDF signingfout toont veilige fout en start geen download',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        songs: [
          {
            id: 'song-pdf-error',
            title: 'PDF signingfout',
            category: 'current',
            description: 'Test signingfout.',
            lyrics: 'Testtekst.',
            pdf_path: 'songs/fout.pdf',
            is_visible: true,
            sort_order: 1,
          },
        ],
        links: [],
        signingErrorPaths: [
          'songs/fout.pdf',
        ],
      },
    );

    await page.addInitScript(() => {
      (
        window as any
      ).__PDF_ANCHOR_CLICKS__ = [];

      HTMLAnchorElement.prototype.click =
        function () {
          (
            window as any
          ).__PDF_ANCHOR_CLICKS__.push(
            this.href,
          );
        };
    });

    await page.goto(
      '/leden/muziek.html',
    );

    const pdfButton =
      page.getByRole(
        'button',
        {
          name:
            'Download liedblad (PDF)',
        },
      );

    await expect(
      pdfButton,
    ).toBeEnabled();

    await pdfButton.click();

    await expect(
      page.locator(
        '[data-auth-status]',
      ),
    ).toContainText(
      'Het liedblad kon niet worden gedownload.',
    );

    const clicks =
      await page.evaluate(
        () =>
          (
            window as any
          ).__PDF_ANCHOR_CLICKS__,
      );

    expect(clicks).toEqual([]);

    await expect(
      pdfButton,
    ).toBeEnabled();
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

test(
  'B4.1d Ledenportaal-navigatie en footer-wave volgen goedgekeurd wireframe',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        profile: activeMember,
      },
    );

    for (const path of [
      '/leden/muziek.html',
      '/leden/smoelenboek.html',
    ]) {
      await page.goto(path);
      await waitForSharedLayout(page);

      const nav =
        page.locator('#nav-placeholder');

      const portalLink =
        nav.getByRole(
          'link',
          {
            name: 'Ledenportaal',
            exact: true,
          },
        );

      const ledenLink =
        nav.getByRole(
          'link',
          {
            name: 'Leden',
            exact: true,
          },
        );

      await expect(portalLink)
        .toHaveClass(/active/);

      await expect(portalLink)
        .toHaveAttribute(
          'aria-current',
          'page',
        );

      await expect(ledenLink)
        .not.toHaveClass(/active/);

      const wave =
        await page
          .locator('#footer-placeholder')
          .evaluate((element) => {
            const style =
              getComputedStyle(
                element,
                '::before',
              );

            return {
              content: style.content,
              height:
                Number.parseFloat(
                  style.height,
                ),
              clipPath:
                style.clipPath,
            };
          });

      expect(wave.content)
        .not.toBe('none');

      expect(wave.height)
        .toBeGreaterThanOrEqual(50);

      expect(wave.clipPath)
        .toContain('polygon');
    }
  },
);

test(
  'B4.1d portal footer-wave veroorzaakt mobiel geen horizontale overflow',
  async ({ page }) => {
    await page.setViewportSize({
      width: 390,
      height: 844,
    });

    await stubSupabase(
      page,
      {
        profile: activeMember,
      },
    );

    await page.goto(
      '/leden/muziek.html',
    );

    await waitForSharedLayout(page);

    const dimensions =
      await page.evaluate(
        () => ({
          viewport:
            window.innerWidth,
          document:
            document.documentElement
              .scrollWidth,
        }),
      );

    expect(dimensions.document)
      .toBeLessThanOrEqual(
        dimensions.viewport + 1,
      );
  },
);

// B4.1d APPROVED WIREFRAME NAV + FOOTER


test(
  'B4.1e Muziek volgt het goedgekeurde wireframe-detailcontract',
  async ({ page }) => {
    await stubSupabase(
      page,
      {
        profile: activeMember,
      },
    );

    await page.goto(
      '/leden/muziek.html',
    );

    await waitForSharedLayout(page);

    await expect(
      page.locator('.member-hero__eyebrow'),
    ).toHaveText('LEDENPORTAAL');

    await expect(
      page.locator('.music-tab'),
    ).toHaveCount(3);

    const tabColumns =
      await page
        .locator('.music-tabs')
        .evaluate(
          (element) =>
            getComputedStyle(element)
              .gridTemplateColumns
              .trim()
              .split(/\s+/)
              .length,
        );

    expect(tabColumns)
      .toBe(3);

    const infoCard =
      page.locator('.member-info-card');

    await expect(infoCard)
      .toContainText(
        'Huidig:',
      );

    await expect(infoCard)
      .toContainText(
        'Concept:',
      );

    await expect(infoCard)
      .toContainText(
        'Archief:',
      );

    await expect(infoCard)
      .toContainText(
        'PDF-download',
      );

    await expect(
      infoCard.getByRole(
        'link',
        {
          name:
            'Contact muziekcommissie',
        },
      ),
    ).toHaveAttribute(
      'href',
      '../pages/contact.html',
    );

    const infoBackground =
      await infoCard.evaluate(
        (element) =>
          getComputedStyle(element)
            .backgroundColor,
      );

    expect(infoBackground)
      .not.toBe(
        'rgba(255, 255, 255, 0.98)',
      );

    const firstCard =
      page.locator('.song-card')
        .first();

    await expect(
      firstCard.locator(
        '.song-card__resources',
      ),
    ).toBeVisible();

    await expect(
      firstCard.getByRole(
        'button',
        {
          name:
            'Download liedblad (PDF)',
        },
      ),
    ).toBeDisabled();

    await expect(
      firstCard.getByRole(
        'button',
        {
          name: 'Print liedblad',
        },
      ),
    ).toBeVisible();

    const footer =
      page.locator(
        '#footer-placeholder .site-footer',
      );

    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
  },
);

test(
  'B4.1e Smoelenboek toont vijf kolommen en functioneel Meer leden laden',
  async ({ page }) => {
    await page.setViewportSize({
      width: 1440,
      height: 1000,
    });

    const manyMembers: DirectoryRow[] =
      visualDemo.directory;


    await stubSupabase(
      page,
      {
        profile: activeMember,
        directory: manyMembers,
      },
    );

    // B4.1f VISUAL PORTRAIT ROUTE
    await page.route(
      'https://signed.example/member-photos/**',
      async (route) => {
        const url =
          new URL(
            route.request().url(),
          );

        const fileName =
          decodeURIComponent(
            url.pathname
              .split('/')
              .pop() || '',
          );

        if (
          !/^member-\d{2}\.png$/
            .test(fileName)
        ) {
          await route.abort();
          return;
        }

        const body =
          readFileSync(
            `${process.cwd()}/tests/fixtures/ledenportaal-portraits/${fileName}`,
          );

        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body,
        });
      },
    );

    await page.goto(
      '/leden/smoelenboek.html',
    );

    await waitForSharedLayout(page);

    await expect(
      page.locator('.member-hero__eyebrow'),
    ).toHaveText('LEDENPORTAAL');

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toHaveCount(10);


    const gridColumns =
      await page
        .locator('.member-directory-grid')
        .evaluate(
          (element) =>
            getComputedStyle(element)
              .gridTemplateColumns
              .trim()
              .split(/\s+/)
              .length,
        );

    expect(gridColumns)
      .toBe(5);

    const firstName =
      page.locator(
        '.member-directory-card h3',
      ).first();

    const accent =
      await firstName.evaluate(
        (element) => {
          const style =
            getComputedStyle(
              element,
              '::after',
            );

          return {
            content:
              style.content,
            width:
              Number.parseFloat(
                style.width,
              ),
          };
        },
      );

    expect(accent.content)
      .not.toBe('none');

    expect(accent.width)
      .toBeGreaterThan(20);

    const initialImages =
      page.locator(
        '.member-directory-card img',
      );

    await expect(initialImages)
      .toHaveCount(10);

    await expect(
      initialImages.first(),
    ).toBeVisible();

    expect(
      await initialImages.first()
        .evaluate(
          (image) =>
            image.complete &&
            image.naturalWidth > 0,
        ),
    ).toBe(true);
    await page.screenshot({
      path: 'test-output/b4.1f-visual-review/smoelenboek-10-leden.png',
      fullPage: true,
    });
    const loadMore =
      page.getByRole(
        'button',
        {
          name: 'Meer leden laden',
        },
      );

    await expect(loadMore)
      .toBeVisible();

    await loadMore.click();

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toHaveCount(15);

    const allImages =
      page.locator(
        '.member-directory-card img',
      );

    await expect(allImages)
      .toHaveCount(15);

    await expect
      .poll(
        async () =>
          allImages.evaluateAll(
            (images) =>
              images.every(
                (image) =>
                  image.complete &&
                  image.naturalWidth > 0,
              ),
          ),
        {
          message:
            "Alle 15 ledenfoto's moeten volledig geladen zijn.",
        },
      )
      .toBe(true);

    await page.screenshot({
      path: 'test-output/b4.1f-visual-review/smoelenboek-15-leden.png',
      fullPage: true,
    });

    await expect(loadMore)
      .toBeHidden();

    const footer =
      page.locator(
        '#footer-placeholder .site-footer',
      );

    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
  },
);

test(
  'B4.1e Smoelenboek zoeken reset de laadlimiet veilig',
  async ({ page }) => {
    const manyMembers: DirectoryRow[] =
      Array.from(
        {
          length: 12,
        },
        (_, index) => ({
          profile_id:
            `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          full_name:
            index === 11
              ? 'Unieke Zoeknaam'
              : `Gewoon Lid ${index + 1}`,
          memo: '',
          photo_path: null,
        }),
      );

    await stubSupabase(
      page,
      {
        directory: manyMembers,
      },
    );

    await page.goto(
      '/leden/smoelenboek.html',
    );

    await page
      .getByLabel('Zoek een lid')
      .fill('Unieke Zoeknaam');

    await expect(
      page.locator(
        '.member-directory-card',
      ),
    ).toHaveCount(1);

    await expect(
      page.getByRole(
        'button',
        {
          name: 'Meer leden laden',
        },
      ),
    ).toBeHidden();
  },
);

test(
  'B4.1f visual fixture rendert 15 liedjes per categorie',
  async ({ page }) => {
    expect(visualDemo.songs).toHaveLength(45);
    expect(visualDemo.directory).toHaveLength(15);

    for (const category of [
      'current',
      'concept',
      'archive',
    ] as const) {
      expect(
        visualDemo.songs.filter(
          (song) =>
            song.category === category,
        ),
      ).toHaveLength(15);
    }

    await stubSupabase(
      page,
      {
        profile: activeMember,
        songs: visualDemo.songs,
        links: visualDemo.links,
      },
    );

    await page.goto(
      '/leden/muziek.html',
    );

    await waitForSharedLayout(page);

    await expect(
      page.locator('.song-card'),
    ).toHaveCount(15);
    // B4.1f VISUAL REVIEW SCREENSHOTS
    await page.screenshot({
      path: 'test-output/b4.1f-visual-review/muziek-huidig.png',
      fullPage: true,
    });

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
    ).toHaveCount(15);
    await page.screenshot({
      path: 'test-output/b4.1f-visual-review/muziek-concept.png',
      fullPage: true,
    });

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
    ).toHaveCount(15);
    await page.screenshot({
      path: 'test-output/b4.1f-visual-review/muziek-archief.png',
      fullPage: true,
    });
  },
);
// B4.1e APPROVED WIREFRAME FIDELITY

test('keyboard: Muziek en Smoelenboek zijn zonder muis bedienbaar', async ({ page }) => {
  await stubSupabase(page);

  await page.goto(
    '/leden/muziek.html',
  );

  const currentTab =
    page.getByRole(
      'button',
      { name: 'Huidig' },
    );

  const conceptTab =
    page.getByRole(
      'button',
      { name: 'Concept' },
    );

  await currentTab.focus();

  await expect(
    currentTab,
  ).toBeFocused();

  await page.keyboard.press(
    'Tab',
  );

  await expect(
    conceptTab,
  ).toBeFocused();

  await page.keyboard.press(
    'Enter',
  );

  await expect(
    conceptTab,
  ).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const search =
    page.getByLabel(
      'Zoek een lied',
    );

  await search.focus();

  await expect(
    search,
  ).toBeFocused();

  await page.keyboard.type(
    'ontwikkeling',
  );

  await expect(
    page.locator(
      '.song-card',
    ),
  ).toHaveCount(1);

  const songText =
    page.locator(
      '.song-card details summary',
    ).first();

  await songText.focus();

  await expect(
    songText,
  ).toBeFocused();

  await page.keyboard.press(
    'Enter',
  );

  await expect(
    page.locator(
      '.song-card details',
    ).first(),
  ).toHaveAttribute(
    'open',
    '',
  );

  await page.goto(
    '/leden/smoelenboek.html',
  );

  const memberSearch =
    page.getByLabel(
      'Zoek een lid',
    );

  await memberSearch.focus();

  await expect(
    memberSearch,
  ).toBeFocused();

  await page.keyboard.type(
    'Jan',
  );

  await expect(
    page.locator(
      '.member-directory-card',
    ),
  ).toHaveCount(1);
});
