// flows/approvals.flow.js
import path from 'path';
import fs from 'fs';
import { loadAppConfig } from '../utils/app.js';
import { ENV } from '../utils/env.js';
import { getSheetRows } from '../utils/excel.js';
import { ApproverPortal } from '../pages/portal-approver.page.js';

const APP = loadAppConfig();

// Resolve Excel file path and fail fast if missing
function excelPath() {
  const p = path.resolve(APP.excel.path);
  if (!fs.existsSync(p)) throw new Error(`Excel not found at ${p}`);
  return p;
}

// Read a sheet as rows
function readSheet(sheetName) {
  return getSheetRows(excelPath(), sheetName);
}

// Filter rows by Scenario column
function filterByScenario(rows, scenario) {
  const s = String(scenario || '').trim();
  return rows.filter(r => String(r.Scenario || '').trim() === s);
}

// Keep assignee order 
function sortAssignees(rows) {
  // If your sheet has 'order' column, sort by it; else keep original order
  if (rows.length && Object.prototype.hasOwnProperty.call(rows[0], 'order')) {
    return [...rows].sort((a, b) => Number(a.order) - Number(b.order));
  }
  return rows;
}

// Approvals order (by 'order', then 'stage')
function sortApprovals(rows) {
  // Ensure deterministic order: order asc, stage asc
  return [...rows].sort(
    (a, b) =>
      Number(a.order) - Number(b.order) ||
      Number(a.stage) - Number(b.stage)
  );
}

// User ID and Password
function approverPassword(orderIndex, assigneeRow, approvalsRow) {
  const envKey = `APPROVER_${orderIndex}_PASS`; // e.g. APPROVER_1_PASS
  if (ENV[envKey]) return String(ENV[envKey]).trim();
  if ((approvalsRow?.password || '').toString().trim()) return String(approvalsRow.password).trim();
  if ((assigneeRow?.password || '').toString().trim()) return String(assigneeRow.password).trim();
  if (ENV.APPROVER_DEFAULT_PASS) return String(ENV.APPROVER_DEFAULT_PASS).trim();
  throw new Error(`No password available for approver ${orderIndex}`);
}

// Pick stage1/stage2 rows for a given order
function pickApprovalRows(APPROVALS, orderIndex) {
  const rows = APPROVALS.filter(r => Number(r.order) === Number(orderIndex));
  const stage1 = rows.find(r => Number(r.stage) === 1) || null;
  const stage2 = rows.find(r => Number(r.stage) === 2) || null;
  return { stage1, stage2 };
}

// Normalize common fields from a sheet row
function mapStageCommon(row) {
  if (!row) return null;
  return {
    impact: row['Impact Product/Plant'] ?? '',
    // Abbreviated headers supported (from  sheet)
    prediction: row['Prediction Of O'] ?? row['Prediction Of Occurrence'] ?? '',
    discovery: row['Discovery Abi'] ?? row['Discovery Ability'] ?? '',
    optionalDescription: row['optionalDescription'] ?? '',
    remarks: row['remarks'] ?? '',
    releaseRecommendation: row['releaseRecommendation'] ?? '',
    approvalNote: row['Approval Note'] ?? row['Comment'] ?? '',
    actionPriority: row['actionPriori'] ?? row['actionPriority'] ?? '',
    approvalRequired: row['approvalRequired'] ?? '',
    username: row['username'] ?? '',
  };
}

// Build portal payload for a specific order (combines stage1 + stage2)
function buildPayloadForOrder(APPROVALS, orderIndex) {
  const { stage1, stage2 } = pickApprovalRows(APPROVALS, orderIndex);
  if (!stage1 && !stage2) {
    throw new Error(`No Approvals rows found for order ${orderIndex}`);
  }
  const s1 = mapStageCommon(stage1);
  const s2 = mapStageCommon(stage2);

  // Prefer the most recent note for the comment box
  const comment =
    (s2?.approvalNote && String(s2.approvalNote).trim()) ||
    (s1?.approvalNote && String(s1.approvalNote).trim()) ||
    '';

  return { stage1: s1, stage2: s2, comment, username: s1?.username || s2?.username || '' };
}

/**
 * Run approvals end-to-end for all approvers in order.
 * - Loads ASSIGNEES/APPROVALS from Excel
 * - Derives execution order from Approvals sheet
 * - Logs in as each approver, opens the case, applies stage data
 * - Optionally audits at the end on the last approver
 */
export async function runApprovals(
  browser,
  caseId,
  { ASSIGNEES, APPROVALS, scenario } = {},
  { auditAtEnd = true } = {}
) {
  const scenarioName = (scenario || process.env.SCENARIO || 'Test Data 1').trim();

  // Load data if not provided by the test
  if (!ASSIGNEES) {
    const rawAssignees = readSheet(APP.excel.sheets.assignees);
    ASSIGNEES = sortAssignees(filterByScenario(rawAssignees, scenarioName));
  }
  if (!APPROVALS) {
    const rawApprovals = readSheet(APP.excel.sheets.approvals);
    APPROVALS = sortApprovals(filterByScenario(rawApprovals, scenarioName));
  }

  if (!ASSIGNEES.length) throw new Error(`No ASSIGNEES for scenario "${scenarioName}"`);
  if (!APPROVALS.length) throw new Error(`No APPROVALS for scenario "${scenarioName}"`);

  // Orders present in Approvals (these drive execution)
  const approverOrders = Array.from(
    new Set(
      APPROVALS.map(r => Number(r.order))
        .filter(n => Number.isFinite(n) && n > 0)
    )
  ).sort((a, b) => a - b);

  if (!approverOrders.length) {
    throw new Error(`No approval orders found for scenario "${scenarioName}"`);
  }

  // Map assignees by explicit order if present; fallback to 1..N (keeps top 3 approvers)
  const assigneeByOrder = new Map(ASSIGNEES.map((r, idx) => [Number(r.order) || (idx + 1), r]));

  // Run orders present in Approvals AND in Assignees
  const ordersToRun = approverOrders.filter(o => assigneeByOrder.has(o));

  if (!ordersToRun.length) {
    throw new Error(`No matching assignee orders for approvals in scenario "${scenarioName}"`);
  }

  for (const orderIndex of ordersToRun) {
    const assigneeRow = assigneeByOrder.get(orderIndex) ?? ASSIGNEES[orderIndex - 1];
    if (!assigneeRow) throw new Error(`No assignee found for order ${orderIndex}`);

    const payload = buildPayloadForOrder(APPROVALS, orderIndex);

    const ctx = await browser.newContext();

    // new code

    try {
      const page = await ctx.newPage();
      const portal = new ApproverPortal(page);

      // login username: prefer approvals sheet, else assignees sheet
      const loginUser =
        (payload.username && String(payload.username).trim()) ||
        String(assigneeRow?.searchText || assigneeRow?.username || '').trim();
      const pass = approverPassword(orderIndex, assigneeRow, payload.stage1);
      await portal.login(loginUser, pass);
      await portal.openCaseFromWorklist(caseId);

      const isLast = orderIndex === ordersToRun[ordersToRun.length - 1];
      // Non-final approvers (or when not auditing): logout inside approveWith.
      await portal.approveWith(payload, { logoutAfter: !auditAtEnd || !isLast });

      // Final approver + auditing: keep session for audit, then logout inside auditAndClose.
      if (auditAtEnd && isLast) {
        await portal.auditAndClose();
      }
    } finally {
      await ctx.close();
    }
  }
}