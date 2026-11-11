import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSalary, roundCurrency } from './salaryCalculator';

test('TEST 1: Exact Provided Example (CTC 55008, Employer PF 3000, Employer ESI 0, Employee PF 3000, Employee ESI 0, PT 208, TDS 0, Loan 0, Late 0, LOP 3226)', () => {
  const result = calculateSalary({
    ctc: 55008,
    employerPf: 3000,
    employerEsi: 0,
    employeePf: 3000,
    employeeEsi: 0,
    professionalTax: 208,
    tds: 0,
    loan: 0,
    lateDeduction: 0,
    lopDeduction: 3226
  });

  // Total Gross = 55008 - 3000 - 0 = 52008
  assert.equal(result.calculatedGross, 52008, 'Total Gross must equal 52008');
  assert.equal(result.totalGross, 52008);

  // Total Deductions = 3000 + 0 + 208 + 0 + 0 + 0 + 3226 = 6434
  assert.equal(result.calculatedDeductions, 6434, 'Total Deductions must equal 6434');
  assert.equal(result.totalDeductions, 6434);

  // Net Salary = 52008 - 6434 = 45574
  assert.equal(result.calculatedNet, 45574, 'Net Salary must equal 45574');
  assert.equal(result.netSalary, 45574);
});

test('TEST 2: Employer PF Separation (Deducted from CTC, never added to employee deductions)', () => {
  const result = calculateSalary({
    ctc: 55008,
    employerPf: 3000,
    employeePf: 3000
  });

  assert.equal(result.employerPf, 3000);
  assert.equal(result.employeePf, 3000);
  assert.equal(result.calculatedGross, 52008);
  assert.equal(result.calculatedDeductions, 3000);
});

test('TEST 3: Employer ESI Separation', () => {
  const result = calculateSalary({
    ctc: 60000,
    employerPf: 2500,
    employerEsi: 1000,
    employeePf: 2500,
    employeeEsi: 450,
    professionalTax: 200
  });

  // Gross = 60000 - 2500 - 1000 = 56500
  assert.equal(result.calculatedGross, 56500);
  // Deductions = 2500 + 450 + 200 = 3150
  assert.equal(result.calculatedDeductions, 3150);
  assert.equal(result.calculatedNet, 53350);
});

test('TEST 4: All Zero Deductions', () => {
  const result = calculateSalary({
    ctc: 50000,
    employerPf: 2000,
    employeePf: 0,
    employeeEsi: 0,
    professionalTax: 0,
    tds: 0,
    loan: 0,
    lateDeduction: 0,
    lopDeduction: 0
  });

  assert.equal(result.calculatedGross, 48000);
  assert.equal(result.calculatedDeductions, 0);
  assert.equal(result.calculatedNet, 48000);
});

test('TEST 5: Multiple Deductions (All 7 components)', () => {
  const result = calculateSalary({
    ctc: 80000,
    employerPf: 4000,
    employeePf: 4000,
    employeeEsi: 200,
    professionalTax: 200,
    tds: 1500,
    loan: 1000,
    lateDeduction: 100,
    lopDeduction: 2000
  });

  // Gross = 80000 - 4000 = 76000
  assert.equal(result.calculatedGross, 76000);
  // Deductions = 4000 + 200 + 200 + 1500 + 1000 + 100 + 2000 = 9000
  assert.equal(result.calculatedDeductions, 9000);
  assert.equal(result.calculatedNet, 67000);
});

test('TEST 6: Missing Component handled gracefully', () => {
  const result = calculateSalary({
    ctc: 45000,
    employerPf: 1800
  });

  assert.equal(result.calculatedGross, 43200);
  assert.equal(result.calculatedDeductions, 0);
  assert.equal(result.calculatedNet, 43200);
});

test('TEST 7: Imported Gross Salary (providedGross) is kept separate and does not override calculated Total Earnings', () => {
  const result = calculateSalary({
    ctc: 55008,
    employerPf: 3000,
    employerEsi: 0,
    providedGross: 50000, // Different pre-calculated gross in sheet
    employeePf: 3000,
    employeeEsi: 0,
    professionalTax: 208,
    tds: 0,
    loan: 0,
    lateDeduction: 0,
    lopDeduction: 3226
  });

  assert.equal(result.ctc, 55008);
  assert.equal(result.providedGross, 50000);
  assert.equal(result.calculatedGross, 52008); // Must be CTC - Employer PF = 52008, NOT 50000
  assert.equal(result.calculatedDeductions, 6434);
  assert.equal(result.calculatedNet, 45574);
});

test('TEST 8: Employer ESI calculation test (CTC 55008, Employer PF 3000, Employer ESI 500, Employee PF 3000, Employee ESI 0, PT 208, TDS 0, Loan 0, Late 0, LOP 3226)', () => {
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
    lopDeduction: 3226
  });

  // Total Earnings = 55008 - 3000 - 500 = 51508
  assert.equal(result.calculatedGross, 51508);
  // Total Deductions = 3000 + 0 + 208 + 0 + 0 + 0 + 3226 = 6434
  assert.equal(result.calculatedDeductions, 6434);
  // Net Salary = 51508 - 6434 = 45074
  assert.equal(result.calculatedNet, 45074);
});


