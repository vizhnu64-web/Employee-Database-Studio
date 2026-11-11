import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEmployeeRecord, validateBatch, roundCurrency } from './payrollValidator';

test('validates correct record without errors or discrepancies', () => {
  const record = {
    id: 'emp-1',
    employeeId: 'EMP001',
    name: 'Alice Johnson',
    basic: 5000,
    hra: 2000,
    otherAllowances: 1000,
    providedGross: 8000,
    pf: 600,
    esi: 150,
    professionalTax: 50,
    tds: 400,
    otherDeductions: 0,
    providedDeductions: 1200,
    providedNet: 6800
  };

  const result = validateEmployeeRecord(record, ['EMP001']);
  assert.equal(result.isValid, true);
  assert.equal(result.calculatedGross, 8000);
  assert.equal(result.calculatedDeductions, 1200);
  assert.equal(result.calculatedNet, 6800);
  assert.equal(result.issues.length, 0);
});

test('accurately calculates all earnings components and deduction components', () => {
  const record = {
    id: 'emp-all-comp',
    employeeId: 'EMP-FULL',
    name: 'Comprehensive Employee',
    basic: 10000.33,
    hra: 4000.22,
    specialAllowance: 2500.11,
    otherAllowances: 1000.05,
    conveyance: 800.15,
    medicalAllowance: 600.14,
    pf: 1200.50,
    esi: 150.25,
    professionalTax: 200.00,
    tds: 1500.00,
    otherDeductions: 350.25
  };

  const result = validateEmployeeRecord(record, ['EMP-FULL']);
  // Gross = 10000.33 + 4000.22 + 2500.11 + 1000.05 + 800.15 + 600.14 = 18901.00
  assert.equal(result.calculatedGross, 18901.00);
  // Deductions = 1200.50 + 150.25 + 200.00 + 1500.00 + 350.25 = 3401.00
  assert.equal(result.calculatedDeductions, 3401.00);
  // Net = 18901.00 - 3401.00 = 15500.00
  assert.equal(result.calculatedNet, 15500.00);
  assert.equal(result.isValid, true);
});

test('handles floating-point decimal rounding cleanly', () => {
  // Test floating point inaccuracy cases: 0.1 + 0.2 != 0.3 in IEEE-754
  const val1 = roundCurrency(0.1 + 0.2);
  assert.equal(val1, 0.3);

  const record = {
    id: 'emp-dec',
    employeeId: 'EMP-DEC',
    name: 'Decimal Test',
    basic: 1234.567, // rounds to 1234.57 during calculation
    hra: 0.005,
    pf: 100.101
  };

  const result = validateEmployeeRecord(record, ['EMP-DEC']);
  assert.equal(result.calculatedGross, 1234.57);
  assert.equal(result.calculatedDeductions, 100.1);
  assert.equal(result.calculatedNet, 1134.47);
});

test('flags missing employee ID and missing name as fatal errors', () => {
  const record = {
    id: 'emp-2',
    employeeId: '',
    name: '',
    basic: 3000,
    hra: 1000,
    otherAllowances: 0,
    pf: 300,
    esi: 0,
    professionalTax: 0,
    tds: 0,
    otherDeductions: 0
  };

  const result = validateEmployeeRecord(record, []);
  assert.equal(result.isValid, false);
  const errorFields = result.issues.map(i => i.field);
  assert.ok(errorFields.includes('employeeId'));
  assert.ok(errorFields.includes('name'));
});

test('flags duplicate employee IDs in batch', () => {
  const batch = [
    {
      id: '1',
      employeeId: '00101',
      name: 'Bob',
      basic: 4000,
      hra: 1000,
      otherAllowances: 0,
      pf: 400,
      esi: 0,
      professionalTax: 0,
      tds: 0,
      otherDeductions: 0
    },
    {
      id: '2',
      employeeId: '00101', // duplicate
      name: 'Bob Twin',
      basic: 4500,
      hra: 1000,
      otherAllowances: 0,
      pf: 400,
      esi: 0,
      professionalTax: 0,
      tds: 0,
      otherDeductions: 0
    }
  ];

  const results = validateBatch(batch);
  assert.equal(results[0].isValid, false);
  assert.equal(results[1].isValid, false);
  assert.ok(results[0].issues.some(i => i.message.includes('Duplicate Employee ID')));
});

test('flags negative basic salary as fatal error', () => {
  const record = {
    id: 'emp-neg',
    employeeId: 'EMP-NEG',
    name: 'Negative Salary',
    basic: -5000,
    hra: 1000
  };

  const result = validateEmployeeRecord(record, ['EMP-NEG']);
  assert.equal(result.isValid, false);
  assert.ok(result.issues.some(i => i.field === 'basic' && i.severity === 'error'));
});

