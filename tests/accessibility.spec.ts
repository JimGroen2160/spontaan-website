import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('WCAG scan per pagina (inzicht + controle)', async ({ page }) => {

  await page.goto('/');

  // wacht tot DOM stabiel is (betrouwbaarder dan networkidle)
  await page.waitForLoadState('domcontentloaded');

  const links = await page.$$eval('a', anchors =>
    anchors.map(a => a.getAttribute('href'))
  );

  const pages = links
    .filter(link => link && link.endsWith('.html'))
    .filter(link => !link.includes('login'));

  pages.push('/');

  const uniquePages = [...new Set(pages)];

  if (uniquePages.length === 0) {
    throw new Error("Geen pagina's gevonden — test ongeldig");
  }

  console.log("Pagina's:", uniquePages);

  let totalViolations = 0;

  for (const url of uniquePages) {

    await page.goto(url);

    // stabieler load moment
    await page.waitForLoadState('domcontentloaded');

    // wacht tot menu geladen is (cruciaal)
    await page.waitForSelector('#nav');

    const results = await new AxeBuilder({ page }).analyze();

    console.log(`\n--- ${url} ---`);
    console.log(results.violations);

    totalViolations += results.violations.length;
  }

  console.log("\nTotaal violations:", totalViolations);

  expect(totalViolations).toBeLessThan(25);
});