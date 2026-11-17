import {
  CompanySettings,
  EmployeeRecord,
  PayslipElementConfig,
  PayslipLayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
} from '../types/payroll';
import { getDaysInMonth } from './dateUtils';

export type PayslipSectionGroup = 'A' | 'B' | 'C' | 'D' | 'E';

export interface PayslipFieldMeta {
  key: string;
  aliases: string[];
  section: PayslipSectionGroup;
  sectionName: string;
  defaultLabel: string;
  showKey: keyof PayslipLayoutSettings;
  labelKey: keyof PayslipLayoutSettings;
  dataType: 'text' | 'currency' | 'date' | 'number';
  defaultPlacement: 'employeeInfo' | 'earnings' | 'deductions' | 'finalSummary';
  isSensitiveBank?: boolean;
  isDeduction?: boolean;
  isSummaryRow?: boolean;
}

/**
 * Authoritative Registry of ALL 36 Mandatory Payslip Data Fields across Sections A–E.
 */
export const PAYSLIP_FIELD_REGISTRY: PayslipFieldMeta[] = [
  // SECTION A — Employee Details (7)
  {
    key: 'employeeId',
    aliases: ['empId'],
    section: 'A',
    sectionName: 'A. Employee Details',
    defaultLabel: 'Employee ID',
    showKey: 'showEmployeeId',
    labelKey: 'labelEmployeeId',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'name',
    aliases: ['employeeName', 'legalName'],
    section: 'A',
    sectionName: 'A. Employee Details',
    defaultLabel: 'Employee Name',
    showKey: 'showName',
    labelKey: 'labelName',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'department',
    aliases: [],
    section: 'A',
    sectionName: 'A. Employee Details',
    defaultLabel: 'Department',
    showKey: 'showDepartment',
    labelKey: 'labelDepartment',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'designation',
    aliases: [],
    section: 'A',
    sectionName: 'A. Employee Details',
    defaultLabel: 'Designation',
    showKey: 'showDesignation',
    labelKey: 'labelDesignation',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'joiningDate',
    aliases: ['doj'],
    section: 'A',
    sectionName: 'A. Employee Details',
    defaultLabel: 'Joining Date',
    showKey: 'showJoiningDate',
    labelKey: 'labelJoiningDate',
    dataType: 'date',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'email',
    aliases: ['workEmail'],
    section: 'A',
    sectionName: 'A. Employee Details',
    defaultLabel: 'Email',
    showKey: 'showEmail',
    labelKey: 'labelEmail',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'phone',
    aliases: ['primaryPhone', 'mobile'],
    section: 'A',
    sectionName: 'A. Employee Details',
    defaultLabel: 'Phone',
    showKey: 'showPhone',
    labelKey: 'labelPhone',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },

  // SECTION B — Bank & Statutory Details (9)
  {
    key: 'pfNumber',
    aliases: ['pfNo'],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'PF Number',
    showKey: 'showPfNumber',
    labelKey: 'labelPfNumber',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'esiNumber',
    aliases: ['esicNumber', 'esiNo'],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'ESI Number',
    showKey: 'showEsiNumber',
    labelKey: 'labelEsiNumber',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'bankName',
    aliases: [],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'Bank Name',
    showKey: 'showBankName',
    labelKey: 'labelBankName',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'ifscCode',
    aliases: ['ifsc'],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'IFSC Code',
    showKey: 'showIfscCode',
    labelKey: 'labelIfscCode',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'bankAccount',
    aliases: ['bankAccountNumber', 'accountNumber'],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'Bank Account Number',
    showKey: 'showBankAccount',
    labelKey: 'labelBankAccount',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
    isSensitiveBank: true,
  },
  {
    key: 'branchName',
    aliases: [],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'Branch Name',
    showKey: 'showBranchName',
    labelKey: 'labelBranchName',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'accountHolderName',
    aliases: [],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'Account Holder Name',
    showKey: 'showAccountHolderName',
    labelKey: 'labelAccountHolderName',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'pan',
    aliases: ['panNumber'],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'PAN',
    showKey: 'showPan',
    labelKey: 'labelPan',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'uan',
    aliases: ['uanNumber'],
    section: 'B',
    sectionName: 'B. Bank & Statutory Details',
    defaultLabel: 'UAN',
    showKey: 'showUan',
    labelKey: 'labelUan',
    dataType: 'text',
    defaultPlacement: 'employeeInfo',
  },

  // SECTION C — Earnings (8)
  {
    key: 'basic',
    aliases: ['basicSalary'],
    section: 'C',
    sectionName: 'C. Earnings',
    defaultLabel: 'Basic Salary',
    showKey: 'showBasic',
    labelKey: 'labelBasic',
    dataType: 'currency',
    defaultPlacement: 'earnings',
  },
  {
    key: 'hra',
    aliases: ['houseRentAllowance'],
    section: 'C',
    sectionName: 'C. Earnings',
    defaultLabel: 'HRA',
    showKey: 'showHra',
    labelKey: 'labelHra',
    dataType: 'currency',
    defaultPlacement: 'earnings',
  },
  {
    key: 'specialAllowance',
    aliases: [],
    section: 'C',
    sectionName: 'C. Earnings',
    defaultLabel: 'Special Allowance',
    showKey: 'showSpecialAllowance',
    labelKey: 'labelSpecialAllowance',
    dataType: 'currency',
    defaultPlacement: 'earnings',
  },
  {
    key: 'otherAllowances',
    aliases: ['allowances'],
    section: 'C',
    sectionName: 'C. Earnings',
    defaultLabel: 'Other Allowances',
    showKey: 'showOtherAllowances',
    labelKey: 'labelOtherAllowances',
    dataType: 'currency',
    defaultPlacement: 'earnings',
  },
  {
    key: 'ctc',
    aliases: ['costToCompany'],
    section: 'C',
    sectionName: 'C. Earnings',
    defaultLabel: 'CTC',
    showKey: 'showCtc',
    labelKey: 'labelCtc',
    dataType: 'currency',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'employerPf',
    aliases: ['employerPfDeductions'],
    section: 'C',
    sectionName: 'C. Earnings',
    defaultLabel: 'Employer PF Deductions',
    showKey: 'showEmployerPf',
    labelKey: 'labelEmployerPf',
    dataType: 'currency',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'employerEsi',
    aliases: ['employerEsiDeductions'],
    section: 'C',
    sectionName: 'C. Earnings',
    defaultLabel: 'Employer ESI Deductions',
    showKey: 'showEmployerEsi',
    labelKey: 'labelEmployerEsi',
    dataType: 'currency',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'calculatedGross',
    aliases: ['grossEarnings', 'totalGross'],
    section: 'C',
    sectionName: 'C. Earnings',
    defaultLabel: 'Gross Earnings',
    showKey: 'showGrossEarnings',
    labelKey: 'labelGrossEarnings',
    dataType: 'currency',
    defaultPlacement: 'earnings',
    isSummaryRow: true,
  },

  // SECTION D — Deductions (8)
  {
    key: 'employeePf',
    aliases: ['pf'],
    section: 'D',
    sectionName: 'D. Deductions',
    defaultLabel: 'Employee PF',
    showKey: 'showPf',
    labelKey: 'labelPf',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
  },
  {
    key: 'esi',
    aliases: ['employeeEsi'],
    section: 'D',
    sectionName: 'D. Deductions',
    defaultLabel: 'Employee ESI',
    showKey: 'showEsi',
    labelKey: 'labelEsi',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
  },
  {
    key: 'professionalTax',
    aliases: ['pt'],
    section: 'D',
    sectionName: 'D. Deductions',
    defaultLabel: 'Professional Tax',
    showKey: 'showProfessionalTax',
    labelKey: 'labelProfessionalTax',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
  },
  {
    key: 'loan',
    aliases: ['loanDeductions'],
    section: 'D',
    sectionName: 'D. Deductions',
    defaultLabel: 'Loan Deductions',
    showKey: 'showLoan',
    labelKey: 'labelLoan',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
  },
  {
    key: 'lateDeduction',
    aliases: ['lateDeductions'],
    section: 'D',
    sectionName: 'D. Deductions',
    defaultLabel: 'Late Deductions',
    showKey: 'showLateDeduction',
    labelKey: 'labelLateDeduction',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
  },
  {
    key: 'tds',
    aliases: ['incomeTax'],
    section: 'D',
    sectionName: 'D. Deductions',
    defaultLabel: 'TDS',
    showKey: 'showTds',
    labelKey: 'labelTds',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
  },
  {
    key: 'otherDeductions',
    aliases: [],
    section: 'D',
    sectionName: 'D. Deductions',
    defaultLabel: 'Other Deductions',
    showKey: 'showOtherDeductions',
    labelKey: 'labelOtherDeductions',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
  },
  {
    key: 'calculatedDeductions',
    aliases: ['totalDeductions'],
    section: 'D',
    sectionName: 'D. Deductions',
    defaultLabel: 'Total Deductions',
    showKey: 'showTotalDeductions',
    labelKey: 'labelTotalDeductions',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
    isSummaryRow: true,
  },

  // SECTION E — Final Payroll Summary & Attendance (4)
  {
    key: 'calculatedNet',
    aliases: ['netSalary'],
    section: 'E',
    sectionName: 'E. Final Payroll Summary & Attendance',
    defaultLabel: 'Net Salary',
    showKey: 'showNetSalary',
    labelKey: 'labelNetSalary',
    dataType: 'currency',
    defaultPlacement: 'finalSummary',
    isSummaryRow: true,
  },
  {
    key: 'paidDays',
    aliases: [],
    section: 'E',
    sectionName: 'E. Final Payroll Summary & Attendance',
    defaultLabel: 'Paid Days',
    showKey: 'showPaidDays',
    labelKey: 'labelPaidDays',
    dataType: 'number',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'lopDays',
    aliases: ['unpaidDays'],
    section: 'E',
    sectionName: 'E. Final Payroll Summary & Attendance',
    defaultLabel: 'LOP Days',
    showKey: 'showLopDays',
    labelKey: 'labelLopDays',
    dataType: 'number',
    defaultPlacement: 'employeeInfo',
  },
  {
    key: 'lopAmount',
    aliases: ['lopDeduction'],
    section: 'E',
    sectionName: 'E. Final Payroll Summary & Attendance',
    defaultLabel: 'LOP Amount',
    showKey: 'showLopAmount',
    labelKey: 'labelLopAmount',
    dataType: 'currency',
    defaultPlacement: 'deductions',
    isDeduction: true,
  },
];

