import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseExcelFile, parseSpecificSheet, mapRowsToEmployeeRecords } from './excelParser';
import { autoDetectColumnMapping } from './columnDetector';

test('preserves leading zeros in Employee IDs from Excel buffer', () => {
  // Create synthetic Excel sheet with leading zeros formatted as strings
  const data = [
    ['Employee ID', 'Employee Name', 'Basic Salary', 'Gross Earnings', 'Net Salary'],
    ['00101', 'Alexander Wright', 75000, 75000, 68000],
    ['000042', 'Deep Thought', 50000, 50000, 45000]
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Staff List');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const parsed = parseExcelFile(buffer);
  assert.equal(parsed.sheetNames.length, 1);
  assert.equal(parsed.sheetNames[0], 'Staff List');
  assert.equal(parsed.rows.length, 2);

  // Verify leading zeros were NOT stripped to 101 or 42
  assert.equal(parsed.rows[0]['Employee ID'], '00101');
  assert.equal(parsed.rows[1]['Employee ID'], '000042');
});

test('handles multi-sheet workbooks and worksheet selection', () => {
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet([['ID', 'Name'], ['E1', 'Alice']]);
  const ws2 = XLSX.utils.aoa_to_sheet([['ID', 'Name', 'Role'], ['E2', 'Bob', 'Engineer']]);
  XLSX.utils.book_append_sheet(wb, ws1, 'HQ Staff');
  XLSX.utils.book_append_sheet(wb, ws2, 'Regional Office');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const parsedFirst = parseExcelFile(buffer);
  assert.equal(parsedFirst.sheetNames.length, 2);
  assert.equal(parsedFirst.activeSheet, 'HQ Staff');
  assert.equal(parsedFirst.rows.length, 1);
  assert.equal(parsedFirst.rows[0]['Name'], 'Alice');

  const parsedSecond = parseSpecificSheet(buffer, 'Regional Office');
  assert.equal(parsedSecond.activeSheet, 'Regional Office');
  assert.equal(parsedSecond.rows.length, 1);
  assert.equal(parsedSecond.rows[0]['Name'], 'Bob');
  assert.equal(parsedSecond.rows[0]['Role'], 'Engineer');
});

test('ignores blank rows and whitespace lines', () => {
  const data = [
    ['Emp ID', 'Full Name', 'Basic Pay'],
    ['EMP-01', 'John Doe', 3000],
    ['', '', ''], // empty row
    ['   ', '   ', '   '], // whitespace only row
    ['EMP-02', 'Jane Smith', 4500]
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const parsed = parseExcelFile(buffer);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]['Emp ID'], 'EMP-01');
  assert.equal(parsed.rows[1]['Emp ID'], 'EMP-02');
});

test('column auto-detection maps non-standard headers accurately', () => {
  const headers = [
    'Staff ID',
    'Worker Name',
    'Dept Name',
    'Job Title',
    'Base Pay',
    'House Rent',
    'Spl Pay',
    'Total Gross',
    'EPF',
    'ESIC',
    'Prof Tax',
    'Income Tax',
    'Net Pay'
  ];

  const mapping = autoDetectColumnMapping(headers);
  assert.equal(mapping.employeeId, 'Staff ID');
  assert.equal(mapping.name, 'Worker Name');
  assert.equal(mapping.department, 'Dept Name');
  assert.equal(mapping.designation, 'Job Title');
  assert.equal(mapping.basic, 'Base Pay');
  assert.equal(mapping.hra, 'House Rent');
  assert.equal(mapping.specialAllowance, 'Spl Pay');
  assert.equal(mapping.providedGross, 'Total Gross');
  assert.equal(mapping.pf, 'EPF');
  assert.equal(mapping.esi, 'ESIC');
  assert.equal(mapping.professionalTax, 'Prof Tax');
  assert.equal(mapping.tds, 'Income Tax');
  assert.equal(mapping.providedNet, 'Net Pay');
});

