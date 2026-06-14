import { test, expect } from '@playwright/test';

const VALID_EMAIL = process.env.TEST_ADMIN_EMAIL;
const VALID_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const ADMIN_DISPLAY_NAME = process.env.TEST_ADMIN_DISPLAY_NAME;
const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL;
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD;
const MEMBER_DISPLAY_NAME = process.env.TEST_MEMBER_DISPLAY_NAME;
const INACTIVE_MEMBER_EMAIL = process.env.TEST_MEMBER_INACTIVE_EMAIL;
const INACTIVE_MEMBER_PASSWORD = process.env.TEST_MEMBER_INACTIVE_PASSWORD;
const STATUS_MEMBER_EMAIL = process.env.TEST_STATUS_MEMBER_EMAIL;
const STATUS_MEMBER_PASSWORD = process.env.TEST_STATUS_MEMBER_PASSWORD;
const STATUS_MEMBER_DISPLAY_NAME = process.env.TEST_STATUS_MEMBER_DISPLAY_NAME;

if (!VALID_EMAIL || !VALID_PASSWORD) {
  throw new Error(
    'Missing required environment variables: TEST_ADMIN_EMAIL and/or TEST_ADMIN_PASSWORD'
  );
}

if (!ADMIN_DISPLAY_NAME) {
  throw new Error('Missing required environment variable: TEST_ADMIN_DISPLAY_NAME');
}

if (!MEMBER_EMAIL || !MEMBER_PASSWORD) {
  throw new Error(
    'Missing required environment variables: TEST_MEMBER_EMAIL and/or TEST_MEMBER_PASSWORD'
  );
}

if (!MEMBER_DISPLAY_NAME) {
  throw new Error('Missing required environment variable: TEST_MEMBER_DISPLAY_NAME');
}

const MEMBER_SEARCH_TERM = MEMBER_DISPLAY_NAME.trim().split(/\s+/)[0]!.toLowerCase();

async function loginAsAdmin(page) {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', VALID_EMAIL!);
  await page.fill('#password', VALID_PASSWORD!);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/dashboard\.html/);
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');
}

async function loginAsMember(page) {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', MEMBER_EMAIL!);
  await page.fill('#password', MEMBER_PASSWORD!);
  await page.click('button[type="submit"]');

  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');
}

async function waitForLedenlijstReady(page) {
  await expect(page.locator('#ledenbeheer-toast')).toContainText('Ledenbeheer is geladen.', {
    timeout: 15000,
  });

  await expect(page.locator('#ledenbeheer-lijst-body')).toBeVisible();

  await expect(
    page.locator('#ledenbeheer-lijst-body tr:not(.ledenbeheer-empty-row)').first()
  ).toBeVisible({ timeout: 15000 });

  await expect(page.locator('#ledenbeheer-result-count')).not.toContainText('Nog geen leden geladen.');
}

async function openAdminAndWaitUntilReady(page) {
  await page.goto('http://localhost:5500/admin/index.html');

  await expect(page).toHaveURL(/admin\/index\.html/);
  await expect(page.locator('main')).toContainText('Welkom (Admin)');
  await expect(page.locator('#ledenbeheer')).toBeVisible();
  await expect(page.locator('#nieuw-lid-form')).toBeVisible();

  await page.waitForFunction(async () => {
    if (!window.authHelpers || typeof window.authHelpers.getCurrentSession !== 'function') {
      return false;
    }

    try {
      const session = await window.authHelpers.getCurrentSession();
      return Boolean(session?.access_token);
    } catch {
      return false;
    }
  });

  await expect(page.locator('#ledenbeheer-toast')).toBeVisible();
  await expect(page.locator('#ledenbeheer-lijst-body')).toBeVisible();
  await expect(page.locator('#ledenbeheer-result-count')).toBeVisible();

  await waitForLedenlijstReady(page);
}

async function openMemberActionMenu(page) {
  const memberRow = page.locator('#ledenbeheer-lijst-body tr').filter({ hasText: MEMBER_DISPLAY_NAME });

  await expect(memberRow.locator('.ledenbeheer-action-trigger')).toBeVisible();
  await memberRow.locator('.ledenbeheer-action-trigger').click();

  await expect(memberRow.locator('.ledenbeheer-action-menu')).toHaveClass(/open/);

  return memberRow;
}

