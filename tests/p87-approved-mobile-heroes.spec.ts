import {expect, test} from '@playwright/test';

for (const item of [
  {
    name: 'Nieuws',
    route: '/pages/nieuws.html',
    selector: '.news-hero',
    image: 'nieuws-goedgekeurd.png',
  },
  {
    name: 'Agenda',
    route: '/pages/agenda.html',
    selector: '.agenda-hero',
    image: 'agenda-goedgekeurd.webp',
  },
]) {
  test(`${item.name} gebruikt uitsluitend goedgekeurde mobiele hero`, async ({page}) => {
    await page.setViewportSize({width: 412, height: 915});

    await page.goto(item.route);
    await page.waitForLoadState('load');

    const hero = page.locator(item.selector);
    await expect(hero).toBeVisible();

    await expect.poll(async () => hero.evaluate(element => {
      return getComputedStyle(element, '::before').backgroundImage;
    })).toContain(item.image);

    await expect(hero.locator('.p87-mobile-photo')).toHaveCount(0);

    const geometry = await hero.evaluate(element => {
      const picture = getComputedStyle(element, '::before');
      const content = element.querySelector(
        '[class$="hero__content"]'
      );

      return {
        imageHeight: parseFloat(picture.height),
        imageWidth: parseFloat(picture.width),
        imageSize: picture.backgroundSize,
        contentTop: content?.getBoundingClientRect().top ?? 0,
        heroTop: element.getBoundingClientRect().top,
      };
    });

    expect(geometry.imageHeight).toBeGreaterThan(0);
    expect(geometry.imageWidth).toBeGreaterThan(0);
    expect(geometry.imageSize).toBe('contain');
    expect(geometry.contentTop).toBeGreaterThanOrEqual(
      geometry.heroTop + geometry.imageHeight - 2
    );


    const imageResponse = await page.request.get(
      '/images/approved-heroes/' + item.image
    );

    expect(imageResponse.ok()).toBeTruthy();
  });
}