import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the real app and a local Supabase (npm run db:start).
// They never use production: e2e/global-setup.ts refuses a non-local database.
// Test data (a fresh company, driver and admin per run) is created there.
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    {
      // The kiosk: an Android tablet in portrait, used by touch.
      name: 'kiosk-tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 800, height: 1280 },
        hasTouch: true,
        isMobile: true,
        // Cloud dev containers ship Chromium here instead of Playwright's cache.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
