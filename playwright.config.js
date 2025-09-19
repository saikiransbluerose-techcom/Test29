// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './SiemensApplication',        // <-- your tests live here
    reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'always' }]],
    timeout: 120_000,
    expect: { timeout: 5_000 },
    retries: 0,
  use: {
    headless: false,
    launchOptions: {
       slowMo: 1000,
          args: [
        '--disable-extensions',
        '--disable-popup-blocking',
        '--no-sandbox',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
      ],
    },
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
            // ✅ This is the important line
    testIdAttribute: 'data-test-id',
    trace: 'on-first-retry',
    
  },
  projects: [
    {
      name: 'chromium',                   // available as --project=chromium
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'edge',                   // available as --project=chromium
      use: { ...devices['Desktop Chrome'] }
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
});
