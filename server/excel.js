import ExcelJS from 'exceljs';
import { rowsToCandidates, SheetValidationError } from '../src/lib/candidates.js';

// Files travel as base64 inside JSON (+33%), and Vercel functions accept request bodies up to 4.5 MB.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.xlsx', '.csv'];

export function extensionOf(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : '';
}

/** Keeps file names safe for storage paths and download headers. */
export function safeFileName(fileName) {
  const base = String(fileName || 'upload')
    .split(/[\\/]/)
    .pop()
    .replace(/[^\w.\- ()]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return base || 'upload';
}

/** Reads the value of an exceljs cell as a plain JS value. */
function cellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return cellValue(value.result); // formula
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('text' in value) return value.text; // hyperlink
    if ('error' in value) return '';
    return '';
  }
  return value;
}

async function readXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new SheetValidationError("This file couldn't be read as an Excel workbook. Save it as .xlsx and try again.");
  }
  const sheet =
    workbook.worksheets.find((ws) => /candidate/i.test(ws.name)) ||
    workbook.worksheets.find((ws) => ws.actualRowCount > 0);
  if (!sheet) throw new SheetValidationError('The workbook has no data.');

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = [];
    // row.values is 1-indexed.
    for (let c = 1; c < row.values.length; c++) values.push(cellValue(row.values[c]));
    rows.push(values);
  });
  return { rows, sheetName: sheet.name };
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Parses an uploaded sheet into candidate data.
 * Throws SheetValidationError with a message that's safe to show the user.
 */
export async function parseSheet(buffer, fileName) {
  if (!buffer || buffer.length === 0) throw new SheetValidationError('The file is empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new SheetValidationError(`The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  const ext = extensionOf(fileName);
  let parsed;
  if (ext === '.xlsx') parsed = await readXlsx(buffer);
  else if (ext === '.csv') parsed = { rows: parseCsv(buffer.toString('utf8')), sheetName: 'CSV' };
  else if (ext === '.xls') throw new SheetValidationError('Old .xls files are not supported. Open it in Excel and save as .xlsx.');
  else throw new SheetValidationError('Please upload an Excel (.xlsx) or CSV file.');

  return { ...rowsToCandidates(parsed.rows), sheetName: parsed.sheetName };
}
