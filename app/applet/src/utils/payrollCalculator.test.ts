import test from 'node:test';
import assert from 'node:assert';
import {
  calculateTotalEarnings,
  calculateTotalDeductions,
  calculateNetSalary,
  computePayroll,
} from './payrollCalculator.ts';

test('calculateTotalEarnings computes CTC - Employer PF - Employer ESI correctly', () => {
  const earnings = calculateTotalEarnings(55008, 3000, 0);
  assert.strictEqual(earnings, 52008);
});

test('calculateTotalDeductions sums all deduction components correctly', () => {
  const deductions = calculateTotalDeductions(3000, 0, 208, 0, 0, 0, 3226);
  assert.strictEqual(deductions, 6434);
});

test('calculateNetSalary computes Total Earnings - Total Deductions correctly', () => {
  const net = calculateNetSalary(52008, 6434);
  assert.strictEqual(net, 45574);
});

test('computePayroll performs end-to-end payroll calculation matching prompt example', () => {
  const result = computePayroll({
    ctc: 55008,
    employerPf: 3000,
    employerEsi: 0,
    employeePf: 3000,
    employeeEsi: 0,
    pt: 208,
    tds: 0,
    loan: 0,
    lateDeduction: 0,
    lopDeduction: 3226,
  });

  assert.strictEqual(result.ctc, 55008);
  assert.strictEqual(result.totalEarnings, 52008);
  assert.strictEqual(result.totalDeductions, 6434);
  assert.strictEqual(result.netSalary, 45574);
  assert.strictEqual(result.netSalaryPayable, 45574);
});
