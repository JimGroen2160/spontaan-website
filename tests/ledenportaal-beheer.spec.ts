import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const managerProfile = {
  id: 'profile-manager',
  auth_user_id: 'auth-manager',
  full_name: 'Test Contentmanager',
  role: 'contentmanager',
  status: 'active',
};

const adminProfile = {
  ...managerProfile,
  id: 'profile-admin',
  full_name: 'Test Administrator',
  role: 'admin',
};

const memberProfile = {
  ...managerProfile,
  id: 'profile-member',
  full_name: 'Gewoon Lid',
  role: 'member',
};

async function stubSupabase(page: Page, options: any = {}) {
  const state = {
    session: options.session === false ? null : { user: { id: 'auth-manager' } },
    currentProfile: options.profile || managerProfile,
    failTable: options.failTable || '',
    failSongPdfUpdate: Boolean(options.failSongPdfUpdate),
    storageUploadError: Boolean(options.storageUploadError),
    storageRemoveError: Boolean(options.storageRemoveError),
    songs: options.songs || [
      { id: 'song-1', title: 'Aan de Amsterdamse grachten', category: 'current', description: 'Een ode aan onze stad.', lyrics: 'Tekst 1', is_visible: true, sort_order: 1 },
      { id: 'song-2', title: 'Bridge Over Troubled Water', category: 'current', description: 'Een klassieker.', lyrics: 'Tekst 2', is_visible: true, sort_order: 2 },
      { id: 'song-3', title: 'Verborgen concept', category: 'concept', description: 'In voorbereiding.', lyrics: '', is_visible: false, sort_order: 1 },
    ],
    links: options.links || [
      { id: 'link-1', song_id: 'song-1', label: 'Audio', link_type: 'audio', url: 'https://example.com/audio', sort_order: 0 },
    ],
    profiles: options.profiles || [
      { id: 'profile-manager', auth_user_id: 'auth-manager', full_name: 'Test Contentmanager', role: 'contentmanager', status: 'active' },
      { id: 'member-1', auth_user_id: 'auth-member-1', full_name: 'Jan de Vries', role: 'member', status: 'active' },
      { id: 'member-2', auth_user_id: 'auth-member-2', full_name: 'Bert Jansen', role: 'member', status: 'active' },
      { id: 'member-inactive', auth_user_id: 'auth-inactive', full_name: 'Inactief Lid', role: 'member', status: 'inactive' },
    ],
    directory: options.directory || [
      { profile_id: 'member-1', memo: 'Altijd in voor een grap.', photo_path: 'member-1/jan.webp' },
      { profile_id: 'member-2', memo: 'Bas met een warm hart.', photo_path: null },
    ],
    calls: [],
  };

  await page.addInitScript((initialState) => {
    (window as any).__B4_STATE__ = initialState;
  }, state);

  await page.route('https://cdn.jsdelivr.net/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `
        (function () {
          const state = window.__B4_STATE__;
          function clone(value) { return JSON.parse(JSON.stringify(value)); }

          function tableRows(table) {
            if (table === 'member_songs') return state.songs;
            if (table === 'member_song_links') return state.links;
            if (table === 'profiles') return state.profiles;
            if (table === 'member_directory') return state.directory;
            return [];
          }

          function makeQuery(table) {
            const filters = [];
            let operation = 'select';
            let payload = null;
            let returning = false;
            state.calls.push({ kind: 'table', table });

            function applyFilters(rows) {
              return rows.filter((row) => filters.every((filter) => {
                if (filter.kind === 'eq') return row[filter.column] === filter.value;
                if (filter.kind === 'in') return filter.values.includes(row[filter.column]);
                return true;
              }));
            }

            function execute() {
              if (state.failTable === table) return { data: null, error: { message: 'Geforceerde fout voor ' + table } };
              const rows = tableRows(table);

              if (operation === 'select') return { data: clone(applyFilters(rows)), error: null };

              if (operation === 'insert') {
                const values = Array.isArray(payload) ? payload : [payload];
                const inserted = values.map((item, index) => {
                  const row = { ...item };
                  if (!row.id && table === 'member_songs') row.id = 'song-new-' + (state.songs.length + index + 1);
                  if (!row.id && table === 'member_song_links') row.id = 'link-new-' + (state.links.length + index + 1);
                  rows.push(row);
                  return row;
                });
                return { data: returning ? clone(inserted) : null, error: null };
              }

              if (operation === 'update') {
                if (
                  state.failSongPdfUpdate &&
                  table === 'member_songs' &&
                  payload &&
                  Object.prototype.hasOwnProperty.call(
                    payload,
                    'pdf_path',
                  )
                ) {
                  return {
                    data: null,
                    error: {
                      message:
                        'Geforceerde PDF-metadatafout',
                    },
                  };
                }

                const targets = applyFilters(rows);
                targets.forEach((row) => Object.assign(row, payload));
                return { data: returning ? clone(targets) : null, error: null };
              }

              if (operation === 'delete') {
                const targets = new Set(applyFilters(rows));
                for (let index = rows.length - 1; index >= 0; index -= 1) {
                  if (targets.has(rows[index])) rows.splice(index, 1);
                }
                return { data: null, error: null };
              }

              if (operation === 'upsert') {
                const existing = rows.find((row) => row.profile_id === payload.profile_id);
                if (existing) Object.assign(existing, payload);
                else rows.push({ ...payload });
                return { data: null, error: null };
              }

              return { data: null, error: null };
            }

            const builder = {
              select: function () { returning = operation !== 'select' || returning; return builder; },
              eq: function (column, value) { filters.push({ kind: 'eq', column, value }); return builder; },
              in: function (column, values) { filters.push({ kind: 'in', column, values }); return builder; },
              order: function () { return builder; },
              insert: function (value) { operation = 'insert'; payload = value; state.calls.push({ kind: 'insert', table, value: clone(value) }); return builder; },
              update: function (value) { operation = 'update'; payload = value; state.calls.push({ kind: 'update', table, value: clone(value) }); return builder; },
              delete: function () { operation = 'delete'; state.calls.push({ kind: 'delete', table }); return builder; },
              upsert: function (value) { operation = 'upsert'; payload = value; state.calls.push({ kind: 'upsert', table, value: clone(value) }); return builder; },
              single: async function () {
                if (table === 'profiles' && operation === 'select') {
                  return { data: clone(state.currentProfile), error: null };
                }
                const response = execute();
                return { data: Array.isArray(response.data) ? response.data[0] || null : response.data, error: response.error };
              },
              then: function (resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
            };

            return builder;
          }

          window.supabase = {
            createClient: function () {
              return {
                auth: {
                  getSession: async function () { return { data: { session: state.session }, error: null }; },
                  signOut: async function () { state.session = null; return { error: null }; }
                },
                from: function (table) { return makeQuery(table); },
                storage: {
                  from: function (bucket) {
                    return {
                      createSignedUrl: async function (path, expiresIn) {
                        state.calls.push({ kind: 'signed', bucket, path, expiresIn });
                        return { data: { signedUrl: 'https://signed.example/' + bucket + '/' + path + '?ttl=' + expiresIn }, error: null };
                      },
                      upload: async function (path, file, options) {
                        state.calls.push({ kind: 'upload', bucket, path, type: file.type, size: file.size, options });
                        return state.storageUploadError ? { data: null, error: { message: 'Uploadfout' } } : { data: { path }, error: null };
                      },
                      remove: async function (paths) {
                        state.calls.push({ kind: 'remove', bucket, paths });
                        return state.storageRemoveError ? { data: null, error: { message: 'Removefout' } } : { data: paths, error: null };
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
  });

  await page.route('https://signed.example/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
    });
  });
}

async function openManager(page: Page, options: any = {}) {
  await stubSupabase(page, options);
  await page.goto('/admin/ledenportaal.html');
  await expect(page.locator('#portal-beheer-content')).toBeVisible();

  const expectedSongCount =
    Array.isArray(options.songs)
      ? options.songs.length
      : 2;

  await expect(
    page.locator(
      '.portal-beheer-song-card',
    ),
  ).toHaveCount(
    expectedSongCount,
  );
}

test('niet-ingelogde bezoeker wordt naar login gestuurd', async ({ page }) => {
  await stubSupabase(page, { session: false });
  await page.goto('/admin/ledenportaal.html');
  await expect(page).toHaveURL(/leden\/login\.html/);
});

test('gewoon lid krijgt geen toegang tot ledenportaalbeheer', async ({ page }) => {
  await stubSupabase(page, { profile: memberProfile });
  await page.goto('/admin/ledenportaal.html');
  await expect(page).toHaveURL(/leden\/login\.html/);
});

for (const profile of [managerProfile, adminProfile]) {
  test(`${profile.role} kan beheerpagina openen`, async ({ page }) => {
    await openManager(page, { profile });
    await expect(page.getByRole('heading', { name: 'Muziek en smoelenboek beheren', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Muziek/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Huidig' })).toHaveAttribute('aria-pressed', 'true');
  });
}

test('muziekbeheer toont ook verborgen content via wireframe-categorietabs en filtert zoekterm', async ({ page }) => {
  await openManager(page);
  await expect(page.locator('.portal-beheer-song-card')).toHaveCount(2);
  await expect(page.locator('.portal-beheer-song-card', { hasText: 'Verborgen concept' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Concept' }).click();
  await expect(page.getByRole('button', { name: 'Concept' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.portal-beheer-song-card')).toHaveCount(1);
  await expect(page.locator('.portal-beheer-song-card')).toContainText('Verborgen concept');

  await page.getByRole('button', { name: 'Huidig' }).click();
  await page.fill('#song-admin-search', 'Bridge');
  await expect(page.locator('.portal-beheer-song-card')).toHaveCount(1);
  await expect(page.locator('.portal-beheer-song-card')).toContainText('Bridge Over Troubled Water');
});

test('contentmanager kan nieuw lied met veilige oefenlink toevoegen', async ({ page }) => {
  await openManager(page);
  await page.getByRole('button', { name: 'Concept' }).click();
  await page.click('#song-new');
  await page.fill('#song-title', 'Nieuw testlied');
  await page.selectOption('#song-category', 'concept');
  await page.fill('#song-sort-order', '4');
  await page.fill('#song-description', 'Nieuwe beheerinhoud.');
  await page.click('#song-link-add');
  await page.locator('[data-link-field="label"]').fill('Oefenbestand');
  await page.locator('[data-link-field="url"]').fill('https://example.com/nieuw');
  await page.click('#song-save');

  await expect(page.locator('#song-modal')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.portal-beheer-song-card', { hasText: 'Nieuw testlied' })).toHaveCount(1);

  const calls = await page.evaluate(() => (window as any).__B4_STATE__.calls);
  expect(calls.some((call) => call.kind === 'insert' && call.table === 'member_songs')).toBe(true);
  expect(calls.some((call) => call.kind === 'insert' && call.table === 'member_song_links')).toBe(true);
});

test('onveilige oefenlink wordt lokaal geweigerd zonder write', async ({ page }) => {
  await openManager(page);
  const before = await page.evaluate(() => (window as any).__B4_STATE__.calls.length);
  await page.click('#song-new');
  await page.fill('#song-title', 'Onveilige link');
  await page.click('#song-link-add');
  await page.locator('[data-link-field="label"]').fill('Onveilig');
  await page.locator('[data-link-field="url"]').fill('http://example.com/onveilig');
  await page.click('#song-save');
  await expect(page.locator('#song-form-error')).toContainText('HTTPS');

  const writes = await page.evaluate((start) => (window as any).__B4_STATE__.calls.slice(start).filter((call) => ['insert', 'update', 'delete', 'upsert'].includes(call.kind)), before);
  expect(writes).toEqual([]);
});

test('bestaand lied kan worden bewerkt en verwijderd na bevestiging', async ({ page }) => {
  await openManager(page);
  const first = page.locator('.portal-beheer-song-card').first();
  await first.getByRole('button', { name: 'Bewerken' }).click();
  await page.fill('#song-title', 'Aangepast lied');
  await page.click('#song-save');
  await expect(page.locator('.portal-beheer-song-card', { hasText: 'Aangepast lied' })).toHaveCount(1);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.portal-beheer-song-card', { hasText: 'Aangepast lied' }).getByRole('button', { name: 'Verwijderen' }).click();
  await expect(page.locator('.portal-beheer-song-card', { hasText: 'Aangepast lied' })).toHaveCount(0);
});

test('contentmanager kan PDF-liedblad uploaden en metadata koppelen', async ({ page }) => {
  await openManager(page);

  const first =
    page.locator(
      '.portal-beheer-song-card',
    ).first();

  await first
    .getByRole(
      'button',
      { name: 'Bewerken' },
    )
    .click();

  const fileInput =
    page.locator(
      '#song-pdf-file',
    );

  await expect(
    fileInput,
  ).toBeEnabled();

  await fileInput.setInputFiles({
    name: 'liedblad.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(
      '%PDF-1.4 demo',
    ),
  });

  await page
    .getByRole(
      'button',
      { name: 'PDF uploaden' },
    )
    .click();

  await expect(
    page.locator(
      '#portal-beheer-toast',
    ),
  ).toContainText(
    'PDF-liedblad',
  );

  const calls =
    await page.evaluate(
      () =>
        (window as any)
          .__B4_STATE__
          .calls,
    );

  expect(
    calls.some(
      (call) =>
        call.kind === 'upload' &&
        call.bucket ===
          'member-song-sheets' &&
        call.type ===
          'application/pdf' &&
        call.path
          .startsWith(
            'songs/song-1/',
          ) &&
        call.path
          .endsWith('.pdf'),
    ),
  ).toBe(true);

  expect(
    calls.some(
      (call) =>
        call.kind === 'update' &&
        call.table ===
          'member_songs' &&
        typeof call.value
          ?.pdf_path ===
          'string' &&
        call.value.pdf_path
          .startsWith(
            'songs/song-1/',
          ) &&
        call.value.pdf_path
          .endsWith('.pdf'),
    ),
  ).toBe(true);
});


test('ongeldig liedbladtype wordt geweigerd vóór Storage-write', async ({ page }) => {
  await openManager(page);

  await page
    .locator(
      '.portal-beheer-song-card',
    )
    .first()
    .getByRole(
      'button',
      { name: 'Bewerken' },
    )
    .click();

  const before =
    await page.evaluate(
      () =>
        (window as any)
          .__B4_STATE__
          .calls.length,
    );

  await page
    .locator('#song-pdf-file')
    .setInputFiles({
      name: 'liedblad.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'geen pdf',
      ),
    });

  await page
    .getByRole(
      'button',
      { name: 'PDF uploaden' },
    )
    .click();

  await expect(
    page.locator(
      '#portal-beheer-toast',
    ),
  ).toContainText(
    'alleen een PDF',
  );

  const writes =
    await page.evaluate(
      (start) =>
        (window as any)
          .__B4_STATE__
          .calls
          .slice(start)
          .filter(
            (call) =>
              [
                'upload',
                'update',
                'insert',
                'delete',
                'upsert',
                'remove',
              ].includes(
                call.kind,
              ),
          ),
      before,
    );

  expect(writes).toEqual([]);
});


test('PDF groter dan 5 MiB wordt geweigerd vóór Storage-write', async ({ page }) => {
  await openManager(page);

  await page
    .locator(
      '.portal-beheer-song-card',
    )
    .first()
    .getByRole(
      'button',
      { name: 'Bewerken' },
    )
    .click();

  const before =
    await page.evaluate(
      () =>
        (window as any)
          .__B4_STATE__
          .calls.length,
    );

  await page
    .locator('#song-pdf-file')
    .setInputFiles({
      name: 'te-groot.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(
        5 * 1024 * 1024 + 1,
      ),
    });

  await page
    .getByRole(
      'button',
      { name: 'PDF uploaden' },
    )
    .click();

  await expect(
    page.locator(
      '#portal-beheer-toast',
    ),
  ).toContainText(
    'maximaal 5 MiB',
  );

  const writes =
    await page.evaluate(
      (start) =>
        (window as any)
          .__B4_STATE__
          .calls
          .slice(start)
          .filter(
            (call) =>
              [
                'upload',
                'update',
                'remove',
              ].includes(
                call.kind,
              ),
          ),
      before,
    );

  expect(writes).toEqual([]);
});


test('bestaand PDF-liedblad kan veilig worden vervangen', async ({ page }) => {
  await openManager(
    page,
    {
      songs: [
        {
          id: 'song-1',
          title:
            'Aan de Amsterdamse grachten',
          category: 'current',
          description:
            'Een ode aan onze stad.',
          lyrics: 'Tekst 1',
          pdf_path:
            'songs/song-1/oud.pdf',
          is_visible: true,
          sort_order: 1,
        },
      ],
      links: [],
    },
  );

  await page
    .locator(
      '.portal-beheer-song-card',
    )
    .first()
    .getByRole(
      'button',
      { name: 'Bewerken' },
    )
    .click();

  await expect(
    page.getByRole(
      'button',
      { name: 'PDF verwijderen' },
    ),
  ).toBeVisible();

  await page
    .locator('#song-pdf-file')
    .setInputFiles({
      name: 'nieuw.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(
        '%PDF-1.4 nieuw',
      ),
    });

  await page
    .getByRole(
      'button',
      { name: 'PDF uploaden' },
    )
    .click();

  const calls =
    await page.evaluate(
      () =>
        (window as any)
          .__B4_STATE__
          .calls,
    );

  expect(
    calls.some(
      (call) =>
        call.kind === 'remove' &&
        call.bucket ===
          'member-song-sheets' &&
        call.paths.includes(
          'songs/song-1/oud.pdf',
        ),
    ),
  ).toBe(true);

  const song =
    await page.evaluate(
      () =>
        (window as any)
          .__B4_STATE__
          .songs
          .find(
            (item) =>
              item.id ===
              'song-1',
          ),
    );

  expect(
    song.pdf_path,
  ).toMatch(
    /^songs\/song-1\/.+\.pdf$/,
  );

  expect(
    song.pdf_path,
  ).not.toBe(
    'songs/song-1/oud.pdf',
  );
});


test('contentmanager kan gekoppeld PDF-liedblad verwijderen', async ({ page }) => {
  await openManager(
    page,
    {
      songs: [
        {
          id: 'song-1',
          title:
            'Aan de Amsterdamse grachten',
          category: 'current',
          description:
            'Een ode aan onze stad.',
          lyrics: 'Tekst 1',
          pdf_path:
            'songs/song-1/liedblad.pdf',
          is_visible: true,
          sort_order: 1,
        },
      ],
      links: [],
    },
  );

  await page
    .locator(
      '.portal-beheer-song-card',
    )
    .first()
    .getByRole(
      'button',
      { name: 'Bewerken' },
    )
    .click();

  page.once(
    'dialog',
    (dialog) =>
      dialog.accept(),
  );

  await page
    .getByRole(
      'button',
      { name: 'PDF verwijderen' },
    )
    .click();

  const calls =
    await page.evaluate(
      () =>
        (window as any)
          .__B4_STATE__
          .calls,
    );

  expect(
    calls.some(
      (call) =>
        call.kind === 'update' &&
        call.table ===
          'member_songs' &&
        call.value
          ?.pdf_path === null,
    ),
  ).toBe(true);

  expect(
    calls.some(
      (call) =>
        call.kind === 'remove' &&
        call.bucket ===
          'member-song-sheets' &&
        call.paths.includes(
          'songs/song-1/liedblad.pdf',
        ),
    ),
  ).toBe(true);
});


test('mislukte PDF-metadata-update ruimt nieuw Storage-bestand op', async ({ page }) => {
  await openManager(
    page,
    {
      failSongPdfUpdate:
        true,
    },
  );

  await page
    .locator(
      '.portal-beheer-song-card',
    )
    .first()
    .getByRole(
      'button',
      { name: 'Bewerken' },
    )
    .click();

  const originalSong =
    await page.evaluate(
      () => {
        const song =
          (window as any)
            .__B4_STATE__
            .songs
            .find(
              (item) =>
                item.id ===
                'song-1',
            );

        return {
          pdf_path:
            song?.pdf_path ??
            null,
        };
      },
    );

  expect(
    originalSong.pdf_path,
  ).toBeNull();

  await page
    .locator(
      '#song-pdf-file',
    )
    .setInputFiles({
      name:
        'rollback.pdf',
      mimeType:
        'application/pdf',
      buffer:
        Buffer.from(
          '%PDF-1.4 rollback',
        ),
    });

  await page
    .getByRole(
      'button',
      {
        name:
          'PDF uploaden',
      },
    )
    .click();

  await expect(
    page.locator(
      '#portal-beheer-toast',
    ),
  ).toContainText(
    'Geforceerde PDF-metadatafout',
  );

  const result =
    await page.evaluate(
      () => {
        const state =
          (window as any)
            .__B4_STATE__;

        const song =
          state.songs.find(
            (item) =>
              item.id ===
              'song-1',
          );

        return {
          calls:
            state.calls,
          pdf_path:
            song?.pdf_path ??
            null,
        };
      },
    );

  const uploadCall =
    result.calls.find(
      (call) =>
        call.kind ===
          'upload' &&
        call.bucket ===
          'member-song-sheets',
    );

  expect(
    uploadCall,
  ).toBeTruthy();

  expect(
    uploadCall.path,
  ).toMatch(
    /^songs\/song-1\/.+\.pdf$/,
  );

  expect(
    result.calls.some(
      (call) =>
        call.kind ===
          'update' &&
        call.table ===
          'member_songs' &&
        call.value
          ?.pdf_path ===
          uploadCall.path,
    ),
  ).toBe(true);

  expect(
    result.calls.some(
      (call) =>
        call.kind ===
          'remove' &&
        call.bucket ===
          'member-song-sheets' &&
        call.paths.length ===
          1 &&
        call.paths[0] ===
          uploadCall.path,
    ),
  ).toBe(true);

  expect(
    result.pdf_path,
  ).toBeNull();
});

test('Storage-uploadfout koppelt geen PDF-metadata', async ({ page }) => {
  await openManager(
    page,
    {
      storageUploadError:
        true,
    },
  );

  await page
    .locator(
      '.portal-beheer-song-card',
    )
    .first()
    .getByRole(
      'button',
      { name: 'Bewerken' },
    )
    .click();

  const before =
    await page.evaluate(
      () =>
        (window as any)
          .__B4_STATE__
          .calls.length,
    );

  await page
    .locator('#song-pdf-file')
    .setInputFiles({
      name: 'fout.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(
        '%PDF-1.4 fout',
      ),
    });

  await page
    .getByRole(
      'button',
      { name: 'PDF uploaden' },
    )
    .click();

  await expect(
    page.locator(
      '#portal-beheer-toast',
    ),
  ).toContainText(
    'Uploadfout',
  );

  const after =
    await page.evaluate(
      (start) =>
        (window as any)
          .__B4_STATE__
          .calls
          .slice(start),
      before,
    );

  expect(
    after.some(
      (call) =>
        call.kind === 'upload' &&
        call.bucket ===
          'member-song-sheets',
    ),
  ).toBe(true);

  expect(
    after.some(
      (call) =>
        call.kind === 'update' &&
        call.table ===
          'member_songs' &&
        'pdf_path' in
          (call.value || {}),
    ),
  ).toBe(false);
});

test('smoelenboekbeheer toont alleen actieve leden en kan memo opslaan', async ({ page }) => {
  await openManager(page);
  await page.getByRole('button', { name: /Smoelenboek/ }).click();
  await expect(page.locator('.portal-beheer-member-card')).toHaveCount(3);
  await expect(page.locator('.portal-beheer-member-card', { hasText: 'Inactief Lid' })).toHaveCount(0);

  const jan = page.locator('.portal-beheer-member-card', { hasText: 'Jan de Vries' });
  await jan.locator('summary').click();
  await jan.locator('textarea').fill('Nieuwe memo voor Jan.');
  await jan.getByRole('button', { name: 'Memo opslaan' }).click();

  const directory = await page.evaluate(() => (window as any).__B4_STATE__.directory);
  expect(directory.find((item) => item.profile_id === 'member-1').memo).toBe('Nieuwe memo voor Jan.');
});

test('foto-upload valideert type en voert private upload plus metadata-update uit', async ({ page }) => {
  await openManager(page);
  await page.getByRole('button', { name: /Smoelenboek/ }).click();
  const bert = page.locator('.portal-beheer-member-card', { hasText: 'Bert Jansen' });
  await bert.locator('summary').click();

  await bert.locator('input[type="file"]').setInputFiles({
    name: 'bert.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from('RIFFfakeWEBP'),
  });
  await bert.getByRole('button', { name: 'Foto uploaden' }).click();

  const calls = await page.evaluate(() => (window as any).__B4_STATE__.calls);
  expect(calls.some((call) => call.kind === 'upload' && call.bucket === 'member-photos' && call.type === 'image/webp')).toBe(true);
  expect(calls.some((call) => call.kind === 'upsert' && call.table === 'member_directory' && call.value.profile_id === 'member-2' && call.value.photo_path)).toBe(true);
});

test('ongeldig fototype wordt geweigerd voordat Storage wordt aangeroepen', async ({ page }) => {
  await openManager(page);
  await page.getByRole('button', { name: /Smoelenboek/ }).click();
  const bert = page.locator('.portal-beheer-member-card', { hasText: 'Bert Jansen' });
  await bert.locator('summary').click();
  await bert.locator('input[type="file"]').setInputFiles({ name: 'bert.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await bert.getByRole('button', { name: 'Foto uploaden' }).click();
  await expect(page.locator('#portal-beheer-toast')).toContainText('JPEG, PNG of WebP');
  const calls = await page.evaluate(() => (window as any).__B4_STATE__.calls);
  expect(calls.some((call) => call.kind === 'upload')).toBe(false);
});

test('fotoverwijdering schrijft metadata naar null en verwijdert private object', async ({ page }) => {
  await openManager(page);
  await page.getByRole('button', { name: /Smoelenboek/ }).click();
  const jan = page.locator('.portal-beheer-member-card', { hasText: 'Jan de Vries' });
  await jan.locator('summary').click();
  page.once('dialog', (dialog) => dialog.accept());
  await jan.getByRole('button', { name: 'Foto verwijderen' }).click();

  const calls = await page.evaluate(() => (window as any).__B4_STATE__.calls);
  expect(calls.some((call) => call.kind === 'upsert' && call.table === 'member_directory' && call.value.photo_path === null)).toBe(true);
  expect(calls.some((call) => call.kind === 'remove' && call.bucket === 'member-photos' && call.paths.includes('member-1/jan.webp'))).toBe(true);
});

test('beheerstructuur volgt de muziek- en smoelenboekwireframes met beheer als tweede laag', async ({ page }) => {
  await openManager(page);

  await expect(page.locator('.portal-beheer-category-tabs [data-song-category]')).toHaveCount(3);
  await expect(page.locator('.portal-beheer-music-layout')).toBeVisible();
  await expect(page.locator('.portal-beheer-info-card')).toBeVisible();
  await expect(page.locator('.portal-beheer-song-card__resources').first()).toContainText('Tekst');
  await expect(page.locator('.portal-beheer-song-card__resources').first()).toContainText('Audio');

  await page.getByRole('button', { name: /Smoelenboek/ }).click();

  const jan = page.locator('.portal-beheer-member-card', { hasText: 'Jan de Vries' });
  await expect(jan.locator('.portal-beheer-member-card__memo-preview')).toContainText('Altijd in voor een grap.');
  await expect(jan.locator('.portal-beheer-member-card__manage')).not.toHaveAttribute('open', '');
  await expect(jan.locator('summary')).toHaveText('Memo en foto beheren');
});

test('backendfout wordt veilig als beheerfout getoond', async ({ page }) => {
  await stubSupabase(page, { failTable: 'member_songs' });
  await page.goto('/admin/ledenportaal.html');
  await expect(page.locator('#portal-beheer-toast')).toContainText('kon niet worden geladen');
});

test('wireframe-huisstijl, Axe en mobiele overflow blijven correct', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openManager(page);

  const hero = page.locator('.portal-beheer-hero');
  await expect(hero).toBeVisible();
  const background = await hero.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(background).toContain('over-hero-mannenkoor.jpg');

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
});

test(
  'B4.1d beheer markeert Ledenportaal actief en toont footer-wave',
  async ({ page }) => {
    await openManager(page);

    await page
      .locator('#nav-placeholder .main-nav')
      .waitFor();

    await page
      .locator('#footer-placeholder .site-footer')
      .waitFor();

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
  },
);

// B4.1d APPROVED WIREFRAME NAV + FOOTER

test('keyboard: beheer opent het liedformulier en verplaatst focus correct', async ({ page }) => {
  await openManager(page);

  const newSong =
    page.getByRole(
      'button',
      { name: 'Nieuw lied' },
    );

  await newSong.focus();

  await expect(
    newSong,
  ).toBeFocused();

  await page.keyboard.press(
    'Enter',
  );

  await expect(
    page.locator(
      '#song-modal',
    ),
  ).toHaveAttribute(
    'aria-hidden',
    'false',
  );

  await expect(
    page.locator(
      '#song-title',
    ),
  ).toBeFocused();

  await page.keyboard.type(
    'Keyboard testlied',
  );

  await expect(
    page.locator(
      '#song-title',
    ),
  ).toHaveValue(
    'Keyboard testlied',
  );

  const cancel =
    page.getByRole(
      'button',
      { name: 'Annuleren' },
    );

  await cancel.focus();

  await expect(
    cancel,
  ).toBeFocused();

  await page.keyboard.press(
    'Space',
  );

  await expect(
    page.locator(
      '#song-modal',
    ),
  ).toHaveAttribute(
    'aria-hidden',
    'true',
  );

  const directoryTab =
    page.getByRole(
      'button',
      { name: /Smoelenboek/ },
    );

  await directoryTab.focus();

  await expect(
    directoryTab,
  ).toBeFocused();

  await page.keyboard.press(
    'Enter',
  );

  const directorySearch =
    page.locator(
      '#directory-admin-search',
    );

  await directorySearch.focus();

  await expect(
    directorySearch,
  ).toBeFocused();

  await page.keyboard.type(
    'Jan de Vries',
  );

  await expect(
    page.locator(
      '.portal-beheer-member-card',
    ),
  ).toHaveCount(1);

  const manageSummary =
    page.locator(
      '.portal-beheer-member-card summary',
    ).first();

  await manageSummary.focus();

  await expect(
    manageSummary,
  ).toBeFocused();

  await page.keyboard.press(
    'Enter',
  );

  await expect(
    page.locator(
      '.portal-beheer-member-card__manage',
    ).first(),
  ).toHaveAttribute(
    'open',
    '',
  );
});
