import { EmployeeRecord, ValidationIssue } from '../types/payroll';
import { validateYear } from './dateUtils';
import { calculateSalary, roundCurrency } from './salaryCalculator';

/**
 * Deterministically validates an employee record and checks mathematical consistency
 * using the authoritative three-stage salary calculation engine.
 */
export type RawEmployeeInput = Partial<EmployeeRecord>;

export function validateEmployeeRecord(
  record: RawEmployeeInput,
  allEmployeeIds: string[] = [],
  batchPeriod?: { month?: string; year?: number }
): {
  calculatedGross: number;
  calculatedDeductions: number;
  calculatedNet: number;
  isValid: boolean;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  // 1. Mandatory Field Checks
  const trimmedId = (record.employeeId || '').trim();
  if (!trimmedId) {
    issues.push({
      field: 'employeeId',
      severity: 'error',
      message: 'Employee ID is required.'
    });
  }

  const trimmedName = (record.name || '').trim();
  if (!trimmedName) {
    issues.push({
      field: 'name',
      severity: 'error',
      message: 'Employee Name is required.'
    });
  }

  // 2. Duplicate ID Check
  if (trimmedId && allEmployeeIds.length > 0) {
    const duplicates = allEmployeeIds.filter(id => id.toLowerCase() === trimmedId.toLowerCase());
    if (duplicates.length > 1) {
      issues.push({
        field: 'employeeId',
        severity: 'error',
        message: `Duplicate Employee ID detected (${trimmedId}). Each employee must have a unique ID.`
      });
    }
  }

  // 3. Three-Stage Salary Calculation via Authoritative Engine
  const salaryCalc = calculateSalary({
    ctc: record.ctc,
    employerPf: record.employerPf,
    employerEsi: record.employerEsi,
    basic: record.basic,
    hra: record.hra,
    specialAllowance: record.specialAllowance,
    otherAllowances: record.otherAllowances,
    conveyance: record.conveyance,
    medicalAllowance: record.medicalAllowance,
    providedGross: record.providedGross,
    employeePf: record.employeePf,
    pf: record.pf,
    esi: record.esi,
    professionalTax: record.professionalTax,
    pt: (record as any).pt,
    tds: record.tds,
    loan: record.loan,
    lateDeduction: record.lateDeduction,
    lopDeduction: record.lopDeduction || record.lopAmount,
    otherDeductions: record.otherDeductions,
    providedDeductions: record.providedDeductions,
    providedNet: record.providedNet
  });

  const calculatedGross = salaryCalc.calculatedGross;
  const calculatedDeductions = salaryCalc.calculatedDeductions;
  const calculatedNet = salaryCalc.calculatedNet;

  const basic = Number(record.basic) || 0;
  if (basic < 0) {
    issues.push({
      field: 'basic',
      severity: 'error',
      message: 'Basic salary cannot be negative.',
      actual: basic
    });
  }

  if (calculatedNet < 0) {
    issues.push({
      field: 'calculatedNet',
      severity: 'warning',
      message: 'Calculated Net Salary is negative (deductions exceed earnings).',
      actual: calculatedNet
    });
  }

  // 4. Comparison with Provided Totals
  if (record.providedGross !== undefined && record.providedGross !== null && !isNaN(record.providedGross)) {
    const providedGross = roundCurrency(record.providedGross);
    const diff = roundCurrency(Math.abs(calculatedGross - providedGross));
    if (diff > 0.01) {
      issues.push({
        field: 'providedGross',
        severity: 'warning',
        message: `Gross earnings mismatch: Sheet provided ${providedGross}, but calculated gross is ${calculatedGross} (diff: ${roundCurrency(providedGross - calculatedGross)}).`,
        expected: calculatedGross,
        actual: providedGross,
        canAutoFix: true
      });
    }
  }

  if (record.providedDeductions !== undefined && record.providedDeductions !== null && !isNaN(record.providedDeductions)) {
    const providedDeductions = roundCurrency(record.providedDeductions);
    const diff = roundCurrency(Math.abs(calculatedDeductions - providedDeductions));
    if (diff > 0.01) {
      issues.push({
        field: 'providedDeductions',
        severity: 'warning',
        message: `Deductions mismatch: Sheet provided ${providedDeductions}, but calculated deductions is ${calculatedDeductions} (diff: ${roundCurrency(providedDeductions - calculatedDeductions)}).`,
        expected: calculatedDeductions,
        actual: providedDeductions,
        canAutoFix: true
      });
    }
  }

  if (record.providedNet !== undefined && record.providedNet !== null && !isNaN(record.providedNet)) {
    const providedNet = roundCurrency(record.providedNet);
    const diff = roundCurrency(Math.abs(calculatedNet - providedNet));
    if (diff > 0.01) {
      issues.push({
        field: 'providedNet',
        severity: 'warning',
        message: `Net salary mismatch: Sheet provided ${providedNet}, but calculated net (Gross - Deductions) is ${calculatedNet} (diff: ${roundCurrency(providedNet - calculatedNet)}).`,
        expected: calculatedNet,
        actual: providedNet,
        canAutoFix: true
      });
    }
  }

  // 5. Zero earnings check
  if (calculatedGross === 0 && calculatedNet === 0) {
    issues.push({
      field: 'calculatedGross',
      severity: 'warning',
      message: 'All earnings components are zero. Verify if payroll data was provided or if this is only master data.'
    });
  }

  // 6. Payroll Year & Period Validation
  if (record.payrollYear !== undefined && record.payrollYear !== null && record.payrollYear !== 0) {
    const yearValidation = validateYear(record.payrollYear);
    if (!yearValidation.isValid) {
      issues.push({
        field: 'payrollYear',
        severity: 'error',
        message: yearValidation.error || `Invalid payroll year (${record.payrollYear}). Must be a valid 4-digit year.`,
        actual: record.payrollYear
      });
    } else if (batchPeriod?.year && yearValidation.year !== batchPeriod.year) {
      issues.push({
        field: 'payrollYear',
        severity: 'warning',
        message: `Payroll year mismatch: Record specifies year ${yearValidation.year}, while active workspace period is ${batchPeriod.year}. Record data is preserved.`,
        expected: batchPeriod.year,
        actual: yearValidation.year
      });
    }
  }

  // 7. Payroll Month Mismatch Check
  if (batchPeriod?.month && record.payrollMonth && record.payrollMonth.trim() !== '') {
    if (record.payrollMonth.trim().toLowerCase() !== batchPeriod.month.trim().toLowerCase()) {
      issues.push({
        field: 'payrollMonth',
        severity: 'warning',
        message: `Payroll month mismatch: Record specifies "${record.payrollMonth}", while active workspace month is "${batchPeriod.month}". Record data is preserved.`,
        expected: batchPeriod.month,
        actual: record.payrollMonth
      });
    }
  }

  // 8. LOP Conflict Check
  const effectiveLopDays = record.lopDays !== undefined ? record.lopDays : (record.unpaidDays || 0);
  const effectiveLopAmount = record.lopAmount || record.lopDeduction || 0;
  if (effectiveLopDays > 0 && effectiveLopAmount > 0 && calculatedGross > 0) {
    const defaultDays = record.totalWorkingDays || 30;
    const dailyRate = calculatedGross / defaultDays;
    const expectedAttendanceLopAmount = Math.round(dailyRate * effectiveLopDays * 100) / 100;
    if (Math.abs(effectiveLopAmount - expectedAttendanceLopAmount) > 5) {
      issues.push({
        field: 'lopConflict',
        severity: 'warning',
        message: `Imported LOP Amount (Rs. ${effectiveLopAmount}) differs significantly from attendance-calculated deduction (Rs. ${expectedAttendanceLopAmount} for ${effectiveLopDays} days).`,
        expected: expectedAttendanceLopAmount,
        actual: effectiveLopAmount
      });
    }
  } else if (record.lopConflict) {
    issues.push({
      field: 'lopConflict',
      severity: 'warning',
      message: record.lopConflictDetails || 'Discrepancy detected between imported LOP and attendance calculations.'
    });
  }

  // 9. IFSC Code Format Check
  if (record.ifscCode && typeof record.ifscCode === 'string' && record.ifscCode.trim() !== '') {
    const cleanIfsc = record.ifscCode.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      issues.push({
        field: 'ifscCode',
        severity: 'info',
        message: `IFSC code "${cleanIfsc}" does not match standard 11-character RBI format (e.g. HDFC0000240). Please verify.`,
        actual: cleanIfsc
      });
    }
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  const isValid = !hasErrors;

  return {
    calculatedGross,
    calculatedDeductions,
    calculatedNet,
    isValid,
    issues
  };
}

