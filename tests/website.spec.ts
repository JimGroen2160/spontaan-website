import { test, expect } from '@playwright/test';

test.describe('Website basis testen', () => {

  test('homepage opent', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Spontaan/);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });
    await page.waitForSelector('#footer-placeholder', { timeout: 15000 });
  });

  test('agenda pagina opent', async ({ page }) => {
    await page.goto('/pages/agenda.html');
    await expect(page).toHaveURL(/agenda/);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });
    await page.waitForSelector('#footer-placeholder', { timeout: 15000 });
  });

  test('over pagina opent', async ({ page }) => {
    await page.goto('/pages/over.html');
    await expect(page).toHaveURL(/over/);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });
    await page.waitForSelector('#footer-placeholder', { timeout: 15000 });
  });

  test('navigatie werkt', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });

    await page.locator('#nav-placeholder .nav-menu a', { hasText: 'Agenda' }).click();
    await expect(page).toHaveURL(/agenda/);

    await page.waitForSelector('#nav-placeholder .nav-menu a', { timeout: 15000 });

    await page.locator('#nav-placeholder .nav-menu a', { hasText: 'Over Spontaan' }).click();
    await expect(page).toHaveURL(/over/);
  });


  test('mobiel hamburgermenu is gesloten, opent, sluit en navigeert functioneel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.waitForSelector('#nav-placeholder .hamburger', { timeout: 15000 });

    const hamburger = page.locator('#nav-placeholder .hamburger');
    const navMenu = page.locator('#nav-placeholder .nav-menu');
    const agendaLink = page.locator('#nav-placeholder .nav-menu a', { hasText: 'Agenda' });

    // Beginsituatie: alleen de hamburger is zichtbaar en het menu is werkelijk verborgen.
    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(hamburger).toHaveAttribute('aria-label', 'Menu openen');
    await expect(navMenu).toBeHidden();
    await expect(agendaLink).toBeHidden();

    // Gebruikersactie 1: menu openen.
    await hamburger.click();

    // Zichtbaar resultaat: menu en links zijn werkelijk zichtbaar.
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    await expect(hamburger).toHaveAttribute('aria-label', 'Menu sluiten');
    await expect(navMenu).toBeVisible();
    await expect(agendaLink).toBeVisible();

    // Gebruikersactie 2: menu opnieuw sluiten.
    await hamburger.click();

    // Zichtbaar resultaat: menu en links zijn opnieuw werkelijk verborgen.
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(hamburger).toHaveAttribute('aria-label', 'Menu openen');
    await expect(navMenu).toBeHidden();
    await expect(agendaLink).toBeHidden();

    // Gebruikersactie 3: opnieuw openen en daadwerkelijk navigeren.
    await hamburger.click();
    await expect(navMenu).toBeVisible();

    await agendaLink.click();

    // Functioneel eindresultaat: juiste pagina en zichtbare paginatitel.
    await expect(page).toHaveURL(/\/pages\/agenda\.html$/);
    await expect(page.locator('h1')).toContainText(/agenda/i);
  });
});
