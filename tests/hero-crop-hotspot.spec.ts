import {expect, test} from '@playwright/test';

const expectedRect = '192,54,1536,972';
const expectedPosition = '75% 50%';

const buildHeroes = [
  {
    name: 'Homepage',
    route: '/',
    selector: '.hero',
    kind: 'background',
  },
  {
    name: 'Over Spontaan',
    route: '/pages/over.html',
    selector: '.about-hero',
    kind: 'background',
  },
  {
    name: 'Beeld en Geluid',
    route: '/pages/media.html',
    selector: '[data-media-page-hero-image]',
    kind: 'image',
  },
  {
    name: 'Repertoire',
    route: '/pages/repertoire.html',
    selector: '.repertoire-hero__image',
    kind: 'image',
  },
  {
    name: 'Vrienden',
    route: '/pages/vrienden.html',
    selector: '[data-friends-hero-image]',
    kind: 'image',
  },
  {
    name: 'Contact',
    route: '/pages/contact.html',
    selector: '[data-contact-hero-image]',
    kind: 'image',
  },
] as const;

function rectFromUrl(value: string) {
  const url = new URL(value, 'http://localhost:5500');
  return url.searchParams.get('rect');
}

async function backgroundUrl(
  locator: ReturnType<Parameters<typeof test>[1]> extends never
    ? never
    : any,
) {
  const value = await locator.evaluate((element: Element) => {
    const background = getComputedStyle(element).backgroundImage;
    const match = background.match(/url\(["']?(.*?)["']?\)/);
    return match?.[1] ?? '';
  });

  return value;
}

test.describe('Hero crop/hotspot P4', () => {
  test.describe.configure({mode: 'serial'});

  for (const hero of buildHeroes) {
    test(`${hero.name} gebruikt crop en hotspot op desktop en mobiel`, async ({page}) => {
      const pageErrors: string[] = [];

      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      for (const viewport of [
        {width: 1440, height: 900},
        {width: 390, height: 844},
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(hero.route, {
          waitUntil: 'networkidle',
        });

        const locator = page.locator(hero.selector);
        await expect(locator).toBeVisible();

        if (hero.kind === 'background') {
          const url = await backgroundUrl(locator);
          expect(url).toContain('cdn.sanity.io/images/');
          expect(rectFromUrl(url)).toBe(expectedRect);

          const position = await locator.evaluate(
            (element) => getComputedStyle(element).backgroundPosition,
          );

          expect(position).toBe(expectedPosition);
        } else {
          const src = await locator.getAttribute('src');

          expect(src).toBeTruthy();
          expect(src!).toContain('cdn.sanity.io/images/');
          expect(rectFromUrl(src!)).toBe(expectedRect);

          const position = await locator.evaluate(
            (element) => getComputedStyle(element).objectPosition,
          );

          expect(position).toBe(expectedPosition);
        }
      }

      expect(pageErrors).toEqual([]);
    });
  }

  for (const runtime of [
    {
      name: 'Agenda',
      route: '/pages/agenda.html',
      selector: '.agenda-hero',
      title: 'Agenda P4',
    },
    {
      name: 'Nieuws',
      route: '/pages/nieuws.html',
      selector: '.news-hero',
      title: 'Nieuws P4',
    },
  ]) {
    test(`${runtime.name} gebruikt runtime crop hotspot en managed glow`, async ({page}) => {
      await page.route(
        '**/data/query/development**',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              result: {
                page: {
                  heroTitle: runtime.title,
                  heroSubtitle: 'P4 crop/hotspot browsertest',
                  heroImageUrl:
                    'https://cdn.sanity.io/images/u66p1mxm/development/p4-runtime-1920x1080.jpg',
                  heroImageDimensions: {
                    width: 1920,
                    height: 1080,
                    aspectRatio: 16 / 9,
                  },
                  heroImageCrop: {
                    top: 0.05,
                    bottom: 0.05,
                    left: 0.10,
                    right: 0.10,
                  },
                  heroImageHotspot: {
                    x: 0.70,
                    y: 0.50,
                    width: 0.20,
                    height: 0.20,
                  },
                  heroGlowManaged: 'light',
                  heroGlow: 'strong',
                },
                items: [],
              },
            }),
          });
        },
      );

      for (const viewport of [
        {width: 1440, height: 900},
        {width: 390, height: 844},
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(runtime.route);
        const hero = page.locator(runtime.selector);

        await expect(hero).toBeVisible();
        await expect(hero).toHaveAttribute(
          'data-hero-glow',
          'light',
        );

        const url = await backgroundUrl(hero);

        expect(url).toContain('cdn.sanity.io/images/');
        expect(rectFromUrl(url)).toBe(expectedRect);

        const position = await hero.evaluate(
          (element) => getComputedStyle(element).backgroundPosition,
        );

        expect(position).toBe(expectedPosition);
      }
    });

    test(`${runtime.name} crop zonder hotspot behoudt CSS-brandpunt`, async ({page}) => {
      await page.route(
        '**/data/query/development**',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              result: {
                page: {
                  heroTitle: `${runtime.name} crop-only`,
                  heroSubtitle: 'P4 crop zonder hotspot',
                  heroImageUrl:
                    'https://cdn.sanity.io/images/u66p1mxm/development/p4-runtime-1920x1080.jpg',
                  heroImageDimensions: {
                    width: 1920,
                    height: 1080,
                    aspectRatio: 16 / 9,
                  },
                  heroImageCrop: {
                    top: 0.05,
                    bottom: 0.05,
                    left: 0.10,
                    right: 0.10,
                  },
                  heroImageHotspot: null,
                  heroGlowManaged: 'normal',
                  heroGlow: 'strong',
                },
                items: [],
              },
            }),
          });
        },
      );

      await page.setViewportSize({
        width: 1440,
        height: 900,
      });

      await page.goto(runtime.route);

      const hero = page.locator(runtime.selector);
      const url = await backgroundUrl(hero);

      expect(rectFromUrl(url)).toBe(expectedRect);

      const inlinePosition = await hero.evaluate(
        (element: HTMLElement) => element.style.backgroundPosition,
      );

      expect(inlinePosition).toBe('');
    });

    test(`${runtime.name} hotspot zonder crop gebruikt positie zonder rect`, async ({page}) => {
      await page.route(
        '**/data/query/development**',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              result: {
                page: {
                  heroTitle: `${runtime.name} hotspot-only`,
                  heroSubtitle: 'P4 hotspot zonder crop',
                  heroImageUrl:
                    'https://cdn.sanity.io/images/u66p1mxm/development/p4-runtime-1920x1080.jpg',
                  heroImageDimensions: {
                    width: 1920,
                    height: 1080,
                    aspectRatio: 16 / 9,
                  },
                  heroImageCrop: null,
                  heroImageHotspot: {
                    x: 0.30,
                    y: 0.65,
                    width: 0.20,
                    height: 0.20,
                  },
                  heroGlowManaged: 'normal',
                  heroGlow: 'strong',
                },
                items: [],
              },
            }),
          });
        },
      );

      await page.goto(runtime.route);

      const hero = page.locator(runtime.selector);
      const url = await backgroundUrl(hero);

      expect(rectFromUrl(url)).toBeNull();

      const position = await hero.evaluate(
        (element) => getComputedStyle(element).backgroundPosition,
      );

      expect(position).toBe('30% 65%');
    });

    test(`${runtime.name} crop zonder dimensions wordt niet half toegepast`, async ({page}) => {
      await page.route(
        '**/data/query/development**',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              result: {
                page: {
                  heroTitle: `${runtime.name} zonder dimensions`,
                  heroSubtitle: 'P4 veilige fallback',
                  heroImageUrl:
                    'https://cdn.sanity.io/images/u66p1mxm/development/p4-runtime-1920x1080.jpg',
                  heroImageDimensions: null,
                  heroImageCrop: {
                    top: 0.05,
                    bottom: 0.05,
                    left: 0.10,
                    right: 0.10,
                  },
                  heroImageHotspot: null,
                  heroGlowManaged: 'normal',
                  heroGlow: 'strong',
                },
                items: [],
              },
            }),
          });
        },
      );

      await page.goto(runtime.route);

      const hero = page.locator(runtime.selector);
      const url = await backgroundUrl(hero);

      expect(rectFromUrl(url)).toBeNull();

      const inlinePosition = await hero.evaluate(
        (element: HTMLElement) => element.style.backgroundPosition,
      );

      expect(inlinePosition).toBe('');
    });
  }
});