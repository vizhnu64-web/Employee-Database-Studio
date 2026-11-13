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
  providedGross?: number;

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
  calculatedGross: number;
  totalGross: number;

  employeePf: number;
  employeeEsi: number;
  esi: number; // alias for employeeEsi
  professionalTax: number;
  tds: number;
  loan: number;
  lateDeduction: number;
  lopDeduction: number;
  otherDeductions: number;
  calculatedDeductions: number;
  totalDeductions: number;

  calculatedNet: number;
  netSalary: number;
}

/**
 * Authoritative single payroll calculation engine for Employee Database Studio.
 *
 * STAGE 1: TOTAL GROSS
 * Total Gross = CTC - Employer PF - Employer ESI (if CTC provided)
 * Otherwise, sum of earnings components.
 *
 * STAGE 2: TOTAL DEDUCTIONS
 * Total Deductions = Employee PF + Employee ESI + PT + TDS + Loan + Late Deduction + LOP Deduction + Other Deductions
 * (Uses Employee PF and Employee ESI, NEVER Employer contributions)
 *
 * STAGE 3: NET SALARY
 * Net Salary = Total Gross - Total Deductions
 */
export function calculateSalary(input: SalaryCalculationInput): CalculatedSalary {
  const employerPf = Number(input.employerPf) || 0;
  const employerEsi = Number(input.employerEsi) || 0;
  let ctc = Number(input.ctc) || 0;

  const basic = Number(input.basic) || 0;
  const hra = Number(input.hra) || 0;
  const specialAllowance = Number(input.specialAllowance) || 0;
  const otherAllowances = Number(input.otherAllowances) || 0;
  const conveyance = Number(input.conveyance) || 0;
  const medicalAllowance = Number(input.medicalAllowance) || 0;

  const componentSum = roundCurrency(
    basic + hra + specialAllowance + otherAllowances + conveyance + medicalAllowance
  );

  // STAGE 1: Total Gross = CTC - Employer PF - Employer ESI
  let calculatedGross = 0;
  if (input.ctc !== undefined && input.ctc !== null && !isNaN(Number(input.ctc)) && Number(input.ctc) > 0) {
    calculatedGross = roundCurrency(ctc - employerPf - employerEsi);
  } else if (componentSum > 0) {
    calculatedGross = componentSum;
    if (ctc === 0 && (calculatedGross > 0 || employerPf > 0 || employerEsi > 0)) {
      ctc = roundCurrency(calculatedGross + employerPf + employerEsi);
    }
  } else if (input.providedGross !== undefined && input.providedGross !== null && !isNaN(Number(input.providedGross)) && Number(input.providedGross) > 0) {
    calculatedGross = roundCurrency(Number(input.providedGross));
    if (ctc === 0 && (calculatedGross > 0 || employerPf > 0 || employerEsi > 0)) {
      ctc = roundCurrency(calculatedGross + employerPf + employerEsi);
    }
  }

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

  const calculatedDeductions = roundCurrency(
    employeePf + employeeEsi + professionalTax + tds + loan + lateDeduction + lopDeduction + otherDeductions
  );

  // STAGE 3: Net Salary = Total Gross - Total Deductions
  const calculatedNet = roundCurrency(calculatedGross - calculatedDeductions);

  return {
    ctc: roundCurrency(ctc),
    employerPf: roundCurrency(employerPf),
    employerEsi: roundCurrency(employerEsi),
    providedGross: input.providedGross !== undefined && input.providedGross !== null ? Number(input.providedGross) : undefined,
    calculatedGross,
    totalGross: calculatedGross,

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
    netSalary: calculatedNet
  };
}
