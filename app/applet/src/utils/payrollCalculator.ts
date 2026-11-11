/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function roundCurrency(val: number): number {
  if (val === undefined || val === null || isNaN(val)) return 0;
  return Math.round(Number(val) * 100) / 100;
}

export interface SalaryCalculationInput {
  ctc?: number;
  employerPf?: number;
  employerEsi?: number;
  basic?: number;
  hra?: number;
  specialAllowance?: number;
  otherAllowances?: number;
  conveyance?: number;
  medicalAllowance?: number;
  providedGross?: number; // Optional imported reference value from sheet (does not control calculated Total Earnings)

  employeePf?: number;
  pf?: number; // legacy alias for employeePf
  employeeEsi?: number;
  esi?: number; // legacy alias for employeeEsi
  professionalTax?: number;
  pt?: number; // alias for professionalTax
  tds?: number;
  loan?: number;
  lateDeduction?: number;
  lopDeduction?: number;
  lopAmount?: number; // alias for lopDeduction
  otherDeductions?: number;
  providedDeductions?: number;
  providedNet?: number;
}

export interface CalculatedSalary {
  ctc: number;
  employerPf: number;
  employerEsi: number;
  providedGross?: number;
  calculatedGross: number; // Total Earnings = CTC - Employer PF - Employer ESI
  totalGross: number; // Alias for calculatedGross
  totalEarnings: number; // Alias for calculatedGross

  employeePf: number;
  employeeEsi: number;
  esi: number;
  professionalTax: number;
  tds: number;
  loan: number;
  lateDeduction: number;
  lopDeduction: number;
  otherDeductions: number;
  calculatedDeductions: number;
  totalDeductions: number;

  calculatedNet: number; // Net Salary Payable = Total Earnings - Total Deductions
  netSalary: number;
  netSalaryPayable: number;
}

/**
 * Calculates Total Earnings:
 * Total Earnings = CTC - Employer PF - Employer ESI
 */
export function calculateTotalEarnings(ctc: number = 0, employerPf: number = 0, employerEsi: number = 0): number {
  const ctcNum = Number(ctc) || 0;
  const pfNum = Number(employerPf) || 0;
  const esiNum = Number(employerEsi) || 0;
  const total = ctcNum - pfNum - esiNum;
  return roundCurrency(Math.max(0, total));
}

/**
 * Calculates Total Deductions:
 * Total Deductions = Employee PF + Employee ESI + PT + TDS + Loan + Late Deduction + LOP Deduction + Other Deductions
 */
export function calculateTotalDeductions(
  employeePf: number = 0,
  employeeEsi: number = 0,
  pt: number = 0,
  tds: number = 0,
  loan: number = 0,
  lateDeduction: number = 0,
  lopDeduction: number = 0,
  otherDeductions: number = 0
): number {
  const sum =
    (Number(employeePf) || 0) +
    (Number(employeeEsi) || 0) +
    (Number(pt) || 0) +
    (Number(tds) || 0) +
    (Number(loan) || 0) +
    (Number(lateDeduction) || 0) +
    (Number(lopDeduction) || 0) +
    (Number(otherDeductions) || 0);
  return roundCurrency(Math.max(0, sum));
}

/**
 * Calculates Net Salary Payable:
 * Net Salary Payable = Total Earnings - Total Deductions
 */
export function calculateNetSalary(totalEarnings: number = 0, totalDeductions: number = 0): number {
  const earnings = Number(totalEarnings) || 0;
  const deductions = Number(totalDeductions) || 0;
  const net = earnings - deductions;
  return roundCurrency(net);
}

/**
 * Authoritative payroll calculation engine for PeopleDesk Studio.
 *
 * STAGE 1: TOTAL EARNINGS (Calculated Gross)
 * Total Earnings = CTC - Employer PF - Employer ESI (if CTC provided).
 * Imported Gross Salary (providedGross) is stored separately as a reference value and NEVER replaces calculated Total Earnings.
 *
 * STAGE 2: TOTAL DEDUCTIONS
 * Total Deductions = Employee PF + Employee ESI + PT + TDS + Loan + Late Deduction + LOP Deduction + Other Deductions
 * (Uses Employee PF and Employee ESI, NEVER Employer contributions)
 *
 * STAGE 3: NET SALARY PAYABLE
 * Net Salary Payable = Total Earnings - Total Deductions
 */
