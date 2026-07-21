require('dotenv').config();

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  testIgnore: '**/*.test.mjs',

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: 'html',

  use: {
    // 🔥 ENIGE WAARHEID
    baseURL: 'http://localhost:5500',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    // 🔥 CONSISTENT MET BASEURL
    command: 'npm run build && npx http-server dist -p 5500',
    env: { MEDIA_BUILD_FIXTURE: 'tests/fixtures/media-cms.json' },
    url: 'http://localhost:5500',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
