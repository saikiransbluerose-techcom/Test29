// tests/workflow1.single.spec.ts
import { test } from '@playwright/test';
import { readExcelScenario } from '../utils/data.js';
import { runWorkflow } from '../flows/requestor.flow.js';
import { runApprovals } from '../flows/approvals.flow.js';


// Pick scenario from ENV or default to "Test Data 1"
// (Scenario name must match one in the Excel file)
const SCENARIO = process.env.SCENARIO ?? 'Test Data 1'; // set via env or keep "Default"

// ------------------------------------------------------------
// STEP 1: Read input data for this scenario from Excel
// - ASSIGNEES: list of users that will be involved in the case
// - APPROVALS: list of approvers per stage (already filtered)
// ------------------------------------------------------------

test(`Workflow 2: Cause Known = No — ${SCENARIO}`, async ({ browser }) => {
  const { ASSIGNEES, APPROVALS } = readExcelScenario(SCENARIO);

  // ------------------------------------------------------------
  // STEP 2: Requestor flow — create a new case
  // - Open a fresh browser context (acts as the requestor)
  // - Run the requestor workflow (fills and submits the form)
  // - Capture the generated caseId for later steps
  // - Close requestor context (cleanup)
  // ------------------------------------------------------------
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { caseId } = await runWorkflow(page, 2, { scenario: SCENARIO });
  await ctx.close();

  // ------------------------------------------------------------
  // STEP 3: Approvals flow — process the case through all stages
  // - Reuse the same caseId created above
  // - Loop through approvals data (stage1 + stage2 per approver)
  // - Execute each approver’s tasks
  // ------------------------------------------------------------
  await runApprovals(browser, caseId, { ASSIGNEES, APPROVALS });
});
