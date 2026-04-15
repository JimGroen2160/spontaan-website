import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error(
    'Missing required environment variables: TEST_USER_EMAIL and/or TEST_USER_PASSWORD'
  );
}

// ✅ 1. HAPPY FLOW
test('Login → Dashboard → Logout flow (robuust)', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);

  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);

  const errorVisible = await page.locator('#error').isVisible().catch(() => false);

  if (errorVisible) {
    const errorText = await page.locator('#error').innerText();
    throw new Error('Login mislukt: ' + errorText);
  }

  await expect(page.locator('#status')).toHaveText('Je bent succesvol ingelogd.');

  await page.click('#logout');

  await expect(page).toHaveURL(/login\.html/);
});

// ❌ 2. FOUTE LOGIN
test('Login met fout wachtwoord → foutmelding zichtbaar', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', EMAIL);
  await page.fill('#password', 'FOUT_WACHTWOORD');

  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);

  await expect(page.locator('#error')).toBeVisible();
});

// 🔐 3. DIRECT DASHBOARD BLOKKEREN
test('Direct naar dashboard zonder login → redirect naar login', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/dashboard.html');

  await page.waitForTimeout(2000);

  await expect(page).toHaveURL(/login\.html/);
});