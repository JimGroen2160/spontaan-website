import { test, expect, Page } from '@playwright/test';

const publicRoutes = [
  '/',
  '/pages/over.html',
  '/pages/agenda.html',
  '/pages/media.html',
  '/pages/repertoire.html',
  '/pages/nieuws.html',
  '/pages/nieuwsbericht.html?slug=nieuwe-stemmen-zijn-van-harte-welkom',
  '/pages/vrienden.html',
  '/pages/contact.html',
  '/leden/login.html',
  '/leden/wachtwoord-vergeten.html',
  '/leden/reset-wachtwoord.html',
];

async function waitForSharedLayout(page: Page) {
  await page.locator('#nav-placeholder .main-nav').waitFor({
    state: 'attached',
    timeout: 15000,
  });

  await page.locator('#nav-placeholder .nav-menu a').first().waitFor({
    state: 'attached',
    timeout: 15000,
  });

  await page.locator('#footer-placeholder .site-footer').waitFor({
    state: 'attached',
    timeout: 15000,
  });
}

test.describe('Website basis en huisstijl', () => {
  test('homepage opent met zichtbaar en geladen Spontaan-logo', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Spontaan/);
    await waitForSharedLayout(page);

    const logoLink = page.locator('#nav-placeholder .site-logo');
    const logo = logoLink.locator('img');

    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute('aria-label', /homepage.*Spontaan/i);
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('alt', 'Zanggroep Spontaan');

    const logoLoaded = await logo.evaluate((image: HTMLImageElement) => (
      image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    ));
    expect(logoLoaded).toBe(true);
  });

  test('agenda en over pagina openen met gedeelde navigatie en footer', async ({ page }) => {
    for (const route of ['/pages/agenda.html', '/pages/over.html']) {
      await page.goto(route);
      await waitForSharedLayout(page);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('#footer-placeholder .site-footer')).toBeVisible();
    }
  });

  test('navigatie werkt en markeert de actuele pagina toegankelijk', async ({ page }) => {
    await page.goto('/');
    await waitForSharedLayout(page);

    const homeLink = page.locator('#nav-placeholder .nav-menu a', { hasText: /^Home$/ });
    await expect(homeLink).toHaveAttribute('aria-current', 'page');
    await expect(homeLink).toHaveClass(/active/);

    await page.locator('#nav-placeholder .nav-menu a', { hasText: 'Agenda' }).click();
    await expect(page).toHaveURL(/\/pages\/agenda\.html$/);
    await waitForSharedLayout(page);

    const agendaLink = page.locator('#nav-placeholder .nav-menu a', { hasText: 'Agenda' });
    await expect(agendaLink).toHaveAttribute('aria-current', 'page');
    await expect(agendaLink).toHaveClass(/active/);
    await expect(page.locator('#nav-placeholder .nav-menu a[aria-current="page"]')).toHaveCount(1);

    await page.locator('#nav-placeholder .nav-menu a', { hasText: 'Over Spontaan' }).click();
    await expect(page).toHaveURL(/\/pages\/over\.html$/);
    await expect(page.locator('h1')).toContainText(/over spontaan/i);
  });

  test('logo-link navigeert vanaf een subpagina terug naar de homepage', async ({ page }) => {
    await page.goto('/pages/contact.html');
    await waitForSharedLayout(page);

    await page.locator('#nav-placeholder .site-logo').click();

    await expect(page).toHaveURL(/\/(?:index\.html)?$/);
    await expect(page.locator('.hero h1')).toContainText(/zanggroep spontaan/i);
  });

  test('mobiel hamburgermenu is gesloten, opent, sluit met Escape en navigeert', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForSharedLayout(page);

    const hamburger = page.locator('#nav-placeholder .hamburger');
    const navMenu = page.locator('#nav-placeholder .nav-menu');
    const agendaLink = page.locator('#nav-placeholder .nav-menu a', { hasText: 'Agenda' });

    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(hamburger).toHaveAttribute('aria-label', 'Menu openen');
    await expect(navMenu).toBeHidden();
    await expect(agendaLink).toBeHidden();

    await hamburger.click();

    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    await expect(hamburger).toHaveAttribute('aria-label', 'Menu sluiten');
    await expect(navMenu).toBeVisible();
    await expect(agendaLink).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(navMenu).toBeHidden();
    await expect(hamburger).toBeFocused();

    await hamburger.click();
    await agendaLink.click();

    await expect(page).toHaveURL(/\/pages\/agenda\.html$/);
    await expect(page.locator('h1')).toContainText(/agenda/i);
  });

  test('desktopnavigatie blijft op één rij en schakelt tijdig naar het hamburgermenu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForSharedLayout(page);

    const hamburger = page.locator('#nav-placeholder .hamburger');
    const navMenu = page.locator('#nav-placeholder .nav-menu');
    const navLinks = navMenu.locator('a');

    await expect(hamburger).toBeHidden();
    await expect(navMenu).toBeVisible();
    await expect(navLinks).toHaveCount(9);

    for (const link of await navLinks.all()) {
      await expect(link).toBeVisible();
    }

    const linkRows = await navLinks.evaluateAll((links) => links.map((link) => {
      const rectangle = link.getBoundingClientRect();
      return {
        top: Math.round(rectangle.top),
        centerY: Math.round(rectangle.top + rectangle.height / 2),
      };
    }));

    expect(new Set(linkRows.map((position) => position.centerY)).size).toBe(1);

    await page.setViewportSize({ width: 1100, height: 900 });

    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(navMenu).toBeHidden();
    await expect(navLinks.first()).toBeHidden();
  });

  test('publieke en ledenpagina’s hebben geen horizontale overflow op desktop, tablet en mobiel', async ({ page }) => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 820, height: 1180 },
      { width: 390, height: 844 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      for (const route of publicRoutes) {
        await page.goto(route);
        await waitForSharedLayout(page);

        const layout = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        }));

        expect(
          layout.documentWidth,
          `${route} heeft horizontale overflow bij ${viewport.width}px`,
        ).toBeLessThanOrEqual(layout.viewportWidth + 1);
      }
    }
  });
});

