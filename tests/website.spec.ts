import { test, expect, Page } from '@playwright/test';

const publicRoutes = [
  '/',
  '/pages/over.html',
  '/pages/agenda.html',
  '/pages/media.html',
  '/pages/repertoire.html',
  '/pages/nieuws.html',
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
    await expect(page.locator('.hero h1')).toContainText(/zangkoor spontaan/i);
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

    await expect(page.locator('[data-homepage-hero-title]')).toContainText('Zangkoor Spontaan');
    await expect(page.locator('[data-homepage-hero-subtitle]')).toContainText('Samen zingen, samen beleven');
    await expect(page.locator('[data-homepage-welcome-title]')).toContainText('Samen zingen met plezier');
    await expect(page.locator('[data-homepage-welcome-text]')).toContainText('Zangkoor Spontaan is een enthousiast koor uit Angerlo.');
    await expect(page.locator('[data-homepage-cta-container]')).toBeHidden();
  });

  test('homepage toont Sanity-content en veilige CTA als Sanity content levert', async ({ page }) => {
    await page.route(sanityQueryUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            heroTitle: 'Sanity hero titel',
            heroSubtitle: 'Sanity hero subtitel',
            welcomeTitle: 'Sanity welkom titel',
            welcomeText: 'Sanity welkom tekst voor de homepage.',
            ctaLabel: 'Bekijk nieuws',
            ctaLink: '/pages/nieuws.html',
          },
        }),
      });
    });

    await page.goto('/');
    await waitForSharedLayout(page);

    await expect(page.locator('[data-homepage-hero-title]')).toContainText('Sanity hero titel');
    await expect(page.locator('[data-homepage-hero-subtitle]')).toContainText('Sanity hero subtitel');
    await expect(page.locator('[data-homepage-welcome-title]')).toContainText('Sanity welkom titel');
    await expect(page.locator('[data-homepage-welcome-text]')).toContainText('Sanity welkom tekst voor de homepage.');

    const cta = page.locator('[data-homepage-cta-container] a');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText('Bekijk nieuws');
    await expect(cta).toHaveAttribute('href', '/pages/nieuws.html');
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
