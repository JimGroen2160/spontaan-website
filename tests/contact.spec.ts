import {expect, test} from '@playwright/test';

test.describe('Contactpagina zonder formulier', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/pages/contact.html');
    await page.locator('#nav-placeholder .main-nav').waitFor();
    await page.locator('#footer-placeholder .site-footer').waitFor();
  });

  test('toont de volledige toegankelijke contactstructuur', async ({page}) => {
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Contact');
    await expect(page.getByRole('heading', {name: 'Hoe kunnen wij u helpen?'})).toBeVisible();
    await expect(page.locator('.contact-topic-card')).toHaveCount(4);
    await expect(page.locator('.contact-topic-card h3')).toHaveText([
      'Algemene vragen',
      'Boekingen',
      'Lid worden',
      'Repetitie bezoeken',
    ]);
    await expect(page.locator('.contact-direct')).toBeVisible();
    await expect(page.locator('.contact-faq')).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Kan ik vrijblijvend een repetitie bezoeken?'})).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('#formulier')).toHaveCount(0);
  });

  test('biedt geldige directe e-mail- en telefoonacties', async ({page}) => {
    const emailLinks = page.locator('.contact-hero a[href="mailto:spontaaninfo@gmail.com"], .contact-page a[href="mailto:spontaaninfo@gmail.com"]');
    const phoneLinks = page.locator('.contact-hero a[href="tel:+31600000000"], .contact-page a[href="tel:+31600000000"]');
    await expect(emailLinks.first()).toHaveText('Stuur een e-mail');
    await expect(emailLinks).toHaveCount(6);
    await expect(phoneLinks.first()).toHaveText('Bel ons');
    await expect(phoneLinks).toHaveCount(2);
    await expect(page.getByText('[DEMO] +31 6 0000 0000', {exact: true})).toBeVisible();
    await expect(page.getByText(/nog niet gepubliceerd/i)).toHaveCount(0);
  });

  test('gebruikt vaste beeldafmetingen en precies één gedeelde navigatie en footer', async ({page}) => {
    const hero = page.locator('[data-contact-hero-image]');
    const welcome = page.locator('[data-contact-welcome-image]');
    await expect(hero).toHaveAttribute('width', '1672');
    await expect(hero).toHaveAttribute('height', '941');
    await expect(hero).toHaveAttribute('loading', 'eager');
    await expect(hero).toHaveAttribute('fetchpriority', 'high');
    await expect(welcome).toHaveAttribute('width', '1672');
    await expect(welcome).toHaveAttribute('height', '941');
    await expect(welcome).toHaveAttribute('loading', 'lazy');
    await expect(page.locator('#nav-placeholder .main-nav')).toHaveCount(1);
    await expect(page.locator('#footer-placeholder .site-footer')).toHaveCount(1);
  });

  test('doet geen runtime-Sanity-fetch en laadt elk contactbeeld eenmaal', async ({page}) => {
    const sanityRequests: string[] = [];
    const contactImageRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('.api.sanity.io/')) sanityRequests.push(request.url());
      if (/over-(?:hero|intro)-mannenkoor\.jpg$/.test(request.url())) {
        contactImageRequests.push(request.url());
      }
    });
    await page.reload();
    await page.locator('[data-contact-hero-image]').waitFor();
    expect(sanityRequests).toEqual([]);
    expect(contactImageRequests).toHaveLength(2);
    expect(new Set(contactImageRequests).size).toBe(2);
  });

  test('toont een zichtbare toetsenbordfocus op contactlinks', async ({page}) => {
    const firstTopicLink = page.locator('.contact-topic-card__link').first();
    await firstTopicLink.focus();
    await expect(firstTopicLink).toBeFocused();
    const focus = await firstTopicLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
      };
    });
    expect(focus.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(3);
    expect(focus.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  for (const viewport of [
    {name: 'desktop', width: 1440, columns: 4},
    {name: 'tablet', width: 850, columns: 2},
    {name: 'mobiel', width: 390, columns: 1},
  ]) {
    test(`is overflowvrij en herschikt gecontroleerd op ${viewport.name}`, async ({page}) => {
      await page.setViewportSize({width: viewport.width, height: 900});
      await page.reload();
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);

      const columns = await page.locator('.contact-topic-grid').evaluate((element) => (
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      ));
      expect(columns).toBe(viewport.columns);

      const welcomeColumns = await page.locator('.contact-welcome').evaluate((element) => (
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      ));
      expect(welcomeColumns).toBe(viewport.width > 560 ? 2 : 1);

      const mainColumns = await page.locator('.contact-main').evaluate((element) => (
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      ));
      expect(mainColumns).toBe(viewport.width > 900 ? 2 : 1);

      const practicalColumns = await page.locator('.contact-practical__list').evaluate((element) => (
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      ));
      expect(practicalColumns).toBe(viewport.width > 900 ? 4 : viewport.width > 560 ? 2 : 1);
      await expect(page.locator('.contact-hero')).toBeVisible();
    });
  }
});
