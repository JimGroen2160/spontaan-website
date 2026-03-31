import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('WCAG scan voor alle pagina’s', async ({ page }) => {

  // Start op homepage (CI-proof)
  await page.goto('/');

  // Wacht op navigatie (component!)
  await page.waitForSelector('#nav a');

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

    await page.goto(url);

    // Wacht opnieuw op nav (BELANGRIJK!)
    await page.waitForSelector('#nav a');

    const results = await new AxeBuilder({ page }).analyze();

    console.log(`WCAG check voor ${url}`);
    console.log(results.violations);

    totalViolations += results.violations.length;
  }

  console.log("Totaal aantal WCAG violations:", totalViolations);

  if (totalViolations > 0) {
    console.warn("⚠️ Accessibility issues gevonden — verbetering nodig");
  }

  // Pipeline regel (bewust niet streng)
  expect(totalViolations).toBeLessThan(50);

});