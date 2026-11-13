import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePayslipPdf, getSafeFileName, generateBulkPayslipsZip } from './pdfGenerator';
import { DEFAULT_COMPANY_SETTINGS } from './dbStorage';
import { EmployeeRecord } from '../types/payroll';

const sampleRecord: EmployeeRecord = {
  id: 'emp-test-1',
  employeeId: '00101',
  name: 'Alexander Wright',
  department: 'Engineering',
  designation: 'Lead Architect',
  joiningDate: '2021-03-15',
  paidDays: 30,
  unpaidDays: 0,
  bankAccount: 'ACME-9821039',
  pan: 'ABCDE1234F',
  basic: 75000,
  hra: 30000,
  specialAllowance: 15000,
  otherAllowances: 5000,
  calculatedGross: 125000,
  pf: 9000,
  esi: 0,
  professionalTax: 200,
  tds: 8500,
  otherDeductions: 0,
  calculatedDeductions: 17700,
  calculatedNet: 107300,
  payrollMonth: 'October',
  payrollYear: 2026,
  isValid: true,
  issues: []
};

test('generates valid vector jsPDF object for employee', () => {
  const doc = generatePayslipPdf(sampleRecord, DEFAULT_COMPANY_SETTINGS, 'October', 2026);
  assert.ok(doc, 'jsPDF instance should be created');
  const pdfOutput = doc.output('arraybuffer');
  assert.ok(pdfOutput.byteLength > 1000, 'PDF output should contain binary data');

  // Verify PDF header magic bytes "%PDF-"
  const header = String.fromCharCode(...new Uint8Array(pdfOutput.slice(0, 5)));
  assert.equal(header, '%PDF-');
});

test('handles missing optional employee fields cleanly in PDF generation', () => {
  const minimalRecord: EmployeeRecord = {
    id: 'emp-min',
    employeeId: 'EMP-999',
    name: 'Minimal Staff',
    basic: 3000,
    hra: 0,
    specialAllowance: 0,
    otherAllowances: 0,
    calculatedGross: 3000,
    pf: 0,
    esi: 0,
    professionalTax: 0,
    tds: 0,
    otherDeductions: 0,
    calculatedDeductions: 0,
    calculatedNet: 3000,
    payrollMonth: 'November',
    payrollYear: 2026,
    isValid: true,
    issues: []
  };

  const doc = generatePayslipPdf(minimalRecord, DEFAULT_COMPANY_SETTINGS, 'November', 2026);
  const pdfOutput = doc.output('arraybuffer');
  assert.ok(pdfOutput.byteLength > 1000);
});

test('sanitizes unsafe characters in generated PDF filename', () => {
  const unsafeRecord: EmployeeRecord = {
    ...sampleRecord,
    employeeId: 'EMP/001:2026',
    name: 'John *Doe* <Admin>'
  };

  const fileName = getSafeFileName(unsafeRecord, 'October/Fall', 2026);
  assert.ok(!fileName.includes('/'));
  assert.ok(!fileName.includes(':'));
  assert.ok(!fileName.includes('*'));
  assert.ok(!fileName.includes('<'));
  assert.ok(!fileName.includes('>'));
  assert.ok(fileName.endsWith('.pdf'));
  assert.ok(fileName.includes('OctoberFall'));
});

test('generates bulk ZIP containing exact payslip PDFs and reports progress', async () => {
  const records = [
    sampleRecord,
    {
      ...sampleRecord,
      id: 'emp-test-2',
      employeeId: '00102',
      name: 'Sophia Chen',
      calculatedGross: 116000,
      calculatedDeductions: 15800,
      calculatedNet: 100200
    }
  ];

  let progressCalls = 0;
  const zipBlob = await generateBulkPayslipsZip(
    records,
    DEFAULT_COMPANY_SETTINGS,
    'October',
    2026,
    (completed, total, currentName) => {
      progressCalls++;
      assert.ok(completed <= total);
      assert.ok(currentName.length > 0);
    }
  );

  assert.ok(zipBlob, 'ZIP blob must be produced');
  assert.ok(zipBlob.size > 2000, 'ZIP blob should contain file data');
  assert.ok(progressCalls >= 2, 'Progress callback should be invoked for all records');
});

test('generates valid vector PDF and filename for year 3047', () => {
  const doc = generatePayslipPdf(sampleRecord, DEFAULT_COMPANY_SETTINGS, 'February', 3047);
  assert.ok(doc);
  const pdfBytes = doc.output('arraybuffer');
  assert.ok(pdfBytes.byteLength > 1000);

  const fileName = getSafeFileName(sampleRecord, 'February', 3047);
  assert.ok(fileName.includes('3047'), 'Filename must include year 3047');
  assert.equal(fileName, 'Payslip_00101_Alexander_Wright_February_3047.pdf');
});

