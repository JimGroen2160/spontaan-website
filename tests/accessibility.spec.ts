import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { name: 'homepage', path: '/' },
  { name: 'over Spontaan', path: '/pages/over.html' },
  { name: 'agenda', path: '/pages/agenda.html' },
  { name: 'agenda met activiteiten', path: '/pages/agenda.html?demo=1' },
  { name: 'media', path: '/pages/media.html' },
  { name: 'repertoire', path: '/pages/repertoire.html' },
  { name: 'nieuws', path: '/pages/nieuws.html' },
  { name: 'vrienden', path: '/pages/vrienden.html' },
  { name: 'contact', path: '/pages/contact.html' },
  { name: 'ledenlogin', path: '/leden/login.html' },
  { name: 'wachtwoord vergeten', path: '/leden/wachtwoord-vergeten.html' },
  { name: 'wachtwoord resetten', path: '/leden/reset-wachtwoord.html' },
];

test.describe('WCAG scan per publieke en ledenpagina', () => {
  for (const { name, path } of pages) {
    test(`${name} (${path}) heeft geen Axe-overtredingen`, async ({ page }) => {
      test.setTimeout(45_000);

      await page.goto(path);

      await page.locator('#nav-placeholder .main-nav').waitFor({
        state: 'attached',
        timeout: 15_000,
      });

      await page.locator('#footer-placeholder .site-footer').waitFor({
        state: 'attached',
        timeout: 15_000,
      });

      const results = await new AxeBuilder({ page }).analyze();

      expect(
        results.violations,
        `Toegankelijkheidsproblemen op ${path}`,
      ).toEqual([]);
    });
  }
});
