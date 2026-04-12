import { test, expect } from '@playwright/test';

test('Login → Dashboard → Logout flow (robuust)', async ({ page }) => {

  // 1. Ga naar login
  await page.goto('http://localhost:5500/leden/login.html');

  // 2. Vul juiste gegevens in
  await page.fill('#email', 'jim.groen14@gmail.com');
  await page.fill('#password', 'Spontaan2026');

  // 3. Klik login
  await page.click('button[type="submit"]');

  // 4. Wacht kort
  await page.waitForTimeout(2000);

  // 5. Check foutmelding
  const errorVisible = await page.locator('#error').isVisible().catch(() => false);

  if (errorVisible) {
    const errorText = await page.locator('#error').innerText();
    throw new Error('Login mislukt: ' + errorText);
  }

  // 6. Check dashboard
  const statusVisible = await page.locator('#status').isVisible().catch(() => false);

  if (!statusVisible) {
    throw new Error('Geen dashboard en geen foutmelding → onduidelijke status');
  }

  // 7. Controle tekst
  await expect(page.locator('#status')).toHaveText('Je bent succesvol ingelogd.');

  // 8. Logout
  await page.click('#logout');

  // 9. Controle redirect
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/login\.html/);

});