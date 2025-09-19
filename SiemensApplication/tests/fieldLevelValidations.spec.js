// tests/fieldLevelValidations.spec.js
import { test } from '@playwright/test';
import { runWorkflow } from '../flows/requestor.flow.js';

test('WF1: 3-field validation on Work Details, then continue', async ({ browser }) => {

  // ------------------------------------------------------------
  // STEP 1: Open a new isolated browser context
  // ------------------------------------------------------------

  const ctx = await browser.newContext();     // fresh, isolated context
  const page = await ctx.newPage();
  try {

    // ------------------------------------------------------------
    // STEP 2: Run workflow in validation mode
    // - Targets 3-field validation on Work Details
    // - Continues after validation is checked
    // ------------------------------------------------------------
    await runWorkflow(page, 1, { mode: 'validation' });
  } finally {
    // ------------------------------------------------------------
    // STEP 3: Close the browser context (cleanup)
    // ------------------------------------------------------------
    await ctx.close();
  }
});
