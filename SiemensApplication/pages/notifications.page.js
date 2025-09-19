// pages/notifications.page.js
import { expect } from '@playwright/test';
import { Gadgets } from './gadgets.page.js';

const NAME_RX = /lastname.*firstname/i;
const escapeRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class NotificationsPage {
  constructor(page) {
    this.page = page;
    this.g = new Gadgets(page);
  }


  //Refresh by re-selecting the Notifications tab in the center panel.
  async refreshInline() {
    const { gadget1 } = this.g.frames();
    await gadget1.getByRole('link', { name: 'Notifications', exact: true }).click({ timeout: 10_000 });
    await gadget1.getByRole('link', { name: 'Add user', exact: true })
      .waitFor({ state: 'visible', timeout: 30_000 });
  }

  // Add a directory user by searching with text and selecting from results
  async addDirectoryUserByText(searchText, displayText) {

    await this.refreshInline();
    const { gadget1 } = this.g.frames();

    // Click on Add User Link
    const addUser = gadget1.getByRole('link', { name: 'Add user', exact: true });
    await expect(addUser).toBeVisible({ timeout: 30_000 });
    await addUser.click();

    // Target the active directory textbox (accessible name seen in your snapshot)
    const input = gadget1.getByRole('textbox', { name: /.*lastname.*firstname.*,?/i });
    await expect(input).toBeEditable({ timeout: 30_000 });

    // Enter the User Name
    await input.fill(searchText);

    // Wait for the User email options to show and select the correct user by display text
    const emailOption = gadget1.getByText(displayText);
    await expect(emailOption).toBeVisible({ timeout: 20000 }); // Ensure the user is visible
    await emailOption.click(); // Select the user by clicking on it


  }

  // Add a  email notification 
  async addEmailIfPresent(email) {
    await this.refreshInline();

    const { gadget1 } = this.g.frames();

    // Click on Email ID Link
    const addEmailLink = gadget1.getByRole('link', { name: /^\+?\s*Add User Email$/i });
    await expect(addEmailLink).toBeVisible({ timeout: 30_000 });

    // Wait for Email Id Field to appear
    const emailInput =
      gadget1.locator('input[type="email"]').first()
        .or(gadget1.getByRole('textbox', { name: /email/i }).first())
        .or(gadget1.getByTestId('20160908075844034240762').first());

    // Click on Email ID
    await Promise.all([
      addEmailLink.click(),
      emailInput.waitFor({ state: 'visible', timeout: 30_000 }),
    ]);

    await expect(emailInput).toBeEditable({ timeout: 30_000 });
    await emailInput.fill(email);

    // Optional: confirm no validation and that the email shows in the Notify table
    const invalid = gadget1.getByText('Enter a valid email address', { exact: true });
    if (await invalid.isVisible().catch(() => false)) {
      throw new Error(`Invalid email address: ${email}`);
    }

  }

  // Proceed to the next screen, waiting for busy spinners to clear
  async next() {
    // Click Next using the current frame
    const { gadget1 } = this.g.frames();
    const nextBtn = gadget1.getByRole('button', { name: /^Next$/i }).first();
    await expect(nextBtn).toBeEnabled({ timeout: 30_000 });
    await nextBtn.click();

    // Reacquire gadget1 after navigation
    const g1 = this.page.frameLocator('iframe[name="PegaGadget1Ifr"]');

    // Guard against spinners (iframe-level and top-level)
    const guard = async (loc) => {
      await loc.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => { });
      await loc.waitFor({ state: 'detached', timeout: 120_000 }).catch(() => { });
    };
    await Promise.all([
      guard(g1.getByRole('progressbar', { name: /loading content/i })), // in-frame spinner
      guard(this.page.getByRole('progressbar', { name: /loading content/i })), // top-level spinner (if any)
    ]);

    // Stable marker on Summary page
    await expect(g1.getByRole('link', { name: 'Summary', exact: true }))
      .toBeVisible({ timeout: 90_000 });

  }

}
