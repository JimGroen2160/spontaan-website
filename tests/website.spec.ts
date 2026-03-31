import { test, expect } from '@playwright/test';

test('homepage opent', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Spontaan/);
});

test('agenda pagina opent', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Agenda');
  await expect(page).toHaveURL(/agenda/);
});

test('contact pagina opent', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Contact');
  await expect(page).toHaveURL(/contact/);
});

test('navigatie werkt', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Over Spontaan');
  await expect(page).toHaveURL(/over/);
});

test('mobile layout werkt', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});

test('title bevat Zangkoor Spontaan', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Zangkoor Spontaan/);
});

test('navigatie component werkt correct', async ({ page }) => {
  await page.goto('/pages/over.html');

  const nav = page.locator('#nav');

  // Stap 1: nav moet zichtbaar zijn
  await expect(nav).toBeVisible();

  // Stap 2: wacht tot component geladen is (BELANGRIJK)
  await page.waitForSelector('#nav a');

  // Stap 3: fail-fast check → moet links bevatten
  await expect(nav.locator('a')).toHaveCountGreaterThan(0);

  // Stap 4: concrete check
  await expect(nav.locator('text=Home')).toBeVisible();
});
