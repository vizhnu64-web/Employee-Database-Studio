import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectAllColumns,
  autoDetectColumnMapping,
  STANDARD_FIELD_LABELS
} from './columnDetector';
import {
  parseExcelFile,
  mapRowsToEmployeeRecords,
  createSampleWorkbookBuffer
} from './excelParser';
import { validateBatch, validateEmployeeRecord } from './payrollValidator';
import { generatePayslipPdf } from './pdfGenerator';
import { DEFAULT_COMPANY_SETTINGS } from './dbStorage';
import {
  DEFAULT_LAYOUT_SETTINGS,
  EmployeeRecord,
  CompanySettings,
  CustomFieldDefinition,
  ColumnImportControl
} from '../types/payroll';

test('TEST A: Standard column detection with aliases', () => {
  const sampleHeaders = [
    'Emp Code',
    'Official Name',
    'Dept',
    'A/C Number',
    'Bank IFSC',
    'Bank Name',
    'ESI No',
    'Loss of Pay Days',
    'LOP Amount',
    'Base Salary',
    'H.R.A.',
    'Provident Fund',
    'Prof Tax',
    'Income Tax TDS'
  ];

  const detected = detectAllColumns(sampleHeaders, []);
  const mapping = detected.mapping;

  assert.equal(mapping.employeeId, 'Emp Code');
  assert.equal(mapping.name, 'Official Name');
  assert.equal(mapping.department, 'Dept');
  assert.equal(mapping.bankAccount, 'A/C Number');
  assert.equal(mapping.ifscCode, 'Bank IFSC');
  assert.equal(mapping.bankName, 'Bank Name');
  assert.equal(mapping.esiNumber, 'ESI No');
  assert.equal(mapping.lopDays, 'Loss of Pay Days');
  assert.equal(mapping.lopAmount, 'LOP Amount');
  assert.equal(mapping.basic, 'Base Salary');
  assert.equal(mapping.hra, 'H.R.A.');
  assert.equal(mapping.pf, 'Provident Fund');
  assert.equal(mapping.professionalTax, 'Prof Tax');
  assert.equal(mapping.tds, 'Income Tax TDS');
});

test('TEST B: HR fetch control disabling columns without overwriting existing data', () => {
  const headers = ['Employee ID', 'Employee Name', 'Department', 'Bank Account Number', 'Internal Remarks'];
  const rawRows = [
    {
      'Employee ID': 'EMP001',
      'Employee Name': 'Arun Kumar',
      'Department': 'Cloud Engineering',
      'Bank Account Number': '001099887766',
      'Internal Remarks': 'Confidential HR Note'
    }
  ];

  // Disable Bank Account Number and Internal Remarks
  const controls: ColumnImportControl[] = [
    { excelColumn: 'Employee ID', suggestedField: 'employeeId', fetch: true, isStandard: true, destination: 'both' },
    { excelColumn: 'Employee Name', suggestedField: 'name', fetch: true, isStandard: true, destination: 'both' },
    { excelColumn: 'Department', suggestedField: 'department', fetch: true, isStandard: true, destination: 'both' },
    { excelColumn: 'Bank Account Number', suggestedField: 'bankAccount', fetch: false, isStandard: true, destination: 'both' },
    { excelColumn: 'Internal Remarks', suggestedField: '', fetch: false, isStandard: false, destination: 'payroll' }
  ];

  const mapping = {
    employeeId: 'Employee ID',
    name: 'Employee Name',
    department: 'Department',
    bankAccount: 'Bank Account Number',
    email: '',
    designation: '',
    joiningDate: '',
    paidDays: '',
    unpaidDays: '',
    pan: '',
    uan: '',
    esiNumber: '',
    basic: '',
    hra: '',
    specialAllowance: '',
    otherAllowances: '',
    providedGross: '',
    pf: '',
    esi: '',
    professionalTax: '',
    tds: '',
    otherDeductions: '',
    providedDeductions: '',
    providedNet: '',
    payrollMonth: '',
    payrollYear: ''
  };

  const records = mapRowsToEmployeeRecords(rawRows, mapping, 'October', 2026, {
    columnControls: controls
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].employeeId, 'EMP001');
  assert.equal(records[0].name, 'Arun Kumar');
  assert.equal(records[0].department, 'Cloud Engineering');
  // Bank account was disabled from fetch -> must NOT be populated
  assert.equal(records[0].bankAccount, undefined);
  // Disabled custom field must not be in customFields
  assert.equal(records[0].customFields?.['Internal Remarks'], undefined);
});

