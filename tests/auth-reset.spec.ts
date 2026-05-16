import { test, expect } from '@playwright/test';

test.describe('Auth reset flow', () => {
  test('loginpagina toont link wachtwoord vergeten en opent resetpagina', async ({ page }) => {
    await page.goto('/leden/login.html');

    await expect(page.locator('h1')).toHaveText('Inloggen');

    const forgotPasswordLink = page.getByRole('link', { name: 'Wachtwoord vergeten?' });
    await expect(forgotPasswordLink).toBeVisible();

    await forgotPasswordLink.click();

    await expect(page).toHaveURL(/\/leden\/wachtwoord-vergeten\.html$/);
    await expect(page.locator('h1')).toHaveText('Wachtwoord vergeten');
  });

  test('reset aanvraagpagina toont nette melding na verzenden', async ({ page }) => {
    await page.goto('/leden/wachtwoord-vergeten.html');

    await page.fill('#reset-email', 'jim.groen14@gmail.com');
    await page.getByRole('button', { name: 'Verstuur resetlink' }).click();

    const message = page.locator('#message');
    await expect(message).not.toHaveText('');

    await expect(message).toContainText(/resetlink verstuurd|te veel resetverzoeken/i);
  });

  test('reset wachtwoord pagina kan wachtwoorden tonen/verbergen', async ({ page }) => {
    await page.goto('/leden/reset-wachtwoord.html');

    const newPassword = page.locator('#new-password');
    const confirmPassword = page.locator('#confirm-password');
    const toggle = page.locator('#toggle-password-visibility');

    await newPassword.fill('testenSpontaan123');
    await confirmPassword.fill('testenSpontaan123');

    await expect(newPassword).toHaveAttribute('type', 'password');
    await expect(confirmPassword).toHaveAttribute('type', 'password');

    await toggle.check();

    await expect(newPassword).toHaveAttribute('type', 'text');
    await expect(confirmPassword).toHaveAttribute('type', 'text');

    await toggle.uncheck();

    await expect(newPassword).toHaveAttribute('type', 'password');
    await expect(confirmPassword).toHaveAttribute('type', 'password');
  });

  test('reset wachtwoord pagina toont melding bij ongelijke wachtwoorden', async ({ page }) => {
    await page.goto('/leden/reset-wachtwoord.html');

    await page.fill('#new-password', 'testenspontaan');
    await page.fill('#confirm-password', 'testenspontaa');

    await page.getByRole('button', { name: 'Opslaan' }).click();

    await expect(page.locator('#message')).toHaveText('De wachtwoorden komen niet overeen.');
  });

  test('reset wachtwoord pagina toont nette melding bij ontbrekende of verlopen sessie', async ({ page }) => {
    await page.goto('/leden/reset-wachtwoord.html');

    await page.fill('#new-password', 'testenspontaan');
    await page.fill('#confirm-password', 'testenspontaan');

    await page.getByRole('button', { name: 'Opslaan' }).click();

    await expect(page.locator('#message')).toHaveText(
      'De resetlink is ongeldig of verlopen. Vraag opnieuw een wachtwoordreset aan.'
    );
  });
});