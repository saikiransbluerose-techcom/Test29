import { test, expect, chromium as defaultChromium } from '@playwright/test';
import { authenticator } from 'otplib';

const TOTP_SECRET = process.env.TOTP_SECRET || 'MNAEAQDLMV2USSTDJFCWYTZTEUWDKMKW';

// Default Chromium from Playwright
let chromium = defaultChromium;

test('login flow', async ({ page }) => {
  test.setTimeout(90_000);

  // Only load stealth plugin in CI/Jenkins
  if (process.env.CI || process.env.JENKINS_URL) {
    try {
      const { chromium: chromiumExtra } = await import('playwright-extra');
      const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');
      chromiumExtra.use(StealthPlugin());
      chromium = chromiumExtra;
      console.log('🥷 Using stealth browser in CI');
    } catch (e) {
      console.warn('⚠️ Could not load stealth plugin, falling back to normal browser', e);
    }
  }

  // Launch browser (direct stealth if CI, else Playwright runner will handle browserless `page`)
  let browser, context;
  if (chromium !== defaultChromium) {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    context = await browser.newContext();
    page = await context.newPage();
  }

  // === Siemens Login Flow ===
  await page.goto(
    'https://siemens-dev1.pegacloud.com/prweb/PRAuth/app/GWSS/WufOMs17lxZjy1fI-RH7kXW6DtwPXjuN*/!STANDARD?pzuiactionrrr=CXtpbn1yblhJcEYzRHZaSUFPUGUvcE5ZV2xqTS9rSHJKSTQreE9CL1Zaa3FPZDI2MFZ6dUY2MzVJek5OdklKYWZ4S3hXc082OHRHVVg3VGZmRE8rYnkxM2xvZz09*'
  );
  await page.getByRole('link', { name: 'Login with SiemensID' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('vineeti_hemdani@bluerose-tech.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  
});
