import { test, expect } from '@playwright/test';

test.describe('Website basis testen', () => {

  test('homepage opent', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Spontaan/);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });
    await page.waitForSelector('#footer-placeholder', { timeout: 15000 });
  });

  test('agenda pagina opent', async ({ page }) => {
    await page.goto('/pages/agenda.html');
    await expect(page).toHaveURL(/agenda/);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });
    await page.waitForSelector('#footer-placeholder', { timeout: 15000 });
  });

  test('over pagina opent', async ({ page }) => {
    await page.goto('/pages/over.html');
    await expect(page).toHaveURL(/over/);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });
    await page.waitForSelector('#footer-placeholder', { timeout: 15000 });
  });

  test('navigatie werkt', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });

    await page.locator('#nav-placeholder .nav-menu a', { hasText: 'Agenda' }).click();
    await expect(page).toHaveURL(/agenda/);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });

    await page.locator('#nav-placeholder .nav-menu a', { hasText: 'Over Spontaan' }).click();
    await expect(page).toHaveURL(/over/);
  });

});