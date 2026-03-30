import { test, expect } from '@playwright/test';

test('homepage opent', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await expect(page).toHaveTitle(/Spontaan/);
});

test('agenda pagina opent', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.click('text=Agenda');
  await expect(page).toHaveURL(/agenda/);
});

test('contact pagina opent', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.click('text=Contact');
  await expect(page).toHaveURL(/contact/);
});

test('navigatie werkt', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.click('text=Over Spontaan');
  await expect(page).toHaveURL(/over/);
});

test('mobile layout werkt', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://localhost:5500');
  await expect(page.locator('h1')).toBeVisible();
});

test('homepage screenshot', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await expect(page).toHaveScreenshot();
});

test('title bevat Zangkoor Spontaan', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await expect(page).toHaveTitle(/Zangkoor Spontaan/);
});