import {expect, test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Muziek en repertoire', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/pages/repertoire.html');
    await page.locator('#nav-placeholder .main-nav').waitFor();
    await page.locator('#footer-placeholder .site-footer').waitFor();
  });

  test('combineert het overzicht en het muzikale verhaal in de bestaande huisstijl', async ({page}) => {
    await expect(page.getByRole('heading', {name: 'Muziek en repertoire'})).toBeVisible();
    await expect(page.locator('.repertoire-world')).toHaveCount(3);
    await expect(page.locator('.repertoire-audio-card')).toHaveCount(3);
    await expect(page.locator('.repertoire-process li')).toHaveCount(4);
    await expect(page.getByText('[TEST] The Rose', {exact: true}).first()).toBeVisible();
    await expect(page.locator('.nav-menu a[aria-current="page"]')).toHaveText('Muziek en repertoire');
    await expect(page.locator('html')).toHaveAttribute('data-repertoire-source', 'cms');

    const colors = await page.locator('.repertoire-cta').evaluate((element) => {
      const root = getComputedStyle(document.documentElement);
      return [root.getPropertyValue('--color-primary').trim(), root.getPropertyValue('--color-secondary').trim(), getComputedStyle(element).color];
    });
    expect(colors).toEqual(['#6f25ae', '#d90d87', 'rgb(255, 255, 255)']);
  });

  test('hero en CTA-links zijn bruikbaar en de pagina bevat geen mojibake', async ({page}) => {
    await expect(page.locator('.repertoire-hero__image')).toHaveAttribute(
      'src',
      /^(?:\.\.\/images\/repertoire\/repertoire-hero\.jpg|https:\/\/cdn\.sanity\.io\/images\/)/,
    );
    await expect(page.locator('.repertoire-hero__image')).toHaveAttribute('fetchpriority', 'high');
    await expect(page.getByRole('link', {name: 'Kom kennismaken'})).toHaveAttribute('href', './contact.html');
    await expect(page.getByRole('link', {name: 'Bekijk Beeld en Geluid'})).toHaveAttribute('href', './media.html');
    const body = await page.locator('body').innerText();
    expect(body).toContain('Onze muzikale wereld');
    expect(body).toContain('Een ode aan liefde, hoop en herinnering');
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
    await expect(buttons.first()).toHaveAttribute(
      'data-audio-url',
      /^(?:\.\.\/data\/test-repertoire-warm\.wav|https:\/\/cdn\.sanity\.io\/files\/)/,
    );
    const statuses = page.locator('.media-audio-control__status');

    await expect(statuses.nth(0)).toBeVisible();
    await expect(statuses.nth(0)).toHaveText('Gereed');

    await buttons.nth(0).click();
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(statuses.nth(0)).toHaveText('Afspelen');

    const firstAudio = buttons.nth(0).locator('xpath=..').locator('audio');

    await firstAudio.evaluate((audio) => {
      Object.defineProperty(audio, 'currentTime', {
        configurable: true,
        writable: true,
        value: 1,
      });
    });

    await buttons.nth(0).click();
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(statuses.nth(0)).toHaveText('Gepauzeerd');

    await buttons.nth(1).click();
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(statuses.nth(1)).toHaveText('Afspelen');

    const secondAudio = buttons.nth(1).locator('xpath=..').locator('audio');

    await secondAudio.evaluate((audio) => {
      audio.dispatchEvent(new Event('ended'));
    });

    await expect(statuses.nth(1)).toHaveText('Afgelopen');
  });

  test('featured lied, verhaal en audio komen uit hetzelfde repertoire-item', async ({page}) => {
    const featuredTitle = await page.locator('.repertoire-feature h3').innerText();
    const featuredStory = await page.locator('.repertoire-feature__content > p:not(.repertoire-label)').innerText();
    const featuredAudio = page.locator('#featured-audio .repertoire-audio-card').first();
    await expect(featuredAudio.getByRole('heading')).toHaveText(featuredTitle);
    expect(featuredStory.trim().length).toBeGreaterThan(20);
    await expect(featuredAudio.locator('[data-audio-url]')).toHaveAttribute(
      'data-audio-title',
      featuredTitle,
    );
  });

  test('haalt geen repertoire-inhoud tijdens runtime bij Sanity op', async ({page}) => {
    const sanityRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('.api.sanity.io/')) sanityRequests.push(request.url());
    });
    await page.reload();
    await expect(page.locator('.repertoire-feature')).toBeVisible();
    expect(sanityRequests).toEqual([]);
  });

  test('lijnt selectie, quote en CTA gelijk uit en behoudt de quote-uitsnede', async ({page}) => {
    await page.setViewportSize({width: 1440, height: 900});

    const boxes = await Promise.all(
      ['.repertoire-selection', '.repertoire-quote', '.repertoire-cta'].map(
        async (selector) => page.locator(selector).boundingBox(),
      ),
    );

    for (const box of boxes) expect(box).not.toBeNull();

    const [selection, quote, cta] = boxes;

    expect(Math.abs(selection!.x - quote!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(selection!.x - cta!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(selection!.width - quote!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(selection!.width - cta!.width)).toBeLessThanOrEqual(1);

    await page.setViewportSize({width: 390, height: 900});

    const objectPosition = await page
      .locator('.repertoire-quote img')
      .evaluate((image) => getComputedStyle(image).objectPosition);

    expect(objectPosition).toBe('50% 32%');
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