async function expectVisibleRowsSortedByColumn(page, columnIndex: number) {
  const values = await page
    .locator('#ledenbeheer-lijst-body tr:not(.ledenbeheer-empty-row)')
    .evaluateAll((rows, index) => {
      return rows
        .map((row) => row.children[index as number]?.textContent?.trim().toLowerCase() || '')
        .filter(Boolean);
    }, columnIndex);

  expect(values.length).toBeGreaterThan(0);

  const sortedValues = [...values].sort((a, b) =>
    a.localeCompare(b, 'nl', { sensitivity: 'base' })
  );

  expect(values).toEqual(sortedValues);
}

async function expectVisibleRowCountAtMost(page, maximum: number) {
  const visibleRows = page.locator('#ledenbeheer-lijst-body tr:not(.ledenbeheer-empty-row)');

  await expect(visibleRows.first()).toBeVisible({ timeout: 15000 });

  const visibleRowCount = await visibleRows.count();

  expect(visibleRowCount).toBeGreaterThan(0);
  expect(visibleRowCount).toBeLessThanOrEqual(maximum);
}

test('Geldig account kan inloggen en dashboard openen', async ({ page }) => {
  await loginAsAdmin(page);
});

test('Login met fout wachtwoord toont foutmelding', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', VALID_EMAIL!);
  await page.fill('#password', 'FOUT_WACHTWOORD');
  await page.click('button[type="submit"]');

  await expect(page.locator('#error')).toBeVisible();
});

test('Dashboard zonder login redirect naar login', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/dashboard.html');

  await expect(page).toHaveURL(/login\.html/);
});

test('Ingelogde admin kan adminpagina openen', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);
});

test('Ingelogde member kan adminpagina niet openen', async ({ page }) => {
  await loginAsMember(page);

  await page.goto('http://localhost:5500/admin/index.html');

  await expect(page).toHaveURL(/login\.html/);
});

test('Ingelogde admin ziet navigatie naar adminomgeving op dashboard', async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.locator('#admin-link')).toBeVisible();
  await expect(page.locator('#admin-link')).toContainText('Naar adminomgeving');

  await page.click('#admin-link');

  await expect(page).toHaveURL(/admin\/index\.html/);
  await expect(page.locator('#ledenbeheer')).toBeVisible();
});

test('Ingelogde member ziet geen navigatie naar adminomgeving op dashboard', async ({ page }) => {
  await loginAsMember(page);

  await expect(page.locator('#admin-link')).toBeHidden();
});

test('Ingelogde admin ziet navigatie naar ledenomgeving op adminpagina', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('#ledenomgeving-link')).toBeVisible();
  await expect(page.locator('#ledenomgeving-link')).toContainText('Naar ledenomgeving');

  await page.click('#ledenomgeving-link');

  await expect(page).toHaveURL(/leden\/dashboard\.html/);
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');
});

test('Ingelogde admin ziet ledenbeheerformulier op adminpagina', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('#nieuw-lid-submit')).toBeVisible();
  await expect(page.locator('#ledenbeheer-formulier')).toContainText('Nieuw lid toevoegen');
});

test('Ingelogde admin ziet schaalbare ledenlijstfuncties', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('#ledenbeheer-zoek')).toBeVisible();
  await expect(page.locator('#ledenbeheer-status-filter')).toBeVisible();
  await expect(page.locator('#ledenbeheer-role-filter')).toBeVisible();
  await expect(page.locator('#ledenbeheer-sortering')).toBeVisible();
  await expect(page.locator('#ledenbeheer-page-size')).toBeVisible();
  await expect(page.locator('#ledenbeheer-result-count')).toBeVisible();
  await expect(page.locator('#ledenbeheer-prev-page')).toBeVisible();
  await expect(page.locator('#ledenbeheer-next-page')).toBeVisible();
});