export const PAYSLIP_SECTION_TITLES: Record<PayslipSectionGroup, string> = {
  A: 'Section A — Employee Details (7)',
  B: 'Section B — Bank & Statutory Details (9)',
  C: 'Section C — Earnings (8)',
  D: 'Section D — Deductions (8)',
  E: 'Section E — Final Payroll & Attendance (4)',
};

export const EXTRA_METADATA_FIELDS: Array<{
  key: string;
  labelKey: keyof PayslipLayoutSettings;
  showKey: keyof PayslipLayoutSettings;
  defaultLabel: string;
}> = [
  { key: 'paymentDate', labelKey: 'labelPaymentDate', showKey: 'showPaymentDate', defaultLabel: 'Payment Date' },
  { key: 'totalWorkingDays', labelKey: 'labelTotalWorkingDays', showKey: 'showTotalWorkingDays', defaultLabel: 'Total Working Days' },
  { key: 'payslipNumber', labelKey: 'labelPayslipNumber', showKey: 'showPayslipNumber', defaultLabel: 'Payslip Number' },
];

export function maskBankAccountNumber(raw?: string | null): string {
  const clean = String(raw || '').trim();
  if (!clean) return '—';
  if (clean.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

export function buildPayslipNumber(record: EmployeeRecord, month: string, year: number): string {
  const monthCode = (month || 'PAY').slice(0, 3).toUpperCase();
  const safeId = (record.employeeId || '000').replace(/[^A-Za-z0-9]/g, '');
  return `PS-${year}-${monthCode}-${safeId}`;
}

export function isFieldVisibleInLayout(layout: PayslipLayoutSettings, meta: PayslipFieldMeta): boolean {
  const cfg = layout.fieldConfigs?.[meta.key];
  if (cfg && typeof cfg.visible === 'boolean') return cfg.visible;
  const topFlag = layout[meta.showKey];
  if (meta.key === 'employeePf' && layout.showEmployeePf === false) return false;
  if (topFlag !== undefined) return Boolean(topFlag);
  return true;
}

export function getFieldLabelInLayout(layout: PayslipLayoutSettings, meta: PayslipFieldMeta): string {
  const cfg = layout.fieldConfigs?.[meta.key];
  if (cfg && cfg.label && cfg.label.trim()) return cfg.label;
  const topLabel = layout[meta.labelKey];
  if (typeof topLabel === 'string' && topLabel.trim()) return topLabel;
  return meta.defaultLabel;
}

export function getElementStyleConfig(layout: PayslipLayoutSettings, fieldKey: string): PayslipElementConfig {
  return layout.fieldConfigs?.[fieldKey] || { key: fieldKey };
}

export function formatMoneyDisplay(amount: number, symbol: string, showSymbol = true, forPdf = false): string {
  const val = Number(amount) || 0;
  const numStr = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!showSymbol) return numStr;
  if (forPdf) {
    const safeSymbol = symbol === '₹' ? 'Rs.' : String(symbol || '$').replace(/[^\x00-\x7F\u00A0-\u00FF]/g, '') || '$';
    return `${safeSymbol} ${numStr}`;
  }
  return `${symbol || '$'} ${numStr}`;
}

export interface ResolvedPayslipItem {
  key: string;
  label: string;
  displayValue: string;
  numericValue?: number;
  styleConfig: PayslipElementConfig;
}

/**
 * Resolves all visible fields into consistent structured buckets shared between
 * PreviewModal, LayoutEditorView A4 Canvas, and jsPDF Vector Generator.
 */
export function resolvePayslipSectionsData(
  record: EmployeeRecord,
  settings: CompanySettings,
  month: string,
  year: number,
  layoutInput?: PayslipLayoutSettings,
  forPdf = false
): {
  infoFields: ResolvedPayslipItem[];
  earningRows: ResolvedPayslipItem[];
  deductionRows: ResolvedPayslipItem[];
  grossTotal: ResolvedPayslipItem;
  deductionTotal: ResolvedPayslipItem;
  netPaySummary: ResolvedPayslipItem;
} {
  const layout: PayslipLayoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    ...(layoutInput || {}),
  };
  const showSymbol = settings.showCurrencySymbol !== false;
  const sym = settings.currencySymbol || '$';

  const getMeta = (key: string) => PAYSLIP_FIELD_REGISTRY.find((f) => f.key === key)!;

  const infoFields: ResolvedPayslipItem[] = [];
  const earningRows: ResolvedPayslipItem[] = [];
  const deductionRows: ResolvedPayslipItem[] = [];

  const pushInfo = (key: string, label: string, rawVal: any, forceFormat?: PayslipElementConfig['valueFormat']) => {
    const cfg = getElementStyleConfig(layout, key);
    const fmt = cfg.valueFormat && cfg.valueFormat !== 'auto' ? cfg.valueFormat : forceFormat || 'text';
    let displayValue = '—';
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      if (fmt === 'masked' || (key === 'bankAccount' && layout.maskBankAccount)) {
        displayValue = maskBankAccountNumber(String(rawVal));
      } else if (fmt === 'currency') {
        displayValue = formatMoneyDisplay(Number(rawVal) || 0, sym, showSymbol, forPdf);
      } else {
        displayValue = String(rawVal).trim();
      }
    }
    infoFields.push({
      key,
      label,
      displayValue,
      numericValue: typeof rawVal === 'number' ? rawVal : undefined,
      styleConfig: cfg,
    });
  };

  // Ordered Employee & Statutory + Metadata items
  const defaultInfoKeys = [
    'employeeId',
    'name',
    'department',
    'designation',
    'joiningDate',
    'email',
    'phone',
    'pfNumber',
    'esiNumber',
    'pan',
    'uan',
    'bankName',
    'bankAccount',
    'ifscCode',
    'branchName',
    'accountHolderName',
    'paidDays',
    'lopDays',
    'ctc',
    'employerPf',
    'employerEsi',
  ];

  const sortedInfoKeys = [...defaultInfoKeys].sort((a, b) => {
    const ordA = layout.fieldConfigs?.[a]?.order ?? defaultInfoKeys.indexOf(a);
    const ordB = layout.fieldConfigs?.[b]?.order ?? defaultInfoKeys.indexOf(b);
    return ordA - ordB;
  });

  // Optional Header/Attendance Metadata (Payslip #, Payment Date, Working Days)
  if (layout.showPayslipNumber) {
    pushInfo('payslipNumber', layout.labelPayslipNumber || 'Payslip Number', buildPayslipNumber(record, month, year));
  }
  if (layout.showPaymentDate !== false) {
    pushInfo('paymentDate', layout.labelPaymentDate || 'Payment Date', record.paymentDate || '—');
  }
  if (layout.showTotalWorkingDays) {
    const wd = record.totalWorkingDays ?? getDaysInMonth(year, month);
    pushInfo('totalWorkingDays', layout.labelTotalWorkingDays || 'Total Working Days', `${wd} Days`);
  }

  for (const key of sortedInfoKeys) {
    const meta = getMeta(key);
    if (!meta || !isFieldVisibleInLayout(layout, meta)) continue;

    // Check if placed inside earnings or deductions via inspector override
    const cfg = getElementStyleConfig(layout, key);
    if (cfg.sectionPlacement === 'earnings' && meta.dataType === 'currency') {
      const numVal = Number((record as any)[key]) || 0;
      earningRows.push({
        key,
        label: getFieldLabelInLayout(layout, meta),
        displayValue: formatMoneyDisplay(numVal, sym, showSymbol, forPdf),
        numericValue: numVal,
        styleConfig: cfg,
      });
      continue;
    }

    let rawVal: any = (record as any)[key];
    if (key === 'esiNumber') rawVal = record.esiNumber;
    else if (key === 'name') rawVal = record.name;
    else if (key === 'paidDays') rawVal = `${record.paidDays ?? getDaysInMonth(year, month)} Days`;
    else if (key === 'lopDays') rawVal = `${record.lopDays ?? record.unpaidDays ?? 0} Days`;
    else if (key === 'ctc') {
      if (record.ctc === undefined || record.ctc === null) continue;
      pushInfo(key, getFieldLabelInLayout(layout, meta), record.ctc, 'currency');
      continue;
    } else if (key === 'employerPf') {
      if (record.employerPf === undefined || record.employerPf === null) continue;
      pushInfo(key, getFieldLabelInLayout(layout, meta), record.employerPf, 'currency');
      continue;
    } else if (key === 'employerEsi') {
      if (record.employerEsi === undefined || record.employerEsi === null) continue;
      pushInfo(key, getFieldLabelInLayout(layout, meta), record.employerEsi, 'currency');
      continue;
    }

    pushInfo(key, getFieldLabelInLayout(layout, meta), rawVal);
  }

  // Custom Excel / User fields in Employee Info
  if (record.customFields && typeof record.customFields === 'object') {
    const customLayouts = layout.customFieldLayouts || [];
    const seenCustom = new Set<string>();
    Object.entries(record.customFields).forEach(([cKey, cVal]) => {
      const normKey = cKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenCustom.has(normKey)) return;
      seenCustom.add(normKey);

      const cf = customLayouts.find(
        (c) => c.key === cKey || c.key.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey
      );
      if (cf && (cf.showInPdf === false || cf.isVisible === false)) return;

      const lowerKey = cKey.toLowerCase();
      if (
        typeof cVal === 'number' &&
        (lowerKey.includes('allowance') ||
          lowerKey.includes('deduction') ||
          lowerKey.includes('loan') ||
          lowerKey.includes('advance') ||
          lowerKey.includes('pf') ||
          lowerKey.includes('esi') ||
          lowerKey.includes('tax') ||
          lowerKey.includes('tds') ||
          lowerKey.includes('lop') ||
          lowerKey.includes('late') ||
          lowerKey.includes('basic') ||
          lowerKey.includes('hra') ||
          lowerKey.includes('gross') ||
          lowerKey.includes('net') ||
          lowerKey.includes('ctc'))
      ) {
        return;
      }

      const fieldLabel = cf?.label || cKey.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      pushInfo(`custom_${cKey}`, fieldLabel, cVal);
    });
  }

  // Custom fields added directly in Layout Customizer
  if (Array.isArray(layout.customFieldsMeta)) {
    layout.customFieldsMeta.forEach((cm) => {
      if (cm.visible === false) return;
      const val = record.customFields?.[cm.key] ?? cm.sampleValue ?? '—';
      if (cm.sectionPlacement === 'earnings') {
        const num = Number(val) || 0;
        earningRows.push({
          key: cm.key,
          label: cm.label,
          displayValue: formatMoneyDisplay(num, sym, showSymbol, forPdf),
          numericValue: num,
          styleConfig: getElementStyleConfig(layout, cm.key),
        });
      } else if (cm.sectionPlacement === 'deductions') {
        const num = Number(val) || 0;
        deductionRows.push({
          key: cm.key,
          label: cm.label,
          displayValue: formatMoneyDisplay(num, sym, showSymbol, forPdf),
          numericValue: num,
          styleConfig: getElementStyleConfig(layout, cm.key),
        });
      } else {
        pushInfo(cm.key, cm.label, val);
      }
    });
  }

  // Earnings Table Rows
  const earningKeys = ['basic', 'hra', 'specialAllowance', 'otherAllowances'];
  earningKeys.forEach((eKey) => {
    const meta = getMeta(eKey);
    if (!meta || !isFieldVisibleInLayout(layout, meta)) return;
    const val = Number((record as any)[eKey]) || 0;
    const cfg = getElementStyleConfig(layout, eKey);
    earningRows.push({
      key: eKey,
      label: getFieldLabelInLayout(layout, meta),
      displayValue: formatMoneyDisplay(val, sym, showSymbol, forPdf),
      numericValue: val,
      styleConfig: cfg,
    });
  });

  if (record.conveyance) {
    earningRows.push({
      key: 'conveyance',
      label: 'Conveyance Allowance',
      displayValue: formatMoneyDisplay(record.conveyance, sym, showSymbol, forPdf),
      numericValue: record.conveyance,
      styleConfig: getElementStyleConfig(layout, 'conveyance'),
    });
  }
  if (record.medicalAllowance) {
    earningRows.push({
      key: 'medicalAllowance',
      label: 'Medical Allowance',
      displayValue: formatMoneyDisplay(record.medicalAllowance, sym, showSymbol, forPdf),
      numericValue: record.medicalAllowance,
      styleConfig: getElementStyleConfig(layout, 'medicalAllowance'),
    });
  }
  if (Array.isArray(record.customEarnings)) {
    record.customEarnings.forEach((ce, idx) => {
      if (ce.label && Number(ce.amount || 0) !== 0) {
        const amt = Number(ce.amount);
        earningRows.push({
          key: `custom_earn_${idx}`,
          label: ce.label,
          displayValue: formatMoneyDisplay(amt, sym, showSymbol, forPdf),
          numericValue: amt,
          styleConfig: { key: `custom_earn_${idx}` },
        });
      }
    });
  }
  if (record.customFields) {
    const seenEarnKeys = new Set<string>();
    Object.entries(record.customFields).forEach(([key, val]) => {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenEarnKeys.has(normKey)) return;
      seenEarnKeys.add(normKey);
      if (typeof val === 'number' && key.toLowerCase().includes('allowance')) {
        const label = key.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        earningRows.push({
          key: `custom_allow_${key}`,
          label,
          displayValue: formatMoneyDisplay(val, sym, showSymbol, forPdf),
          numericValue: val,
          styleConfig: { key: `custom_allow_${key}` },
        });
      }
    });
  }

  // Deductions Table Rows
  const deductionMappings: Array<{ key: string; val: number; showZero?: boolean }> = [
    { key: 'employeePf', val: Number(record.employeePf ?? record.pf) || 0, showZero: true },
    { key: 'esi', val: Number(record.esi) || 0, showZero: true },
    { key: 'professionalTax', val: Number(record.professionalTax) || 0, showZero: true },
    { key: 'loan', val: Number(record.loan) || 0, showZero: false },
    { key: 'lateDeduction', val: Number(record.lateDeduction) || 0, showZero: false },
    { key: 'tds', val: Number(record.tds) || 0, showZero: true },
    { key: 'lopAmount', val: Number(record.lopAmount || record.lopDeduction) || 0, showZero: false },
    { key: 'otherDeductions', val: Number(record.otherDeductions) || 0, showZero: true },
  ];

  deductionMappings.forEach(({ key, val, showZero }) => {
    const meta = getMeta(key);
    if (!meta || !isFieldVisibleInLayout(layout, meta)) return;
    if (!showZero && val <= 0) return;
    deductionRows.push({
      key,
      label: getFieldLabelInLayout(layout, meta),
      displayValue: formatMoneyDisplay(val, sym, showSymbol, forPdf),
      numericValue: val,
      styleConfig: getElementStyleConfig(layout, key),
    });
  });

  if (Array.isArray(record.customDeductions)) {
    record.customDeductions.forEach((cd, idx) => {
      if (cd.label && Number(cd.amount || 0) !== 0) {
        const amt = Number(cd.amount);
        deductionRows.push({
          key: `custom_ded_${idx}`,
          label: cd.label,
          displayValue: formatMoneyDisplay(amt, sym, showSymbol, forPdf),
          numericValue: amt,
          styleConfig: { key: `custom_ded_${idx}` },
        });
      }
    });
  }

  const grossMeta = getMeta('calculatedGross');
  const dedMeta = getMeta('calculatedDeductions');
  const netMeta = getMeta('calculatedNet');

  return {
    infoFields,
    earningRows,
    deductionRows,
    grossTotal: {
      key: 'calculatedGross',
      label: getFieldLabelInLayout(layout, grossMeta) || 'TOTAL GROSS EARNINGS',
      displayValue: formatMoneyDisplay(record.calculatedGross, sym, showSymbol, forPdf),
      numericValue: record.calculatedGross,
      styleConfig: getElementStyleConfig(layout, 'calculatedGross'),
    },
    deductionTotal: {
      key: 'calculatedDeductions',
      label: getFieldLabelInLayout(layout, dedMeta) || 'TOTAL DEDUCTIONS',
      displayValue: formatMoneyDisplay(record.calculatedDeductions, sym, showSymbol, forPdf),
      numericValue: record.calculatedDeductions,
      styleConfig: getElementStyleConfig(layout, 'calculatedDeductions'),
    },
    netPaySummary: {
      key: 'calculatedNet',
      label: getFieldLabelInLayout(layout, netMeta) || 'NET SALARY PAYABLE',
      displayValue: formatMoneyDisplay(record.calculatedNet, sym, showSymbol, forPdf),
      numericValue: record.calculatedNet,
      styleConfig: getElementStyleConfig(layout, 'calculatedNet'),
    },
  };
}