test('mapRowsToEmployeeRecords constructs valid records and parses formatted currency', () => {
  const rows = [
    {
      'Emp ID': '00987',
      'Name': 'Sarah Connor',
      'Base': '$5,000.50',
      'HRA': '$1,500.00',
      'PF': '$500.25'
    }
  ];

  const mapping = {
    employeeId: 'Emp ID',
    name: 'Name',
    basic: 'Base',
    hra: 'HRA',
    pf: 'PF'
  } as any;

  const records = mapRowsToEmployeeRecords(rows, mapping, 'October', 2026);
  assert.equal(records.length, 1);
  const rec = records[0];
  assert.equal(rec.employeeId, '00987');
  assert.equal(rec.name, 'Sarah Connor');
  assert.equal(rec.basic, 5000.50);
  assert.equal(rec.hra, 1500);
  assert.equal(rec.pf, 500.25);
  assert.equal(rec.calculatedGross, 6500.50);
  assert.equal(rec.calculatedDeductions, 500.25);
  assert.equal(rec.calculatedNet, 6000.25);
  assert.equal(rec.isValid, true);
});

test('handles empty workbook and malformed files gracefully', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.book_append_sheet(wb, ws, 'Blank');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const parsed = parseExcelFile(buffer);
  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.headers.length, 0);

  // Empty buffer throws cleanly
  assert.throws(() => {
    parseExcelFile(new ArrayBuffer(0));
  }, /empty or contains no readable data/);
});

test('mapRowsToEmployeeRecords correctly calculates default paidDays for February 3047 (28) and leap February 3048 (29)', () => {
  const rows = [{ 'Emp ID': 'E01', 'Name': 'Future Staff', 'Base': '5000' }];
  const mapping = { employeeId: 'Emp ID', name: 'Name', basic: 'Base' } as any;

  // February 3047 (non-leap) -> 28 days
  const rec3047 = mapRowsToEmployeeRecords(rows, mapping, 'February', 3047);
  assert.equal(rec3047[0].payrollYear, 3047);
  assert.equal(rec3047[0].payrollMonth, 'February');
  assert.equal(rec3047[0].paidDays, 28);

  // February 3048 (leap year) -> 29 days
  const rec3048 = mapRowsToEmployeeRecords(rows, mapping, 'February', 3048);
  assert.equal(rec3048[0].payrollYear, 3048);
  assert.equal(rec3048[0].payrollMonth, 'February');
  assert.equal(rec3048[0].paidDays, 29);
});

test('preserves row-specific payroll year from spreadsheet without overwriting it', () => {
  const rows = [
    {
      'Emp ID': 'E-ROW-YEAR',
      'Name': 'Custom Year Employee',
      'Base': '9000',
      'Pay Month': 'December',
      'Pay Year': '3047'
    }
  ];
  const mapping = {
    employeeId: 'Emp ID',
    name: 'Name',
    basic: 'Base',
    payrollMonth: 'Pay Month',
    payrollYear: 'Pay Year'
  } as any;

  // Workspace default is October 2026, but row has December 3047
  const records = mapRowsToEmployeeRecords(rows, mapping, 'October', 2026);
  assert.equal(records[0].payrollYear, 3047, 'Row-specific year 3047 must be preserved');
  assert.equal(records[0].payrollMonth, 'December', 'Row-specific month December must be preserved');
});

test('safely parses XLSX from sliced buffer pool with non-zero byteOffset without leaking PK bytes or Column_2', () => {
  // Generate valid XLSX workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Staff Code', 'Full Name', 'Department', 'Monthly Gross'],
    ['00789', 'Siddharth Raman', 'Technology', 125000],
    ['00790', 'Ananya Krishnan', 'Finance', 98000]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Staff List');
  const xlsxRaw = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  // Simulate internal Node.js Buffer pool where byteOffset is non-zero
  const pool = Buffer.alloc(xlsxRaw.length + 4096);
  xlsxRaw.copy(pool, 1024);
  const poolSlice = pool.subarray(1024, 1024 + xlsxRaw.length);

  // Parse slice using parseExcelFile
  const parsed = parseExcelFile(poolSlice, 'Staff_Payroll.xlsx');
  assert.equal(parsed.sheetNames[0], 'Staff List');
  assert.equal(parsed.headers.length, 4);
  assert.equal(parsed.headers[0], 'Staff Code');
  assert.equal(parsed.headers[1], 'Full Name');
  assert.equal(parsed.headers[2], 'Department');
  assert.equal(parsed.headers[3], 'Monthly Gross');

  // Verify headers NEVER contain PK or [Content_Types]
  assert.ok(!parsed.headers.some(h => h.includes('PK') || h.includes('[Content_Types]')));
  // Verify generic Column_2 was NOT created
  assert.ok(!parsed.headers.includes('Column_2'));

  // Verify rows and leading zeros
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]['Staff Code'], '00789');
  assert.equal(parsed.rows[0]['Full Name'], 'Siddharth Raman');
  assert.equal(parsed.rows[1]['Staff Code'], '00790');
});

