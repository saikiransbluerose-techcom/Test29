// pages/login-otp.helper.js
import { expect } from '@playwright/test';
import { secondsLeftInTotpWindow, getOtpCode } from '../utils/mfa.js';

/**
 * enterOtpWithRetries:
 * - Up to maxAttempts tries
 * - If current TOTP is near expiry (< 4s), wait for next window
 * - After submit, if an "invalid/expired" message appears, retry
 */
export async function enterOtpWithRetries(page, codeField, verifyBtn, { maxAttempts = 3 } = {}) {
  let attempt = 1;

  while (attempt <= maxAttempts) {

    // If TOTP window is about to expire, wait for a fresh code
    const remain = secondsLeftInTotpWindow();

    console.log('remain value', remain);
    if (remain < 4) {
      await page.waitForTimeout((remain + 1) * 1000); // roll into a fresh code window
    }

    // Generate code and submit
    const code = getOtpCode();
    console.log('TOTP', code);

    if (!code) throw new Error('MFA required but neither TOTP_SECRET nor MFA_CODE is set.');
    await codeField.fill(code);
    await verifyBtn.click();


    // Check for invalid/expired feedback; retry if present
    const invalidMsg = page.getByText(/invalid|expired/i).first();
    const bad = await invalidMsg.isVisible().catch(() => false);
    if (!bad) return; // success (no invalid banner)

    attempt += 1;
  }


  // Exhausted attempts -> fail
  throw new Error('MFA did not succeed after multiple attempts.');
}

//  Default exports
export default enterOtpWithRetries;
