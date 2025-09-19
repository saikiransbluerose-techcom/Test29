// utils/data.js
// Read a single Excel file and expose helpers to:
// - list scenario names from StartWorkflow header
// - read StartWorkflow values for a given scenario (column-based sheet)
// - read scenario-filtered rows from Assignees/Approvals (row-based sheets)

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { loadAppConfig } from './app.js';

const APP = loadAppConfig();
const EXCEL_PATH = path.resolve(APP.excel.path);

// read workbook once 
function readWB() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found at ${EXCEL_PATH}`);
  }
  return XLSX.readFile(EXCEL_PATH, { cellDates: true });
}

// Return scenario names from StartWorkflow header row
export function getScenarioNames() {
  const wb = readWB();
  const ws = wb.Sheets[APP.excel.sheets.startWorkflow];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
  const header = rows[0] || [];                 // ["field", "Test Data 1", "Test Data 2", ...]
  return header.slice(1).filter(Boolean);       // skip first col "field"
}

// Format a Date as YYYY-MM-DD using local components (no UTC shift)
function formatLocalYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Read StartWorkflow sheet for a given scenario column
function readStartWorkflowFor(wb, scenarioName) {
  const ws = wb.Sheets[APP.excel.sheets.startWorkflow];
  if (!ws) throw new Error(`Sheet "${APP.excel.sheets.startWorkflow}" not found`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });

  const header = rows[0] || [];
  const col = header.indexOf(scenarioName);
  if (col === -1) {
    throw new Error(`Scenario "${scenarioName}" not found in StartWorkflow header: [${header.join(', ')}]`);
  }

  const out = {};
  // Column A = "field" names; scenario values in selected col
  for (let r = 1; r < rows.length; r++) {
    const key = String(rows[r][0] ?? '').trim();
    if (!key) continue;
    const cell = rows[r][col];
    if (cell instanceof Date) {
      // keep a stable, date-only string suitable for direct input into the UI
      out[key] = formatLocalYYYYMMDD(cell); // e.g., "2025-09-23"
    } else {
      out[key] = String(cell ?? '').trim();
    }
  }
  return out;
}


// Filter a row-based sheet (Assignees/Approvals) by Scenario column
function readRowsByScenario(wb, sheetName, scenarioName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const all = XLSX.utils.sheet_to_json(ws, { defval: '' });   // uses header row
  return all.filter(r => String(r.Scenario || '').trim() === scenarioName);
}

// Aggregate a single scenario payload for flows/tests
export function readExcelScenario(scenarioName = 'Test Data 1') {
  const wb = readWB();
  const SW = readStartWorkflowFor(wb, scenarioName);
  const ASSIGNEES = readRowsByScenario(wb, APP.excel.sheets.assignees, scenarioName);
  const APPROVALS = readRowsByScenario(wb, APP.excel.sheets.approvals, scenarioName);
  return { SW, ASSIGNEES, APPROVALS };
}