test('parses CSV file with proper UTF-8 text decoding and preserves leading zeros', () => {
  const csvContent = 'Employee ID,Employee Name,Designation,Basic Salary\n00101,Maya Sundaram,Architect,85000\n00102,Karthik Raja,Manager,72000';
  const encoder = new TextEncoder();
  const csvBuffer = encoder.encode(csvContent);

  const parsed = parseExcelFile(csvBuffer, 'staff_export.csv');
  assert.equal(parsed.headers.length, 4);
  assert.equal(parsed.headers[0], 'Employee ID');
  assert.equal(parsed.headers[1], 'Employee Name');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]['Employee ID'], '00101');
  assert.equal(parsed.rows[0]['Employee Name'], 'Maya Sundaram');
  assert.equal(parsed.rows[1]['Employee ID'], '00102');
});

test('handles CSV with UTF-8 BOM cleanly without distorting first header column', () => {
  // UTF-8 BOM: 0xEF, 0xBB, 0xBF
  const csvWithBOM = '\uFEFFEmployee ID,Employee Name,Basic Salary\n00042,Arthur Dent,42000';
  const parsed = parseExcelFile(csvWithBOM, 'bom_export.csv');

  assert.equal(parsed.headers[0], 'Employee ID');
  assert.ok(!parsed.headers[0].includes('\uFEFF'), 'BOM character must be stripped from header');
  assert.equal(parsed.rows[0]['Employee ID'], '00042');
});

test('parses legacy XLS (Excel 97-2003) workbook', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['EmpID', 'Name', 'Salary'],
    ['00555', 'Legacy User', 50000]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'LegacySheet');
  const xlsBuffer = XLSX.write(wb, { bookType: 'biff8', type: 'array' });

  const parsed = parseExcelFile(xlsBuffer, 'legacy.xls');
  assert.equal(parsed.sheetNames[0], 'LegacySheet');
  assert.equal(parsed.headers[0], 'EmpID');
  assert.equal(parsed.rows[0]['EmpID'], '00555');
});

test('rejects oversized spreadsheets exceeding 25 MB limit', () => {
  // Create a mock large Uint8Array of 26 MB
  const oversizedBuffer = new Uint8Array(26 * 1024 * 1024);
  assert.throws(() => {
    parseExcelFile(oversizedBuffer, 'huge.xlsx');
  }, /exceeds the maximum allowed file size of 25 MB/);

  const oversizedString = 'A'.repeat(26 * 1024 * 1024);
  assert.throws(() => {
    parseExcelFile(oversizedString, 'huge.csv');
  }, /exceeds the maximum allowed file size of 25 MB/);
});

test('sanitizes dangerous property names like __proto__ and constructor in rows', () => {
  const data = [
    ['__proto__', 'constructor', 'NormalHeader'],
    ['polluted', 'bad', 'safeValue']
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Test');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const parsed = parseExcelFile(buffer);
  assert.equal(parsed.rows.length, 1);
  const row = parsed.rows[0];
  // Verify dangerous keys are safely renamed or handled without prototype pollution
  assert.equal(row['Safe___proto__'], 'polluted');
  assert.equal(row['Safe_constructor'], 'bad');
  assert.equal(row['NormalHeader'], 'safeValue');
  assert.equal(({} as any).polluted, undefined);
});


