import {expect, Page, test} from '@playwright/test';

async function waitForSharedLayout(page: Page) {
  await page.locator('#nav-placeholder .main-nav').waitFor({
    state: 'attached',
    timeout: 15_000,
  });

  await page.locator('#footer-placeholder .site-footer').waitFor({
    state: 'attached',
    timeout: 15_000,
  });
}

async function openPage(page: Page, route: string) {
  await page.goto(route);
  await waitForSharedLayout(page);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Interactie- en navigatieaudit — Nieuws', () => {
  test.beforeEach(async ({page}) => {
    /*
     * Gebruik bewust de statische fallback, zodat de test niet afhankelijk
     * is van actuele of veranderende Sanity-inhoud.
     */
    await page.route('**/data/query/development**', async (route) => {
      await route.abort('failed');
    });
  });

  test('filter Overig bedient de interface en toont uitsluitend de juiste categorie', async ({
    page,
  }) => {
    await openPage(page, '/pages/nieuws.html');

    const filter = page.getByRole('button', {
      name: 'Overig',
      exact: true,
    });

    await expect(filter).toBeVisible();
    await filter.click();

    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', {
        name: 'Alles',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'false');

    const visibleCards = page.locator('.news-card:not([hidden])');

    /*
     * De huidige gecontroleerde fallback bevat geen bericht in de
     * categorie Overig. De juiste functionele uitkomst is daarom een
     * actieve filterknop, nul zichtbare kaarten en een duidelijke melding.
     */
    await expect(visibleCards).toHaveCount(0);
    await expect(page.locator('.news-result-summary p')).toHaveText(
      '0 nieuwsberichten gevonden',
    );
    await expect(page.locator('.news-pagination')).toBeHidden();
  });

  test('alle zes nieuwslinks openen het juiste detailbericht', async ({
    page,
  }) => {
    const expectedArticles = [
      {
        slug: 'spontaan-zingt-tijdens-een-sfeervolle-zomeravond',
        title: 'Spontaan zingt tijdens een sfeervolle zomeravond',
      },
      {
        slug: 'nieuwe-stemmen-zijn-van-harte-welkom',
        title: 'Nieuwe stemmen zijn van harte welkom',
      },
      {
        slug: 'zo-bereiden-wij-een-nieuw-optreden-voor',
        title: 'Zo bereiden wij een nieuw optreden voor',
      },
      {
        slug: 'terugblik-op-een-warm-ontvangen-optreden',
        title: 'Terugblik op een warm ontvangen optreden',
      },
      {
        slug: 'samen-zingen-geeft-energie-en-plezier',
        title: 'Samen zingen geeft energie en plezier',
      },
      {
        slug: 'een-kijkje-in-het-repertoire-van-spontaan',
        title: 'Een kijkje in het repertoire van Spontaan',
      },
    ];

    for (const article of expectedArticles) {
      await openPage(page, '/pages/nieuws.html');

      const link = page.locator(
        `.news-card a[href="./nieuwsbericht.html?slug=${article.slug}"]`,
      );

      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();

      await link.click();

      await expect(page).toHaveURL(
        new RegExp(
          `/pages/nieuwsbericht\\.html\\?slug=${escapeRegex(article.slug)}$`,
        ),
      );

      await waitForSharedLayout(page);

      await expect(page.locator('[data-news-detail-title]')).toHaveText(
        article.title,
      );
    }
  });

  test('paginering bedient drie pagina’s en toont de juiste resultaten', async ({
    page,
  }) => {
    await page.unroute('**/data/query/development**');

    const articles = Array.from({length: 13}, (_, index) => {
      const number = index + 1;

      return {
        title: `[TEST] Nieuwsbericht ${number}`,
        slug: `test-nieuwsbericht-${number}`,
        publishedAt:
          `2026-07-${String(number).padStart(2, '0')}T12:00:00.000Z`,
        category: 'vereniging',
        summary: `Samenvatting van testnieuwsbericht ${number}.`,
        mainImageAlt: `Testafbeelding ${number}`,
        imageUrl: `https://cdn.sanity.io/images/u66p1mxm/development/news-test-${number}.jpg`,
      };
    });

    await page.route('**/data/query/development**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: articles,
        }),
      });
    });

    await openPage(page, '/pages/nieuws.html');

    const visibleCards = page.locator('.news-card:not([hidden])');
    const pagination = page.locator('.news-pagination');

    await expect(page.locator('.news-result-summary p')).toHaveText(
      '13 nieuwsberichten gevonden',
    );
    await expect(pagination).toBeVisible();
    await expect(visibleCards).toHaveCount(6);
    await expect(visibleCards.first().locator('h2')).toHaveText(
      '[TEST] Nieuwsbericht 13',
    );

    const pageTwo = pagination.getByRole('button', {
      name: 'Nieuwspagina 2',
      exact: true,
    });

    await pageTwo.click();

    await expect(pageTwo).toHaveAttribute('aria-current', 'page');
    await expect(visibleCards).toHaveCount(6);
    await expect(visibleCards.first().locator('h2')).toHaveText(
      '[TEST] Nieuwsbericht 7',
    );

    const next = pagination.getByRole('button', {
      name: 'Volgende nieuwspagina',
      exact: true,
    });

    await next.click();

    const pageThree = pagination.getByRole('button', {
      name: 'Nieuwspagina 3',
      exact: true,
    });

    await expect(pageThree).toHaveAttribute('aria-current', 'page');
    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.first().locator('h2')).toHaveText(
      '[TEST] Nieuwsbericht 1',
    );
    await expect(next).toBeDisabled();

    const previous = pagination.getByRole('button', {
      name: 'Vorige nieuwspagina',
      exact: true,
    });

    await previous.click();

    await expect(pageTwo).toHaveAttribute('aria-current', 'page');
    await expect(visibleCards).toHaveCount(6);
    await expect(visibleCards.first().locator('h2')).toHaveText(
      '[TEST] Nieuwsbericht 7',
    );
  });
});

