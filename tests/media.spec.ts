import {expect, Page, test} from '@playwright/test';

async function openMediaPage(page: Page) {
  await page.goto('/pages/media.html');
  await expect(page.locator('[data-media-page-hero-title]')).toHaveText(
    'CMS Beeld en Geluid',
  );
}

test.describe('Beeld en Geluid - gebouwde CMS-pagina', () => {
  test('levert definitieve CMS-HTML zonder runtime-Sanity-request', async ({page}) => {
    const sanityRequests: string[] = [];
    const componentRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('.api.sanity.io/')) sanityRequests.push(request.url());
      if (/\/components\/(?:nav|footer)\.html/.test(request.url())) {
        componentRequests.push(request.url());
      }
    });

    await openMediaPage(page);

    await expect(page.locator('[data-media-page-intro-title]')).toHaveText(
      'CMS-introductie',
    );
    await expect(page.locator('[data-media-featured] h2')).toHaveText(
      'CMS Zomerconcert',
    );
    await expect(page.locator('[data-media-photo-grid] .media-photo-tile')).toHaveCount(2);
    await expect(page.locator('[data-media-audio-list] .media-audio-tile')).toHaveCount(2);
    await expect(page.locator('[data-media-video-grid] .media-video-tile')).toHaveCount(2);
    await expect(page.locator('[data-media-page-primary-button]')).toHaveAttribute('href', '/pages/contact.html');
    await expect(page.locator('[data-media-page-secondary-button]')).toHaveAttribute('href', '/pages/agenda.html');
    await expect(page.locator('html')).toHaveAttribute('data-media-source', 'cms');
    await expect(page.locator('#nav-placeholder .main-nav')).toHaveCount(1);
    await expect(page.locator('#footer-placeholder .site-footer')).toHaveCount(1);
    expect(sanityRequests).toEqual([]);
    expect(componentRequests).toEqual([]);
  });

  test('laadt geen lokale fallbackafbeeldingen naast CMS-afbeeldingen', async ({page}) => {
    const imageRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'image') imageRequests.push(request.url());
    });

    await openMediaPage(page);

    expect(imageRequests.some((url) => /\/images\/media\/demo-|beeld-en-geluid-hero\.jpg/.test(url))).toBe(false);
    await expect(page.locator('[data-media-page-hero-image]')).toHaveAttribute('src', /cdn\.sanity\.io\/images\/u66p1mxm\/development\/test-hero\.jpg/);
  });

  test('fotoalbum ondersteunt navigatie, Escape en focusterugkeer', async ({page}) => {
    await openMediaPage(page);
    const albumButton = page.locator('[data-media-photo-grid] [data-media-album-button]').first();
    await albumButton.focus();
    await albumButton.click();
    const gallery = page.locator('[data-media-gallery]');
    await expect(gallery).toBeVisible();
    await expect(page.locator('[data-media-gallery-image]')).toHaveAttribute('alt', 'Eerste foto van het zomerconcert');
    await expect(page.locator('[data-media-gallery-counter]')).toContainText(/1.*2/);
    await page.locator('[data-media-gallery-next]').click();
    await expect(page.locator('[data-media-gallery-image]')).toHaveAttribute('alt', 'Tweede foto van het zomerconcert');
    await page.keyboard.press('Escape');
    await expect(gallery).toBeHidden();
    await expect(albumButton).toBeFocused();
  });

  test('video wordt pas na een klik geladen en volledig gesloten', async ({page}) => {
    await openMediaPage(page);
    const videoButton = page.locator('[data-media-video-grid] [data-youtube-id]').first();
    await expect(page.locator('.media-video-player iframe')).toHaveCount(0);
    await videoButton.click();
    const frame = page.locator('.media-video-player iframe');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    const closeButton = page.locator('[data-video-close]');
    await expect(closeButton).toBeFocused();
    await closeButton.click();
    await expect(frame).toHaveCount(0);
    await expect(videoButton).toBeFocused();
  });

  test('sectieacties veroorzaken geen ongewenst afspelen', async ({page}) => {
    await openMediaPage(page);
    await page.locator('[data-media-section-action="audio"]').click();
    await expect(page.locator('[data-audio-url]').first()).toBeFocused();
    await expect(page.locator('audio')).toHaveCount(0);
    await page.locator('[data-media-section-action="videos"]').click();
    await expect(page.locator('[data-youtube-id]').first()).toBeFocused();
    await expect(page.locator('.media-video-player iframe')).toHaveCount(0);
    await page.locator('[data-media-section-action="photos"]').click();
    await expect(page.locator('[data-media-gallery]')).toBeVisible();
  });

  test('heeft op mobiel geen horizontale overflow', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await openMediaPage(page);
    const dimensions = await page.evaluate(() => ({documentWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth}));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  });
});
