// SiemensApplication/pages/login.page.js
import { loadAppConfig } from '../utils/app.js';
import { ENV } from '../utils/env.js';
import { authenticator } from 'otplib';

const APP = loadAppConfig();

function genTotp() {
  const secret = (ENV.TOTP_SECRET || '').trim();
  if (!secret) return '';
  authenticator.options = { step: 30, digits: 6, window: 1 }; // small skew tolerance
  return authenticator.generate(secret);
}

export class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.portalMarker = this.page.locator(
      `[data-test-id="${APP.ui.refreshTestId}"]`
    ); // marker we expect after successful login
  }

  async goto() {
    const url = (APP.urls.loginStart || '').trim();
    if (!url) throw new Error('Missing loginStart in config');
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async loginWithSiemensId(email, password, { portalWaitMs = 5000, otpWaitMs = 15000 } = {}) {
    const p = this.page;

    //  // SiemensID login sequence
    await p.getByRole('link', { name: 'Login with SiemensID' }).click();
    await p.getByRole('textbox', { name: 'Email address' }).fill(email);
    await p.getByRole('button', { name: 'Continue' }).click();
    await p.getByRole('textbox', { name: 'Password' }).fill(password);
    await p.getByRole('button', { name: 'Log in' }).click();

    // If the portal shows up quickly, skip MFA
    if (await this._appears(this.portalMarker, portalWaitMs)) return;

    // OTP screen expected
    const codeField = p.getByRole('textbox', { name: /Enter your one-time code|one[-\s]?time code|verification code|otp/i }).first();
    const verifyBtn = p.getByRole('button', { name: /Continue|Verify|Submit|Log in/i });
    if (!(await this._appears(codeField, otpWaitMs))) {
      throw new Error('Login failed fast: neither portal nor OTP screen appeared in time.');
    }

    // Attempt OTP submission
    const submitOtpOnce = async () => {
      const code = genTotp() || (ENV.MFA_CODE || '').trim(); // ✅ correct fallback
      if (!code) throw new Error('MFA required but TOTP_SECRET or MFA_CODE not set in .env');
     // await this.page.pause();
      await codeField.fill(code);
      
      await verifyBtn.click();
      const invalidMsg = p.getByText(/The code you entered is invalid|invalid code|expired/i).first();
      const invalid = await this._appears(invalidMsg, 2000);
      return !invalid;
    };

    // First try
    let ok = await submitOtpOnce();

    // If invalid and we used TOTP, wait for the next 30s window and retry once
    if (!ok && (ENV.TOTP_SECRET || '').trim()) {
      const remaining = typeof authenticator.timeRemaining === 'function'
        ? authenticator.timeRemaining()
        : 0;
      await p.waitForTimeout((remaining > 1 ? remaining + 1 : 2) * 1000);
      ok = await submitOtpOnce();
    }

    if (!ok) throw new Error('MFA did not succeed (invalid/expired code).');

    // Verify portal really loaded after MFA
    if (!(await this._appears(this.portalMarker, 10000))) {
      throw new Error('MFA succeeded but portal did not load in time.');
    }
  }

  // Helper: returns true if locator appears within timeout
  async _appears(locator, timeoutMs) {
    try {
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }
}
