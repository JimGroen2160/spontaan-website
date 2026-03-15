import { test, expect } from '@playwright/test';

test('homepage opent', async ({ page }) => {
  await page.goto('http://localhost:5500/index.html');
  await expect(page).toHaveTitle(/Spontaan/);
});

test('agenda pagina opent', async ({ page }) => {
  await page.goto('http://localhost:5500/index.html');
  await page.click('text=Agenda');
  await expect(page).toHaveURL(/agenda/);
});

test('contact pagina opent', async ({ page }) => {
  await page.goto('http://localhost:5500/index.html');
  await page.click('text=Contact');
  await expect(page).toHaveURL(/contact/);
});