test('Ingelogde admin ziet beheeracties in ledenlijst', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('th')).toContainText(['Naam', 'E-mailadres', 'Role', 'Status', 'Acties']);

  const adminRow = page.locator('#ledenbeheer-lijst-body tr').filter({ hasText: ADMIN_DISPLAY_NAME });
  await expect(adminRow).toContainText('Eigen account');

  const memberRow = await openMemberActionMenu(page);

  await expect(memberRow.locator('.ledenbeheer-menu-action.edit')).toBeVisible();
  await expect(memberRow.locator('.ledenbeheer-menu-action.edit')).toContainText('Bewerken');
  await expect(memberRow.locator('.ledenbeheer-menu-action.deactivate')).toBeVisible();
  await expect(memberRow.locator('.ledenbeheer-menu-action.deactivate')).toContainText('Deactiveren');
});

// Test statusmutatie: active → inactive → active met exacte assertions
test('Ingelogde admin kan lid deactiveren en heractiveren', async ({ page, browserName }) => {
  // Deze test wijzigt Supabase-testdata en mag niet parallel draaien in meerdere browsers.
  test.skip(
    browserName !== 'chromium',
    'Statusmutatie gebruikt gedeelde Supabase-testdata en draait daarom alleen in Chromium.'
  );

  // Skip als TEST_STATUS_MEMBER_DISPLAY_NAME ontbreekt
  if (!STATUS_MEMBER_DISPLAY_NAME) {
    test.skip(true, 'TEST_STATUS_MEMBER_DISPLAY_NAME ontbreekt; statusmutatie-test wordt overgeslagen.');
    return;
  }

  // 1. Admin inloggen en admin pagina openen
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  // 2. Helper-functie om member row te vinden (opnieuw bepalen na refresh)
  const getMemberRow = () =>
    page.locator('#ledenbeheer-lijst-body tr').filter({ hasText: STATUS_MEMBER_DISPLAY_NAME });

  // 3. Helper-functie om status badge te vinden
  const getStatusBadge = (memberRow: ReturnType<typeof getMemberRow>) =>
    memberRow.locator('.status-badge');

  // 4. Vind het member row en controleer zichtbaarheid
  let memberRow = getMemberRow();
  await expect(memberRow).toBeVisible();

  // 5. Lees de actuele status van het testlid
  let statusBadge = getStatusBadge(memberRow);
  const currentStatus = (await statusBadge.textContent())?.trim().toLowerCase();

  // 6. Indien het lid al inactive is, eerst heractiveren naar active
  if (currentStatus === 'inactive') {
    await memberRow.locator('.ledenbeheer-action-trigger').click();
    await expect(memberRow.locator('.ledenbeheer-action-menu')).toHaveClass(/open/);

    await memberRow.locator('.ledenbeheer-menu-action.activate').click();

    await expect(page.locator('#ledenbeheer-toast')).toContainText('Lid is geheractiveerd.');

    // Herhaal memberRow en statusBadge na refresh
    memberRow = getMemberRow();
    statusBadge = getStatusBadge(memberRow);

    // Controleer dat status nu active is (exacte matching)
    await expect(statusBadge).toHaveText(/^active$/i);
  }

  // 7. Nu is het lid gegarandeerd active - start de eigenlijke test
  // Controleer eerst dat status active is (exacte matching)
  await expect(statusBadge).toHaveText(/^active$/i);

  // 8. Open action menu en deactiveer
  await memberRow.locator('.ledenbeheer-action-trigger').click();
  await expect(memberRow.locator('.ledenbeheer-action-menu')).toHaveClass(/open/);

  await memberRow.locator('.ledenbeheer-menu-action.deactivate').click();

  // 9. Wacht op successmelding en controleer statuswijziging naar inactive
  await expect(page.locator('#ledenbeheer-toast')).toContainText('Lid is gedeactiveerd.');

  // Herhaal memberRow en statusBadge na refresh
  memberRow = getMemberRow();
  statusBadge = getStatusBadge(memberRow);

  // VEILIGE ASSERTION: exacte tekst matching (geen toContainText('active')!)
  await expect(statusBadge).toHaveText(/^inactive$/i);

  // 10. Open opnieuw action menu en heractiveer
  await memberRow.locator('.ledenbeheer-action-trigger').click();
  await expect(memberRow.locator('.ledenbeheer-action-menu')).toHaveClass(/open/);

  await memberRow.locator('.ledenbeheer-menu-action.activate').click();

  // 11. Wacht op successmelding en controleer statuswijziging naar active
  await expect(page.locator('#ledenbeheer-toast')).toContainText('Lid is geheractiveerd.');

  // Herhaal memberRow en statusBadge na refresh
  memberRow = getMemberRow();
  statusBadge = getStatusBadge(memberRow);

  // VEILIGE ASSERTION: exacte tekst matching
  await expect(statusBadge).toHaveText(/^active$/i);
});

