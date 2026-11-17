import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYSLIP_FIELD_REGISTRY,
  maskBankAccountNumber,
  resolvePayslipSectionsData,
  estimatePayslipFit,
} from './payslipFieldRegistry';
import { DEFAULT_LAYOUT_SETTINGS, EmployeeRecord, PayslipLayoutSettings } from '../types/payroll';
import { generatePayslipPdf } from './pdfGenerator';

const TEST_EMPLOYEE: EmployeeRecord = {
  id: 'emp_test_36',
  employeeId: 'EMP0099',
  name: 'Sophia Chen',
  department: 'Product Engineering',
  designation: 'Principal Architect',
  joiningDate: '2021-04-01',
  paymentDate: '2026-10-31',
  email: 'sophia.chen@acme.corp',
  phone: '+91 98765 43210',
  pfNumber: 'MH/BAN/009988/001',
  esiNumber: '310099887766',
  bankName: 'HDFC Bank Ltd',
  ifscCode: 'HDFC0000240',
  bankAccount: '001099887766',
  branchName: 'Indiranagar Branch',
  accountHolderName: 'Sophia Chen',
  pan: 'BCDEF2345G',
  uan: '100998877665',
  totalWorkingDays: 22,
  paidDays: 30,
  unpaidDays: 1,
  lopDays: 1,
  lopAmount: 1000,
  lopDeduction: 1000,
  ctc: 35000,
  basic: 20000,
  hra: 8000,
  specialAllowance: 5000,
  otherAllowances: 2000,
  employerPf: 1800,
  employerEsi: 500,
  calculatedGross: 32700,
  pf: 1800,
  employeePf: 1800,
  esi: 150,
  professionalTax: 200,
  loan: 500,
  lateDeduction: 100,
  tds: 250,
  otherDeductions: 100,
  calculatedDeductions: 4100,
  calculatedNet: 28600,
  isValid: true,
  issues: [],
};

const TEST_COMPANY: any = {
  companyName: 'Acme Technologies Pvt Ltd',
  addressLine1: '100 Tech Park',
  addressLine2: 'Level 4',
  cityStateZip: 'Bengaluru 560001',
  phone: '+91 80 4000 1000',
  email: 'payroll@acme.corp',
  website: 'acme.corp',
  taxRegistrationNumber: '29ABCDE1234F1Z5',
  currencySymbol: '₹',
  currencyName: 'INR',
  showCurrencySymbol: true,
  authorizedSignatoryName: 'Elena Vance',
  authorizedSignatoryTitle: 'VP Human Resources',
  payslipNote: 'System generated official payslip.',
  themeColor: '#CB1417',
};

test('PAYSLIP_FIELD_REGISTRY contains all 36 mandatory fields grouped cleanly across Sections A–E', () => {
  assert.equal(PAYSLIP_FIELD_REGISTRY.length, 36);
  const bySection = (sec: string) => PAYSLIP_FIELD_REGISTRY.filter((f) => f.section === sec);
  assert.equal(bySection('A').length, 7);
  assert.equal(bySection('B').length, 9);
  assert.equal(bySection('C').length, 8);
  assert.equal(bySection('D').length, 8);
  assert.equal(bySection('E').length, 4);
});

test('maskBankAccountNumber hides leading digits cleanly', () => {
  assert.equal(maskBankAccountNumber('001099887766'), '••••••••7766');
  assert.equal(maskBankAccountNumber('1234'), '••••');
});

test('resolvePayslipSectionsData applies custom labels, visibility toggles, and bank masking consistently', () => {
  const customLayout: PayslipLayoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    showPhone: true,
    showEmail: true,
    showPfNumber: true,
    showEsiNumber: true,
    showBankName: true,
    showIfscCode: true,
    showBranchName: true,
    showAccountHolderName: true,
    showBankAccount: true,
    maskBankAccount: true,
    showTotalWorkingDays: true,
    showEmployerPf: true,
    showEmployerEsi: true,
    showLoan: true,
    showLateDeduction: true,
    showLopDays: true,
    labelBasic: 'Base Pay Component',
    showPan: false,
  };

  const resolved = resolvePayslipSectionsData(TEST_EMPLOYEE, TEST_COMPANY, 'October', 2026, customLayout, false);

  const bankItem = resolved.infoFields.find((f) => f.key === 'bankAccount');
  assert.ok(bankItem, 'Bank account should be present when showBankAccount is true');
  assert.equal(bankItem.displayValue, '••••••••7766');

  const panItem = resolved.infoFields.find((f) => f.key === 'pan');
  assert.equal(panItem, undefined, 'PAN should be hidden when showPan is false');

  const basicRow = resolved.earningRows.find((r) => r.key === 'basic');
  assert.ok(basicRow, 'Basic earning row should be visible');
  assert.equal(basicRow.label, 'Base Pay Component');

  assert.ok(resolved.deductionRows.some((r) => r.key === 'loan'), 'Loan deduction should appear');
  assert.ok(resolved.deductionRows.some((r) => r.key === 'lateDeduction'), 'Late deduction should appear');
  assert.ok(resolved.deductionRows.some((r) => r.key === 'lopAmount'), 'LOP deduction amount should appear');
});

test('estimatePayslipFit detects single-page fit vs overflow warnings accurately', () => {
  const standardFit = estimatePayslipFit(TEST_EMPLOYEE, TEST_COMPANY, DEFAULT_LAYOUT_SETTINGS, 'October', 2026);
  assert.equal(standardFit.fitsOnSinglePage, true);
  assert.equal(standardFit.warningMessage, null);

  const bloatedLayout: PayslipLayoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    orientation: 'landscape',
    cellPadding: 'spacious',
    marginMm: 22,
    customTextBlocks: [
      { id: 'b1', title: 'Notice 1', content: 'Long notice block 1', position: 'afterNetPay', visible: true },
      { id: 'b2', title: 'Notice 2', content: 'Long notice block 2', position: 'afterNetPay', visible: true },
      { id: 'b3', title: 'Notice 3', content: 'Long notice block 3', position: 'footer', visible: true },
      { id: 'b4', title: 'Notice 4', content: 'Long notice block 4', position: 'afterEmployeeInfo', visible: true },
    ],
  };

  const overflowFit = estimatePayslipFit(TEST_EMPLOYEE, TEST_COMPANY, bloatedLayout, 'October', 2026);
  assert.equal(overflowFit.fitsOnSinglePage, false);
  assert.ok(overflowFit.warningMessage && overflowFit.warningMessage.includes('exceeds single A4 printable area'));
});

test('generatePayslipPdf renders valid PDFs across Professional Corporate, Minimal Clean, and Detailed Salary Breakdown presets', () => {
  const presets = ['professional_corporate', 'minimal_clean', 'detailed_breakdown'] as const;
  for (const preset of presets) {
    const layout: PayslipLayoutSettings = {
      ...DEFAULT_LAYOUT_SETTINGS,
      templatePreset: preset,
      showEmployerPf: preset === 'detailed_breakdown',
      showEmployerEsi: preset === 'detailed_breakdown',
    };
    const doc = generatePayslipPdf(TEST_EMPLOYEE, TEST_COMPANY, 'October', 2026, layout);
    const uri = doc.output('datauristring');
    assert.ok(uri.startsWith('data:application/pdf;'), `Preset ${preset} should generate valid PDF`);
  }
});
