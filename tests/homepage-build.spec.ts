import {expect, test} from '@playwright/test';

const viewports = [
  {
    name: 'desktop',
    width: 1440,
    height: 1000,
  },
  {
    name: 'tablet',
    width: 768,
    height: 1024,
  },
  {
    name: 'mobiel',
    width: 390,
    height: 844,
  },
];

test.describe('Gebouwde Homepage', () => {
  test('toont CMS-inhoud zonder runtime-Sanity', async ({page}) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const sanityRequests: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    page.on('request', (request) => {
      const url = request.url();

      if (
        url.includes('api.sanity.io') ||
        url.includes('apicdn.sanity.io') ||
        url.includes('/data/query/')
      ) {
        sanityRequests.push(url);
      }
    });

    const response = await page.goto('/', {
      waitUntil: 'networkidle',
    });

    expect(response?.status()).toBe(200);

    await expect(page.locator('html')).toHaveAttribute(
      'data-home-source',
      'cms',
    );

    await expect(
      page.locator('[data-homepage-hero-title]'),
    ).toHaveText('[TEST] Zanggroep Spontaan');

    await expect(
      page.locator('[data-homepage-hero-subtitle]'),
    ).toHaveText('[TEST] Samen zingen vanuit de Homepage');

    await expect(
      page.locator('[data-homepage-quicklinks] .homepage-card'),
    ).toHaveCount(3);

    await expect(
      page.locator('[data-homepage-quicklinks] h3'),
    ).toHaveText([
      '[TEST] Nieuws',
      '[TEST] Agenda',
      '[TEST] Beeld en Geluid',
    ]);

    await expect(
      page.locator('[data-homepage-welcome-title]'),
    ).toHaveText('[TEST] Samen zingen met plezier');

    await expect(
      page.locator('[data-homepage-visit-title]'),
    ).toHaveText('[TEST] Zing je mee met Spontaan?');

    const expectedLinks = [
      'pages/contact.html',
      'pages/nieuws.html',
      'pages/agenda.html',
      'pages/media.html',
      'pages/over.html',
    ];

    for (const href of expectedLinks) {
      await expect(
        page.locator(`a[href="${href}"]`).first(),
      ).toBeVisible();
    }

    await expect(page.locator('nav').first()).toBeVisible();
    await expect(page.locator('footer').first()).toBeVisible();

    await expect(
      page.locator('script[src="js/homepage.js"]'),
    ).toHaveCount(0);

    expect(sanityRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  for (const viewport of viewports) {
    test(`heeft geen horizontale overflow op ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      const response = await page.goto('/', {
        waitUntil: 'networkidle',
      });

      expect(response?.status()).toBe(200);

      await expect(
        page.locator('[data-homepage-hero-title]'),
      ).toBeVisible();

      await expect(
        page.locator('[data-homepage-quicklinks] .homepage-card'),
      ).toHaveCount(3);

      const dimensions = await page.evaluate(() => ({
        documentScrollWidth:
          document.documentElement.scrollWidth,
        documentClientWidth:
          document.documentElement.clientWidth,
        bodyScrollWidth:
          document.body.scrollWidth,
        bodyClientWidth:
          document.body.clientWidth,
      }));

      expect(
        dimensions.documentScrollWidth,
        JSON.stringify(dimensions),
      ).toBeLessThanOrEqual(
        dimensions.documentClientWidth + 1,
      );

      expect(
        dimensions.bodyScrollWidth,
        JSON.stringify(dimensions),
      ).toBeLessThanOrEqual(
        dimensions.bodyClientWidth + 1,
      );

      await expect(page.locator('footer').first()).toBeVisible();
    });
  }
});
