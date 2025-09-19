// pages/work-details.page.js
import { expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { Gadgets } from './gadgets.page.js';
import path from 'node:path';
import { expectVisibleAndHighlight } from '../utils/ui.js'; //
import { fileURLToPath } from 'node:url';

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// pages/ → (..) → SiemensApplication
const appRoot = path.resolve(__dirname, '..');

// Resolve relative asset paths from app root
const resolveAsset = (p) =>
  path.isAbsolute(p) ? p : path.resolve(appRoot, p.replace(/^\.?[\\/]/, ''));


export class WorkDetailsPage {
  constructor(page) {
    this.page = page;
    this.g = new Gadgets(page);
  }

  // Fill the main Work Details section; optional skips for validation tests
  async fillCore(sw, { skipArticleTitle = false, skipPartsChecked = false } = {}) {

    const { gadget1 } = this.g.frames();

    const itemNo = gadget1.getByRole('combobox', { name: 'Item No. / Index' });

    await itemNo.scrollIntoViewIfNeeded();
    await expect(itemNo).toBeVisible({ timeout: 20000 });
    await expect(itemNo).toBeEditable({ timeout: 20000 });

    await itemNo.click();
    await itemNo.fill(String(sw.itemIndex));

    // Pega AutoComplete: commit with Enter (or ArrowDown+Enter if needed)
    await itemNo.press('Enter');
    await itemNo.press('Tab');


    if (!skipArticleTitle) {
      await gadget1.getByLabel('Article title').fill(sw.articleTitle);
      await gadget1.getByLabel('Article title').press('Tab');
    }

    await gadget1.getByLabel('Article title').press('Tab');

    await gadget1.getByLabel('Specification / Target state').fill(sw.specTarget);
    await gadget1.getByLabel('Specification / Target state').press('Tab');

    await gadget1.getByLabel('Description of the deviation').fill(sw.deviationDesc);
    await gadget1.getByLabel('Description of the deviation').press('Tab');

    if (!skipPartsChecked) {
      await gadget1.getByLabel('Number of parts checked').fill(sw.partsChecked);
      await gadget1.getByLabel('Number of parts checked').press('Tab');
    }

    await gadget1.getByLabel('Number of parts checked').press('Tab');

    await gadget1.getByLabel('Failure rate').fill(sw.failureRate);
  }

  // Cause known = Yes path
  async setCauseKnownYes(sw) {
    const { gadget1 } = this.g.frames();
    await gadget1.getByLabel('Is the cause known?').selectOption(sw.causeKnown);
    await gadget1.getByLabel('Corrective action defined?').selectOption(sw.correctiveDefined);
  }

  // Cause known = No path (assigns owner via directory search)
  async setCauseKnownNo(sw, assigneeSearchText, assigneeDisplay) {
    const { gadget1 } = this.g.frames();
    await gadget1.getByLabel('Is the cause known?').selectOption(sw.causeKnown2);

    const input = gadget1.getByRole('textbox', { name: /.*lastname.*firstname.*,?/i });
    await expect(input).toBeVisible({ timeout: 30000 });
    await expect(input).toBeEditable({ timeout: 30000 });
    await input.fill(assigneeSearchText);

    // Wait for the assignee display text to appear and click on it
    const assigneeOption = gadget1.getByText(assigneeDisplay);
    await expect(assigneeOption).toBeVisible({ timeout: 30000 });
    await assigneeOption.click();

    // Select the "Corrective Action Defined" option
    const correctiveActionSelect = gadget1.getByLabel('Corrective action defined?');
    await expect(correctiveActionSelect).toBeVisible({ timeout: 30000 });
    await correctiveActionSelect.selectOption(sw.correctiveDefined);
  }

  async moreFields(sw, { skipCorrectiveAction = false } = {}) {
    const { gadget1 } = this.g.frames();

    await gadget1.getByLabel('Quantity').fill(sw.quantity);
    await gadget1.getByLabel('Quantity').press('Tab');

    // ---- Date field ----
    const dateField = gadget1.getByRole('textbox', { name: 'Date' });
    await expect(dateField).toBeVisible({ timeout: 30000 });
    await expect(dateField).toBeEditable({ timeout: 30000 });
    await dateField.fill(sw.dateISO);
    await dateField.press('Tab'); // commit the value

    // ---- Change number ----
    await gadget1.getByLabel('Change number').fill(sw.changeNumber);

    // No .or(), no heading scrolls
    await this.page.keyboard.press('Escape');
    await expect(gadget1.getByText(/Superordinate Art\. Numbers/i)).toBeVisible();

    const addItem = gadget1.locator('a[data-test-id="20160721092326035219972"]');
    await addItem.click();

    const editor = gadget1.locator('[data-test-id="2016072109335505834280"]').last();
    await expect(editor).toBeVisible();
    await editor.click();                      // activate inline editor
    await editor.fill(sw.superOrdinateArticleNo);
    await editor.press('Tab');                 // commit the value
    await expect(editor).toHaveValue(sw.superOrdinateArticleNo);

    // ---- Rest of fields ----
    await gadget1.getByLabel('3D - Corrective measures').fill(sw.measures3D);
    await gadget1.getByLabel('Affected customer and / or').fill(sw.affectedCustomer);
    await gadget1.getByLabel('Causing process').selectOption(sw.causingProcess);
    await gadget1.getByLabel('Requirements for special').selectOption(sw.reqSpecial);
    await gadget1.getByLabel('Is there a need for changes').selectOption(sw.needChanges);
    await gadget1.getByLabel('Does the delivery to the').selectOption(sw.deliveryImpact);

    if (sw.rootCauseAnalysis) {
      await gadget1.getByLabel('Root cause analysis').fill(sw.rootCauseAnalysis);
    }


    if (!skipCorrectiveAction) {
      await gadget1.getByRole('textbox', { name: 'Corrective action' }).fill(sw.correctiveAction);
    }

    await this.page.keyboard.press('Escape');
  }

  // Upload an attachment and optionally proceed
  async uploadAndNext({ uploadFilePath, clickNext = true } = {}) {

    if (!uploadFilePath) throw new Error('uploadFilePath missing');

    const abs = resolveAsset(uploadFilePath); // e.g. "test-data/attachment.pdf"
    try { await fs.access(abs); } catch { throw new Error(`Upload file not found: ${abs}`); }

    await this.page.keyboard.press('Escape');

    const { gadget1: g1 } = this.g.frames();

    const addAttachmentLink = g1.locator('a[data-test-id="2015111614330806168211"]').first();
    await expect(addAttachmentLink).toBeVisible();
    await addAttachmentLink.scrollIntoViewIfNeeded();  // precise + robust
    await addAttachmentLink.click();

    const dialog = g1.getByRole('dialog', { name: /attach file\(s\)/i });
    await expect(dialog).toBeVisible();

    const fileInput = dialog.locator('input[type="file"][name="$PpyAttachmentPage$ppxAttachName"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles(abs);

    await dialog.getByRole('button', { name: /^Attach$/ }).click();
    await expect(dialog).toBeHidden();


    // ... Next/Submit logic

    // Optionally click Next/Submit
    if (clickNext) {
      const { gadget1: g2 } = this.g.frames();
      await g2.locator('body').evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const nextBtn = g2.getByRole('button', { name: /^(Next|Submit)$/ });
      await expect(nextBtn).toBeVisible({ timeout: 30_000 });
      await expect(nextBtn).toBeEnabled({ timeout: 30_000 });
      await nextBtn.click();
    }
  }

  // Click the page Save/Next button
  async save() {
    const { gadget1 } = this.g.frames();
    // this is the same testId you already click in uploadAndNext()
    await gadget1.getByTestId('20150908171228012736690').click();
  }

  // Fill only the fields used by the validation test
  async fillMainFields(sw) {
    const { gadget1 } = this.g.frames();

    // Article title (combobox)
    await gadget1.getByLabel('Article title').fill(sw.articleTitle);
    await gadget1.getByLabel('Article title').press('Tab'); // commit/blur

    // Number of parts checked
    await gadget1.getByLabel('Number of parts checked').fill(sw.partsChecked);
    await gadget1.getByLabel('Number of parts checked').press('Tab');

    // Corrective action
    await gadget1.getByRole('textbox', { name: 'Corrective action' }).fill(sw.correctiveAction);
  }

  // Assert the three required-field messages appear next to their fields
  async expectThreeFieldErrors() {
    const { gadget1 } = this.g.frames();

    // helper: look for a typical required/blank message close to a field
    const expectRequiredNear = async (fieldLoc) => {
      const container = fieldLoc.locator(
        'xpath=ancestor::*[@role="group" or self::div or self::td][1]'
      );
      await expect(
        container.getByText(/(required|This field cannot be blank|This field|Pflichtfeld)/i).first()
      ).toBeVisible({ timeout: 15_000 });

    };

    await expectRequiredNear(gadget1.getByLabel('Article title'));
    await expectRequiredNear(gadget1.getByLabel('Number of parts checked'));
    await expectRequiredNear(gadget1.getByRole('textbox', { name: 'Corrective action' }));
    console.log('Assertion Successful:When Mandatory fields are not filled in error message appears');
  }

  // Assert the top banner lists all three errors and highlight it
  async expectTopBannerErrorsAndHighlight() {
    const { gadget1 } = this.g.frames();

    let banner = gadget1.getByRole('alert').first();
    try {
      await expect(banner).toBeVisible({ timeout: 10_000 });
    } catch {

      banner = gadget1.locator('[role="alert"], .pz-error, .errorFlag').first();
      await expect(banner).toBeVisible({ timeout: 10_000 });
    }
    await expect(banner.getByText(/NumberOfPartsChecked:\s*This field cannot be blank/i)).toBeVisible();
    await expect(banner.getByText(/Article\s*title:\s*This field cannot be blank/i)).toBeVisible();
    await expect(banner.getByText(/Corrective\s*Action:\s*This field cannot be blank/i)).toBeVisible();

    // ✨ highlight using the shared helper
    await expectVisibleAndHighlight(this.page, banner);
  }

}