test.describe('Homepage Sanity-content en fallback', () => {
  const sanityQueryUrl = '**/data/query/development**';

  test('homepage toont statische fallback als Sanity niet bereikbaar is', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');
    await waitForSharedLayout(page);

    await expect(page.locator('[data-homepage-hero-title]')).toContainText('Zanggroep Spontaan');
    await expect(page.locator('[data-homepage-hero-subtitle]')).toContainText('Samen zingen, samen beleven');
    await expect(page.locator('[data-homepage-welcome-title]')).toContainText('Samen zingen met plezier');
    await expect(page.locator('[data-homepage-welcome-text]')).toContainText('Zanggroep Spontaan is een enthousiast mannenkoor uit Angerlo.');
    await expect(page.locator('[data-homepage-cta-container]')).toBeHidden();
  });

  test('homepage toont volledige Sanity-content als Sanity geldige content levert', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            heroTitle: 'Sanity hero titel',
            heroSubtitle: 'Sanity hero subtitel',
            heroImageUrl: 'https://cdn.sanity.io/images/u66p1mxm/development/hero-test.jpg',
            ctaLabel: 'Bekijk nieuws',
            ctaLink: '/pages/nieuws.html',
            quickLinksTitle: 'Sanity snel naar',
            quickLinksIntro: 'Sanity introductie voor de routekaarten.',
            quickLinks: [
              {
                title: 'Sanity nieuws',
                text: 'Lees de nieuwste berichten.',
                imageUrl: 'https://cdn.sanity.io/images/u66p1mxm/development/nieuws-test.jpg',
                imageAlt: 'Nieuwsafbeelding',
                buttonLabel: 'Lees verder',
                buttonLink: '/pages/nieuws.html',
              },
              {
                title: 'Sanity agenda',
                text: 'Bekijk onze activiteiten.',
                imageUrl: null,
                imageAlt: '',
                buttonLabel: 'Bekijk agenda',
                buttonLink: '/pages/agenda.html',
              },
            ],
            welcomeTitle: 'Sanity welkom titel',
            welcomeText: 'Sanity welkom tekst voor de homepage.',
            welcomeButtonLabel: 'Over Spontaan',
            welcomeButtonLink: '/pages/over.html',
            visitTitle: 'Sanity bezoek titel',
            visitText: 'Sanity uitnodiging om kennis te maken.',
            visitPrimaryButtonLabel: 'Neem contact op',
            visitPrimaryButtonLink: '/pages/contact.html',
            visitSecondaryButtonLabel: 'Bekijk agenda',
            visitSecondaryButtonLink: '/pages/agenda.html',
          },
        }),
      });
    });

    await page.goto('/');
    await waitForSharedLayout(page);

    await expect(page.locator('[data-homepage-hero-title]')).toContainText('Sanity hero titel');
    await expect(page.locator('[data-homepage-hero-subtitle]')).toContainText('Sanity hero subtitel');
    await expect(page.locator('.hero')).toHaveAttribute(
      'style',
      /https:\/\/cdn\.sanity\.io\/images\/u66p1mxm\/development\/hero-test\.jpg/,
    );

    const heroCta = page.locator('[data-homepage-cta-container] a');
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveText('Bekijk nieuws');
    await expect(heroCta).toHaveAttribute('href', '/pages/nieuws.html');

    await expect(page.locator('[data-homepage-quicklinks-title]')).toContainText('Sanity snel naar');
    await expect(page.locator('[data-homepage-quicklinks-intro]')).toContainText(
      'Sanity introductie voor de routekaarten.',
    );

    const quickLinks = page.locator('[data-homepage-quicklinks] .homepage-card');
    await expect(quickLinks).toHaveCount(2);
    await expect(quickLinks.nth(0).locator('h3')).toHaveText('Sanity nieuws');
    await expect(quickLinks.nth(0).locator('a')).toHaveAttribute('href', '/pages/nieuws.html');
    await expect(quickLinks.nth(1).locator('h3')).toHaveText('Sanity agenda');

    await expect(page.locator('[data-homepage-welcome-title]')).toContainText('Sanity welkom titel');
    await expect(page.locator('[data-homepage-welcome-text]')).toContainText(
      'Sanity welkom tekst voor de homepage.',
    );
    await expect(page.locator('[data-homepage-welcome-cta] a')).toHaveAttribute(
      'href',
      '/pages/over.html',
    );

    await expect(page.locator('[data-homepage-visit-title]')).toContainText('Sanity bezoek titel');
    await expect(page.locator('[data-homepage-visit-text]')).toContainText(
      'Sanity uitnodiging om kennis te maken.',
    );

    const visitButtons = page.locator('[data-homepage-visit-cta] a');
    await expect(visitButtons).toHaveCount(2);
    await expect(visitButtons.nth(0)).toHaveAttribute('href', '/pages/contact.html');
    await expect(visitButtons.nth(1)).toHaveAttribute('href', '/pages/agenda.html');
    await expect(visitButtons.nth(1)).toHaveClass(/btn--secondary/);
  });

  test('homepage behoudt statische snel-naar-kaarten bij ongeldige Sanity-kaarten', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            quickLinksTitle: 'Sanity snel naar',
            quickLinksIntro: 'Deze teksten zijn wel geldig.',
            quickLinks: [
              {
                title: 'Onvolledige kaart',
                text: '',
                buttonLabel: 'Open kaart',
                buttonLink: 'javascript:alert("xss")',
              },
            ],
          },
        }),
      });
    });

    await page.goto('/');
    await waitForSharedLayout(page);

    await expect(page.locator('[data-homepage-quicklinks-title]')).toContainText(
      'Sanity snel naar',
    );
    await expect(page.locator('[data-homepage-quicklinks-intro]')).toContainText(
      'Deze teksten zijn wel geldig.',
    );

    const quickLinks = page.locator('[data-homepage-quicklinks] .homepage-card');
    await expect(quickLinks).toHaveCount(3);
    await expect(quickLinks.nth(0).locator('h3')).toHaveText('Nieuws');
    await expect(quickLinks.nth(1).locator('h3')).toHaveText('Agenda');
    await expect(quickLinks.nth(2).locator('h3')).toHaveText('Media');
  });

  test('homepage verbergt CTA bij onveilige Sanity-link', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            heroTitle: 'Sanity titel met onveilige link',
            heroSubtitle: 'Sanity subtitel',
            welcomeTitle: 'Sanity welkom',
            welcomeText: 'Sanity tekst.',
            ctaLabel: 'Onveilige knop',
            ctaLink: 'javascript:alert("xss")',
          },
        }),
      });
    });

    await page.goto('/');
    await waitForSharedLayout(page);

    await expect(page.locator('[data-homepage-hero-title]')).toContainText('Sanity titel met onveilige link');
    await expect(page.locator('[data-homepage-cta-container]')).toBeHidden();
    await expect(page.locator('[data-homepage-cta-container] a')).toHaveCount(0);
  });
});
test.describe('Nieuwsoverzicht en nieuwsdetail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/nieuws.html');
    await waitForSharedLayout(page);
  });

  test('toont zes nieuwskaarten met afzonderlijke afbeeldingen', async ({ page }) => {
    const cards = page.locator('.news-card:not([hidden])');
    const images = cards.locator('.news-card__image img');

    await expect(cards).toHaveCount(6);
    await expect(page.locator('.news-result-summary p')).toHaveText(
      '6 nieuwsberichten gevonden',
    );
    await expect(page.locator('.news-pagination')).toBeHidden();

    const imageSources = await images.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLImageElement).src),
    );

    expect(new Set(imageSources).size).toBe(6);
    expect(imageSources.every((source) => source.includes('/images/news/'))).toBe(true);
  });

  test('zoeken beperkt het overzicht tot passende nieuwsberichten', async ({ page }) => {
    await page.locator('#news-search-input').fill('repertoire');

    const visibleCards = page.locator('.news-card:not([hidden])');

    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.locator('h2')).toHaveText(
      'Een kijkje in het repertoire van Spontaan',
    );
    await expect(page.locator('.news-result-summary p')).toHaveText(
      '1 nieuwsbericht gevonden',
    );
  });

  test('categoriefilter toont uitsluitend berichten uit de gekozen categorie', async ({ page }) => {
    const optredensButton = page.getByRole('button', { name: 'Optredens' });

    await optredensButton.click();

    await expect(optredensButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Alles' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    const visibleCards = page.locator('.news-card:not([hidden])');

    await expect(visibleCards).toHaveCount(2);
    await expect(visibleCards.locator('.news-card__category')).toHaveText([
      'Optredens',
      'Optredens',
    ]);
  });

  test('sorteren op oudste plaatst het oudste nieuwsbericht vooraan', async ({ page }) => {
    await page.locator('#news-sort-select').selectOption('oldest');

    const firstVisibleCard = page.locator('.news-card:not([hidden])').first();

    await expect(firstVisibleCard.locator('time')).toHaveAttribute(
      'datetime',
      '2026-05-10',
    );
    await expect(firstVisibleCard.locator('h2')).toHaveText(
      'Een kijkje in het repertoire van Spontaan',
    );
  });

  test('detailnavigatie toont het gekozen bericht met de juiste afbeelding', async ({ page }) => {
    await page
      .getByRole('link', { name: 'Lees meer over nieuwe leden bij Spontaan' })
      .click();

    await expect(page).toHaveURL(
      /nieuwsbericht\.html\?slug=nieuwe-stemmen-zijn-van-harte-welkom$/,
    );
    await waitForSharedLayout(page);

    await expect(page.locator('[data-news-detail-title]')).toHaveText(
      'Nieuwe stemmen zijn van harte welkom',
    );
    await expect(page.locator('[data-news-detail-image]')).toHaveAttribute(
      'src',
      '../images/news/nieuws-nieuwe-stemmen.webp',
    );
  });

  test('onbekende en geërfde slugs worden veilig als niet gevonden behandeld', async ({ page }) => {
    await page.goto('/pages/nieuwsbericht.html?slug=__proto__');
    await waitForSharedLayout(page);

    await expect(page.locator('[data-news-detail-title]')).toHaveText(
      'Nieuwsbericht niet gevonden',
    );
    await expect(page.locator('.news-detail__media')).toBeHidden();
    await expect(page.locator('[data-news-detail-body]')).toContainText(
      'Ga terug naar het nieuwsoverzicht',
    );
  });
});
test.describe('Nieuws Sanity-content en fallback', () => {
  const sanityQueryUrl = '**/data/query/development**';

  test('nieuwsoverzicht toont geldige Sanity-berichten', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: [
            {
              title: 'Sanity nieuwsbericht',
              slug: 'sanity-nieuwsbericht',
              publishedAt: '2026-07-12T10:00:00.000Z',
              category: 'vereniging',
              summary: 'Dit bericht komt rechtstreeks uit Sanity.',
              mainImageAlt: 'Zangers tijdens een repetitie',
              imageUrl:
                'https://cdn.sanity.io/images/u66p1mxm/development/news-test.jpg',
            },
          ],
        }),
      });
    });

    await page.goto('/pages/nieuws.html');
    await waitForSharedLayout(page);

    const cards = page.locator('.news-card:not([hidden])');

    await expect(cards).toHaveCount(1);
    await expect(cards.locator('h2')).toHaveText('Sanity nieuwsbericht');
    await expect(cards.locator('.news-card__category')).toHaveText(
      'Vereniging',
    );
    await expect(cards.locator('img')).toHaveAttribute(
      'src',
      'https://cdn.sanity.io/images/u66p1mxm/development/news-test.jpg',
    );
    await expect(cards.locator('a')).toHaveAttribute(
      'href',
      './nieuwsbericht.html?slug=sanity-nieuwsbericht',
    );
  });

  test('nieuwsoverzicht behoudt statische fallback bij mislukte Sanity-request', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.abort('failed');
    });

    await page.goto('/pages/nieuws.html');
    await waitForSharedLayout(page);

    await expect(page.locator('.news-card:not([hidden])')).toHaveCount(6);
    await expect(page.locator('.news-result-summary p')).toHaveText(
      '6 nieuwsberichten gevonden',
    );
  });

  test('nieuwsdetail toont geldige Sanity-content', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            title: 'Sanity detailbericht',
            slug: 'sanity-detailbericht',
            publishedAt: '2026-07-11T12:00:00.000Z',
            category: 'media',
            summary: 'Dit is de Sanity-samenvatting.',
            mainImageAlt: 'Microfoon tijdens een optreden',
            imageUrl:
              'https://cdn.sanity.io/images/u66p1mxm/development/detail-test.jpg',
            body: [
              {
                _type: 'block',
                children: [
                  {
                    _type: 'span',
                    text: 'Eerste alinea uit Sanity.',
                  },
                ],
              },
              {
                _type: 'block',
                children: [
                  {
                    _type: 'span',
                    text: 'Tweede alinea uit Sanity.',
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    await page.goto(
      '/pages/nieuwsbericht.html?slug=sanity-detailbericht',
    );
    await waitForSharedLayout(page);

    await expect(page.locator('[data-news-detail-title]')).toHaveText(
      'Sanity detailbericht',
    );
    await expect(page.locator('[data-news-detail-category]').first()).toHaveText(
      'Media',
    );
    await expect(page.locator('[data-news-detail-summary]')).toHaveText(
      'Dit is de Sanity-samenvatting.',
    );
    await expect(page.locator('[data-news-detail-image]')).toHaveAttribute(
      'src',
      'https://cdn.sanity.io/images/u66p1mxm/development/detail-test.jpg',
    );
    await expect(page.locator('[data-news-detail-body] p')).toHaveText([
      'Eerste alinea uit Sanity.',
      'Tweede alinea uit Sanity.',
    ]);
  });

  test('nieuwsdetail gebruikt statische fallback bij mislukte Sanity-request', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.abort('failed');
    });

    await page.goto(
      '/pages/nieuwsbericht.html?slug=nieuwe-stemmen-zijn-van-harte-welkom',
    );
    await waitForSharedLayout(page);

    await expect(page.locator('[data-news-detail-title]')).toHaveText(
      'Nieuwe stemmen zijn van harte welkom',
    );
    await expect(page.locator('[data-news-detail-image]')).toHaveAttribute(
      'src',
      '../images/news/nieuws-nieuwe-stemmen.webp',
    );
  });
});
test.describe('Nieuwsoverzicht unhappy flows', () => {
  const sanityQueryUrl = '**/data/query/development**';

  test('zoeken zonder resultaat toont een duidelijke gebruikersmelding', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.abort('failed');
    });

    await page.goto('/pages/nieuws.html');
    await waitForSharedLayout(page);

    const searchInput = page.locator('#news-search-input');
    await searchInput.fill('niet-bestaand-bericht-12345');

    await expect(page.locator('.news-card:not([hidden])')).toHaveCount(0);
    await expect(page.locator('.news-result-summary p')).toHaveText(
      '0 nieuwsberichten gevonden',
    );
    await expect(page.locator('.news-pagination')).toBeHidden();
    await expect(searchInput).toBeEditable();
  });

  test('HTTP 500 van Sanity behoudt een bruikbaar nieuwsoverzicht zonder technische fouttekst', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
        }),
      });
    });

    await page.goto('/pages/nieuws.html');
    await waitForSharedLayout(page);

    await expect(page.locator('.news-card:not([hidden])')).toHaveCount(6);
    await expect(page.locator('.news-result-summary p')).toHaveText(
      '6 nieuwsberichten gevonden',
    );

    await page.locator('#news-search-input').fill('repertoire');
    await expect(page.locator('.news-card:not([hidden])')).toHaveCount(1);

    const visibleText = await page.locator('body').innerText();
    expect(visibleText).not.toContain('Sanity request failed');
    expect(visibleText).not.toContain('Internal server error');
    expect(visibleText).not.toContain('status 500');
  });

  test('ongeldige JSON van Sanity toont de statische fallback zonder technische details', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{ ongeldige-json',
      });
    });

    await page.goto('/pages/nieuws.html');
    await waitForSharedLayout(page);

    await expect(page.locator('.news-card:not([hidden])')).toHaveCount(6);
    await expect(page.locator('.news-result-summary p')).toHaveText(
      '6 nieuwsberichten gevonden',
    );

    const visibleText = await page.locator('body').innerText();
    expect(visibleText).not.toContain('SyntaxError');
    expect(visibleText).not.toContain('Unexpected token');
    expect(visibleText).not.toContain('ongeldige-json');
  });

  test('ongeldig bericht tussen geldige Sanity-data wordt veilig overgeslagen', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: [
            {
              title: 'Geldig Sanity-bericht',
              slug: 'geldig-sanity-bericht',
              publishedAt: '2026-07-12T10:00:00.000Z',
              category: 'optredens',
              summary: 'Dit geldige bericht moet zichtbaar blijven.',
              mainImageAlt: 'Zanggroep tijdens een optreden',
              imageUrl:
                'https://cdn.sanity.io/images/u66p1mxm/development/geldig.jpg',
            },
            {
              title: 'Ongeldig Sanity-bericht',
              slug: 'ongeldig-sanity-bericht',
              publishedAt: 'geen-geldige-datum',
              category: 'media',
              summary: '',
              mainImageAlt: '',
              imageUrl: 'javascript:alert("xss")',
            },
          ],
        }),
      });
    });

    await page.goto('/pages/nieuws.html');
    await waitForSharedLayout(page);

    const cards = page.locator('.news-card:not([hidden])');

    await expect(cards).toHaveCount(1);
    await expect(cards.locator('h2')).toHaveText('Geldig Sanity-bericht');
    await expect(page.locator('.news-result-summary p')).toHaveText(
      '1 nieuwsbericht gevonden',
    );
    await expect(page.getByText('Ongeldig Sanity-bericht')).toHaveCount(0);
  });
});
test.describe('Nieuwsdetail unhappy flows', () => {
  const sanityQueryUrl = '**/data/query/development**';

  test('ontbrekende slug toont een duidelijke melding en terugmogelijkheid', async ({ page }) => {
    await page.goto('/pages/nieuwsbericht.html');
    await waitForSharedLayout(page);

    await expect(page.locator('[data-news-detail-title]')).toHaveText(
      'Nieuwsbericht niet gevonden',
    );
    await expect(page.locator('[data-news-detail-summary]')).toHaveText(
      'Het opgevraagde nieuwsbericht bestaat niet of is niet meer beschikbaar.',
    );
    await expect(page.locator('[data-news-detail-body]')).toContainText(
      'Ga terug naar het nieuwsoverzicht',
    );
    await expect(
      page.getByRole('link', { name: 'Terug naar al het nieuws' }),
    ).toBeVisible();
    await expect(page.locator('.news-detail__media')).toBeHidden();
  });

  test('HTTP 500 bij onbekende slug toont geen technische details', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
        }),
      });
    });

    await page.goto(
      '/pages/nieuwsbericht.html?slug=volledig-onbekend-bericht',
    );
    await waitForSharedLayout(page);

    await expect(page.locator('[data-news-detail-title]')).toHaveText(
      'Nieuwsbericht niet gevonden',
    );
    await expect(page.locator('[data-news-detail-body]')).toContainText(
      'Ga terug naar het nieuwsoverzicht',
    );

    const visibleText = await page.locator('body').innerText();
    expect(visibleText).not.toContain('Sanity request failed');
    expect(visibleText).not.toContain('Internal server error');
    expect(visibleText).not.toContain('status 500');
  });

  test('ongeldige JSON op detailpagina leidt tot veilige fallback', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{ ongeldige-json',
      });
    });

    await page.goto(
      '/pages/nieuwsbericht.html?slug=nieuwe-stemmen-zijn-van-harte-welkom',
    );
    await waitForSharedLayout(page);

    await expect(page.locator('[data-news-detail-title]')).toHaveText(
      'Nieuwe stemmen zijn van harte welkom',
    );
    await expect(page.locator('[data-news-detail-body] p')).toHaveCount(3);

    const visibleText = await page.locator('body').innerText();
    expect(visibleText).not.toContain('SyntaxError');
    expect(visibleText).not.toContain('Unexpected token');
    expect(visibleText).not.toContain('ongeldige-json');
  });

  test('ongeldig Sanity-detail met lege body wordt niet getoond', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            title: 'Onvolledig Sanity-detail',
            slug: 'onvolledig-sanity-detail',
            publishedAt: '2026-07-12T10:00:00.000Z',
            category: 'media',
            summary: 'Deze inhoud is technisch onvolledig.',
            mainImageAlt: 'Testafbeelding',
            imageUrl:
              'https://cdn.sanity.io/images/u66p1mxm/development/onvolledig.jpg',
            body: [],
          },
        }),
      });
    });

    await page.goto(
      '/pages/nieuwsbericht.html?slug=onvolledig-sanity-detail',
    );
    await waitForSharedLayout(page);

    await expect(page.locator('[data-news-detail-title]')).toHaveText(
      'Nieuwsbericht niet gevonden',
    );
    await expect(page.locator('[data-news-detail-body]')).toContainText(
      'Ga terug naar het nieuwsoverzicht',
    );
    await expect(page.getByText('Onvolledig Sanity-detail')).toHaveCount(0);
    await expect(page.locator('.news-detail__media')).toBeHidden();
  });
});

