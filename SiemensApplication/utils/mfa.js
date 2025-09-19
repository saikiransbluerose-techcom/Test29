// utils/mfa.js
import { authenticator } from 'otplib';
import { ENV } from './env.js';

// Configure TOTP library (step = 30s, 6 digits, allow ±1 window)
export function initTotpOptions({ step = 30, digits = 6, window = 1 } = {}) {
  authenticator.options = { step, digits, window };
}

// Seconds left in the current TOTP window (0 if not supported)
export function secondsLeftInTotpWindow() {
  return typeof authenticator.timeRemaining === 'function'
    ? authenticator.timeRemaining()
    : 0;
}

// Get an OTP code: prefer TOTP_SECRET, else fallback to MFA_CODE
export function getOtpCode() {
  const secret = (ENV.TOTP_SECRET || '').trim();
  if (secret) {
    if (!authenticator.options || !authenticator.options.step) initTotpOptions();
    return authenticator.generate(secret);
  }
  return (ENV.MFA_CODE || '').trim();
}

// Optional: default export
export default { initTotpOptions, secondsLeftInTotpWindow, getOtpCode };
