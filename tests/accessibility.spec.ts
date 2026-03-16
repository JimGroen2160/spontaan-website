import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility tests', () => {

  test('homepage heeft geen WCAG violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test('agenda pagina heeft geen WCAG violations', async ({ page }) => {
    await page.goto('/agenda.html');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test('contact pagina heeft geen WCAG violations', async ({ page }) => {
    await page.goto('/contact.html');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

});