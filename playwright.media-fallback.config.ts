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
      'npm run build && npx http-server dist -p 5510 -c-1',
    env: {
      VERCEL_ENV: 'production',
      MEDIA_BUILD_FIXTURE:
        'tests/fixtures/media-error.json',
    },
    url: 'http://127.0.0.1:5510',
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