test('flags warning when deductions exceed earnings (negative net)', () => {
  const record = {
    id: 'emp-loss',
    employeeId: 'EMP-LOSS',
    name: 'High Deductions',
    basic: 2000,
    pf: 1500,
    tds: 1000 // Total deductions 2500 > Gross 2000
  };

  const result = validateEmployeeRecord(record, ['EMP-LOSS']);
  assert.equal(result.calculatedGross, 2000);
  assert.equal(result.calculatedDeductions, 2500);
  assert.equal(result.calculatedNet, -500);
  assert.ok(result.issues.some(i => i.field === 'calculatedNet' && i.severity === 'warning'));
});

test('handles zero salary case with appropriate warning', () => {
  const record = {
    id: 'emp-zero',
    employeeId: 'EMP-ZERO',
    name: 'Unpaid Intern',
    basic: 0,
    hra: 0
  };

  const result = validateEmployeeRecord(record, ['EMP-ZERO']);
  assert.equal(result.calculatedGross, 0);
  assert.equal(result.calculatedDeductions, 0);
  assert.equal(result.calculatedNet, 0);
  // Still valid (not a fatal blocking error), but contains warning
  assert.equal(result.isValid, true);
  assert.ok(result.issues.some(i => i.field === 'calculatedGross' && i.severity === 'warning'));
});

test('flags mathematical discrepancy when provided Gross does not match component sum', () => {
  const record = {
    id: 'emp-3',
    employeeId: 'EMP003',
    name: 'Charlie Davis',
    basic: 4000,
    hra: 1500,
    otherAllowances: 500, // Sum = 6000
    providedGross: 6500, // Provided total is 6500 (mismatch of 500)
    pf: 400,
    esi: 0,
    professionalTax: 0,
    tds: 200,
    otherDeductions: 0,
    providedDeductions: 600,
    providedNet: 5900 // Mismatch with calculatedNet 5400
  };

  const result = validateEmployeeRecord(record, ['EMP003']);
  // Warning issues flagged with canAutoFix: true
  assert.ok(result.issues.some(i => i.field === 'providedGross' && i.canAutoFix === true));
  assert.ok(result.issues.some(i => i.field === 'providedNet' && i.canAutoFix === true));
  assert.equal(result.calculatedGross, 6000);
  assert.equal(result.calculatedNet, 5400);
});

test('validates records for year 2026 and far-future year 3047 without errors', () => {
  const rec2026 = {
    id: 'emp-2026',
    employeeId: 'EMP-2026',
    name: 'Year 2026 Staff',
    basic: 5000,
    payrollMonth: 'October',
    payrollYear: 2026
  };
  const res2026 = validateEmployeeRecord(rec2026, ['EMP-2026'], { month: 'October', year: 2026 });
  assert.equal(res2026.isValid, true);
  assert.equal(res2026.issues.filter(i => i.field === 'payrollYear').length, 0);

  const rec3047 = {
    id: 'emp-3047',
    employeeId: 'EMP-3047',
    name: 'Year 3047 Staff',
    basic: 8500,
    payrollMonth: 'May',
    payrollYear: 3047
  };
  const res3047 = validateEmployeeRecord(rec3047, ['EMP-3047'], { month: 'May', year: 3047 });
  assert.equal(res3047.isValid, true);
  assert.equal(res3047.issues.filter(i => i.field === 'payrollYear').length, 0);
});

test('flags error when payrollYear is not a valid 4-digit year', () => {
  const invalidYears = [-2026, 99, 10000, 2026.5];
  for (const badYear of invalidYears) {
    const record = {
      id: `emp-bad-${badYear}`,
      employeeId: 'EMP-BAD',
      name: 'Bad Year Staff',
      basic: 4000,
      payrollYear: badYear as any
    };
    const res = validateEmployeeRecord(record, ['EMP-BAD']);
    assert.equal(res.isValid, false, `Year ${badYear} should cause validation error`);
    assert.ok(res.issues.some(i => i.field === 'payrollYear' && i.severity === 'error'));
  }
});

test('flags period mismatch warning when record specifies a different year or month than active batch', () => {
  const record = {
    id: 'emp-mismatch',
    employeeId: 'EMP-MISMATCH',
    name: 'Period Mismatch Staff',
    basic: 6000,
    payrollMonth: 'January',
    payrollYear: 2025 // differs from batch year 3047
  };

  const res = validateEmployeeRecord(record, ['EMP-MISMATCH'], { month: 'October', year: 3047 });
  // Record should still be valid (not fatal), but flagged with period warnings
  assert.equal(res.isValid, true);
  assert.ok(res.issues.some(i => i.field === 'payrollYear' && i.severity === 'warning'));
  assert.ok(res.issues.some(i => i.field === 'payrollMonth' && i.severity === 'warning'));
});