test.describe('Over Spontaan pagina', () => {
  test('toont de vastgestelde inhoud en geladen afbeeldingen', async ({ page }) => {
    await page.goto('/pages/over.html');
    await waitForSharedLayout(page);

    await expect(page.locator('.about-hero h1')).toHaveText('Over Spontaan');
    await expect(page.getByRole('heading', { name: 'Samen groeien in muziek' })).toBeVisible();

    const timelineHeadings = page.locator('.about-timeline h3');
    await expect(timelineHeadings).toHaveText([
      'Het begin',
      'Ontwikkeling',
      'Vandaag',
      'Vooruitkijken',
    ]);

    await expect(page.locator('.about-quote')).toContainText(
      'Samen zingen geeft energie, verbinding en veel mooie momenten.',
    );

    await expect(page.getByRole('heading', { name: 'Maak kennis met Spontaan' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Neem contact op' })).toHaveAttribute(
      'href',
      './contact.html',
    );

    const contentImages = page.locator('.about-media img');
    await expect(contentImages).toHaveCount(2);

    for (const image of await contentImages.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();

      await expect.poll(
        async () => image.evaluate((element: HTMLImageElement) => (
          element.complete &&
          element.naturalWidth > 0 &&
          element.naturalHeight > 0
        )),
        {
          message: 'De afbeelding moet volledig geladen zijn',
          timeout: 10_000,
        },
      ).toBe(true);
    }

    const heroImage = await page.locator('.about-hero').evaluate((element) => (
      getComputedStyle(element).backgroundImage
    ));

    expect(heroImage).toContain('over-hero-mannenkoor.jpg');
  });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobiel', width: 390, height: 844 },
  ]) {
    test(`heeft geen horizontale overflow op ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await page.goto('/pages/over.html');
      await waitForSharedLayout(page);

      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    });
  }
});

test.describe('Agenda pagina', () => {
  test('toont demoactiviteiten, mannenkoor-hero en werkende filters', async ({ page }) => {
    await page.goto('/pages/agenda.html?demo=1');
    await waitForSharedLayout(page);

    await expect(page.locator('.agenda-hero h1')).toHaveText('Agenda');

    const heroImage = await page.locator('.agenda-hero').evaluate((element) => (
      getComputedStyle(element).backgroundImage
    ));

    expect(heroImage).toContain('over-hero-mannenkoor.jpg');

    const cards = page.locator('.agenda-event-card');
    await expect(cards).toHaveCount(5);

    await expect(page.getByText('Zomeravondconcert')).toBeVisible();
    await expect(page.getByText('Open repetitieavond')).toBeVisible();
    await expect(page.getByText('Najaarsconcert')).toBeVisible();
    await expect(page.locator('[data-agenda-result-summary]')).toHaveText(
      '5 activiteiten gevonden',
    );

    await page.locator('[data-agenda-type-filter]').selectOption('concert');

    await expect(cards).toHaveCount(2);
    await expect(page.getByText('Zomeravondconcert')).toBeVisible();
    await expect(page.getByText('Najaarsconcert')).toBeVisible();
    await expect(page.getByText('Open repetitieavond')).toHaveCount(0);

    await page.locator('[data-agenda-location-filter]').selectOption('angerlo');

    await expect(cards).toHaveCount(1);
    await expect(page.getByText('Zomeravondconcert')).toBeVisible();
    await expect(page.locator('[data-agenda-result-summary]')).toHaveText(
      '1 activiteit gevonden',
    );

    await page.locator('[data-agenda-reset-filters]').click();

    await expect(cards).toHaveCount(5);
    await expect(page.locator('[data-agenda-type-filter]')).toHaveValue('alles');
    await expect(page.locator('[data-agenda-location-filter]')).toHaveValue('alles');
    await expect(page.locator('[data-agenda-month-filter]')).toHaveValue('alles');
  });

  test('kalender navigeert en filtert op een evenementdag', async ({ page }) => {
    await page.goto('/pages/agenda.html?demo=1');
    await waitForSharedLayout(page);

    const calendarTitle = page.locator('[data-agenda-calendar-title]');
    await expect(calendarTitle).toContainText(/augustus 2026/i);

    const eventDay = page.getByRole('button', {
      name: /bekijk activiteiten op 22 augustus 2026/i,
    });

    await expect(eventDay).toBeVisible();
    await eventDay.click();

    await expect(page.locator('.agenda-event-card')).toHaveCount(1);
    await expect(page.getByText('Zomeravondconcert')).toBeVisible();
    await expect(eventDay).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-agenda-clear-date]')).toBeVisible();

    await page.locator('[data-agenda-clear-date]').click();

    await expect(page.locator('.agenda-event-card')).toHaveCount(5);
    await expect(page.locator('[data-agenda-clear-date]')).toBeHidden();

    await page.locator('[data-agenda-next-month]').click();
    await expect(calendarTitle).toContainText(/september 2026/i);

    await page.locator('[data-agenda-previous-month]').click();
    await expect(calendarTitle).toContainText(/augustus 2026/i);
  });

  test('gecombineerde filters tonen een toegankelijke lege status', async ({ page }) => {
    await page.goto('/pages/agenda.html?demo=1');
    await waitForSharedLayout(page);

    await page.locator('[data-agenda-type-filter]').selectOption('concert');
    await page.locator('[data-agenda-location-filter]').selectOption('doetinchem');

    await expect(page.locator('.agenda-event-card')).toHaveCount(0);
    await expect(page.locator('[data-agenda-empty-state]')).toContainText(
      'Geen activiteiten gevonden',
    );
    await expect(page.locator('[data-agenda-result-summary]')).toHaveText(
      'Geen activiteiten gevonden',
    );

    await page.locator('[data-agenda-reset-filters]').click();
    await expect(page.locator('.agenda-event-card')).toHaveCount(5);
  });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobiel', width: 390, height: 844 },
  ]) {
    test(`heeft geen horizontale overflow op ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await page.goto('/pages/agenda.html?demo=1');
      await waitForSharedLayout(page);

      await expect(page.locator('.agenda-event-card').first()).toBeVisible();

      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    });
  }
});