/**
 * Estimates whether the configured layout fits onto a single A4 sheet without page overflow.
 */
export function estimatePayslipFit(
  record: EmployeeRecord,
  settings: CompanySettings,
  layout: PayslipLayoutSettings,
  month = 'October',
  year = 2026
): {
  fitsOnSinglePage: boolean;
  estimatedHeightMm: number;
  maxHeightMm: number;
  visibleFieldCount: number;
  warningMessage: string | null;
} {
  const isLandscape = layout.orientation === 'landscape';
  const pageH = isLandscape ? 210 : 297;
  const margin = Number(layout.marginMm ?? 14);
  const maxHeightMm = pageH - margin * 2;

  const resolved = resolvePayslipSectionsData(record, settings, month, year, layout, true);
  const headerH = layout.templatePreset === 'compact' || layout.templatePreset === 'minimal_clean' ? 36 : 40;
  const infoRowH = layout.cellPadding === 'compact' ? 4.4 : layout.cellPadding === 'spacious' ? 6.0 : 5.2;
  const infoHeight = Math.ceil(resolved.infoFields.length / 2) * infoRowH + 10;

  const tableRowH = layout.cellPadding === 'compact' ? 6.2 : layout.cellPadding === 'spacious' ? 9.0 : 7.5;
  const maxTableRows = Math.max(resolved.earningRows.length, resolved.deductionRows.length, 1);
  const tableHeight = 7 + maxTableRows * tableRowH + 14;

  const netPayH = layout.showNetSalary !== false ? 26 : 4;
  const blocksH = (layout.customTextBlocks || []).filter((b) => b.visible !== false && b.content?.trim()).length * 16;
  const noteH = layout.showFooterNote ? 10 : 2;
  const sigH = layout.showSignatures ? 24 : 4;

  const estimatedHeightMm = Math.round(headerH + infoHeight + tableHeight + netPayH + blocksH + noteH + sigH);
  const fitsOnSinglePage = estimatedHeightMm <= maxHeightMm;

  return {
    fitsOnSinglePage,
    estimatedHeightMm,
    maxHeightMm,
    visibleFieldCount: resolved.infoFields.length + resolved.earningRows.length + resolved.deductionRows.length + 3,
    warningMessage: fitsOnSinglePage
      ? null
      : `Content height (~${estimatedHeightMm}mm) exceeds single A4 printable area (${maxHeightMm}mm). Consider compact padding, hiding optional fields, or smaller margins.`,
  };
}