test('Ingelogde admin kan bewerkmodal voor lid openen en sluiten', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  const memberRow = await openMemberActionMenu(page);

  await memberRow.locator('.ledenbeheer-menu-action.edit').click();

  await expect(page.locator('#ledenbeheer-edit-modal')).toHaveClass(/open/);
  await expect(page.locator('#ledenbeheer-edit-title')).toContainText('Lidgegevens bewerken');
  await expect(page.locator('#edit_full_name')).toBeVisible();
  await expect(page.locator('#edit_email')).toBeVisible();
  await expect(page.locator('#edit_role')).toBeVisible();
  await expect(page.locator('#edit_status')).toBeVisible();
  await expect(page.locator('#edit_email')).toHaveAttribute('readonly', '');
  await expect(page.locator('#edit_role')).toHaveAttribute('readonly', '');
  await expect(page.locator('#edit_status')).toHaveAttribute('readonly', '');
  await expect(page.locator('#ledenbeheer-edit-save')).toBeVisible();
  await expect(page.locator('#ledenbeheer-edit-cancel')).toBeVisible();

  await page.click('#ledenbeheer-edit-cancel');

  await expect(page.locator('#ledenbeheer-edit-modal')).not.toHaveClass(/open/);
});

// Controleert client-side validatie zonder echte lidgegevensmutatie.
test('Ingelogde admin ziet veldvalidatie in bewerkmodal', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  const memberRow = await openMemberActionMenu(page);

  await memberRow.locator('.ledenbeheer-menu-action.edit').click();

  await expect(page.locator('#ledenbeheer-edit-modal')).toHaveClass(/open/);

  await page.fill('#edit_house_number', 'testhuisnummer');
  await page.click('#ledenbeheer-edit-save');

  await expect(page.locator('#edit_house_number_error')).toBeVisible();
  await expect(page.locator('#edit_house_number_error')).toContainText('Huisnummer moet met een cijfer beginnen');

  await page.fill('#edit_house_number', '10A');
  await page.fill('#edit_phone', '0613694301B');
  await page.click('#ledenbeheer-edit-save');

  await expect(page.locator('#edit_phone_error')).toBeVisible();
  await expect(page.locator('#edit_phone_error')).toContainText('Telefoonnummer mag alleen cijfers');

  await page.click('#ledenbeheer-edit-cancel');

  await expect(page.locator('#ledenbeheer-edit-modal')).not.toHaveClass(/open/);
});

test('Ingelogde admin kan ledenlijst zoeken en filteren', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText(ADMIN_DISPLAY_NAME);
  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText(MEMBER_DISPLAY_NAME);

  await page.fill('#ledenbeheer-zoek', MEMBER_SEARCH_TERM);

  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText(MEMBER_DISPLAY_NAME);
  await expect(page.locator('#ledenbeheer-lijst-body')).not.toContainText(ADMIN_DISPLAY_NAME);

  await page.fill('#ledenbeheer-zoek', '');
  await page.selectOption('#ledenbeheer-role-filter', 'member');

  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText('member');
  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText(MEMBER_DISPLAY_NAME);

  await page.selectOption('#ledenbeheer-status-filter', 'active');

  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText('active');

  await page.selectOption('#ledenbeheer-sortering', 'email');
  await page.selectOption('#ledenbeheer-page-size', '25');

  await expect(page.locator('#ledenbeheer-result-count')).toBeVisible();
  await expect(page.locator('#ledenbeheer-page-status')).toContainText(/Pagina \d+ van \d+/);
});

