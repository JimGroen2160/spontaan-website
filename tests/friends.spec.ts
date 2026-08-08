import {expect, test} from '@playwright/test';

test.describe('Vrienden van Spontaan', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/pages/vrienden.html');
    await page.locator('#nav-placeholder .main-nav').waitFor();
    await page.locator('#footer-placeholder .site-footer').waitFor();
  });

  test('rendert de beheerbare vriendenfixture zonder verlopen sponsor', async ({page}) => {
    await expect(page.locator('html')).toHaveAttribute(
      'data-friends-source',
      'cms',
    );

    await expect(page.locator('[data-friends-hero-title]')).toHaveText(
      '[TEST] Vrienden van Spontaan',
    );

    const cards = page.locator('.friends-partner-card');

    await expect(cards).toHaveCount(6);
    await expect(
      page.getByText('[TEST] Bedrijf Een', {exact: true}),
    ).toBeVisible();
    await expect(
      page.getByText('[TEST] Organisatie Twee', {exact: true}),
    ).toBeVisible();
    await expect(
      page.getByText('[TEST] Verlopen sponsor', {exact: true}),
    ).toHaveCount(0);

    await expect(page.locator('#nav-placeholder .main-nav')).toHaveCount(1);
    await expect(page.locator('#footer-placeholder .site-footer')).toHaveCount(1);
  });

  test('biedt veilige en bruikbare externe sponsorlinks', async ({page}) => {
    const link = page.getByRole('link', {
      name: 'Bezoek de website van [TEST] Bedrijf Een',
    });

    await expect(link).toHaveAttribute('href', 'https://example.com/');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    await link.focus();
    await expect(link).toBeFocused();
  });

  test('carrousel navigeert vooruit en terug en werkt zijn controls bij', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.setViewportSize({width: 390, height: 844});
    await page.reload();

    const viewport = page.locator('[data-friends-list]');
    const previous = page.locator('[data-friends-carousel-previous]');
    const next = page.locator('[data-friends-carousel-next]');

    await expect(viewport).toBeVisible();
    await expect(previous).toBeVisible();
    await expect(next).toBeVisible();

    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();

    const start = await viewport.evaluate((element) => element.scrollLeft);

    await next.click();

    await expect.poll(
      () => viewport.evaluate((element) => element.scrollLeft),
    ).toBeGreaterThan(start);

    await expect(previous).toBeEnabled();

    await previous.click();

    await expect.poll(
      () => viewport.evaluate((element) => element.scrollLeft),
    ).toBeLessThanOrEqual(1);

    await expect(previous).toBeDisabled();
  });
});