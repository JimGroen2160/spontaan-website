import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('WCAG scan voor alle pagina’s', async ({ page }) => {

  // Start op homepage
  await page.goto('http://localhost:5500');

  // Alle links ophalen
  const links = await page.$$eval('a', anchors =>
    anchors.map(a => a.getAttribute('href'))
  );

  // Alleen relevante pagina's filteren
  const pages = links
    .filter(link => link && link.endsWith('.html'))
    .filter(link => !link.includes('login'));

  // Homepage altijd toevoegen
  pages.push('/');

  // Unieke lijst maken
  const uniquePages = [...new Set(pages)];

  // Fail-fast check
  if (uniquePages.length === 0) {
    throw new Error("Geen pagina's gevonden — test ongeldig");
  }

  console.log("Pagina's gevonden:", uniquePages);

  let totalViolations = 0;

  // Loop door alle pagina's
  for (const url of uniquePages) {

    const fullUrl = url.startsWith('http')
      ? url
      : `http://localhost:5500${url.startsWith('/') ? url : '/' + url}`;

    await page.goto(fullUrl);

    const results = await new AxeBuilder({ page }).analyze();

    console.log(`WCAG check voor ${fullUrl}`);
    console.log(results.violations);

    totalViolations += results.violations.length;
  }

  console.log("Totaal aantal WCAG violations:", totalViolations);

  if (totalViolations > 0) {
    console.log("⚠️ Accessibility issues gevonden — verbetering nodig");
  }

  // Pipeline regel (niet te streng)
  expect(totalViolations).toBeLessThan(50);

});