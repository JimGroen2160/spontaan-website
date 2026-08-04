import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  Page,
  test
} from '@playwright/test';

type ErrorMonitor = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  responseErrors: string[];
};

function monitorBrowserErrors(page: Page): ErrorMonitor {
  const monitor: ErrorMonitor = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    responseErrors: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      monitor.consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    monitor.pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    const errorText =
      request.failure()?.errorText ?? 'onbekend';

    const isExpectedReplacedImageRequest =
      request.resourceType() === 'image' &&
      (
        errorText === 'NS_BINDING_ABORTED' ||
        errorText === 'net::ERR_ABORTED'
      ) &&
      url.searchParams.has('regression-slide');

    if (
      !isExpectedReplacedImageRequest &&
      (
        url.hostname === '127.0.0.1' ||
        url.hostname === 'localhost'
      )
    ) {
      monitor.requestFailures.push(
        `${request.method()} ${request.url()} - ${errorText}`
      );
    }
  });

  page.on('response', (response) => {
    const url = new URL(response.url());

    if (
      (url.hostname === '127.0.0.1' ||
        url.hostname === 'localhost') &&
      response.status() >= 400
    ) {
      monitor.responseErrors.push(
        `${response.status()} ${response.url()}`
      );
    }
  });

  return monitor;
}

function expectNoBrowserErrors(
  monitor: ErrorMonitor
) {
  expect(
    monitor.consoleErrors,
    'Onverwachte consolefouten'
  ).toEqual([]);

  expect(
    monitor.pageErrors,
    'Onverwachte JavaScriptfouten'
  ).toEqual([]);

  expect(
    monitor.requestFailures,
    'Onverwachte lokale requestfouten'
  ).toEqual([]);

  expect(
    monitor.responseErrors,
    'Onverwachte lokale HTTP-fouten'
  ).toEqual([]);
}

async function openFallbackMediaPage(page: Page) {
  await page.goto('/pages/media.html', {
    waitUntil: 'networkidle',
  });

  await expect(page.locator('html')).toHaveAttribute(
    'data-media-source',
    'fallback'
  );

  await expect(
    page.locator('[data-media-photo-grid] [data-media-album-button]')
  ).toHaveCount(3);
}

async function expectGalleryState(
  page: Page,
  current: number,
  total: number
) {
  const image = page.locator(
    '[data-media-gallery-image]'
  );

  const caption = page.locator(
    '[data-media-gallery-caption]'
  );

  await expect(
    page.locator('[data-media-gallery-counter]')
  ).toHaveText(`Foto ${current} van ${total}`);

  await expect(image).toHaveAttribute(
    'src',
    /\S+/
  );

  await expect(image).toHaveAttribute(
    'alt',
    /\S+/
  );

  await expect(caption).not.toBeEmpty();
}

