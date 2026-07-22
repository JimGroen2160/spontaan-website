import {expect, test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Muziek en repertoire', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/pages/repertoire.html');
    await page.locator('#nav-placeholder .main-nav').waitFor();
    await page.locator('#footer-placeholder .site-footer').waitFor();
  });

  test('combineert het overzicht en het muzikale verhaal in de bestaande huisstijl', async ({page}) => {
    await expect(page.getByRole('heading', {name: 'Muziek die verbindt'})).toBeVisible();
    await expect(page.locator('.repertoire-world')).toHaveCount(3);
    await expect(page.locator('.repertoire-audio-card')).toHaveCount(3);
    await expect(page.locator('.repertoire-process li')).toHaveCount(4);
    await expect(page.getByText('[TEST] The Rose', {exact: true}).first()).toBeVisible();
    await expect(page.locator('.nav-menu a[aria-current="page"]')).toHaveText('Muziek en repertoire');

    const colors = await page.locator('.repertoire-cta').evaluate((element) => {
      const root = getComputedStyle(document.documentElement);
      return [root.getPropertyValue('--color-primary').trim(), root.getPropertyValue('--color-secondary').trim(), getComputedStyle(element).color];
    });
    expect(colors).toEqual(['#6f25ae', '#d90d87', 'rgb(255, 255, 255)']);
  });

  test('hero en CTA-links zijn bruikbaar en de pagina bevat geen mojibake', async ({page}) => {
    await expect(page.locator('.repertoire-hero__image')).toHaveAttribute('src', '../images/repertoire/muziek-repertoire-hero.jpg');
    await expect(page.locator('.repertoire-hero__image')).toHaveAttribute('fetchpriority', 'high');
    await expect(page.getByRole('link', {name: 'Kom kennismaken'})).toHaveAttribute('href', './contact.html');
    await expect(page.getByRole('link', {name: 'Bekijk Beeld en Geluid'})).toHaveAttribute('href', './media.html');
    const body = await page.locator('body').innerText();
    expect(body).toContain('Drie smaken, één klank');
    expect(body).toContain('zelfgemaakte');
    expect(body).not.toMatch(/\u00c3|\u00e2|\ufffd/);
  });

  test('audiobediening gebruikt lokale testaudio en pauzeert een andere speler', async ({page}) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {configurable: true, get: () => 4});
      HTMLMediaElement.prototype.play = async function play() {
        Object.defineProperty(this, 'paused', {configurable: true, value: false});
        this.dispatchEvent(new Event('play'));
      };
      HTMLMediaElement.prototype.pause = function pause() {
        Object.defineProperty(this, 'paused', {configurable: true, value: true});
        this.dispatchEvent(new Event('pause'));
      };
    });
    await page.reload();
    const buttons = page.locator('[data-audio-url]');
    await buttons.nth(0).click();
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await buttons.nth(1).click();
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });

  test('is overflowvrij op desktop, tablet en mobiel', async ({page}) => {
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({width, height: 900});
      const sizes = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
    }
  });

  test('heeft geen Axe-overtredingen', async ({page}) => {
    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });
});
