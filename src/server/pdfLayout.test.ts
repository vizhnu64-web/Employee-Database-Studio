import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT_SETTINGS, PayslipLayoutSettings } from '../types/payroll';
import { calculateSalary } from '../utils/salaryCalculator';
import { generatePayslipPdf, getSafeFileName } from '../utils/pdfGenerator';

test('DEFAULT_LAYOUT_SETTINGS exposes Vivid Red palette and complete 5-section order', () => {
  assert.equal(DEFAULT_LAYOUT_SETTINGS.primaryColor, '#CB1417');
  assert.equal(DEFAULT_LAYOUT_SETTINGS.orientation, 'portrait');
  assert.equal(DEFAULT_LAYOUT_SETTINGS.fontFamily, 'helvetica');
  assert.equal(DEFAULT_LAYOUT_SETTINGS.marginMm, 14);
  assert.deepEqual(DEFAULT_LAYOUT_SETTINGS.sectionOrder, [
    'employeeInfo',
    'salaryTable',
    'netPay',
    'notes',
    'signatures',
  ]);
});

test('calculateSalary enforces Total Earnings = CTC - Employer PF - Employer ESI and excludes employer contributions from deductions', () => {
  const result = calculateSalary({
    ctc: 55008,
    employerPf: 3000,
    employerEsi: 500,
    employeePf: 3000,
    employeeEsi: 0,
    professionalTax: 208,
    tds: 0,
    loan: 0,
    lateDeduction: 0,
    lopDeduction: 3226,
    otherDeductions: 0,
  });

  assert.equal(result.calculatedGross, 51508);
  assert.equal(result.calculatedDeductions, 6434);
  assert.equal(result.calculatedNet, 45074);
});

test('generatePayslipPdf renders valid portrait and landscape A4 PDFs with custom layout order', () => {
  const sampleEmployee: any = {
    id: 'test_1',
    employeeId: 'EMP0042',
    name: 'Avery Chen',
    email: 'avery.chen@apex.com',
    department: 'Finance',
    designation: 'Controller',
    joiningDate: '2024-02-01',
    paymentDate: '2026-10-31',
    ctc: 55008,
    employerPf: 3000,
    employerEsi: 500,
    basic: 25000,
    hra: 12000,
    specialAllowance: 8508,
    otherAllowances: 6000,
    calculatedGross: 51508,
    pf: 3000,
    employeePf: 3000,
    esi: 0,
    professionalTax: 208,
    tds: 0,
    lopDays: 2,
    lopDeduction: 3226,
    otherDeductions: 0,
    calculatedDeductions: 6434,
    calculatedNet: 45074,
    paidDays: 29,
    unpaidDays: 2,
    isValid: true,
    issues: [],
  };

  const settings: any = {
    companyName: 'Apex Enterprise Solutions',
    addressLine1: '100 Market St',
    addressLine2: 'Suite 400',
    cityStateZip: 'San Francisco, CA',
    phone: '+1 555 0100',
    email: 'hr@apex.com',
    website: 'apex.com',
    taxRegistrationNumber: 'EIN-12345',
    currencySymbol: '₹',
    currencyName: 'INR',
    showCurrencySymbol: true,
    authorizedSignatoryName: 'HR Director',
    authorizedSignatoryTitle: 'VP People',
    payslipNote: 'Confidential payslip.',
    themeColor: '#CB1417',
  };

  const portraitDoc = generatePayslipPdf(sampleEmployee, settings, 'October', 2026, DEFAULT_LAYOUT_SETTINGS);
  const portraitUri = portraitDoc.output('datauristring');
  assert.ok(portraitUri.startsWith('data:application/pdf;'), 'Portrait PDF should generate data URI');

  const customLayout: PayslipLayoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    orientation: 'landscape',
    tableBorderStyle: 'horizontal',
    cellPadding: 'compact',
    sectionOrder: ['salaryTable', 'employeeInfo', 'netPay', 'signatures', 'notes'],
    customTextBlocks: [
      {
        id: 'notice_1',
        title: 'Statutory Notice',
        content: 'Bonus payout scheduled in November cycle.',
        position: 'afterNetPay',
        visible: true,
      },
    ],
  };

  const landscapeDoc = generatePayslipPdf(sampleEmployee, settings, 'October', 2026, customLayout);
  const landscapeUri = landscapeDoc.output('datauristring');
  assert.ok(landscapeUri.startsWith('data:application/pdf;'), 'Landscape PDF with custom order should generate data URI');
  assert.equal(getSafeFileName(sampleEmployee, 'October', 2026), 'Payslip_EMP0042_Avery_Chen_October_2026.pdf');
});