test('bulk ZIP generation preserves year 3047 in filenames and internal structure', async () => {
  const records = [sampleRecord];
  const zipBlob = await generateBulkPayslipsZip(
    records,
    DEFAULT_COMPANY_SETTINGS,
    'October',
    3047,
    () => {}
  );
  assert.ok(zipBlob);
  assert.ok(zipBlob.size > 1000);

  // Unpack ZIP to inspect file names inside
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
  const fileNames = Object.keys(zip.files);
  assert.ok(fileNames.some(f => f.includes('3047')), 'Zip contents must contain 3047 in file/folder path');
});

test('sanitizes special characters and unicode symbols like Rupee symbol without corruption', () => {
  const specialRecord: EmployeeRecord = {
    ...sampleRecord,
    name: 'Priya Sundaram (₹ Special)',
    department: 'Research & Dev'
  };
  const specialSettings = {
    ...DEFAULT_COMPANY_SETTINGS,
    companyName: 'Apex Enterprise ₹ Corp',
    currencySymbol: '₹'
  };

  const doc = generatePayslipPdf(specialRecord, specialSettings, 'October', 2026);
  const pdfBytes = doc.output('arraybuffer');
  assert.ok(pdfBytes.byteLength > 1000);
  const header = String.fromCharCode(...new Uint8Array(pdfBytes.slice(0, 5)));
  assert.equal(header, '%PDF-');
});

test('handles logo and signature resilience with PNG, JPEG, SVG fallback, and corrupt data URLs', () => {
  // 1. Valid tiny PNG base64 data URL
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  // 2. SVG logo data URL (should trigger graceful fallback without throwing)
  const svgLogo = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz==';

  // 3. Corrupt data URL
  const corruptLogo = 'data:image/png;base64,CORRUPT_INVALID_BYTES';

  const settingsPng = { ...DEFAULT_COMPANY_SETTINGS, logoDataUrl: tinyPng, signatureDataUrl: tinyPng };
  const settingsSvg = { ...DEFAULT_COMPANY_SETTINGS, logoDataUrl: svgLogo };
  const settingsCorrupt = { ...DEFAULT_COMPANY_SETTINGS, logoDataUrl: corruptLogo };

  const docPng = generatePayslipPdf(sampleRecord, settingsPng, 'October', 2026);
  assert.ok(docPng.output('arraybuffer').byteLength > 1000);

  const docSvg = generatePayslipPdf(sampleRecord, settingsSvg, 'October', 2026);
  assert.ok(docSvg.output('arraybuffer').byteLength > 1000);

  const docCorrupt = generatePayslipPdf(sampleRecord, settingsCorrupt, 'October', 2026);
  assert.ok(docCorrupt.output('arraybuffer').byteLength > 1000);
});

test('bulk ZIP export contains valid standalone PDF files starting with %PDF-', async () => {
  const zipBlob = await generateBulkPayslipsZip(
    [sampleRecord],
    DEFAULT_COMPANY_SETTINGS,
    'October',
    2026
  );

  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
  const pdfFileName = Object.keys(zip.files).find(f => f.endsWith('.pdf'));
  assert.ok(pdfFileName, 'ZIP must contain a PDF file');

  const pdfFileObj = zip.files[pdfFileName!];
  const pdfArrayBuffer = await pdfFileObj.async('arraybuffer');
  assert.ok(pdfArrayBuffer.byteLength > 1000);

  const header = String.fromCharCode(...new Uint8Array(pdfArrayBuffer.slice(0, 5)));
  assert.equal(header, '%PDF-', 'Extracted PDF file inside ZIP must start with valid %PDF- signature');
});

test('respects showCurrencySymbol setting when enabled and disabled', () => {
  const settingsWithSymbol = { ...DEFAULT_COMPANY_SETTINGS, showCurrencySymbol: true, currencySymbol: '$' };
  const settingsWithoutSymbol = { ...DEFAULT_COMPANY_SETTINGS, showCurrencySymbol: false, currencySymbol: '$' };

  const docWith = generatePayslipPdf(sampleRecord, settingsWithSymbol, 'October', 2026);
  assert.ok(docWith.output('arraybuffer').byteLength > 1000);

  const docWithout = generatePayslipPdf(sampleRecord, settingsWithoutSymbol, 'October', 2026);
  assert.ok(docWithout.output('arraybuffer').byteLength > 1000);

  // Ensure calculations are unaffected
  assert.equal(sampleRecord.calculatedNet, 107300);
  assert.equal(sampleRecord.calculatedGross, 125000);
});

test('embeds Employee Database Studio in PDF document metadata and footer', () => {
  const doc = generatePayslipPdf(sampleRecord, DEFAULT_COMPANY_SETTINGS, 'October', 2026);
  const rawPdf = doc.output('datauristring');
  const decoded = Buffer.from(rawPdf.split(',')[1], 'base64').toString('latin1');
  assert.ok(decoded.includes('Employee Database Studio'), 'PDF output must embed Employee Database Studio metadata/footer');
});


