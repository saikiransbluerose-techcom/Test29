import { test, expect, chromium as defaultChromium } from '@playwright/test';
import { authenticator } from 'otplib';

const TOTP_SECRET = process.env.TOTP_SECRET || 'MNAEAQDLMV2USSTDJFCWYTZTEUWDKMKW';
const LOGIN_EMAIL = process.env.LOGIN_USER || 'vineeti_hemdani@bluerose-tech.com';
const LOGIN_PASS = process.env.LOGIN_PASS || 'Siemens@123Siemens@123Siemens@123';

let chromium = defaultChromium; // Default Playwright Chromium

test('Siemens login flow', async ({ page }) => {
  test.setTimeout(90_000);

  // ✅ Load stealth plugin only in Jenkins/CI
  if (process.env.CI || process.env.JENKINS_URL) {
    try {
      const { chromium: chromiumExtra } = await import('playwright-extra');
      const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');
      chromiumExtra.use(StealthPlugin());
      chromium = chromiumExtra;
      console.log('🥷 Using stealth mode in CI');
    } catch (e) {
      console.warn('⚠️ Could not load stealth plugin, using default Playwright browser instead.');
    }
  }

  // ✅ Launch browser manually only if stealth Chromium is active
  let browser, context;
  if (chromium !== defaultChromium) {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  }

  // 🌐 Navigate to Siemens login
  await page.goto('https://siemens-dev1.pegacloud.com/prweb/PRAuth/app/GWSS/WufOMs17lxZjy1fI-RH7kXW6DtwPXjuN*/!STANDARD?pzuiactionrrr=CXtpbn1yblhJcEYzRHZaSUFPUGUvcE5ZV2xqTS9rSHJKSTQreE9CL1Zaa3FPZDI2MFZ6dUY2MzVJek5OdklKYWZ4S3hXc082OHRHVVg3VGZmRE8rYnkxM2xvZz09*');

  await page.getByRole('link', { name: 'Login with SiemensID' }).click();

  // 🧠 Enter email & continue
  await page.getByRole('textbox', { name: 'Email address' }).fill(LOGIN_EMAIL);
  await page.getByRole('button', { name: 'Continue' }).click();

  // (Optional) You can continue the login steps:
  // await page.getByRole('textbox', { name: 'Password' }).fill(LOGIN_PASS);
  // await page.getByRole('button', { name: 'Sign in' }).click();

  // If Siemens login requires TOTP:
  const otp = authenticator.generate(TOTP_SECRET);
  console.log('Generated TOTP:', otp);
  // await page.getByRole('textbox', { name: 'Verification code' }).fill(otp);

  if (browser) await browser.close();
});