export function calculateSalary(input: SalaryCalculationInput): CalculatedSalary {
  const employerPf = Number(input.employerPf) || 0;
  const employerEsi = Number(input.employerEsi) || 0;
  const ctc = Number(input.ctc) || 0;

  const basic = Number(input.basic) || 0;
  const hra = Number(input.hra) || 0;
  const specialAllowance = Number(input.specialAllowance) || 0;
  const otherAllowances = Number(input.otherAllowances) || 0;
  const conveyance = Number(input.conveyance) || 0;
  const medicalAllowance = Number(input.medicalAllowance) || 0;

  const componentSum = roundCurrency(
    basic + hra + specialAllowance + otherAllowances + conveyance + medicalAllowance
  );

  // STAGE 1: Total Earnings = CTC - Employer PF - Employer ESI
  // CRITICAL: providedGross is strictly an imported reference value and must NEVER control calculatedTotalEarnings.
  let calculatedGross = 0;
  if (ctc > 0) {
    calculatedGross = calculateTotalEarnings(ctc, employerPf, employerEsi);
  } else if (componentSum > 0) {
    calculatedGross = componentSum;
  }

  const providedGross = input.providedGross !== undefined && input.providedGross !== null && !isNaN(Number(input.providedGross))
    ? roundCurrency(Number(input.providedGross))
    : undefined;

  // STAGE 2: Total Deductions = Employee PF + Employee ESI + PT + TDS + Loan + Late Deduction + LOP Deduction + Other Deductions
  const employeePf = input.employeePf !== undefined && input.employeePf !== null && !isNaN(Number(input.employeePf))
    ? Number(input.employeePf)
    : (Number(input.pf) || 0);

  const employeeEsi = input.employeeEsi !== undefined && input.employeeEsi !== null && !isNaN(Number(input.employeeEsi))
    ? Number(input.employeeEsi)
    : (Number(input.esi) || 0);

  const professionalTax = input.professionalTax !== undefined ? Number(input.professionalTax) : (Number(input.pt) || 0);
  const tds = Number(input.tds) || 0;
  const loan = Number(input.loan) || 0;
  const lateDeduction = Number(input.lateDeduction) || 0;

  const lopDeduction = input.lopDeduction !== undefined && input.lopDeduction !== null && !isNaN(Number(input.lopDeduction))
    ? Number(input.lopDeduction)
    : (Number(input.lopAmount) || 0);

  const otherDeductions = Number(input.otherDeductions) || 0;

  const calculatedDeductions = calculateTotalDeductions(
    employeePf,
    employeeEsi,
    professionalTax,
    tds,
    loan,
    lateDeduction,
    lopDeduction,
    otherDeductions
  );

  // STAGE 3: Net Salary Payable = Total Earnings - Total Deductions
  const calculatedNet = calculateNetSalary(calculatedGross, calculatedDeductions);

  return {
    ctc: roundCurrency(ctc),
    employerPf: roundCurrency(employerPf),
    employerEsi: roundCurrency(employerEsi),
    providedGross,
    calculatedGross,
    totalGross: calculatedGross,
    totalEarnings: calculatedGross,

    employeePf: roundCurrency(employeePf),
    employeeEsi: roundCurrency(employeeEsi),
    esi: roundCurrency(employeeEsi),
    professionalTax: roundCurrency(professionalTax),
    tds: roundCurrency(tds),
    loan: roundCurrency(loan),
    lateDeduction: roundCurrency(lateDeduction),
    lopDeduction: roundCurrency(lopDeduction),
    otherDeductions: roundCurrency(otherDeductions),
    calculatedDeductions,
    totalDeductions: calculatedDeductions,

    calculatedNet,
    netSalary: calculatedNet,
    netSalaryPayable: calculatedNet
  };
}

export function computePayroll(input: any): CalculatedSalary {
  return calculateSalary(input);
}
