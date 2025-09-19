// SiemensApplication/tests/completeWorkFlow1WithExcelAndConfig.spec.js
import { test } from '@playwright/test';
import { readExcelScenario } from '../utils/data.js';
import { runWorkflow } from '../flows/requestor.flow.js';
import { runApprovals } from '../flows/approvals.flow.js';

const SCENARIO = (process.env.SCENARIO ?? 'Test Data 1').trim();

test(`Workflow 1 — ${SCENARIO}`, async ({ browser }) => {
  // 1) Read the scenario once (assignees + approvals come filtered)
  const { ASSIGNEES, APPROVALS } = readExcelScenario(SCENARIO);

  // 2) Create the case (requestor flow)
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { caseId } = await runWorkflow(page, 1, { scenario: SCENARIO });
  await ctx.close();

});
