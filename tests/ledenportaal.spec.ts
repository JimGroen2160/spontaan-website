import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type AccessProfile = {
  full_name: string;
  role: 'member' | 'contentmanager' | 'admin';
  status: 'active' | 'pending' | 'inactive';
};

async function stubSupabase(page: Page, profile: AccessProfile | null, hasSession = true) {
  await page.addInitScript(
    ({ profileValue, sessionValue }) => {
      (window as any).__LEDENPORTAAL_TEST__ = {
        profile: profileValue,
        session: sessionValue
          ? { user: { id: '00000000-0000-4000-8000-000000000001' } }
          : null,
      };
    },
    { profileValue: profile, sessionValue: hasSession },
  );

  await page.route('https://cdn.jsdelivr.net/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `
        window.supabase = {
          createClient: function () {
            return {
              auth: {
                getSession: async function () {
                  return { data: { session: window.__LEDENPORTAAL_TEST__.session }, error: null };
                },
                signOut: async function () {
                  return { error: null };
                }
              },
              rpc: async function (name) {
                if (name === 'activate_current_user_profile') {
                  return {
                    data: window.__LEDENPORTAAL_TEST__.profile
                      ? { ...window.__LEDENPORTAAL_TEST__.profile, status: 'active' }
                      : null,
                    error: null
                  };
                }

                return { data: null, error: null };
              },
              from: function () {
                return {
                  select: function () {
                    return {
                      eq: function () {
                        return {
                          single: async function () {
                            return { data: window.__LEDENPORTAAL_TEST__.profile, error: null };
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      `,
    });
  });
}

async function waitForSharedLayout(page: Page) {
  await page.locator('#nav-placeholder .main-nav').waitFor({
    state: 'attached',
    timeout: 15_000,
  });

  await page.locator('#footer-placeholder .site-footer').waitFor({
    state: 'attached',
    timeout: 15_000,
  });
}

const activeMember: AccessProfile = {
  full_name: 'Testlid Ledenportaal',
  role: 'member',
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

for (const path of ['/leden/muziek.html', '/leden/smoelenboek.html']) {
  test(`niet-ingelogde bezoeker krijgt geen toegang tot ${path}`, async ({ page }) => {
    await stubSupabase(page, null, false);
    await page.goto(path);
    await expect(page).toHaveURL(/leden\/login\.html/);
  });
}

test('pending lid wordt vanuit een beveiligde ledenpagina naar het dashboard gestuurd', async ({ page }) => {
  await stubSupabase(page, pendingMember);
  await page.goto('/leden/muziek.html');
  await expect(page).toHaveURL(/leden\/dashboard\.html/);
});

test('inactief lid wordt uit de beveiligde ledenomgeving geweerd', async ({ page }) => {
  await stubSupabase(page, inactiveMember);
  await page.goto('/leden/smoelenboek.html');
  await expect(page).toHaveURL(/leden\/login\.html/);
});

test('actief lid ziet op het dashboard links naar Muziek en Smoelenboek', async ({ page }) => {
  await stubSupabase(page, activeMember);
  await page.goto('/leden/dashboard.html');

  const destinations = page.locator('#portal-destinations');
  await expect(destinations).toBeVisible();

  await expect(
    destinations.getByRole('link', { name: /Muziek/ }),
  ).toHaveAttribute('href', 'muziek.html');

  await expect(
    destinations.getByRole('link', { name: /Smoelenboek/ }),
  ).toHaveAttribute('href', 'smoelenboek.html');
});

test('actief lid ziet de muziek-demo en kan categorieën en zoeken gebruiken', async ({ page }) => {
  await stubSupabase(page, activeMember);
  await page.goto('/leden/muziek.html');

  await expect(page.getByRole('heading', { name: 'Muziek', level: 1 })).toBeVisible();
  await expect(page.locator('[data-demo-notice]')).toContainText('[DEMO]');
  await expect(page.locator('.song-card')).toHaveCount(3);

  await page.getByRole('button', { name: 'Concept' }).click();
  await expect(page.locator('.song-card')).toHaveCount(2);

  await page.getByRole('button', { name: 'Archief' }).click();
  await expect(page.locator('.song-card')).toHaveCount(1);

  await page.getByRole('button', { name: 'Huidig' }).click();
  await page.getByLabel('Zoek een lied').fill('nacht');
  await expect(page.locator('.song-card')).toHaveCount(1);
  await expect(page.locator('.song-card')).toContainText('[DEMO] Stemmen in de nacht');

  await expect(page.getByRole('button', { name: 'Download liedblad (PDF)' }).first()).toBeDisabled();
});

test('printactie bouwt een apart printbaar liedblad op en ruimt dit na afterprint op', async ({ page }) => {
  await stubSupabase(page, activeMember);
  await page.goto('/leden/muziek.html');

  await expect(page.locator('.song-card')).toHaveCount(3);

  await page.evaluate(() => {
    (window as any).__PRINT_CALLED__ = false;
    window.print = () => {
      (window as any).__PRINT_CALLED__ = true;
    };
  });

  await page.getByRole('button', { name: 'Print liedblad' }).first().click();

  const printSheet = page.locator('#song-print-sheet');

  await expect(page.locator('body')).toHaveClass(/is-printing-song/);
  await expect(printSheet).not.toHaveAttribute('hidden', '');
  await expect(printSheet).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#print-song-title')).toHaveText('Samen op weg');
  await expect(page.locator('#print-song-lyrics')).toContainText('Wij zingen samen');

  expect(
    await page.evaluate(() => (window as any).__PRINT_CALLED__),
  ).toBe(true);

  await page.emulateMedia({ media: 'print' });
  await expect(printSheet).toBeVisible();
  await page.emulateMedia({ media: 'screen' });

  await page.evaluate(() => {
    window.dispatchEvent(new Event('afterprint'));
  });

  await expect(page.locator('body')).not.toHaveClass(/is-printing-song/);
  await expect(printSheet).toBeHidden();
  await expect(printSheet).toHaveAttribute('aria-hidden', 'true');
});

test('actief lid ziet het smoelenboek en kan op naam zoeken', async ({ page }) => {
  await stubSupabase(page, activeMember);
  await page.goto('/leden/smoelenboek.html');

  await expect(page.getByRole('heading', { name: 'Smoelenboek', level: 1 })).toBeVisible();
  await expect(page.locator('[data-demo-notice]')).toContainText('[DEMO]');
  await expect(page.locator('.member-directory-card')).toHaveCount(8);

  await page.getByLabel('Zoek een lid').fill('Lid 04');
  await expect(page.locator('.member-directory-card')).toHaveCount(1);
  await expect(page.locator('.member-directory-card')).toContainText('[DEMO] Lid 04');
});

test('demo-bron bevat uitsluitend herkenbare fictieve ledenportaaldata', async ({ request }) => {
  const response = await request.get('/data/ledenportaal-demo.json');
  expect(response.ok()).toBe(true);

  const data = await response.json();

  expect(data.mode).toBe('demo');
  expect(data.notice).toContain('[DEMO]');
  expect(data.songs.length).toBeGreaterThan(0);
  expect(data.members.length).toBeGreaterThan(0);

  for (const song of data.songs) {
    expect(song.id).toMatch(/^demo-song-/);
    expect(song.title).toMatch(/^\[DEMO\]/);
    expect(['huidig', 'concept', 'archief']).toContain(song.category);
    expect(song.pdfAvailable).toBe(false);

    for (const link of song.links ?? []) {
      expect(new URL(link.url).hostname).toBe('example.com');
    }
  }

  for (const member of data.members) {
    expect(member.id).toMatch(/^demo-member-/);
    expect(member.fullName).toMatch(/^\[DEMO\]/);
    expect(member.photoUrl).toBe('');
  }
});

for (const target of [
  { name: 'Muziek', path: '/leden/muziek.html' },
  { name: 'Smoelenboek', path: '/leden/smoelenboek.html' },
]) {
  test(`${target.name} gebruikt de mannenkoor-hero en heeft geen Axe-overtredingen`, async ({ page }) => {
    test.setTimeout(45_000);

    await stubSupabase(page, activeMember);
    await page.goto(target.path);
    await waitForSharedLayout(page);
    await expect(page.locator('[data-demo-notice]')).toContainText('[DEMO]');

    const hero = page.locator('.member-hero');
    await expect(hero).toBeVisible();
    await expect(hero).toContainText('mannenkoor');

    const backgroundImage = await hero.evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    );

    expect(backgroundImage).toContain('over-hero-mannenkoor.jpg');

    const results = await new AxeBuilder({ page }).analyze();

    expect(
      results.violations,
      `Toegankelijkheidsproblemen op ${target.path}`,
    ).toEqual([]);
  });

  test(`${target.name} heeft op 390px geen horizontale pagina-overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubSupabase(page, activeMember);
    await page.goto(target.path);

    await expect(page.locator('[data-leden-protected]')).toBeVisible();

    if (target.name === 'Muziek') {
      await expect(page.locator('.song-card')).toHaveCount(3);
    } else {
      await expect(page.locator('.member-directory-card')).toHaveCount(8);
    }

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  });
}
