// gadgets.page.js
import { loadAppConfig } from '../utils/app.js';
const APP = loadAppConfig();

export class Gadgets {
  constructor(page) { this.page = page; }

  // ------------------------------------------------------------
  // Frames: convenient accessors for gadget iframes
  // ------------------------------------------------------------
  frames() {
    return {
      gadget0: this.page.frameLocator('iframe[name="PegaGadget0Ifr"]'),
      gadget1: this.page.frameLocator('iframe[name="PegaGadget1Ifr"]'),
      gadget2: this.page.frameLocator('iframe[name="PegaGadget2Ifr"]'),
      any: this.page.frameLocator('iframe[name^="PegaGadget"]'),
    };
  }

  // ------------------------------------------------------------
  // - Try to detect "reload" marker (testId, banner, or button)
  // - If found, click to reload and wait for gadgets to reattach
  // - Returns true if a reload was performed
  // ------------------------------------------------------------
  async maybeReload() {
    const p = this.page;
    const refreshId = APP.ui?.refreshTestId ?? '202107280807300617678';
    const bannerId = APP.ui?.reloadBannerTid; // may be undefined in your env

    const refreshMarker = p.getByTestId(refreshId)
      .or(bannerId ? p.getByTestId(bannerId) : p.locator(':nth-match(*)', 0)) // harmless noop if missing
      .or(p.getByRole('button', { name: /reload this page/i }));

    if (await refreshMarker.isVisible().catch(() => false)) {
      await Promise.all([
        refreshMarker.click(),
        p.waitForSelector('iframe[name^="PegaGadget"]', { state: 'attached', timeout: 60_000 }),
      ]);
      // tiny settle
      await p.waitForTimeout(300);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------
  // ensureFreshGadget1:
  // - Reload page if needed
  // - Return frame locator for gadget1
  // ------------------------------------------------------------
  async ensureFreshGadget1() {
    await this.maybeReload();
    return this.page.frameLocator('iframe[name="PegaGadget1Ifr"]');
  }
}
