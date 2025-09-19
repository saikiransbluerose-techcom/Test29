// pages/portal-approver.page.js
import { expect } from '@playwright/test';
import { loadAppConfig } from '../utils/app.js';
import { Gadgets } from './gadgets.page.js';
import { SimpleForm } from '../utils/simpleForm.js';

const APP = loadAppConfig();

export class ApproverPortal {
  constructor(page) {
    this.page = page;
    this.g = new Gadgets(page);
    this.form = new SimpleForm(page);
  }

  frames() { return this.g.frames(); }

  // Login to the approver portal (clears cookies/storage, handles pre-logged-in state)
  async login(username, password) {
    await this.page.context().clearCookies();
    await this.page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });

    await this.page.goto(APP.urls.portalRoot, { waitUntil: 'domcontentloaded' });

    // Log out if a previous session is detected
    const logoutBtn = this.page.getByTestId('202203110911550900696');
    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await expect(this.page.getByRole('textbox', { name: /^User\s*name/i }))
        .toBeVisible({ timeout: 20_000 });
    }

    // Username/password login
    const user = this.page.getByRole('textbox', { name: /User name \*/i });
    await expect(user).toBeVisible({ timeout: 20_000 });
    await user.fill(username);
    await this.page.getByRole('textbox', { name: 'Password *' }).fill(password);
    await this.page.getByRole('button', { name: 'Log in' }).click();

    await expect(this.page.getByTestId('202203110911550900696'))
      .toBeVisible({ timeout: 30_000 });
  }

  // Open a case from Worklist with filtering, reload/poll, and lock handling
  async openCaseFromWorklist(
    caseId,
    {
      appearTimeoutMs = 60_000,
      pollIntervalMs = 3_000,
      lockRetries = 2,
      lockBackoffMs = 5_000,
    } = {}
  ) {
    const { gadget0 } = this.frames();
    const worklist = gadget0.getByRole('table', { name: /^Worklist$/ });
    await expect(worklist).toBeVisible({ timeout: 30_000 });

    // Filter the Worklist by ID; returns the case link if found
    const filterOnce = async () => {
      const idHeader = worklist.getByRole('columnheader', { name: /^ID$/ });
      const filter = idHeader.getByRole('link', { name: 'Click to filter' });
      await expect(filter).toHaveCount(1);
      await filter.click();

      const dialog = gadget0.getByRole('dialog').first();
      const dialogInput = dialog.locator('input[type="text"], [role="textbox"], [role="combobox"]').first();
      const inlineInput = idHeader.locator('input[type="text"], [role="textbox"], [role="combobox"]').first();
      const input = (await dialog.isVisible().catch(() => false)) ? dialogInput : inlineInput;

      await expect(input).toBeEditable({ timeout: 15_000 });
      await input.fill(caseId);

      const ok = gadget0.getByRole('button', { name: /^(OK|Apply|Submit)$/i }).first();
      if (await ok.isVisible().catch(() => false)) await ok.click();
      else await input.press('Enter');

      const link = gadget0.getByRole('link', { name: caseId }).first();
      return (await link.isVisible().catch(() => false)) ? link : null;
    };

    // Poll until the case appears (handles indexing/assignment delay)
    const deadline = Date.now() + appearTimeoutMs;
    let caseLink = null;
    while (Date.now() < deadline) {
      await this.g.maybeReload(); // handle "Reload this page..." banner
      caseLink = await filterOnce();
      if (caseLink) break;

      await this.page.waitForTimeout(pollIntervalMs);
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await expect(worklist).toBeVisible({ timeout: 30_000 });
    }
    if (!caseLink) throw new Error(`Case ${caseId} did not appear within ${appearTimeoutMs} ms`);

    // Open the case
    await caseLink.click();

    // Detect editability vs. lock banner; retry if locked
    const g1 = await this.g.ensureFreshGadget1();
    const edit = g1.getByRole('button', { name: 'Edit Fields' });
    const locked = g1.getByRole('alert').filter({ hasText: /Unable to unlock this work object/i }).first();

    if (await edit.isVisible().catch(() => false)) return;

    for (let i = 0; i <= lockRetries; i++) {
      if (!(await locked.isVisible().catch(() => false))) {
        await expect(edit).toBeVisible({ timeout: 15_000 });
        return;
      }
      if (i < lockRetries) {
        await this.page.waitForTimeout(lockBackoffMs);
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await expect(worklist).toBeVisible({ timeout: 30_000 });
        const relink = await filterOnce();
        if (relink) {
          await relink.click();
          const editAgain = (await this.g.ensureFreshGadget1()).getByRole('button', { name: 'Edit Fields' });
          if (await editAgain.isVisible().catch(() => false)) return;
        }
      } else {
        throw new Error('Case is locked by another operator after multiple retries.');
      }
    }
  }



  // Confirm the comment dialog flow; retries when a parent-case lock banner appears
  async _confirmCommentWithRetry(gadget1, comment, { retries = 3, backoffMs = 3000 } = {}) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const commentBox = gadget1.getByTestId('20151221093021020184414');
      const proceedBtn = gadget1.getByTestId('2015090805444404955925');   // proceed/submit in dialog
      const confirmBtn = gadget1.getByTestId('201801251600250687413552'); // confirm/ok in dialog
      const lockAlert = gadget1.getByRole('alert').filter({ hasText: /parent case.*locked/i });

      await expect(commentBox).toBeVisible({ timeout: 15_000 });
      await commentBox.fill(comment || '');

      await proceedBtn.click();

      try {
        await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
        await confirmBtn.click({ timeout: 10_000 });
        return; // success
      } catch (err) {
        // If lock banner is visible, backoff, refresh/rebind frame and retry
        if (await lockAlert.isVisible().catch(() => false)) {
          if (attempt === retries) throw err;
          await this.page.waitForTimeout(backoffMs);
          // Refresh/rebind gadget1 to clear transient state
          await this.g.maybeReload?.();
          const { gadget1: g1 } = this.frames();
          gadget1 = g1;
          continue;
        }
        // Unknown reason — bubble up
        throw err;
      }
    }
  }

  // Select <option> by label with presence checks and a value fallback
  async selectByLabelSafe(root, selector, label, { timeout = 30_000 } = {}) {
    if (!label && label !== 0) return; // nothing to set
    const sel = typeof selector === 'string' ? root.locator(selector) : selector;

    await sel.waitFor({ state: 'attached', timeout });
    await expect(sel).toBeVisible({ timeout });
    await expect(sel).toBeEnabled({ timeout });

    // wait until the option text is present
    await expect
      .poll(async () => {
        return await sel.evaluate((el, lab) => {
          const options = Array.from(el.options ?? []);
          return options.some(o => (o.textContent || '').trim() === String(lab).trim());
        }, label);
      }, { timeout, message: `Waiting for option "${label}" to appear` })
      .toBeTruthy();

    // try label; if that fails, resolve to value and select that
    try {
      await sel.selectOption({ label: String(label).trim() }, { timeout });
    } catch {
      const value = await sel.evaluate((el, lab) => {
        const opt = Array.from(el.options ?? []).find(o => (o.textContent || '').trim() === String(lab).trim());
        return opt?.value ?? null;
      }, label);
      if (!value) throw new Error(`Option with label "${label}" not found`);
      await sel.selectOption(value, { timeout });
    }
  }

  // Expand a collapsible section if it is currently collapsed
  async ensureSectionExpanded(root, sectionTitle) {
    const toggle = root.getByRole('button', { name: new RegExp(`^${sectionTitle}$`, 'i') }).first();
    const expanded = await toggle.getAttribute('aria-expanded').catch(() => null);
    if (expanded === 'false') {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Approve a case via Stage 1 and/or Stage 2.
   * fields = {
   *   comment: string,
   *   stage1?: { impact, prediction, discovery, optionalDescription?, remarks?, releaseRecommendation? },
   *   stage2?: { impact, prediction, discovery, actionPriority?, approvalRequired?, releaseRecommendation? }
   * }
   */
  async approveWith(fields, { logoutAfter = false } = {}) {
    const { gadget1 } = this.frames();

    // --- Enter edit mode
    const editBtn = gadget1.getByRole('button', { name: 'Edit Fields' });
    await expect(editBtn).toBeVisible({ timeout: 30_000 });
    await editBtn.click();
    await expect(gadget1.locator('select:enabled').first()).toBeEnabled({ timeout: 30_000 });

    // ===================
    // ---- Stage 1 ------
    // ===================
    if (fields.stage1) {
      await this.selectByLabelSafe(
        gadget1,
        'select[name="$PInitialFormTemp$pTaskPriorityRatingsPageList$l3$pTask_ImpactProductPlant"]',
        fields.stage1.impact
      );
      await this.selectByLabelSafe(
        gadget1,
        'select[name="$PInitialFormTemp$pTaskPriorityRatingsPageList$l3$pTask_PredictionOfOccurrence"]',
        fields.stage1.prediction
      );
      await this.selectByLabelSafe(
        gadget1,
        'select[name="$PInitialFormTemp$pTaskPriorityRatingsPageList$l3$pTask_DiscoveryAbility"]',
        fields.stage1.discovery
      );

      if (fields.stage1.optionalDescription) {
        await gadget1.locator('#bcf73433').fill(fields.stage1.optionalDescription);
      }
      if (fields.stage1.remarks) {
        await gadget1
          .locator('input[name="$PInitialFormTemp$pTaskPriorityRatingsPageList$l3$pTask_Remarks"]')
          .fill(fields.stage1.remarks);
      }

      // Release recommendation (Production row)
      const releaseSelect = gadget1
        .locator('table')
        .locator('tr:has-text("Production")')
        .locator('select[name*="ReleaseRecommendation"]:enabled')
        .first();
      await this.selectByLabelSafe(gadget1, releaseSelect, fields.stage1.releaseRecommendation);

      // Submit Stage 1
      const submitBtn1 = gadget1.getByRole('button', { name: 'Submit' });
      await expect(submitBtn1).toBeVisible({ timeout: 30_000 });
      await submitBtn1.click();
      await this.page.locator('.loading, .spinner, [aria-busy="true"]')
        .waitFor({ state: 'hidden', timeout: 60_000 });

      await this._confirmCommentWithRetry(gadget1, fields.comment);
    }

    // Ensure Stage 2 area is visible before touching selects

    if (fields.stage2) { await this.ensureSectionExpanded(gadget1, 'Risk Level'); }

    // ===================
    // ---- Stage 2 ------
    // ===================
    if (fields.stage2) {
      // Wait until first select is enabled
      const impactSel = gadget1.locator('select[name="$PInitialFormTemp$pImpactProductPlant"]');
      await expect(impactSel).toBeAttached({ timeout: 30_000 });
      await expect(impactSel).toBeVisible({ timeout: 30_000 });
      await expect(impactSel).toBeEnabled({ timeout: 30_000 });

      await this.selectByLabelSafe(
        gadget1,
        'select[name="$PInitialFormTemp$pImpactProductPlant"]',
        fields.stage2.impact
      );
      await this.selectByLabelSafe(
        gadget1,
        'select[name="$PInitialFormTemp$pPredictionOfOccurrence"]',
        fields.stage2.prediction
      );
      await this.selectByLabelSafe(
        gadget1,
        'select[name="$PInitialFormTemp$pDiscoveryAbility"]',
        fields.stage2.discovery
      );

      if (fields.stage2.actionPriority) {
        await this.selectByLabelSafe(
          gadget1,
          gadget1.getByLabel('Define action priority by AP-'),
          fields.stage2.actionPriority
        );
      }
      if (fields.stage2.approvalRequired) {
        await this.selectByLabelSafe(
          gadget1,
          gadget1.getByLabel('Is customer approval required?'),
          fields.stage2.approvalRequired
        );
      }
      await this.selectByLabelSafe(
        gadget1,
        'select[name="$PInitialFormTemp$pReleaseRecommendation"]',
        fields.stage2.releaseRecommendation
      );

      // Submit Stage 2
      const submitBtn2 = gadget1.getByRole('button', { name: 'Submit' });
      await expect(submitBtn2).toBeVisible({ timeout: 30_000 });
      await submitBtn2.click();
      await this.page.locator('.loading, .spinner, [aria-busy="true"]')
        .waitFor({ state: 'hidden', timeout: 60_000 });

      await this._confirmCommentWithRetry(gadget1, fields.comment);
    }

    if (logoutAfter) {
      await this.page.getByTestId('202203110911550900696').click();
    }
  }

  // Open Overview, verify Resolved-Completed, open Audit,  sign out
  async auditAndClose() {
    const { gadget2 } = this.frames();
    await gadget2.getByText('Overview').click();

    const statusBadge = gadget2
      .getByTestId('2016083016191602341167946')
      .nth(1);

    // Assert it’s visible
    await expect(statusBadge).toBeVisible({ timeout: 120_000 });

    // Assert it has the expected status text
    await expect(statusBadge).toHaveText(/resolved[\s-]?completed/i, { timeout: 120_000 });

    console.log('Assertion Successful: Case is closed with Status-Resolved Completed');

    await gadget2
      .locator('[data-test-id="202105050818560080933_header"]')
      .getByText('Case details')
      .click();
    await gadget2.getByText('Audit').click();

    await this.page.getByTestId('202203110911550900696').click();

  }
}
