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

test('Geldig account kan inloggen en dashboard openen', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', VALID_EMAIL);
  await page.fill('#password', VALID_PASSWORD);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/dashboard\.html/);
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');
});

test('Login met fout wachtwoord toont foutmelding', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', VALID_EMAIL);
  await page.fill('#password', 'FOUT_WACHTWOORD');
  await page.click('button[type="submit"]');

  await expect(page.locator('#error')).toBeVisible();
});

test('Dashboard zonder login redirect naar login', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/dashboard.html');

  await expect(page).toHaveURL(/login\.html/);
});

test('Ingelogde admin kan adminpagina openen', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', VALID_EMAIL);
  await page.fill('#password', VALID_PASSWORD);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/dashboard\.html/);
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');

  await page.goto('http://localhost:5500/admin/index.html');

  await expect(page).toHaveURL(/admin\/index\.html/);
  await expect(page.locator('main')).toContainText('Welkom (Admin)');
});

test('Ingelogde member kan adminpagina niet openen', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', MEMBER_EMAIL);
  await page.fill('#password', MEMBER_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');

  await page.goto('http://localhost:5500/admin/index.html');

  await expect(page).toHaveURL(/login\.html/);
});

test('Ingelogde gebruiker kan uitloggen vanaf dashboard', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', VALID_EMAIL);
  await page.fill('#password', VALID_PASSWORD);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/dashboard\.html/);
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');

  await page.click('#logout');

  await expect(page).toHaveURL(/login\.html/);
});