test.describe('Interactie- en navigatieaudit — Media', () => {
  test('alle fotoalbumknoppen openen en sluiten een bruikbaar album', async ({
    page,
  }) => {
    await openPage(page, '/pages/media.html');

    const buttons = page.locator('[data-media-album-button]');
    const gallery = page.locator('[data-media-gallery]');
    const galleryImage = page.locator('[data-media-gallery-image]');
    const close = page.locator('[data-media-gallery-close]');

    await expect(buttons).toHaveCount(3);

    for (let index = 0; index < await buttons.count(); index++) {
      const button = buttons.nth(index);

      await button.click();

      await expect(gallery).toBeVisible();
      await expect(galleryImage).toBeVisible();

      const alt = await galleryImage.getAttribute('alt');
      expect(alt?.trim().length ?? 0).toBeGreaterThan(0);

      await close.click();

      await expect(gallery).toBeHidden();
      await expect(button).toBeFocused();
    }
  });

  test('beide audioknoppen wijzigen aantoonbaar de afspeelstatus', async ({
    page,
  }) => {
    await page.route(
      'https://cdn.sanity.io/files/u66p1mxm/development/audio-*.mp3',
      async (route) => {
        await route.fulfill({
          path: 'data/test-repertoire-warm.wav',
          contentType: 'audio/wav',
        });
      },
    );

    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        configurable: true,
        get: () => 4,
      });

      HTMLMediaElement.prototype.play = async function play() {
        Object.defineProperty(this, 'paused', {
          configurable: true,
          value: false,
        });

        this.dispatchEvent(new Event('play'));
      };

      HTMLMediaElement.prototype.pause = function pause() {
        Object.defineProperty(this, 'paused', {
          configurable: true,
          value: true,
        });

        this.dispatchEvent(new Event('pause'));
      };
    });

    await openPage(page, '/pages/media.html');

    const buttons = page.locator('[data-audio-url]');

    await expect(buttons).toHaveCount(2);

    for (let index = 0; index < await buttons.count(); index++) {
      const button = buttons.nth(index);
      const status = button
        .locator('xpath=..')
        .locator('.media-audio-control__status');

      await button.click();

      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(status).toHaveText('Afspelen');

      await button.click();

      /*
       * De tweede bediening wordt aan de toegankelijke knopstatus
       * gecontroleerd. De volledige gedeelde pauze- en eindstatuslogica
       * wordt al afzonderlijk in repertoire.spec.ts getest.
       */
      await expect(button).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('beide videoknoppen openen en sluiten de privacyvriendelijke speler', async ({
    page,
  }) => {
    await openPage(page, '/pages/media.html');

    const buttons = page.locator('[data-youtube-id]');

    await expect(buttons).toHaveCount(2);

    for (let index = 0; index < await buttons.count(); index++) {
      const button = buttons.nth(index);

      await button.click();

      const frame = page.locator('.media-video-player iframe');
      const close = page.locator('[data-video-close]');

      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAttribute(
        'src',
        /youtube-nocookie\.com\/embed\//,
      );
      await expect(close).toBeFocused();

      await close.click();

      await expect(frame).toHaveCount(0);
      await expect(button).toBeFocused();
    }
  });

  test('Agenda-CTA navigeert en toont de verwachte bestemmingspagina', async ({
    page,
  }) => {
    await openPage(page, '/pages/media.html');

    const agendaLink = page.getByRole('link', {
      name: 'Bekijk de agenda',
      exact: true,
    });

    await agendaLink.click();

    await expect(page).toHaveURL(/\/pages\/agenda\.html$/);
    await waitForSharedLayout(page);
    await expect(page.getByRole('heading', {level: 1})).toContainText(
      /agenda/i,
    );
  });
});

test.describe('Interactie- en navigatieaudit — Repertoire', () => {
  test('alle interne ankerlinks bereiken een bestaand zichtbaar doel', async ({
    page,
  }) => {
    await openPage(page, '/pages/repertoire.html');

    const links = page.locator('main a[href^="#"]');

    await expect(links).toHaveCount(5);

    for (let index = 0; index < await links.count(); index++) {
      await openPage(page, '/pages/repertoire.html');

      const link = page.locator('main a[href^="#"]').nth(index);
      const href = await link.getAttribute('href');

      expect(href).toMatch(/^#[A-Za-z][\w-]*$/);

      await link.click();

      await expect(page).toHaveURL(
        new RegExp(`${escapeRegex(href!)}$`),
      );

      const target = page.locator(href!);

      await expect(target).toHaveCount(1);
      await expect(target).toBeVisible();
    }
  });

  test('CTA naar Beeld en Geluid navigeert naar de juiste pagina', async ({
    page,
  }) => {
    await openPage(page, '/pages/repertoire.html');

    await page.getByRole('link', {
      name: 'Bekijk Beeld en Geluid',
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/pages\/media\.html$/);
    await waitForSharedLayout(page);

    await expect(page.getByRole('heading', {level: 1})).toContainText(
      /beeld en geluid/i,
    );
  });

  test('kennismakings-CTA navigeert naar de Contactpagina', async ({
    page,
  }) => {
    await openPage(page, '/pages/repertoire.html');

    await page.getByRole('link', {
      name: 'Kom kennismaken',
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/pages\/contact\.html$/);
    await waitForSharedLayout(page);

    await expect(page.getByRole('heading', {level: 1})).toContainText(
      /contact/i,
    );
  });
});