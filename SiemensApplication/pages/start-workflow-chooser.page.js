import { expect } from '@playwright/test';
import { Gadgets } from './gadgets.page.js';

export class StartWorkflowChooserPage {
  constructor(page) { this.page = page; this.g = new Gadgets(page); }

  // Select a case type and workflow, then proceed to Work Details
  async selectCaseAndWorkflow({ flowClassId, workflowId }) {
    const g1 = this.page.frameLocator('iframe[name="PegaGadget1Ifr"]');

    // Wait for the page to be ready
    await expect(g1.getByRole('heading', { name: /Select Workflow/i }))
      .toBeVisible({ timeout: 120_000 });

    // Choose case type + workflow
    const caseType = g1.getByRole('combobox', { name: /^Case type\*/ });
    await caseType.selectOption({ value: flowClassId });

    const workflow = g1.getByRole('combobox', { name: /^Workflow\*/ });
    await workflow.selectOption({ label: workflowId });

    // Locators for transient loaders
    const spinner = g1.getByRole('progressbar', { name: /loading content/i }).first();
    const submittingBtn = g1.getByRole('button', { name: /^Submitting\.\.\.$/ }).first();

    // Wait until Work Details form is rendered
    const waitForNextUi = async (timeoutMs = 180_000) => {
      await g1.getByLabel('Item No. / Index').waitFor({ state: 'visible', timeout: timeoutMs });
      await expect(spinner).toBeHidden({ timeout: timeoutMs });
      await expect(submittingBtn).toBeHidden({ timeout: timeoutMs });
    };

    // Click "Start Workflow" and retry once if it times out
    let startBtn = g1.getByRole('button', { name: 'Start Workflow' });

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await Promise.all([
          startBtn.click(),
          waitForNextUi(120_000),
        ]);
        break;                              // success
      } catch (err) {
        if (attempt === 2) throw err;
        console.warn('Start Workflow took too long; retrying once...');

        // Reacquire frame and button if iframe reloaded
        await expect(g1.getByRole('heading', { name: /Select Workflow/i }))
          .toBeVisible({ timeout: 120_000 });
        startBtn = g1.getByRole('button', { name: 'Start Workflow' });
      }
    }

    // Positive assertion: confirm Work Details page is active
    await expect(g1.getByLabel('Item No. / Index'))
      .toBeVisible({ timeout: 120_000 });
  }


}