test('Ingelogde admin ziet inhoudelijke sortering in ledenlijst', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await page.selectOption('#ledenbeheer-role-filter', 'all');
  await page.selectOption('#ledenbeheer-status-filter', 'all');
  await page.fill('#ledenbeheer-zoek', '');
  await page.selectOption('#ledenbeheer-page-size', '25');

  await page.selectOption('#ledenbeheer-sortering', 'full_name');
  await expectVisibleRowsSortedByColumn(page, 0);

  await page.selectOption('#ledenbeheer-sortering', 'email');
  await expectVisibleRowsSortedByColumn(page, 1);

  await page.selectOption('#ledenbeheer-sortering', 'role');
  await expectVisibleRowsSortedByColumn(page, 2);

  await page.selectOption('#ledenbeheer-sortering', 'status');
  await expectVisibleRowsSortedByColumn(page, 3);
});

test('Ingelogde admin ziet consistente paginering en page-size in ledenlijst', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await page.selectOption('#ledenbeheer-role-filter', 'all');
  await page.selectOption('#ledenbeheer-status-filter', 'all');
  await page.fill('#ledenbeheer-zoek', '');

  await page.selectOption('#ledenbeheer-page-size', '10');
  await expectVisibleRowCountAtMost(page, 10);
  await expect(page.locator('#ledenbeheer-page-status')).toContainText(/Pagina \d+ van \d+/);

  await page.selectOption('#ledenbeheer-page-size', '25');
  await expectVisibleRowCountAtMost(page, 25);
  await expect(page.locator('#ledenbeheer-page-status')).toContainText(/Pagina \d+ van \d+/);

  await page.selectOption('#ledenbeheer-page-size', '50');
  await expectVisibleRowCountAtMost(page, 50);
  await expect(page.locator('#ledenbeheer-page-status')).toContainText(/Pagina \d+ van \d+/);
});

test('Ingelogde admin ziet toastmelding bij client-side validatiefout nieuw lid', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await page.click('#nieuw-lid-submit');

  await expect(page.locator('#full_name_error')).toBeVisible();
  await expect(page.locator('#full_name_error')).toContainText('Volledige naam is verplicht.');

  await expect(page.locator('#ledenbeheer-toast')).toBeVisible();
  await expect(page.locator('#ledenbeheer-toast')).toContainText('Volledige naam is verplicht.');
  await expect(page.locator('#ledenbeheer-toast')).toHaveCSS('position', 'fixed');
});

test('Ingelogde admin krijgt backend-foutmelding bij bestaand e-mailadres', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await page.fill('#full_name', 'Bestaand Test Lid');
  await page.fill('#street', 'Dorpsstraat');
  await page.fill('#house_number', '10');
  await page.fill('#postal_code', '1234 AB');
  await page.fill('#city', 'Angerlo');
  await page.fill('#email', VALID_EMAIL!);
  await page.fill('#email_confirm', VALID_EMAIL!);
  await page.fill('#phone', '0612345678');

  await page.click('#nieuw-lid-submit');

  await expect(page.locator('#ledenbeheer-toast')).toBeVisible();
  await expect(page.locator('#ledenbeheer-toast')).toContainText(
    'Er bestaat al een lid met dit e-mailadres.'
  );
});

test('Ingelogde gebruiker kan uitloggen vanaf dashboard', async ({ page }) => {
  await loginAsAdmin(page);

  await page.click('#logout');

  await expect(page).toHaveURL(/login\.html/);
});

// Test dat inactive accounts geen toegang krijgen tot dashboard
test('Inactief lid krijgt geen toegang tot dashboard', async ({ page }) => {
  // Skip als TEST_MEMBER_INACTIVE_* variabelen ontbreken
  if (!INACTIVE_MEMBER_EMAIL || !INACTIVE_MEMBER_PASSWORD) {
    test.skip(true, 'TEST_MEMBER_INACTIVE_EMAIL/PASSWORD ontbreekt; inactive test wordt overgeslagen.');
    return;
  }

  // Login als inactive member
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', INACTIVE_MEMBER_EMAIL);
  await page.fill('#password', INACTIVE_MEMBER_PASSWORD);
  await page.click('button[type="submit"]');

  // Wacht tot dashboard.html bereikt is (ook al wordt het direct weer verlaten)
  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });

  // Controleer dat #status zichtbar is
  const statusEl = page.locator('#status');
  await expect(statusEl).toBeVisible();

  // Controleer dat status een duidelijke inactive-melding bevat
  await expect(statusEl).toContainText('niet actief');

  // Controleer dat gebruiker teruggaat naar login.html
  await page.waitForURL(/login\.html/, { timeout: 3000 });
});