test('TEST C: Dynamic extra column detection and custom fields mapping', () => {
  const headers = [
    'Emp ID',
    'Employee Name',
    'Basic',
    'Cost Centre',
    'Project Code',
    'Insurance Policy No'
  ];
  const sampleRows = [
    {
      'Emp ID': 'EMP002',
      'Employee Name': 'Priya Sundaram',
      'Basic': 50000,
      'Cost Centre': 'CC-TECH-900',
      'Project Code': 'PROJ-PHOENIX',
      'Insurance Policy No': 'POL-998877'
    }
  ];

  const detected = detectAllColumns(headers, sampleRows);
  const nonStandardControls = detected.controls.filter(c => !c.isStandard);

  assert.equal(nonStandardControls.length, 3);
  assert.ok(nonStandardControls.some(c => c.excelColumn === 'Cost Centre'));
  assert.ok(nonStandardControls.some(c => c.excelColumn === 'Project Code'));
  assert.ok(nonStandardControls.some(c => c.excelColumn === 'Insurance Policy No'));

  const customFieldDefs: CustomFieldDefinition[] = [
    {
      id: 'cf_cost_centre',
      name: 'Cost Centre',
      key: 'cost_centre',
      label: 'Cost Centre',
      dataType: 'text',
      destination: 'both',
      isVisible: true,
      availableInPayslip: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'cf_project_code',
      name: 'Project Code',
      key: 'project_code',
      label: 'Assigned Project',
      dataType: 'text',
      destination: 'payroll',
      isVisible: true,
      availableInPayslip: true,
      createdAt: new Date().toISOString()
    }
  ];

  const records = mapRowsToEmployeeRecords(sampleRows, detected.mapping, 'October', 2026, {
    columnControls: detected.controls,
    customFieldDefinitions: customFieldDefs
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].customFields?.['cost_centre'], 'CC-TECH-900');
  assert.equal(records[0].customFields?.['project_code'], 'PROJ-PHOENIX');
});

test('TEST D: ESI Number import and formatting preservation', () => {
  const headers = ['Employee ID', 'Name', 'ESI Number', 'Basic'];
  const rows = [
    {
      'Employee ID': 'EMP003',
      'Name': 'Karthik Raja',
      'ESI Number': '31001234560001001',
      'Basic': 21000
    }
  ];

  const detected = detectAllColumns(headers, rows);
  const records = mapRowsToEmployeeRecords(rows, detected.mapping, 'October', 2026);

  assert.equal(records[0].esiNumber, '31001234560001001');

  // Verify validateBatch retains ESI number
  const batchValidated = validateBatch(records);
  assert.equal(batchValidated[0].esiNumber, '31001234560001001');
});

test('TEST E: Bank details (Bank Name, IFSC, Account Number with leading zeros, Branch, Account Holder)', () => {
  const headers = [
    'Employee ID',
    'Employee Name',
    'Bank Name',
    'Bank Account Number',
    'IFSC Code',
    'Branch Name',
    'Account Holder Name',
    'Basic'
  ];
  const rows = [
    {
      'Employee ID': '00105', // Leading zero in ID
      'Employee Name': 'Lakshmi Narayanan',
      'Bank Name': 'HDFC Bank',
      'Bank Account Number': '00109988776655', // Leading zeroes in account
      'IFSC Code': 'HDFC0001234',
      'Branch Name': 'Anna Salai, Chennai',
      'Account Holder Name': 'Lakshmi Narayanan R',
      'Basic': 65000
    }
  ];

  const detected = detectAllColumns(headers, rows);
  const records = mapRowsToEmployeeRecords(rows, detected.mapping, 'October', 2026);

  assert.equal(records[0].employeeId, '00105');
  assert.equal(records[0].bankAccount, '00109988776655');
  assert.equal(records[0].bankName, 'HDFC Bank');
  assert.equal(records[0].ifscCode, 'HDFC0001234');
  assert.equal(records[0].branchName, 'Anna Salai, Chennai');
  assert.equal(records[0].accountHolderName, 'Lakshmi Narayanan R');

  // Verify validateBatch does NOT strip or drop any bank properties
  const validated = validateBatch(records);
  assert.equal(validated[0].employeeId, '00105');
  assert.equal(validated[0].bankAccount, '00109988776655');
  assert.equal(validated[0].bankName, 'HDFC Bank');
  assert.equal(validated[0].ifscCode, 'HDFC0001234');
  assert.equal(validated[0].branchName, 'Anna Salai, Chennai');
  assert.equal(validated[0].accountHolderName, 'Lakshmi Narayanan R');
});

