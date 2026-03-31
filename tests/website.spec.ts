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

  // 1. BESTAAT nav?
  const count = await nav.count();
  console.log('nav count:', count);

  expect(count).toBeGreaterThan(0);

  // 2. DEBUG: wat zit erin?
  const html = await nav.innerHTML();
  console.log('nav content:', html);

  // 3. wacht tot links er zijn (max 5 sec)
  await page.waitForFunction(() => {
    const el = document.querySelector('#nav');
    return el && el.querySelectorAll('a').length > 0;
  }, { timeout: 5000 });

  // 4. check links
  const links = nav.locator('a');
  const linkCount = await links.count();
  console.log('aantal links:', linkCount);

  expect(linkCount).toBeGreaterThan(0);

  // 5. check specifieke link
  await expect(nav.locator('text=Home')).toBeVisible();
});