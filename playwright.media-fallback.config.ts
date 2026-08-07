import {
  defineConfig,
  devices
} from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  testMatch: 'media-fallback.spec.ts',

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: 'html',

  use: {
    baseURL: 'http://127.0.0.1:5510',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
    {
      name: 'firefox',
      use: {...devices['Desktop Firefox']},
    },
    {
      name: 'webkit',
      use: {...devices['Desktop Safari']},
    },
  ],

  webServer: {
    command:
      'npm run build && npx http-server dist-media-fallback -p 5510 -c-1',
    env: {
      VERCEL_ENV: 'preview',
      SITE_OUTPUT_DIR: 'dist-media-fallback',

      // Alle CMS-bronnen zijn deterministisch.
      // Alleen Media faalt bewust, zodat de Media-fallback
      // zonder live Sanity-afhankelijkheid wordt getest.
      MEDIA_BUILD_FIXTURE:
        'tests/fixtures/media-error.json',
      REPERTOIRE_BUILD_FIXTURE:
        'tests/fixtures/repertoire-cms.json',
      FRIENDS_BUILD_FIXTURE:
        'tests/fixtures/friends-cms.json',
      ABOUT_BUILD_FIXTURE:
        'data/about-fallback.json',
      CONTACT_BUILD_FIXTURE:
        'data/contact-fallback.json',
      HOME_BUILD_FIXTURE:
        'tests/fixtures/home-cms.json',
    },
    url: 'http://127.0.0.1:5510',
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
