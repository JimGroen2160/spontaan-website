require('dotenv').config();

import { defineConfig, devices } from '@playwright/test';

const SYNTHETIC_SUPABASE_URL =
  'https://synthetic-test-project.supabase.co';
const SYNTHETIC_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_synthetic_test_only';

const testSupabaseUrl =
  process.env.TEST_SUPABASE_URL?.trim();
const testSupabasePublishableKey =
  process.env.TEST_SUPABASE_PUBLISHABLE_KEY?.trim();

if (
  Boolean(testSupabaseUrl) !==
  Boolean(testSupabasePublishableKey)
) {
  throw new Error(
    'TEST_SUPABASE_URL en TEST_SUPABASE_PUBLISHABLE_KEY moeten beide aanwezig of beide afwezig zijn.',
  );
}

const playwrightSupabaseBrowserEnv = {
  SUPABASE_URL:
    testSupabaseUrl || SYNTHETIC_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY:
    testSupabasePublishableKey ||
    SYNTHETIC_SUPABASE_PUBLISHABLE_KEY,
};

export default defineConfig({
  testDir: './tests',

  testIgnore: [
    '**/*.test.mjs',
    '**/media-fallback.spec.ts',
  ],

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
    env: {
      MEDIA_BUILD_FIXTURE: 'tests/fixtures/media-cms.json',
      REPERTOIRE_BUILD_FIXTURE: 'tests/fixtures/repertoire-cms.json',
      CONTACT_BUILD_FIXTURE: 'data/contact-fallback.json',
      FRIENDS_BUILD_FIXTURE: 'tests/fixtures/friends-cms.json',
      HOME_BUILD_FIXTURE: 'tests/fixtures/home-cms.json',
      ...playwrightSupabaseBrowserEnv,

    },
    url: 'http://localhost:5500',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
