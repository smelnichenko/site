import { defineConfig, devices } from '@playwright/test';

/**
 * `npm run test:layout`: the masi pages' layout in headless Chromium (layout.spec.ts), served by the layout harness's
 * own Vite server. In CI the step runs in the Playwright image whose browsers match @playwright/test.
 */
export default defineConfig({
  testDir: '.',
  testMatch: process.env.LAYOUT_SPEC ?? 'layout.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  // a failing page is kept as a screenshot: a layout failure is read by looking at it
  outputDir: '../test-results/layout',
  use: {
    baseURL: 'http://localhost:5199',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    // a CI pod's /dev/shm is 64 MB, which Chromium outgrows and crashes on
    launchOptions: { args: ['--disable-dev-shm-usage'] },
  },
  webServer: {
    command: 'npx vite --config layout/vite.config.ts',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    cwd: '..',
  },
});
