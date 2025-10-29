// SiemensApplication/tests/login.spec.js (ESM) — DEBUG/Hardcoded creds
import fs from 'fs';
import { test, expect, chromium as defaultChromium } from '@playwright/test';
import { authenticator } from 'otplib';

/* -------------------- HARD-CODED DEBUG VALUES -------------------- */
/*  ⚠️  DO NOT COMMIT REAL CREDENTIALS. Revert to env-based after debugging. */
const USER_EMAIL  = 'vineeti_hemdani@bluerose-tech.com';  // <-- change me
const USER_PASS   = 'Vani@44112011';              // <-- change me
const TOTP_SECRET = 'MNAEAQDLMV2USSTDJFCWYTZTEUWDKMKW';           // <-- change me
const START_URL   = 'https://siemens-dev1.pegacloud.com/prweb/PRAuth/app/GWSS/eZ4zv26csZSfrZXZMm2ifg*/!STANDARD';
/* ----------------------------------------------------------------- */

// ---------- helpers to get artifacts into console (no workspace access needed) ----------
async function saveAndLogScreenshot(page, filePath) {
  await page.screenshot({ path: filePath, fullPage: true });
  const b64 = fs.readFileSync(filePath).toString('base64');
  console.log(`===BEGIN_PNG_BASE64:${filePath}===`);
  console.log(b64);
  console.log(`===END_PNG_BASE64:${filePath}===`);
}
async function saveAndLogHTML(page, filePath, maxChars = 200_000) {
  const html = await page.content();
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`===BEGIN_HTML:${filePath}===`);
  console.log(html.slice(0, maxChars));
  console.log(`\n===END_HTML:${filePath}===`);
}
// ---------------------------------------------------------------------------------------

let chromium = defaultChromium; // optionally swapped to stealth in CI

