import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('WCAG scan voor alle pagina’s', async ({ page }) => {

  await page.goto('/');

  const links = await page.$$eval('a', anchors =>
    anchors.map(a => a.getAttribute('href'))
  );

  const pages = links
    .filter(link => link && link.endsWith('.html'))
    .filter(link => !link.includes('login'));

  const uniquePages = [...new Set(pages)];

  console.log("Pagina's gevonden:", uniquePages);

  let totalViolations = 0;

  for (const url of uniquePages) {

    await page.goto(url);

    const results = await new AxeBuilder({ page }).analyze();

    console.log(`WCAG check voor ${url}`);
    console.log(results.violations);

    totalViolations += results.violations.length;

  }

  console.log("Totaal aantal WCAG violations:", totalViolations);

  // Pipeline faalt pas bij veel fouten
  expect(totalViolations).toBeLessThan(100);

});