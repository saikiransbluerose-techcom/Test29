import { expect } from '@playwright/test';
import { Gadgets } from './gadgets.page.js';
import { expectVisibleAndHighlight } from '../utils/ui.js';

export class SummaryPage {
  constructor(page) { this.page = page; this.g = new Gadgets(page); }

  // Click Submit on Summary page, extract case ID, and return it
  async submitAndCaptureCaseId() {
    const { gadget1 } = this.g.frames();

    const submit = gadget1.getByRole('button', { name: 'Submit workflow' });
    await expect(submit).toBeVisible({ timeout: 15000 });   // wait for the real button

    await submit.click();

    // Case ID span becomes visible after submit
    const caseIdSpan = gadget1.getByTestId('20141009112850013217103');
    await expect(caseIdSpan).toBeVisible({ timeout: 30000 });

    const raw = (await caseIdSpan.textContent() || '').trim();
    const match = raw.match(/\(([^)]+)\)/);
    const caseId = match ? match[1] : raw.replace(/[()]/g, '');

    // Format check: APW-xxxxx
    await expect(caseIdSpan).toHaveText(/\(APW-\d+\)/);
    console.log('Case ID of Submitted Request', caseId);
    return caseId;
  }

  // Try to submit without an attachment and assert the validation error
  async triggerMissingAttachmentValidation() {
    const { gadget1 } = this.g.frames();
    const submit = gadget1.getByRole('button', { name: /Submit workflow/i });
    await expect(submit).toBeVisible({ timeout: 15_000 });
    await submit.click();

    // Find the banner and assert the specific message
    let banner = gadget1.getByRole('alert').first();
    try {
      await expect(banner).toBeVisible({ timeout: 10_000 });
    } catch {
      banner = gadget1.locator('[role="alert"], .pz-error, .errorFlag').first();
      await expect(banner).toBeVisible({ timeout: 10_000 });
    }

    // Assert the validation message appears
    await expect(banner.getByText(/ErrorMessage:\s*Please add at/i)).toBeVisible();
    console.log('Assertion Successful:When attachment is not uploaded error message appears');

    // Highlight the banner for debugging / screenshot
    await expectVisibleAndHighlight(this.page, banner);
  }
}