test('TEST F: LOP Days and LOP Amount are imported independently', () => {
  const headers = [
    'Employee ID',
    'Employee Name',
    'Basic',
    'LOP Days',
    'LOP Amount'
  ];
  const rows = [
    {
      'Employee ID': 'EMP006',
      'Employee Name': 'Dinesh Kumar',
      'Basic': 30000,
      'LOP Days': 3,
      'LOP Amount': 3000
    }
  ];

  const detected = detectAllColumns(headers, rows);
  const records = mapRowsToEmployeeRecords(rows, detected.mapping, 'October', 2026);

  assert.equal(records[0].lopDays, 3);
  assert.equal(records[0].lopAmount, 3000);
  assert.equal(records[0].unpaidDays, 3);

  const validated = validateBatch(records);
  assert.equal(validated[0].lopDays, 3);
  assert.equal(validated[0].lopAmount, 3000);
});

test('TEST G: Ambiguous "LOP" column disambiguation', () => {
  const headers = ['Employee ID', 'Employee Name', 'Basic', 'LOP'];
  const rowsDays = [
    { 'Employee ID': 'EMP007', 'Employee Name': 'Ganesh V', 'Basic': 40000, 'LOP': 2 }
  ];

  const detected = detectAllColumns(headers, rowsDays);
  assert.equal(detected.controls.find(c => c.excelColumn === 'LOP')?.ambiguityType, 'lop_days_vs_amount');

  // When HR specifies ambiguous choice = 'amount'
  const recordsAmount = mapRowsToEmployeeRecords(rowsDays, detected.mapping, 'October', 2026, {
    ambiguousLopInterpretation: 'amount'
  });
  assert.equal(recordsAmount[0].lopAmount, 2);

  // When HR specifies ambiguous choice = 'days'
  const recordsDaysParsed = mapRowsToEmployeeRecords(rowsDays, detected.mapping, 'October', 2026, {
    ambiguousLopInterpretation: 'days'
  });
  assert.equal(recordsDaysParsed[0].lopDays, 2);
  assert.equal(recordsDaysParsed[0].unpaidDays, 2);
});

test('TEST H: LOP conflict warning when imported LOP Days and LOP Amount diverge significantly', () => {
  const records: EmployeeRecord[] = [
    {
      id: 'rec_lop_conflict',
      employeeId: 'EMP008',
      name: 'Anand R',
      basic: 60000,
      hra: 24000,
      otherAllowances: 6000,
      calculatedGross: 90000,
      pf: 1800,
      esi: 0,
      professionalTax: 200,
      tds: 5000,
      otherDeductions: 0,
      calculatedDeductions: 7000,
      calculatedNet: 83000,
      paidDays: 28,
      unpaidDays: 2,
      lopDays: 2,
      lopAmount: 15000, // 2 days @ 3000/day = 6000, but amount is 15000
      totalWorkingDays: 30,
      isValid: true,
      issues: []
    }
  ];

  const validated = validateBatch(records);
  const conflictIssue = validated[0].issues.find(i => i.field === 'lopConflict');
  assert.ok(conflictIssue, 'Should flag lopConflict issue');
  assert.equal(conflictIssue?.severity, 'warning');
});