test.describe('Agenda pagina unhappy flows', () => {
  const sanityAgendaUrl = '**/data/query/development?query=*';

  test('toont een eerlijke lege status bij een lege Sanity-dataset', async ({ page }) => {
    await page.route(sanityAgendaUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: [],
        }),
      });
    });

    await page.goto('/pages/agenda.html');
    await waitForSharedLayout(page);

    await expect(page.locator('.agenda-event-card')).toHaveCount(0);
    await expect(page.locator('[data-agenda-empty-state]')).toContainText(
      'Er staan momenteel geen openbare optredens gepland',
    );
    await expect(page.locator('[data-agenda-status]')).toBeHidden();
    await expect(page.locator('[data-agenda-result-summary]')).toHaveText(
      'Er staan momenteel geen openbare activiteiten gepland.',
    );
  });

  test('toont zichtbaar gebruikersbericht bij een mislukte Sanity-request', async ({ page }) => {
    await page.route(sanityAgendaUrl, async (route) => {
      await route.abort('failed');
    });

    await page.goto('/pages/agenda.html');
    await waitForSharedLayout(page);

    await expect(page.locator('[data-agenda-status]')).toBeVisible();
    await expect(page.locator('[data-agenda-status]')).toContainText(
      'De actuele agenda kon niet worden geladen',
    );

    await expect(page.locator('.agenda-event-card')).toHaveCount(0);
    await expect(page.locator('[data-agenda-empty-state]')).toContainText(
      'Er staan momenteel geen openbare optredens gepland',
    );
  });

  test('negeert ongeldige en onvolledige Sanity-records veilig', async ({ page }) => {
    await page.route(sanityAgendaUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: [
            {
              title: 'Geldig voorbeeldoptreden',
              startAt: '2026-09-19T19:30:00+02:00',
              endAt: '2026-09-19T21:30:00+02:00',
              eventType: 'optreden',
              locationName: 'Dorpshuis',
              city: 'Angerlo',
              summary: 'Een geldig openbaar optreden.',
              buttonLabel: 'Meer informatie',
              buttonLink: './contact.html',
              isFree: true,
              isFeatured: false,
              mainImageAlt: '',
              imageUrl: '',
            },
            {
              title: 'Ontbrekende locatie',
              startAt: '2026-09-20T19:30:00+02:00',
              endAt: '2026-09-20T21:30:00+02:00',
              eventType: 'concert',
              locationName: '',
              city: '',
              summary: 'Dit record is onvolledig.',
            },
            {
              title: 'Ongeldige eindtijd',
              startAt: '2026-09-21T21:30:00+02:00',
              endAt: '2026-09-21T19:30:00+02:00',
              eventType: 'optreden',
              locationName: 'Testzaal',
              city: 'Angerlo',
              summary: 'De eindtijd ligt voor de starttijd.',
            },
            {
              title: 'Afbeelding zonder alt-tekst',
              startAt: '2026-09-22T19:30:00+02:00',
              endAt: '2026-09-22T21:30:00+02:00',
              eventType: 'optreden',
              locationName: 'Testzaal',
              city: 'Angerlo',
              summary: 'Afbeelding is niet toegankelijk beschreven.',
              mainImageAlt: '',
              imageUrl:
                'https://cdn.sanity.io/images/u66p1mxm/development/test.jpg',
            },
          ],
        }),
      });
    });

    await page.goto('/pages/agenda.html');
    await waitForSharedLayout(page);

    await expect(page.locator('.agenda-event-card')).toHaveCount(1);
    await expect(page.getByText('Geldig voorbeeldoptreden')).toBeVisible();

    await expect(page.getByText('Ontbrekende locatie')).toHaveCount(0);
    await expect(page.getByText('Ongeldige eindtijd')).toHaveCount(0);
    await expect(page.getByText('Afbeelding zonder alt-tekst')).toHaveCount(0);

    await expect(page.locator('[data-agenda-status]')).toBeHidden();
    await expect(page.locator('[data-agenda-result-summary]')).toHaveText(
      '1 activiteit gevonden',
    );
  });
});
