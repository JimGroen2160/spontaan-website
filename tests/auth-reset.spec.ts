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

  test('reset aanvraag toont succesmelding en verstuurt juiste gegevens', async ({ page }) => {
    const testEmail = 'reset-test@example.com';

    await page.route('**/auth/v1/recover**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}'
      });
    });

    await page.goto('/leden/wachtwoord-vergeten.html');

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/auth/v1/recover') &&
        request.method() === 'POST'
    );

    await page.fill('#reset-email', testEmail);
    await page.getByRole('button', { name: 'Verstuur resetlink' }).click();

    const request = await requestPromise;
    const requestBody = request.postDataJSON();
    const requestUrl = new URL(request.url());
    const expectedRedirect =
      `${new URL(page.url()).origin}/leden/reset-wachtwoord.html`;

    expect(requestBody.email).toBe(testEmail);
    expect(requestUrl.searchParams.get('redirect_to')).toBe(expectedRedirect);

    const message = page.locator('#message');
    await expect(message).toBeVisible();
    await expect(message).toHaveText(
      'Als het e-mailadres bekend is, is er een resetlink verstuurd.'
    );
    await expect(message).toHaveCSS('color', 'rgb(0, 128, 0)');
  });

  test('reset aanvraag toont functionele melding bij rate limit', async ({ page }) => {
    const testEmail = 'reset-test@example.com';

    await page.route('**/auth/v1/recover**', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'over_email_send_rate_limit',
          msg: 'Email rate limit exceeded'
        })
      });
    });

    await page.goto('/leden/wachtwoord-vergeten.html');

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/auth/v1/recover') &&
        request.method() === 'POST'
    );

    await page.fill('#reset-email', testEmail);
    await page.getByRole('button', { name: 'Verstuur resetlink' }).click();

    const request = await requestPromise;
    const requestBody = request.postDataJSON();

    expect(requestBody.email).toBe(testEmail);

    const message = page.locator('#message');
    await expect(message).toBeVisible();
    await expect(message).toHaveText(
      'Er zijn tijdelijk te veel resetverzoeken gedaan. Probeer het over enkele minuten opnieuw.'
    );
    await expect(message).toHaveCSS('color', 'rgb(255, 0, 0)');
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