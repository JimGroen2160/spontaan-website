import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  '/pages/agenda.html',
  '/pages/repertoire.html',
  '/pages/media.html',
  '/pages/over.html',
  '/'
];

test('WCAG scan per pagina (inzicht + controle)', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  }
});