/**
 * Validates a complete batch of employee records, cross-referencing for duplicate IDs
 * and optionally verifying consistency with the active payroll period.
 */
export function validateBatch(
  records: Array<RawEmployeeInput>,
  batchPeriod?: { month?: string; year?: number }
): EmployeeRecord[] {
  const allIds = records.map(r => (r.employeeId || '').trim()).filter(Boolean);

  return records.map((record, index) => {
    const validation = validateEmployeeRecord(record, allIds, batchPeriod);
    const salaryCalc = calculateSalary({
      ctc: record.ctc,
      employerPf: record.employerPf,
      employerEsi: record.employerEsi,
      basic: record.basic,
      hra: record.hra,
      specialAllowance: record.specialAllowance,
      otherAllowances: record.otherAllowances,
      conveyance: record.conveyance,
      medicalAllowance: record.medicalAllowance,
      providedGross: record.providedGross,
      employeePf: record.employeePf,
      pf: record.pf,
      esi: record.esi,
      professionalTax: record.professionalTax,
      pt: (record as any).pt,
      tds: record.tds,
      loan: record.loan,
      lateDeduction: record.lateDeduction,
      lopDeduction: record.lopDeduction || record.lopAmount,
      otherDeductions: record.otherDeductions,
      providedDeductions: record.providedDeductions,
      providedNet: record.providedNet
    });

    return {
      ...record,
      id: record.id || `emp-${index + 1}`,
      employeeId: record.employeeId || '',
      name: record.name || '',
      email: record.email,
      phone: record.phone,
      department: record.department,
      designation: record.designation,
      joiningDate: record.joiningDate,
      employmentStatus: record.employmentStatus,
      paidDays: record.paidDays,
      unpaidDays: record.unpaidDays,
      totalWorkingDays: record.totalWorkingDays,
      presentDays: record.presentDays,
      absentDays: record.absentDays,
      paidLeave: record.paidLeave,
      unpaidLeave: record.unpaidLeave,
      lopDays: record.lopDays,
      lopAmount: salaryCalc.lopDeduction,
      lopSource: record.lopSource,
      lopConflict: record.lopConflict,
      lopConflictDetails: record.lopConflictDetails,
      bankAccount: record.bankAccount,
      bankName: record.bankName,
      ifscCode: record.ifscCode,
      branchName: record.branchName,
      accountHolderName: record.accountHolderName,
      pan: record.pan,
      uan: record.uan,
      esiNumber: record.esiNumber,
      pfNumber: record.pfNumber,
      aadhaarNumber: record.aadhaarNumber,
      ctc: salaryCalc.ctc,
      employerPf: salaryCalc.employerPf,
      employerEsi: salaryCalc.employerEsi,
      employeePf: salaryCalc.employeePf,
      loan: salaryCalc.loan,
      lateDeduction: salaryCalc.lateDeduction,
      lopDeduction: salaryCalc.lopDeduction,
      basic: Number(record.basic) || 0,
      hra: Number(record.hra) || 0,
      conveyance: Number(record.conveyance) || 0,
      medicalAllowance: Number(record.medicalAllowance) || 0,
      specialAllowance: Number(record.specialAllowance) || 0,
      otherAllowances: Number(record.otherAllowances) || 0,
      providedGross: record.providedGross,
      pf: salaryCalc.employeePf,
      esi: salaryCalc.esi,
      professionalTax: salaryCalc.professionalTax,
      tds: salaryCalc.tds,
      otherDeductions: salaryCalc.otherDeductions,
      providedDeductions: record.providedDeductions,
      providedNet: record.providedNet,
      payrollMonth: record.payrollMonth,
      payrollYear: record.payrollYear,
      customFields: record.customFields,
      calculatedGross: validation.calculatedGross,
      calculatedDeductions: validation.calculatedDeductions,
      calculatedNet: validation.calculatedNet,
      totalGross: validation.calculatedGross,
      totalDeductions: validation.calculatedDeductions,
      netSalary: validation.calculatedNet,
      isValid: validation.isValid,
      issues: validation.issues
    };
  });
}

export { roundCurrency } from './salaryCalculator';
