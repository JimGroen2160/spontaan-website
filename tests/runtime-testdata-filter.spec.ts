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

async function serveRuntimeConfig(page, config) {
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


async function captureDevelopmentQuery(page, result) {
  let capturedUrl = '';

  await page.route(
    '**/data/query/development**',
    async (route) => {
      capturedUrl = decodeURIComponent(
        route.request().url(),
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({result}),
      });
    },
  );

  return () => capturedUrl;
}
test.describe('Production testdata-afscherming', () => {
  test('Nieuws verstuurt isTestData-filter naar Production', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, productionConfig);
    const getCapturedUrl = await captureProductionQuery(page);

    await page.goto('/pages/nieuws.html');

    await expect
      .poll(getCapturedUrl)
      .toContain('isTestData != true');

    await expect
      .poll(getCapturedUrl)
      .toContain('$allowDemo=false');
  });

  test('Nieuwsdetail verstuurt isTestData-filter naar Production', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, productionConfig);
    const getCapturedUrl = await captureProductionQuery(page);

    await page.goto(
      '/pages/nieuwsbericht.html?slug=controle-testdata-filter',
    );

    await expect
      .poll(getCapturedUrl)
      .toContain('isTestData != true');

    await expect
      .poll(getCapturedUrl)
      .toContain('$allowDemo=false');
  });

  test('Agenda houdt testdata en niet-openbare content uit Production', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, productionConfig);
    const getCapturedUrl = await captureProductionQuery(page);

    await page.goto('/pages/agenda.html');

    await expect
      .poll(getCapturedUrl)
      .toContain(
        '($allowDemo == true || isTestData != true)',
      );

    await expect
      .poll(getCapturedUrl)
      .toContain('$allowDemo=false');

    await expect
      .poll(getCapturedUrl)
      .toContain('isVisible == true');

    await expect
      .poll(getCapturedUrl)
      .toContain('isPublic == true');

    await expect
      .poll(getCapturedUrl)
      .toContain('eventType != "besloten"');

    await expect
      .poll(getCapturedUrl)
      .toContain('startAt >= now()');
  });
});
test.describe('Development demo-news contract', () => {
  test('Nieuws toont zichtbare demo-CMS-content met allowDemo=true', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, developmentConfig);

    const getCapturedUrl = await captureDevelopmentQuery(
      page,
      [
        {
          title: '[DEMO] Uitgelicht voorbeeldnieuws',
          slug: 'demo-uitgelicht-voorbeeldnieuws',
          publishedAt: '2026-08-16T16:00:00.000Z',
          category: 'vereniging',
          summary: 'Demo voor FAT/GAT.',
          mainImageAlt: 'Zanggroep tijdens een demo-optreden',
          imageUrl:
            'https://cdn.sanity.io/images/u66p1mxm/development/demo-news-image.jpg',
        },
      ],
    );

    await page.goto('/pages/nieuws.html');

    await expect
      .poll(getCapturedUrl)
      .toContain('$allowDemo=true');

    await expect
      .poll(getCapturedUrl)
      .toContain(
        '($allowDemo == true || isTestData != true)',
      );

    await expect
      .poll(getCapturedUrl)
      .toContain('isVisible == true');

    await expect(
      page.getByRole('heading', {
        name: '[DEMO] Uitgelicht voorbeeldnieuws',
      }),
    ).toBeVisible();
  });

  test('Nieuwsdetail toont zichtbaar demo-CMS-item met allowDemo=true', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, developmentConfig);

    const getCapturedUrl = await captureDevelopmentQuery(
      page,
      {
        title: '[DEMO] Uitgelicht voorbeeldnieuws',
        slug: 'demo-uitgelicht-voorbeeldnieuws',
        publishedAt: '2026-08-16T16:00:00.000Z',
        category: 'vereniging',
        summary: 'Demo voor FAT/GAT.',
        mainImageAlt: 'Zanggroep tijdens een demo-optreden',
        imageUrl:
          'https://cdn.sanity.io/images/u66p1mxm/development/demo-news-image.jpg',
        body: [
          {
            _type: 'block',
            children: [
              {
                _type: 'span',
                text: 'Demo-inhoud voor FAT/GAT.',
              },
            ],
          },
        ],
      },
    );

    await page.goto(
      '/pages/nieuwsbericht.html?slug=demo-uitgelicht-voorbeeldnieuws',
    );

    await expect
      .poll(getCapturedUrl)
      .toContain('$allowDemo=true');

    await expect
      .poll(getCapturedUrl)
      .toContain(
        '($allowDemo == true || isTestData != true)',
      );

    await expect
      .poll(getCapturedUrl)
      .toContain('isVisible == true');

    await expect(
      page.locator('[data-news-detail-title]'),
    ).toHaveText('[DEMO] Uitgelicht voorbeeldnieuws');
  });
});
test.describe('Development Agenda CMS-contract', () => {
  test('Agenda toont zichtbare openbare demo-CMS-content met allowDemo=true', async ({
    page,
  }) => {
    await serveRuntimeConfig(page, developmentConfig);

    const getCapturedUrl = await captureDevelopmentQuery(
      page,
      [
        {
          title: '[DEMO] Open repetitieavond',
          startAt: '2027-02-04T19:30:00.000+01:00',
          endAt: '2027-02-04T21:30:00.000+01:00',
          eventType: 'repetitie',
          locationName: 'Repetitieruimte Spontaan',
          city: 'Angerlo',
          address: '',
          mapUrl: '',
          summary:
            'Demo-activiteit voor de functionele FAT/GAT van de Agenda.',
          buttonLabel: '',
          buttonLink: '',
          isFree: true,
          isFeatured: false,
          mainImageAlt: '',
          imageUrl: '',
        },
      ],
    );

    // Bewust GEEN ?demo=1:
    // dit moet de echte CMS-route bewijzen.
    await page.goto('/pages/agenda.html');

    await expect
      .poll(getCapturedUrl)
      .toContain(
        '($allowDemo == true || isTestData != true)',
      );

    await expect
      .poll(getCapturedUrl)
      .toContain('$allowDemo=true');

    await expect
      .poll(getCapturedUrl)
      .toContain('isVisible == true');

    await expect
      .poll(getCapturedUrl)
      .toContain('isPublic == true');

    await expect
      .poll(getCapturedUrl)
      .toContain('eventType != "besloten"');

    await expect
      .poll(getCapturedUrl)
      .toContain('startAt >= now()');

    await expect(
      page.locator('.agenda-event-card'),
    ).toHaveCount(1);

    await expect(
      page.locator('.agenda-event-card h3'),
    ).toHaveText('[DEMO] Open repetitieavond');

    await expect(
      page.locator('.agenda-event-card'),
    ).toContainText('Repetitieruimte Spontaan');

    await expect(
      page.locator('.agenda-event-card'),
    ).toContainText('Angerlo');
  });
});
