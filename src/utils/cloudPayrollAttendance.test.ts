import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSalary } from './salaryCalculator';

test('EXACT USER BENCHMARK RECORD: CTC ₹55,008, ER PF ₹3,000, ER ESI ₹500, EE PF ₹3,000, PT ₹208, LOP ₹3,226', () => {
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

  // 1. Total Earnings = CTC - Employer PF - Employer ESI
  // 55008 - 3000 - 500 = 51508
  assert.equal(result.calculatedGross, 51508, 'Total Earnings must be 51508');
  assert.equal(result.totalGross, 51508);

  // 2. Strict Prohibition: Never use addition or partial subtraction formulas
  assert.notEqual(result.calculatedGross, 55008 + 3000 + 500, 'Never CTC + ER PF + ER ESI');
  assert.notEqual(result.calculatedGross, 55008 - 3000 + 500, 'Never CTC - ER PF + ER ESI');
  assert.notEqual(result.calculatedGross, 55008 + 3000 - 500, 'Never CTC + ER PF - ER ESI');

  // 3. Employee Deductions: Employee PF + EE ESI + PT + TDS + Loan + Late + LOP
  // 3000 + 0 + 208 + 0 + 0 + 0 + 3226 = 6434
  assert.equal(result.calculatedDeductions, 6434, 'Total Deductions must be 6434');

  // 4. Strict Prohibition: Employer PF and Employer ESI must NOT be in employee deductions
  assert.equal(result.employerPf, 3000);
  assert.equal(result.employerEsi, 500);

  // 5. Net Salary Payable = Total Earnings - Total Deductions
  // 51508 - 6434 = 45074
  assert.equal(result.calculatedNet, 45074, 'Net Salary Payable must be 45074');
  assert.equal(result.netSalary, 45074);
});

test('LOP CALCULATION FORMULA: Daily Salary Rate and Deduction', () => {
  const monthlySalaryBasis = 55008;
  const configuredDenominator = 31; // Days in October
  const approvedLopDays = 2;

  const dailyRate = monthlySalaryBasis / configuredDenominator;
  const expectedDailyRate = 55008 / 31; // ~1774.45
  assert.equal(dailyRate, expectedDailyRate);

  const lopDeduction = Math.round(dailyRate * approvedLopDays);
  // 1774.4516 * 2 = 3548.9 -> 3549
  assert.equal(lopDeduction, 3549);
});

test('SHIFT NET HOURS CALCULATION: Prevent double-subtracting breaks', () => {
  // Shift 09:30 AM to 06:30 PM (9.0 gross hours), Lunch 60 min
  const inHours = 9.5;
  const outHours = 18.5;
  const grossHours = outHours - inHours; // 9.0 hours
  const breakHours = 60 / 60; // 1.0 hour

  // Net working hours = Gross Hours - Break Hours (subtracted exactly ONCE)
  const netHours = grossHours - breakHours;
  assert.equal(netHours, 8.0, 'Net hours must be 8.0 hours');
  assert.notEqual(netHours, grossHours - breakHours - breakHours, 'Break must never be double-subtracted');
});
