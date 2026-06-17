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


  test('mobiel hamburgermenu opent en toont navigatielinks', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.waitForSelector('#nav-placeholder .hamburger', { timeout: 15000 });

    const hamburger = page.locator('#nav-placeholder .hamburger');
    const navMenu = page.locator('#nav-placeholder .nav-menu');

    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(navMenu).not.toHaveClass(/open/);

    await hamburger.click();

    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    await expect(navMenu).toHaveClass(/open/);
    await expect(page.locator('#nav-placeholder .nav-menu a', { hasText: 'Agenda' })).toBeVisible();

    await page.locator('#nav-placeholder .nav-menu a', { hasText: 'Agenda' }).click();
    await expect(page).toHaveURL(/agenda/);
  });
});
