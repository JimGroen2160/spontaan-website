import {expect, test} from '@playwright/test';

const productionConfig = {
  projectId: 'u66p1mxm',
  dataset: 'production',
  apiVersion: '2026-07-06',
  environment: 'production',
  allowDemo: false,
};

async function serveProductionRuntimeConfig(page) {
  await page.route(
    '**/js/runtime-config.js',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body:
          'window.SpontaanRuntimeConfig = ' +
          `Object.freeze(${JSON.stringify(productionConfig)});`,
      });
    },
  );
}

async function captureProductionQuery(page) {
  let capturedUrl = '';

  await page.route(
    '**/data/query/production**',
    async (route) => {
      capturedUrl = decodeURIComponent(
        route.request().url(),
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: [],
        }),
      });
    },
  );

  return () => capturedUrl;
}

test.describe('Production testdata-afscherming', () => {
  test('Nieuws verstuurt isTestData-filter naar Production', async ({
    page,
  }) => {
    await serveProductionRuntimeConfig(page);
    const getCapturedUrl = await captureProductionQuery(page);

    await page.goto('/pages/nieuws.html');

    await expect
      .poll(getCapturedUrl)
      .toContain('isTestData != true');
  });

  test('Nieuwsdetail verstuurt isTestData-filter naar Production', async ({
    page,
  }) => {
    await serveProductionRuntimeConfig(page);
    const getCapturedUrl = await captureProductionQuery(page);

    await page.goto(
      '/pages/nieuwsbericht.html?slug=controle-testdata-filter',
    );

    await expect
      .poll(getCapturedUrl)
      .toContain('isTestData != true');
  });

  test('Agenda verstuurt isTestData-filter naar Production', async ({
    page,
  }) => {
    await serveProductionRuntimeConfig(page);
    const getCapturedUrl = await captureProductionQuery(page);

    await page.goto('/pages/agenda.html');

    await expect
      .poll(getCapturedUrl)
      .toContain('isTestData != true');
  });
});