test('login flow', async ({ page }) => {
  test.setTimeout(120_000);

  // Try stealth ONLY in CI/Jenkins; fall back if deps not present
  if (process.env.CI || process.env.JENKINS_URL) {
    try {
      const { chromium: chromiumExtra } = await import('playwright-extra');
      const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');
      chromiumExtra.use(StealthPlugin());
      chromium = chromiumExtra;
      console.log('🥷 Using stealth browser in CI');
    } catch {
      console.warn('⚠️ Could not load stealth plugin, falling back to normal browser');
    }
  }

  // If stealth available, create our own context/page; else use fixture page
  let browser, context;
  if (chromium !== defaultChromium) {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--lang=en-US'],
    });
    context = await browser.newContext();
    page = await context.newPage();
  }

  // ---------------- general helpers ----------------
  const clickIfVisible = async (loc, waitState = 'domcontentloaded') => {
    try {
      const n = await loc.count();
      for (let i = 0; i < n; i++) {
        const el = loc.nth(i);
        if (await el.isVisible().catch(() => false)) {
          await Promise.all([page.waitForLoadState(waitState).catch(() => {}), el.click()]);
          return true;
        }
      }
    } catch {}
    return false;
  };
  const firstVisibleBySelectors = async (selectors) => {
    for (const s of selectors) {
      if (!s || typeof s !== 'string' || !s.trim()) continue;
      const el = page.locator(s).first();
      if (await el.isVisible().catch(() => false)) return el;
    }
    return null;
  };
  const findPasswordInput = async () => {
    const aria = page.getByLabel(/Password/i).first();
    if (await aria.isVisible().catch(() => false)) return aria;
    const main = [
      'input[type="password" i]',
      '[name="password" i]',
      '#password',
      'input[placeholder*="Password" i]',
    ];
    const shadow = [
      'css=>>> input[type="password" i]',
      'css=>>> [name="password" i]',
      'css=>>> #password',
      'css=>>> input[placeholder*="Password" i]',
    ];
    return (await firstVisibleBySelectors(main)) || (await firstVisibleBySelectors(shadow));
  };
  const isRateLimitPage = () => /notification\/error-page\.html/i.test(page.url()) && /rate limit/i.test(page.url());
  const backoff = async (ms) => { console.log(`⏳ Rate limited. Backing off for ${Math.round(ms/1000)}s...`); await page.waitForTimeout(ms); };

  const tryEntraPasswordFlow = async () => {
    const msEmail = page.getByRole('textbox', { name: /Email|Enter your email|Sign in/i }).first();
    if (await msEmail.isVisible().catch(() => false)) {
      await msEmail.fill(USER_EMAIL);
      await clickIfVisible(page.getByRole('button', { name: /Next|Sign in|Continue/i }).first());
    }
    const msPwd = await findPasswordInput();
    if (msPwd) return msPwd;
    await clickIfVisible(page.getByRole('button', { name: /Use password|Sign in with password|Password|Other ways/i }).first());
    await clickIfVisible(page.getByRole('link',   { name: /Use password|Sign in with password|Password|Other ways/i }).first());
    return await findPasswordInput();
  };

  const advanceToPassword = async () => {
    const deadline = Date.now() + 20000; // ~20s loop
    const emailBox = page.getByRole('textbox', { name: /Email address/i }).first();

    while (Date.now() < deadline) {
      await clickIfVisible(page.getByRole('button', { name: /Accept.*cookies|I agree/i }).first());
      const entraBtn = page.getByRole('button', { name: /Sign in with Siemens Entra ID/i }).first();
      if (await entraBtn.isVisible().catch(() => false)) {
        await clickIfVisible(entraBtn, 'networkidle');
        const viaEntra = await tryEntraPasswordFlow();
        if (viaEntra) return viaEntra;
      }
      if (!(await clickIfVisible(page.getByRole('button', { name: /Use password|Sign in with password|Password/i }).first()))) {
        await clickIfVisible(page.getByRole('link', { name: /Use password|Sign in with password|Password/i }).first());
      }
      const primary   = page.locator('button[data-action-button-primary="true"]').first();
      const exact     = page.getByRole('button', { name: /^(Continue|Next|Sign in|Log in|Submit)$/i }).first();
      const safeExact = exact.filter({ hasNot: page.locator('[data-provider]') });
      if (!(await clickIfVisible(primary))) await clickIfVisible(safeExact);
      if (await emailBox.isVisible().catch(() => false)) await emailBox.press('Enter').catch(() => {});
      const pwdEl = await findPasswordInput();
      if (pwdEl) return pwdEl;
      if (/\/u\/login\/password|password|passwd|pwd/i.test(page.url())) {
        const afterNavPwd = await findPasswordInput();
        if (afterNavPwd) return afterNavPwd;
      }
      await page.waitForTimeout(400);
    }
    return null;
  };
  // -----------------------------------------------------

  // ---- Whole flow with rate-limit resilient retries ----
  let attempts = 0;
  const maxAttempts = 3;
  let pwd = null;

  while (attempts < maxAttempts && !pwd) {
    attempts += 1;
    console.log(`🔁 Login attempt ${attempts}/${maxAttempts}`);

    await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
    await clickIfVisible(page.getByRole('link', { name: /Login with SiemensID/i }).first());

    if (isRateLimitPage()) { await backoff(35_000); continue; }

    const emailField = page.getByRole('textbox', { name: /Email address/i }).first();
    if (await emailField.isVisible().catch(() => false)) {
      await emailField.fill(USER_EMAIL);
    }

    pwd = await advanceToPassword();
    if (!pwd && isRateLimitPage()) { await backoff(35_000); continue; }
  }

  if (!pwd) {
    await saveAndLogScreenshot(page, 'no-password.png');
    await saveAndLogHTML(page, 'no-password.html');
    console.log('URL at failure:', page.url());
    try {
      const buttons = await page.locator('button').allInnerTexts();
      const links   = await page.locator('a').allInnerTexts();
      console.log('=== BUTTONS VISIBLE ===', buttons);
      console.log('=== LINKS VISIBLE ===', links);
    } catch {}
    throw new Error(`Password input not found; url=${page.url()}`);
  }

  // ---- Fill password & submit ----
  await pwd.fill(USER_PASS);
  const submit = page
    .getByRole('button', { name: /^(Log in|Sign in|Continue|Next|Submit)$/i })
    .filter({ hasNot: page.locator('[data-provider]') })
    .first();
  await clickIfVisible(submit, 'networkidle');

  // ---- MFA (resilient + log artifacts on failure) ----
  try {
    const outcome = await Promise.race([
      page.getByRole('textbox', { name: /one-time code|verification code|authenticator/i })
          .waitFor({ timeout: 20_000 }).then(() => 'code').catch(() => null),
      page.getByText(/Approve sign-?in request|Use your Microsoft Authenticator/i)
          .waitFor({ timeout: 20_000 }).then(() => 'push').catch(() => null),
      page.locator('iframe[name="PegaGadget1Ifr"]')
          .waitFor({ timeout: 20_000 }).then(() => 'inapp').catch(() => null),
    ]);

    if (outcome === 'push') {
      await page.getByRole('link', { name: /I can't use my.*Authenticator|Use a different verification option|Other ways/i })
        .click({ timeout: 5000 }).catch(() => {});
      await page.getByRole('button', { name: /Use verification code|Enter a code|Use code/i })
        .click({ timeout: 5000 }).catch(() => {});
      await page.getByRole('textbox', { name: /one-time code|verification code|authenticator/i })
        .waitFor({ timeout: 20000 });
    } else if (outcome !== 'code' && outcome !== 'inapp') {
      await page.getByRole('textbox', { name: /one-time code|verification code|authenticator/i })
        .waitFor({ timeout: 10000 });
    }

    if (await page.getByRole('textbox', { name: /one-time code|verification code|authenticator/i }).isVisible().catch(() => false)) {
      authenticator.options = { step: 30, digits: 6, window: 1 };
      const code = authenticator.generate(TOTP_SECRET);
      // Mask the code in logs (only length)
      console.log(`🔐 TOTP generated (${String(code).length} digits)`);
      await page.getByRole('textbox', { name: /one-time code|verification code|authenticator/i }).fill(code);
      await clickIfVisible(page.getByRole('button', { name: /Continue|Verify|Submit|Next/i }).first(), 'networkidle');
    }
  } catch (e) {
    await saveAndLogScreenshot(page, 'mfa-not-found.png');
    await saveAndLogHTML(page, 'mfa-not-found.html');
    console.log('URL at MFA failure:', page.url());
    try {
      const buttons = await page.locator('button').allInnerTexts();
      const links   = await page.locator('a').allInnerTexts();
      console.log('MFA BUTTONS:', buttons);
      console.log('MFA LINKS:', links);
    } catch {}
    throw e;
  }

  // === Quick smoke to ensure we’re in app ===
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('iframe[name="PegaGadget1Ifr"]')).toBeVisible({ timeout: 30_000 });

  if (browser) await browser.close();
});
