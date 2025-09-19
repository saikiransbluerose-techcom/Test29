// SiemensApplication/pages/login.page.js
import { loadAppConfig } from '../utils/app.js';
import { ENV } from '../utils/env.js';


const APP = loadAppConfig();


export class LoginWithNonSSOPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.portalMarker = this.page.locator(
      `[data-test-id="${APP.ui.refreshTestId}"]`
    ); // marker we expect after successful login
  }

  async goto() {
    const url = (APP.urls.portalRoot || '').trim();
    if (!url) throw new Error('Missing loginStart in config');
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async loginWithNonSSOUser(email, password, { portalWaitMs = 5000} = {}) {
    const p = this.page;

    //  Login with Non SSO User
    await p.getByRole('textbox', { name: 'User name *' }).click();
    await p.getByRole('textbox', { name: 'User name *' }).fill(email);

    await p.getByRole('textbox', { name: 'Password *' }).click();
    await p.getByRole('textbox', { name: 'Password *' }).fill(password);
    await p.getByRole('button', { name: 'Log in' }).click();

    if (await this._appears(this.portalMarker, portalWaitMs)) return;

   
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