test('TEST I: Overwrite empty cells toggle protects pre-existing data', () => {
  const incomingRow = {
    'Employee ID': 'EMP009',
    'Employee Name': 'Suresh Raina',
    'Department': '', // Blank cell in Excel
    'Basic': 48000
  };

  const mapping = {
    employeeId: 'Employee ID',
    name: 'Employee Name',
    department: 'Department',
    basic: 'Basic',
    email: '',
    designation: '',
    joiningDate: '',
    paidDays: '',
    unpaidDays: '',
    bankAccount: '',
    pan: '',
    uan: '',
    esiNumber: '',
    hra: '',
    specialAllowance: '',
    otherAllowances: '',
    providedGross: '',
    pf: '',
    esi: '',
    professionalTax: '',
    tds: '',
    otherDeductions: '',
    providedDeductions: '',
    providedNet: '',
    payrollMonth: '',
    payrollYear: ''
  };

  const recordsNoOverwrite = mapRowsToEmployeeRecords([incomingRow], mapping, 'October', 2026, {
    overwriteEmptyCells: false
  });

  assert.equal(recordsNoOverwrite[0].basic, 48000);
});

test('TEST J: Sample Excel template generation with 33 comprehensive columns', () => {
  const buffer = createSampleWorkbookBuffer();
  assert.ok(buffer instanceof Uint8Array);
  assert.ok(buffer.length > 500);

  const parsed = parseExcelFile(buffer, 'Sample_33_Col.xlsx');
  assert.equal(parsed.sheetNames[0], 'October 2026 Payroll');
  assert.equal(parsed.totalRawRows, 10);
  assert.ok(parsed.headers.includes('Employee ID'));
  assert.ok(parsed.headers.includes('Bank Account Number'));
  assert.ok(parsed.headers.includes('Bank Name'));
  assert.ok(parsed.headers.includes('IFSC Code'));
  assert.ok(parsed.headers.includes('ESI Number'));
  assert.ok(parsed.headers.includes('LOP Days'));
  assert.ok(parsed.headers.includes('LOP Amount'));
  assert.ok(parsed.headers.includes('Cost Centre'));
  assert.ok(parsed.headers.includes('Location'));

  const detected = detectAllColumns(parsed.headers, parsed.rows);
  assert.ok(detected.mapping.employeeId);
  assert.ok(detected.mapping.bankAccount);
  assert.ok(detected.mapping.bankName);
  assert.ok(detected.mapping.ifscCode);
  assert.ok(detected.mapping.esiNumber);
  assert.ok(detected.mapping.lopDays);
  assert.ok(detected.mapping.lopAmount);
});

test('TEST K: Payslip Layout Settings support for Bank, ESI, LOP, and Custom Fields', () => {
  const layout = { ...DEFAULT_LAYOUT_SETTINGS };

  assert.equal(layout.showBankName, true);
  assert.equal(layout.showIfscCode, true);
  assert.equal(layout.showBranchName, false);
  assert.equal(layout.showAccountHolderName, false);
  assert.equal(layout.showLopDays, true);
  assert.equal(layout.showLopAmount, true);
  assert.equal(layout.showEsiNumber, true);
  assert.ok(Array.isArray(layout.customFieldLayouts));
});

test('TEST L: Vector PDF generation renders Bank, ESI, LOP, and Custom Fields safely', async () => {
  const sampleEmployee: EmployeeRecord = {
    id: 'emp_full_test',
    employeeId: '00109',
    name: 'Vijayalakshmi Ramanathan',
    department: 'Artificial Intelligence',
    designation: 'Principal Architect',
    email: 'vijayalakshmi@enterprise.com',
    joiningDate: '01-Jan-2022',
    bankAccount: '001020304050',
    bankName: 'State Bank of India',
    ifscCode: 'SBIN0001234',
    branchName: 'T. Nagar, Chennai',
    accountHolderName: 'Vijayalakshmi Ramanathan',
    pan: 'ABCDE1234F',
    uan: '100900800700',
    esiNumber: '31009988770001',
    basic: 80000,
    hra: 32000,
    otherAllowances: 15000,
    calculatedGross: 127000,
    pf: 1800,
    esi: 0,
    professionalTax: 200,
    tds: 12000,
    otherDeductions: 0,
    calculatedDeductions: 14000,
    calculatedNet: 113000,
    paidDays: 29,
    unpaidDays: 2,
    lopDays: 2,
    lopAmount: 8466,
    totalWorkingDays: 31,
    customFields: {
      cost_centre: 'AI-LABS-CHN',
      project_name: 'Project Sovereign'
    },
    isValid: true,
    issues: []
  };

  const companySettings: CompanySettings = {
    ...DEFAULT_COMPANY_SETTINGS,
    companyName: 'Acme Technologies Private Limited',
    addressLine1: 'Cyber Towers, IT Expressway',
    addressLine2: 'Chennai, Tamil Nadu 600096',
    contactEmail: 'hr@acmetech.com',
    contactPhone: '+91 44 2828 0000',
    taxId: '33AABCT1234A1Z5',
    currencySymbol: 'Rs.',
    showCurrencySymbol: true
  };

  const layoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    showBankName: true,
    showIfscCode: true,
    showBranchName: true,
    showAccountHolderName: true,
    showLopDays: true,
    showLopAmount: true,
    showEsiNumber: true,
    customFieldLayouts: [
      { key: 'cost_centre', label: 'Cost Centre', section: 'header' as const, isVisible: true },
      { key: 'project_name', label: 'Assigned Project', section: 'header' as const, isVisible: true }
    ]
  };

  const doc = generatePayslipPdf(sampleEmployee, companySettings, 'October', 2026, layoutSettings);
  const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 1000);

  // Check PDF signature '%PDF-'
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.equal(header, '%PDF-');
});

