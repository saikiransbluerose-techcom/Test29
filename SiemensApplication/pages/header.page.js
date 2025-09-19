// pages/header.page.js
import { expect } from '@playwright/test';
import { loadAppConfig } from '../utils/app.js';
const APP = loadAppConfig();

export class Header {
  constructor(page) { this.page = page; }

  // ------------------------------------------------------------
  // refreshTop:
  // - Click top refresh marker (testId or reload button)
  // - Wait for gadget iframe to attach (signal that UI is ready)
  // - Ensure left navigation toggle becomes visible
  // ------------------------------------------------------------
  async refreshTop() {
    const p = this.page;
    const id = APP.ui?.refreshTestId ?? '202107280807300617678';
    const marker = p.locator(`[data-test-id="${id}"]`)
      .or(p.getByRole('button', { name: /reload this page/i }));

    await expect(marker).toBeVisible({ timeout: 45_000 });
    await Promise.all([
      marker.click(),
      //  “ready” signal: first Pega gadget iframe attaches
      p.waitForSelector('iframe[name^="PegaGadget"]', { state: 'attached', timeout: 60_000 }),
    ]);

    await expect(p.getByRole('button', { name: /toggle left navigation/i }))
      .toBeVisible({ timeout: 10_000 });
  }

  // ------------------------------------------------------------
  // openStartWorkflowFromMenu:
  // - Open left navigation drawer if collapsed
  // - Click "New" (or "Create") entry
  // - If "Start Workflow" link is present, click it
  // - Wait until "Select Workflow" / "Start Workflow" heading is visible
  // ------------------------------------------------------------
  async openStartWorkflowFromMenu() {
    const p = this.page;
    const toggle = p.getByRole('button', { name: /toggle left navigation/i }).first();

    //  make sure the drawer is actually open
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 10_000 });
    }

    // Work inside the Left Panel 
    const leftPanel = p.getByRole('complementary', { name: /left panel/i });


    // Click “New” Link
    const newItem = leftPanel.getByRole('menuitem', { name: /\b(new|create)\b/i }).first();
    await expect(newItem).toBeVisible({ timeout: 20_000 });
    await newItem.click();

    // Try a Start Workflow entry if it exist
    const startItem = leftPanel
      .locator(':is([role="menuitem"], [role="link"], button)', { hasText: /start workflow|démarrer le workflow/i })
      .first();

    if (await startItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await startItem.click(); // click auto-scrolls; no explicit scrollIntoViewIfNeeded needed
    }

    // Wait for Select workflow to be visible
    const g1 = p.frameLocator('iframe[name="PegaGadget1Ifr"]');
    await expect(g1.getByRole('heading', { name: /(Select Workflow|Start Workflow)/i }))
      .toBeVisible({ timeout: 60_000 });
  }

  async refreshAndEnterStartWorkflow() {
    await this.refreshTop();
    await this.openStartWorkflowFromMenu();
  }
}
