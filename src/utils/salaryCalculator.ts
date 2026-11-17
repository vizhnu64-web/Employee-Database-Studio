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
  basicSalary?: number;
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
  loanDeductions?: number;
  lateDeduction?: number;
  lateDeductions?: number;
  lopDeduction?: number;
  lopAmount?: number; // alias for lopDeduction
  otherDeductions?: number;
  providedDeductions?: number;
  providedNet?: number;
}

export interface CalculatedSalary {
  ctc: number;
  componentSum4: number;
  ctcMismatch: boolean;
  employerPf: number;
  employerEsi: number;
  providedGross?: number;
  calculatedGross: number;
  grossEarnings: number;
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
 * STAGE 1: CTC & GROSS EARNINGS
 * - CTC = Basic Salary + HRA + Special Allowance + Other Allowances (when omitted)
 * - Gross Earnings = CTC - Employer PF - Employer ESI
 *
 * STAGE 2: TOTAL DEDUCTIONS
 * Total Deductions = Employee PF + Employee ESI + PT + TDS + Loan + Late + LOP Amount + Other Deductions
 * (Never includes Employer PF / Employer ESI or LOP Days)
 *
 * STAGE 3: NET SALARY
 * Net Salary = Gross Earnings - Total Deductions
 */
export function calculateSalary(input: SalaryCalculationInput): CalculatedSalary {
  const employerPf = Number(input.employerPf) || 0;
  const employerEsi = Number(input.employerEsi) || 0;
  const hasExplicitCtc =
    input.ctc !== undefined && input.ctc !== null && !isNaN(Number(input.ctc)) && Number(input.ctc) > 0;
  let ctc = hasExplicitCtc ? Number(input.ctc) : 0;

  const basic = Number(input.basic ?? input.basicSalary) || 0;
  const hra = Number(input.hra) || 0;
  const specialAllowance = Number(input.specialAllowance) || 0;
  const otherAllowances = Number(input.otherAllowances) || 0;
  const conveyance = Number(input.conveyance) || 0;
  const medicalAllowance = Number(input.medicalAllowance) || 0;

  const componentSum4 = roundCurrency(basic + hra + specialAllowance + otherAllowances);
  const componentSumAll = roundCurrency(componentSum4 + conveyance + medicalAllowance);

  // STAGE 1: Gross Earnings = CTC - Employer PF - Employer ESI
  let calculatedGross = 0;
  if (hasExplicitCtc) {
    calculatedGross = roundCurrency(ctc - employerPf - employerEsi);
  } else if (componentSumAll > 0) {
    ctc = componentSumAll;
    calculatedGross = roundCurrency(ctc - employerPf - employerEsi);
  } else if (
    input.providedGross !== undefined &&
    input.providedGross !== null &&
    !isNaN(Number(input.providedGross)) &&
    Number(input.providedGross) > 0
  ) {
    calculatedGross = roundCurrency(Number(input.providedGross));
    if (ctc === 0 && (calculatedGross > 0 || employerPf > 0 || employerEsi > 0)) {
      ctc = roundCurrency(calculatedGross + employerPf + employerEsi);
    }
  }

  const ctcMismatch = hasExplicitCtc && componentSum4 > 0 && Math.abs(roundCurrency(ctc) - componentSum4) > 0.01;

  // STAGE 2: Total Deductions = Employee PF + Employee ESI + PT + Loan + Late + TDS + Other + LOP Amount
  const employeePf =
    input.employeePf !== undefined && input.employeePf !== null && !isNaN(Number(input.employeePf))
      ? Number(input.employeePf)
      : Number(input.pf) || 0;

  const employeeEsi =
    input.employeeEsi !== undefined && input.employeeEsi !== null && !isNaN(Number(input.employeeEsi))
      ? Number(input.employeeEsi)
      : Number(input.esi) || 0;

  const professionalTax =
    input.professionalTax !== undefined && input.professionalTax !== null && !isNaN(Number(input.professionalTax))
      ? Number(input.professionalTax)
      : Number(input.pt) || 0;

  const tds = Number(input.tds) || 0;
  const loan =
    input.loan !== undefined && input.loan !== null && !isNaN(Number(input.loan))
      ? Number(input.loan)
      : Number(input.loanDeductions) || 0;

  const lateDeduction =
    input.lateDeduction !== undefined && input.lateDeduction !== null && !isNaN(Number(input.lateDeduction))
      ? Number(input.lateDeduction)
      : Number(input.lateDeductions) || 0;

  const lopDeduction =
    input.lopDeduction !== undefined && input.lopDeduction !== null && !isNaN(Number(input.lopDeduction))
      ? Number(input.lopDeduction)
      : Number(input.lopAmount) || 0;

  const otherDeductions = Number(input.otherDeductions) || 0;

  const calculatedDeductions = roundCurrency(
    employeePf + employeeEsi + professionalTax + tds + loan + lateDeduction + lopDeduction + otherDeductions
  );

  // STAGE 3: Net Salary = Gross Earnings - Total Deductions
  const calculatedNet = roundCurrency(calculatedGross - calculatedDeductions);

  return {
    ctc: roundCurrency(ctc),
    componentSum4,
    ctcMismatch,
    employerPf: roundCurrency(employerPf),
    employerEsi: roundCurrency(employerEsi),
    providedGross:
      input.providedGross !== undefined && input.providedGross !== null ? Number(input.providedGross) : undefined,
    calculatedGross,
    grossEarnings: calculatedGross,
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
    netSalary: calculatedNet,
  };
}
