import { test, expect } from '@playwright/test';

test.describe('Website basis testen', () => {

  test('homepage opent', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('agenda pagina opent', async ({ page }) => {
    await page.goto('http://localhost:3000/pages/agenda.html');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('over pagina opent', async ({ page }) => {
    await page.goto('http://localhost:3000/pages/over.html');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('navigatie werkt', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await page.click('text=Agenda');
    await expect(page).toHaveURL(/agenda/);

    await page.click('text=Over Spontaan');
    await expect(page).toHaveURL(/over/);
  });

});