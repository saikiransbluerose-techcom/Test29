import path from 'path';
import XLSX from 'xlsx';

// Find a sheet by name (case-insensitive); fallback to the first sheet if not found
function pickSheet(wb, wanted) {
  return wb.SheetNames.find(n => n.toLowerCase() === wanted.toLowerCase()) ?? wb.SheetNames[0];
}

// Read a 2-column sheet into an object map: { key -> value }
// First column is treated as "field", second column as the corresponding value
export function getSheetMap(xlsxPath, sheetName) {
  const abs = path.isAbsolute(xlsxPath) ? xlsxPath : path.resolve(xlsxPath);
  const wb = XLSX.readFile(abs, { cellDates: true });
  const ws = wb.Sheets[pickSheet(wb, sheetName)];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in "${abs}"`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let start = 0;
  if (rows.length && String(rows[0][0]).toLowerCase() === 'field') start = 1;
  const map = {};
  for (let i = start; i < rows.length; i++) {
    const key = String(rows[i][0] ?? '').trim();
    const val = rows[i][1];
    if (key) map[key] = val;
  }
  return map;
}

// Read a sheet into an array of objects, using the first row as header
export function getSheetRows(xlsxPath, sheetName) {
  const abs = path.isAbsolute(xlsxPath) ? xlsxPath : path.resolve(xlsxPath);
  const wb = XLSX.readFile(abs, { cellDates: true });
  const ws = wb.Sheets[pickSheet(wb, sheetName)];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in "${abs}"`);
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}
