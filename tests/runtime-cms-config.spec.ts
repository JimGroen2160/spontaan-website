import {expect, test} from '@playwright/test';

const productionConfig = {
  projectId: 'u66p1mxm',
  dataset: 'production',
  apiVersion: '2026-07-06',
  environment: 'production',
  allowDemo: false,
};

const developmentConfig = {
  projectId: 'u66p1mxm',
  dataset: 'development',
  apiVersion: '2026-07-06',
  environment: 'development',
  allowDemo: true,
};

async function serveRuntimeConfig(
  page,
  config,
) {
  await page.route(
    '**/js/runtime-config.js',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body:
          'window.SpontaanRuntimeConfig = ' +
          `Object.freeze(${JSON.stringify(config)});`,
      });
    },
  );
}

test.describe('Centrale runtime-CMS-configuratie', () => {
  test('Nieuws gebruikt in Production uitsluitend production', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, productionConfig);

    let developmentRequests = 0;
    let productionRequests = 0;

    await page.route(
      '**/data/query/development**',
      async (route) => {
        developmentRequests += 1;
        await route.abort('blockedbyclient');
      },
    );

    await page.route(
      '**/data/query/production**',
      async (route) => {
        productionRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            result: [],
          }),
        });
      },
    );

    await page.goto('/pages/nieuws.html');

    await expect(
      page.locator('.news-result-summary p'),
    ).toHaveText('0 nieuwsberichten gevonden');

    await expect(
      page.locator('.news-card:not([hidden])'),
    ).toHaveCount(0);

    expect(productionRequests).toBe(1);
    expect(developmentRequests).toBe(0);
  });

  test('lege Nieuws-response behoudt developmentfallback', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, developmentConfig);

    await page.route(
      '**/data/query/development**',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            result: [],
          }),
        });
      },
    );

    await page.goto('/pages/nieuws.html');

    await expect(
      page.locator('.news-card:not([hidden])'),
    ).toHaveCount(6);

    await expect(
      page.locator('.news-result-summary p'),
    ).toHaveText('6 nieuwsberichten gevonden');
  });

  test('Nieuws toont in Production geen statische fallback bij storing', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, productionConfig);

    await page.route(
      '**/data/query/production**',
      async (route) => {
        await route.abort('failed');
      },
    );

    await page.goto('/pages/nieuws.html');

    await expect(
      page.locator('.news-card:not([hidden])'),
    ).toHaveCount(0);

    await expect(
      page.locator('.news-result-summary p'),
    ).toHaveText('0 nieuwsberichten gevonden');
  });

  test('Nieuwsdetail toont in Production geen statisch voorbeeldbericht', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, productionConfig);

    await page.route(
      '**/data/query/production**',
      async (route) => {
        await route.abort('failed');
      },
    );

    await page.goto(
      '/pages/nieuwsbericht.html?slug=nieuwe-stemmen-zijn-van-harte-welkom',
    );

    await expect(
      page.locator('[data-news-detail-title]'),
    ).toHaveText('Nieuwsbericht niet gevonden');

    await expect(
      page.locator('.news-detail__media'),
    ).toBeHidden();
  });

  test('ontbrekende runtimeconfig voorkomt ieder Nieuwsrequest', async ({
    page,
  }) => {
    await page.route(
      '**/js/runtime-config.js',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: '',
        });
      },
    );

    let queryRequests = 0;

    await page.route(
      '**/data/query/**',
      async (route) => {
        queryRequests += 1;
        await route.abort('blockedbyclient');
      },
    );

    await page.goto('/pages/nieuws.html');

    await expect(
      page.locator('.news-card:not([hidden])'),
    ).toHaveCount(0);

    expect(queryRequests).toBe(0);
  });

  test('Agenda gebruikt in Production production en blokkeert demo=1', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, productionConfig);

    let developmentRequests = 0;
    let productionRequests = 0;

    await page.route(
      '**/data/query/development**',
      async (route) => {
        developmentRequests += 1;
        await route.abort('blockedbyclient');
      },
    );

    await page.route(
      '**/data/query/production**',
      async (route) => {
        productionRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            result: [],
          }),
        });
      },
    );

    await page.goto('/pages/agenda.html?demo=1');

    await expect(
      page.locator('.agenda-event-card'),
    ).toHaveCount(0);

    await expect(
      page.getByText('Zomeravondconcert', {
        exact: true,
      }),
    ).toHaveCount(0);

    expect(productionRequests).toBe(1);
    expect(developmentRequests).toBe(0);
  });

  test('Agenda-demomodus blijft alleen in development beschikbaar', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, developmentConfig);

    let queryRequests = 0;

    await page.route(
      '**/data/query/**',
      async (route) => {
        queryRequests += 1;
        await route.abort('blockedbyclient');
      },
    );

    await page.goto('/pages/agenda.html?demo=1');

    await expect(
      page.locator('.agenda-event-card'),
    ).toHaveCount(5);

    await expect(
      page.getByText('Zomeravondconcert', {
        exact: true,
      }),
    ).toBeVisible();

    expect(queryRequests).toBe(0);
  });

  test('ongeldige Production-config kan niet naar development lekken', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, {
      ...productionConfig,
      dataset: 'development',
    });

    let queryRequests = 0;

    await page.route(
      '**/data/query/**',
      async (route) => {
        queryRequests += 1;
        await route.abort('blockedbyclient');
      },
    );

    await page.goto('/pages/agenda.html?demo=1');

    await expect(
      page.locator('.agenda-event-card'),
    ).toHaveCount(0);

    await expect(
      page.locator('[data-agenda-status]'),
    ).toBeVisible();

    expect(queryRequests).toBe(0);
  });
});