test('TEST M: Empty and duplicate column detection', () => {
  const parsed = parseExcelFile(createSampleWorkbookBuffer(), 'test.xlsx');
  assert.ok(parsed.headers.length > 0);
  assert.ok(Array.isArray(parsed.emptyColumns));
  assert.ok(Array.isArray(parsed.duplicateColumns));
});

test('TEST N: Safe string preservation for Bank Accounts with leading zeroes', () => {
  const accountWithLeadingZeros = '0001234567890';
  const row = {
    'Employee ID': '001',
    'Name': 'Test Employee',
    'Bank Account': accountWithLeadingZeros
  };

  const detected = detectAllColumns(['Employee ID', 'Name', 'Bank Account'], [row]);
  const records = mapRowsToEmployeeRecords([row], detected.mapping, 'October', 2026);

  assert.equal(records[0].employeeId, '001');
  assert.equal(records[0].bankAccount, '0001234567890');
  assert.strictEqual(typeof records[0].bankAccount, 'string');
});

test('TEST O: End-to-end propagation from raw workbook to PDF output', async () => {
  // 1. Generate 33-col workbook buffer
  const buffer = createSampleWorkbookBuffer();

  // 2. Parse workbook
  const parsed = parseExcelFile(buffer, 'Acme_Payroll.xlsx');
  assert.equal(parsed.rows.length, 10);

  // 3. Auto-detect columns
  const detected = detectAllColumns(parsed.headers, parsed.rows);

  // 4. Map to EmployeeRecords
  const records = mapRowsToEmployeeRecords(parsed.rows, detected.mapping, 'October', 2026);
  assert.equal(records.length, 10);

  // 5. Validate batch
  const validated = validateBatch(records, { month: 'October', year: 2026 });
  assert.equal(validated.length, 10);

  // First record is 00101 (Alexander Wright)
  const emp1 = validated[0];
  assert.equal(emp1.employeeId, '00101');
  assert.equal(emp1.name, 'Alexander Wright');
  assert.equal(emp1.bankName, 'HDFC Bank Ltd');
  assert.equal(emp1.ifscCode, 'HDFC0000240');
  assert.equal(emp1.esiNumber, '3100123456789');
  assert.equal(emp1.customFields?.['Cost Centre'], 'CC-ENG-101');

  // 6. Generate PDF
  const companySettings: CompanySettings = {
    companyName: 'Acme Corp',
    addressLine1: 'Cyber Towers',
    addressLine2: 'Tech Park',
    cityStateZip: 'Chennai 600096',
    phone: '+91 44 2828 0000',
    email: 'hr@acme.corp',
    website: 'https://acme.corp',
    taxRegistrationNumber: '33AABCT1234A1Z5',
    currencySymbol: 'Rs.',
    currencyName: 'Indian Rupee',
    showCurrencySymbol: true,
    authorizedSignatoryName: 'HR Director',
    authorizedSignatoryTitle: 'Head of HR',
    payslipNote: 'Confidential',
    themeColor: '#CB1417'
  };
  const doc = generatePayslipPdf(emp1, companySettings, 'October', 2026);
  const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
  assert.ok(pdfBytes.length > 1000);
});