test.describe(
  'Beeld en Geluid - production fallback',
  () => {
    test(
      'alle fallbackalbums ondersteunen volledige cyclische navigatie',
      async ({page}) => {
        const monitor = monitorBrowserErrors(page);

        await openFallbackMediaPage(page);

        const albumButtons = page.locator(
          '[data-media-photo-grid] [data-media-album-button]'
        );

        const gallery = page.locator(
          '[data-media-gallery]'
        );

        const image = page.locator(
          '[data-media-gallery-image]'
        );

        const caption = page.locator(
          '[data-media-gallery-caption]'
        );

        const next = page.locator(
          '[data-media-gallery-next]'
        );

        const previous = page.locator(
          '[data-media-gallery-previous]'
        );

        const close = page.locator(
          '[data-media-gallery-close]'
        );

        for (
          let albumIndex = 0;
          albumIndex < 3;
          albumIndex += 1
        ) {
          const albumButton =
            albumButtons.nth(albumIndex);

          await albumButton.focus();
          await albumButton.click();

          await expect(gallery).toBeVisible();
          await expect(close).toBeFocused();
          await expect(next).toBeVisible();
          await expect(previous).toBeVisible();

          const imageSources: string[] = [];
          const altTexts: string[] = [];
          const captions: string[] = [];

          for (
            let photoIndex = 1;
            photoIndex <= 5;
            photoIndex += 1
          ) {
            await expectGalleryState(
              page,
              photoIndex,
              5
            );

            imageSources.push(
              (await image.getAttribute('src')) ?? ''
            );

            altTexts.push(
              (await image.getAttribute('alt')) ?? ''
            );

            captions.push(
              (await caption.textContent())?.trim() ??
                ''
            );

            if (photoIndex < 5) {
              await next.click();
            }
          }

          expect(
            new Set(imageSources).size,
            'Elk album moet vijf verschillende afbeeldingen tonen'
          ).toBe(5);

          expect(
            altTexts.every(
              (value) => value.length > 0
            )
          ).toBe(true);

          expect(
            captions.every(
              (value) => value.length > 0
            )
          ).toBe(true);

          await next.click();
          await expectGalleryState(page, 1, 5);
          await expect(image).toHaveAttribute(
            'src',
            imageSources[0]
          );

          await previous.click();
          await expectGalleryState(page, 5, 5);
          await expect(image).toHaveAttribute(
            'src',
            imageSources[4]
          );

          await page.keyboard.press('ArrowRight');
          await expectGalleryState(page, 1, 5);

          await page.keyboard.press('ArrowLeft');
          await expectGalleryState(page, 5, 5);

          await close.click();
          await expect(gallery).toBeHidden();
          await expect(albumButton).toBeFocused();

          await albumButton.click();
          await expect(gallery).toBeVisible();

          await page.keyboard.press('Escape');

          await expect(gallery).toBeHidden();
          await expect(albumButton).toBeFocused();
        }

        expectNoBrowserErrors(monitor);
      }
    );

    test(
      'een album met vijftig foto-items blijft volledig navigeerbaar',
      async ({page}) => {
        test.setTimeout(60_000);
        const monitor = monitorBrowserErrors(page);

        await page.route(
          '**/pages/media.html',
          async (route) => {
            const response = await route.fetch();
            let html = await response.text();

            const match = html.match(
              /<script([^>]*data-media-albums[^>]*)>([\s\S]*?)<\/script>/i
            );

            if (!match) {
              throw new Error(
                'Albumdata is niet gevonden in de gebouwde mediapagina.'
              );
            }

            const albums = JSON.parse(match[2]);

            if (
              !Array.isArray(albums) ||
              albums.length === 0
            ) {
              throw new Error(
                'De gebouwde mediapagina bevat geen albums.'
              );
            }

            const imageUrls = [
              '../images/about/over-hero-mannenkoor.jpg',
              '../images/about/over-intro-mannenkoor.jpg',
              '../images/about/over-sfeer-mannenkoor.jpg',
              '../images/repertoire/repertoire-feestelijk.jpg',
              '../images/repertoire/repertoire-dirigent.jpg',
            ];

            albums[0].photos = Array.from(
              {length: 50},
              (_, index) => ({
                imageUrl:
                  `${imageUrls[index % imageUrls.length]}?regression-slide=${index + 1}`,
                alt:
                  `Regressietest foto ${index + 1}`,
                caption:
                  `Regressietest foto ${index + 1}`,
              })
            );

            const replacement =
              `<script${match[1]}>${JSON.stringify(albums)}</script>`;

            html = html.replace(
              match[0],
              replacement
            );

            await route.fulfill({
              response,
              body: html,
            });
          }
        );

        await openFallbackMediaPage(page);

        const albumButton = page.locator(
          '[data-media-photo-grid] [data-media-album-button]'
        ).first();

        await albumButton.click();

        const image = page.locator(
          '[data-media-gallery-image]'
        );

        const next = page.locator(
          '[data-media-gallery-next]'
        );

        const previous = page.locator(
          '[data-media-gallery-previous]'
        );

        await expectGalleryState(page, 1, 50);

        const firstSource =
          await image.getAttribute('src');

        for (
          let index = 2;
          index <= 50;
          index += 1
        ) {
          await page.keyboard.press('ArrowRight');

          await expect(
            page.locator(
              '[data-media-gallery-counter]'
            )
          ).toHaveText(`Foto ${index} van 50`);
        }

        await expectGalleryState(page, 50, 50);

        const lastSource =
          await image.getAttribute('src');

        expect(lastSource).not.toBe(firstSource);

        await next.click();
        await expectGalleryState(page, 1, 50);

        await expect(image).toHaveAttribute(
          'src',
          firstSource ?? ''
        );

        await previous.click();
        await expectGalleryState(page, 50, 50);

        await expect(image).toHaveAttribute(
          'src',
          lastSource ?? ''
        );

        await page.keyboard.press('ArrowRight');
        await expectGalleryState(page, 1, 50);

        await page.keyboard.press('ArrowLeft');
        await expectGalleryState(page, 50, 50);

        expectNoBrowserErrors(monitor);
      }
    );

    test(
      'de geopende fallbackgalerij is toegankelijk',
      async ({page}) => {
        const monitor = monitorBrowserErrors(page);

        await openFallbackMediaPage(page);

        await page.locator(
          '[data-media-photo-grid] [data-media-album-button]'
        ).first().click();

        await expect(
          page.locator('[data-media-gallery]')
        ).toBeVisible();

        const accessibilityResults =
          await new AxeBuilder({page})
            .include('[data-media-gallery]')
            .analyze();

        expect(
          accessibilityResults.violations
        ).toEqual([]);

        expectNoBrowserErrors(monitor);
      }
    );

    test(
      'fallbackpagina en geopende galerij hebben geen horizontale overflow',
      async ({page}) => {
        const monitor = monitorBrowserErrors(page);

        const viewports = [
          {width: 1440, height: 1000},
          {width: 850, height: 1000},
          {width: 390, height: 844},
        ];

        for (const viewport of viewports) {
          await page.setViewportSize(viewport);

          await openFallbackMediaPage(page);

          const pageDimensions =
            await page.evaluate(() => ({
              documentWidth:
                document.documentElement.scrollWidth,
              viewportWidth:
                document.documentElement.clientWidth,
            }));

          expect(
            pageDimensions.documentWidth
          ).toBeLessThanOrEqual(
            pageDimensions.viewportWidth
          );

          const albumButton = page.locator(
            '[data-media-photo-grid] [data-media-album-button]'
          ).first();

          await albumButton.click();

          const gallery = page.locator(
            '[data-media-gallery]'
          );

          await expect(gallery).toBeVisible();

          await expect(
            page.locator('[data-media-gallery-next]')
          ).toBeVisible();

          await expect(
            page.locator('[data-media-gallery-previous]')
          ).toBeVisible();

          const galleryOverflow =
            await gallery.evaluate(
              (element) =>
                element.scrollWidth <=
                element.clientWidth
            );

          expect(galleryOverflow).toBe(true);

          const verticalLayout =
            await gallery.evaluate((element) => {
              const caption =
                element.querySelector(
                  '[data-media-gallery-caption]'
                );

              const counter =
                element.querySelector(
                  '[data-media-gallery-counter]'
                );

              if (
                !(caption instanceof HTMLElement) ||
                !(counter instanceof HTMLElement)
              ) {
                return null;
              }

              const galleryRect =
                element.getBoundingClientRect();

              const captionRect =
                caption.getBoundingClientRect();

              const counterRect =
                counter.getBoundingClientRect();

              return {
                galleryTop: galleryRect.top,
                galleryBottom: galleryRect.bottom,
                captionTop: captionRect.top,
                captionBottom: captionRect.bottom,
                counterTop: counterRect.top,
                counterBottom: counterRect.bottom,
                viewportHeight: window.innerHeight,
                hasInternalVerticalOverflow:
                  element.scrollHeight >
                  element.clientHeight,
              };
            });

          expect(verticalLayout).not.toBeNull();

          expect(
            verticalLayout?.galleryTop
          ).toBeGreaterThanOrEqual(0);

          expect(
            verticalLayout?.galleryBottom
          ).toBeLessThanOrEqual(
            verticalLayout?.viewportHeight ?? 0
          );

          expect(
            verticalLayout?.captionBottom
          ).toBeLessThanOrEqual(
            verticalLayout?.counterTop ?? 0
          );

          expect(
            verticalLayout?.counterBottom
          ).toBeLessThanOrEqual(
            verticalLayout?.galleryBottom ?? 0
          );

          expect(
            verticalLayout?.hasInternalVerticalOverflow
          ).toBe(false);

          await expect(
            page.locator(
              '[data-media-gallery-caption]'
            )
          ).toBeInViewport();

          await expect(
            page.locator(
              '[data-media-gallery-counter]'
            )
          ).toBeInViewport();

          await page.locator(
            '[data-media-gallery-close]'
          ).click();

          await expect(gallery).toBeHidden();
        }

        expectNoBrowserErrors(monitor);
      }
    );
  }
);
