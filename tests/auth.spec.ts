import { test, expect } from '@playwright/test';

const VALID_EMAIL = process.env.TEST_ADMIN_EMAIL;
const VALID_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL;
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD;

if (!VALID_EMAIL || !VALID_PASSWORD) {
  throw new Error(
    'Missing required environment variables: TEST_ADMIN_EMAIL and/or TEST_ADMIN_PASSWORD'
  );
}

if (!MEMBER_EMAIL || !MEMBER_PASSWORD) {
  throw new Error(
    'Missing required environment variables: TEST_MEMBER_EMAIL and/or TEST_MEMBER_PASSWORD'
  );
}

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

test('Ingelogde admin kan ledenlijst zoeken en filteren', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText('Jim Groen');
  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText('Tester Spontaan');

  await page.fill('#ledenbeheer-zoek', 'tester');

  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText('Tester Spontaan');
  await expect(page.locator('#ledenbeheer-lijst-body')).not.toContainText('Jim Groen');

  await page.fill('#ledenbeheer-zoek', '');
  await page.selectOption('#ledenbeheer-role-filter', 'member');

  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText('member');
  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText('Tester Spontaan');

  await page.selectOption('#ledenbeheer-status-filter', 'active');

  await expect(page.locator('#ledenbeheer-lijst-body')).toContainText('active');

  await page.selectOption('#ledenbeheer-sortering', 'email');
  await page.selectOption('#ledenbeheer-page-size', '25');

  await expect(page.locator('#ledenbeheer-result-count')).toBeVisible();
  await expect(page.locator('#ledenbeheer-page-status')).toContainText(/Pagina \d+ van \d+/);
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