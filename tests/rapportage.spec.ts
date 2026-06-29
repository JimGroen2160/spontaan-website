import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL;
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Missing required environment variables: TEST_ADMIN_EMAIL and/or TEST_ADMIN_PASSWORD');
}
if (!MEMBER_EMAIL || !MEMBER_PASSWORD) {
  throw new Error('Missing required environment variables: TEST_MEMBER_EMAIL and/or TEST_MEMBER_PASSWORD');
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/leden/login.html');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd', { timeout: 15000 });
}

async function openReportAsAdmin(page: Page): Promise<void> {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin/index.html');
  await expect(page.locator('#ledenbeheer')).toBeVisible({ timeout: 15000 });
  const reportLink = page.locator('#rapportage-link');
  await expect(reportLink).toHaveAttribute('href', './rapportage.html');
  await reportLink.click();
  await expect(page).toHaveURL(/admin\/rapportage\.html/);
  await expect(page.locator('#rapportage-content')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#rapportage-status-title')).not.toContainText('wordt geladen', { timeout: 15000 });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
}

test.describe('Rapportagepagina voor contentmanagers', () => {
  test('bezoeker zonder login wordt naar de loginpagina gestuurd', async ({ page }) => {
    await page.goto('/admin/rapportage.html');
    await expect(page).toHaveURL(/leden\/login\.html/, { timeout: 15000 });
  });

  test('ingelogde gewone member heeft geen toegang', async ({ page }) => {
    await login(page, MEMBER_EMAIL!, MEMBER_PASSWORD!);
    await page.goto('/admin/rapportage.html');
    await expect(page).toHaveURL(/leden\/login\.html/, { timeout: 15000 });
  });

  test('admin opent de rapportage vanuit de beheeromgeving', async ({ page }) => {
    await openReportAsAdmin(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Websiteprestaties' })).toBeVisible();
    await expect(page.locator('.rapportage-beheerzijbalk')).toBeVisible();
    await expect(page.locator('.rapportage-beheermenu a[aria-current="page"]')).toHaveText(/Websiteprestaties/);
    await expect(page.locator('.rapportage-demo-indicator')).toContainText('Demo-modus');
    await expect(page.locator('#nav-placeholder')).toHaveCount(0);
    await expect(page.locator('#footer-placeholder')).toHaveCount(0);
  });

  test('volledig dashboardcontract bevat alle unieke hoofdonderdelen', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openReportAsAdmin(page);

    const uniqueSelectors = [
      '.rapportage-top-grid', '#rapportage-algemene-status', '#rapportage-kpis',
      '#rapportage-begrippen', '#rapportage-bezoekers', '#rapportage-trends',
      '#rapportage-trend-samenvatting', '#rapportage-historie',
    ];
    for (const selector of uniqueSelectors) {
      await expect(page.locator(selector)).toHaveCount(1);
      await expect(page.locator(selector)).toBeVisible();
    }

    const duplicateIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicateIds).toEqual([]);
    await expectNoHorizontalOverflow(page);
  });

  test('desktop toont exact vijf KPI-kaarten in de afgesproken volgorde en op één rij', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openReportAsAdmin(page);

    const cards = page.locator('#rapportage-kpis > .rapportage-kpi-card');
    await expect(cards).toHaveCount(5);
    const order = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-kpi')));
    expect(order).toEqual(['visitors', 'performance', 'accessibility', 'bestPractices', 'seo']);

    const boxes = await cards.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top), left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width) };
    }));
    expect(Math.max(...boxes.map((box) => box.top)) - Math.min(...boxes.map((box) => box.top))).toBeLessThanOrEqual(2);
    expect(boxes.every((box) => box.width > 150)).toBe(true);
    expect(boxes[0].left).toBeLessThan(boxes[1].left);
    expect(boxes[3].left).toBeLessThan(boxes[4].left);
  });

  test('Beste praktijken is aantoonbaar aanwezig in kaart, aandacht, trend, samenvatting en historie', async ({ page }) => {
    await openReportAsAdmin(page);

    const card = page.locator('.rapportage-kpi-card[data-kpi="bestPractices"]');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Beste praktijken', exact: true })).toBeVisible();
    await expect(card.locator('[data-score]')).toHaveText('78');
    await expect(card).toHaveAttribute('data-status', 'attention');
    await expect(card.locator('[data-status]')).toHaveText('Onder streefwaarde (90)');

    const attention = page.locator('#rapportage-aandachtspunten-lijst li[data-attention-metric="bestPractices"]');
    await expect(attention).toHaveCount(1);
    await expect(attention).toContainText('Beste praktijken: score 78');
    await expect(attention).toContainText('verouderde code');

    await expect(page.locator('#rapportage-trendgrafiek [data-legend="bestPractices"]')).toContainText('Beste praktijken');
    await expect(page.locator('#rapportage-trendgrafiek [data-series="bestPractices"]')).toBeVisible();
    await expect(page.locator('#rapportage-trend-samenvatting')).toContainText('Beste praktijken blijft onder de streefwaarde van 90 (78)');

    const headers = page.locator('.rapportage-historietabel thead th');
    await expect(headers.nth(4)).toHaveText('Beste praktijken');
    const newestRow = page.locator('#rapportage-historie-body tr[data-period="2026-06"]');
    await expect(newestRow.locator('td').nth(3)).toHaveText('78');
  });

  test('status en aandachtspunten tonen alle verwachte oorzaken', async ({ page }) => {
    await openReportAsAdmin(page);
    await expect(page.locator('#rapportage-status-title')).toHaveText('Aandacht');
    const points = page.locator('#rapportage-aandachtspunten-lijst li');
    await expect(points).toHaveCount(4);
    await expect(points.nth(0)).toContainText('Snelheid: score 86');
    await expect(points.nth(1)).toContainText('Beste praktijken: score 78');
    await expect(points.nth(2)).toContainText('SEO: score 88');
    await expect(points.nth(3)).toContainText('Toegankelijkheid: in oktober 2025 ontbreekt een meting');
  });

  test('begrippenhulp bevat vier vetgedrukte begrippen zonder dubbele kaartbeschrijvingen', async ({ page }) => {
    await openReportAsAdmin(page);
    const details = page.locator('#rapportage-begrippen');
    await details.locator('summary').click();
    const terms = details.locator('dt');
    await expect(terms).toHaveCount(4);
    await expect(terms).toHaveText(['Snelheid', 'Toegankelijkheid', 'Beste praktijken', 'SEO']);
    for (let index = 0; index < 4; index += 1) {
      const weight = await terms.nth(index).evaluate((element) => Number.parseInt(getComputedStyle(element).fontWeight, 10));
      expect(weight).toBeGreaterThanOrEqual(700);
    }
    await expect(page.locator('.rapportage-scorekaart dd, .rapportage-scorekaart > p:not(.rapportage-kpi-waarde):not(.rapportage-kpi-status):not(.visually-hidden)')).toHaveCount(0);
    const hiddenComparison = page.locator('.rapportage-scorekaart [data-comparison]').first();
    const hiddenStyle = await hiddenComparison.evaluate((element) => ({
      position: getComputedStyle(element).position,
      width: getComputedStyle(element).width,
      height: getComputedStyle(element).height,
    }));
    expect(hiddenStyle).toEqual({ position: 'absolute', width: '1px', height: '1px' });
  });

  test('grafieken staan op desktop naast elkaar, passen binnen het scherm en bevatten alle gegevens', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openReportAsAdmin(page);
    const visitors = page.locator('#rapportage-bezoekers');
    const trends = page.locator('#rapportage-trends');
    const visitorBox = await visitors.boundingBox();
    const trendBox = await trends.boundingBox();
    expect(visitorBox).not.toBeNull();
    expect(trendBox).not.toBeNull();
    expect(Math.abs(visitorBox!.y - trendBox!.y)).toBeLessThanOrEqual(2);
    expect(visitorBox!.x + visitorBox!.width).toBeLessThanOrEqual(trendBox!.x + 2);
    expect(trendBox!.width).toBeGreaterThan(visitorBox!.width);
    await expect(page.locator('#rapportage-bezoekers-grafiek .rapportage-bezoekers-balk')).toHaveCount(12);
    await expect(page.locator('#rapportage-trendgrafiek [data-series]')).toHaveCount(4);
    await expect(page.locator('#rapportage-trendgrafiek [data-legend]')).toHaveCount(4);
    await expectNoHorizontalOverflow(page);
  });

  test('Wat valt op staat in de trendkaart en gebruikt twee kolommen met vijf observaties', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openReportAsAdmin(page);
    const summary = page.locator('#rapportage-trends #rapportage-trend-samenvatting');
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('heading', { name: 'Wat valt op?' })).toBeVisible();
    await expect(summary.locator('li')).toHaveCount(5);
    await expect(summary).toContainText('Beste praktijken');
    await expect(summary).toContainText('SEO');
    const columns = await summary.locator('ul').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(2);
  });

  test('historie heeft de juiste kolommen en alle geselecteerde perioden', async ({ page }) => {
    await openReportAsAdmin(page);
    const headers = await page.locator('.rapportage-historietabel thead th').allTextContents();
    expect(headers.map((text) => text.trim())).toEqual(['Maand', 'Bezoeken', 'Snelheid', 'Toegankelijkheid', 'Beste praktijken', 'SEO', 'Status']);
    await expect(page.locator('#rapportage-historie-body tr[data-period]')).toHaveCount(12);
    await expect(page.locator('#rapportage-historie-body tr[data-period="2026-06"]')).toContainText('1.647');
  });

  test('periodefilter werkt voor 12, 6, 3 en 1 maand en werkt alle onderdelen bij', async ({ page }) => {
    await openReportAsAdmin(page);
    const select = page.locator('#rapportage-periode');
    const scenarios = [
      { value: '12', count: 12 },
      { value: '6', count: 6 },
      { value: '3', count: 3 },
      { value: '1', count: 1 },
    ];
    for (const scenario of scenarios) {
      await select.selectOption(scenario.value);
      await expect(page.locator('#rapportage-bezoekers-grafiek .rapportage-bezoekers-balk')).toHaveCount(scenario.count);
      await expect(page.locator('#rapportage-historie-body tr[data-period]')).toHaveCount(scenario.count);
      await expect(page.locator('#rapportage-trendgrafiek')).toHaveAttribute('aria-label', `Lijngrafiek met vier kwaliteitsscores over ${scenario.count} perioden`);
      await expect(page.locator('.rapportage-kpi-card[data-kpi="bestPractices"] [data-score]')).toHaveText('78');
    }
  });

  test('mobiele weergave toont alle vijf KPI-kaarten en heeft geen horizontale pagina-overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReportAsAdmin(page);
    const cards = page.locator('#rapportage-kpis > .rapportage-kpi-card');
    await expect(cards).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) await expect(cards.nth(index)).toBeVisible();
    const cardColumns = await page.locator('#rapportage-kpis').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(cardColumns).toBe(1);
    const chartColumns = await page.locator('.rapportage-grafieken-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(chartColumns).toBe(1);
    await expectNoHorizontalOverflow(page);
  });

  test('pagina heeft logische kopstructuur en bedienbaar periodefilter', async ({ page }) => {
    await openReportAsAdmin(page);
    await expect(page.locator('h1')).toHaveCount(1);
    const select = page.locator('#rapportage-periode');
    await expect(select).toBeVisible();
    await expect(select).toBeEnabled();
    await select.focus();
    await expect(select).toBeFocused();
  });
});
