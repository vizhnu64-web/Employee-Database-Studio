export interface EmployeeRecord {
  id: string; // Internal unique row ID
  employeeId: string; // Staff/Employee ID (preserved string with leading zeros)
  name: string;
  email?: string;
  department?: string;
  designation?: string;
  joiningDate?: string;
  paymentDate?: string;
  paidDays?: number;
  unpaidDays?: number; // Loss of pay (LOP)

  // Personal & Statutory
  pan?: string;
  uan?: string;
  esiNumber?: string;
  pfNumber?: string;
  aadhaarNumber?: string;
  phone?: string;
  employmentStatus?: string;

  // Bank Information
  bankName?: string;
  bankAccount?: string;
  ifscCode?: string;
  branchName?: string;
  accountHolderName?: string;

  // Attendance & Loss of Pay (LOP)
  totalWorkingDays?: number;
  presentDays?: number;
  absentDays?: number;
  paidLeave?: number;
  unpaidLeave?: number;
  lopDays?: number; // Explicit LOP Days
  lopAmount?: number; // Explicit LOP Amount
  lopSource?: 'excel' | 'attendance' | 'manual'; // Precedence source
  lopConflict?: boolean; // Flagged when Excel and attendance conflict
  lopConflictDetails?: string;

  // Dynamic Custom Fields
  customFields?: Record<string, any>;

  // Salary Structure, CTC & Employer Contributions
  ctc?: number; // Cost to Company
  employerPf?: number; // Employer PF (deducted from CTC to arrive at Total Gross; NOT in Total Deductions)
  employerEsi?: number; // Employer ESI (deducted from CTC to arrive at Total Gross; NOT in Total Deductions)

  // Earnings
  basic: number;
  hra: number;
  conveyance?: number;
  medicalAllowance?: number;
  specialAllowance?: number;
  otherAllowances: number;
  providedGross?: number; // Value read directly from file if present
  calculatedGross: number; // Stage 1 Total Gross: CTC - Employer PF (or sum of earnings)
  totalGross?: number; // Alias for calculatedGross

  // Deductions
  employeePf?: number; // Employee PF (deducted in Total Deductions; NOT Employer PF)
  pf: number; // Provident Fund (EPF / Employee PF legacy field)
  esi: number; // Employee State Insurance
  professionalTax: number; // PT
  tds: number; // Tax Deducted at Source / Income Tax
  loan?: number; // Staff Loan / Advance Recovery
  lateDeduction?: number; // Late Arrival / Attendance penalty
  lopDeduction?: number; // Loss of Pay Deduction amount
  otherDeductions: number;
  providedDeductions?: number; // Value read directly from file if present
  calculatedDeductions: number; // Stage 2 Total Deductions: Employee PF + ESI + PT + TDS + Loan + Late + LOP + Other
  totalDeductions?: number; // Alias for calculatedDeductions
  customEarnings?: Array<{ label: string; amount: number }>;
  customDeductions?: Array<{ label: string; amount: number }>;

  // Net Salary
  providedNet?: number; // Value read directly from file if present
  calculatedNet: number; // Stage 3 Net Salary: Total Gross - Total Deductions
  netSalary?: number; // Alias for calculatedNet

  // Payroll Period (if row-specific)
  payrollMonth?: string;
  payrollYear?: number;

  // Validation State
  isValid: boolean;
  issues: ValidationIssue[];
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  severity: IssueSeverity;
  message: string;
  expected?: number | string;
  actual?: number | string;
  canAutoFix?: boolean;
}

export interface ColumnMapping {
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  designation: string;
  joiningDate: string;
  employmentStatus?: string;
  paidDays: string;
  unpaidDays: string; // Legacy / general LOP days
  lopDays?: string; // Explicit LOP Days
  lopAmount?: string; // Explicit LOP Amount
  totalWorkingDays?: string;
  presentDays?: string;
  absentDays?: string;
  paidLeave?: string;
  unpaidLeave?: string;
  bankAccount: string;
  bankName?: string;
  ifscCode?: string;
  branchName?: string;
  accountHolderName?: string;
  pan: string;
  uan: string;
  esiNumber: string;
  pfNumber?: string;
  aadhaarNumber?: string;
  ctc?: string;
  employerPf?: string;
  employerEsi?: string;
  employeePf?: string;
  loan?: string;
  lateDeduction?: string;
  lopDeduction?: string;
  basic: string;
  hra: string;
  specialAllowance: string;
  otherAllowances: string;
  providedGross: string;
  pf: string;
  esi: string;
  professionalTax: string;
  tds: string;
  otherDeductions: string;
  providedDeductions: string;
  providedNet: string;
  payrollMonth: string;
  payrollYear: string;
}

export type CustomFieldDataType = 'text' | 'number' | 'decimal' | 'date' | 'currency' | 'boolean';
export type CustomFieldDestination = 'directory' | 'payroll' | 'both';

export interface CustomFieldDefinition {
  id: string; // unique identifier (e.g., "cost_centre")
  name?: string;
  key: string; // sanitized field key
  label: string; // HR display label
  dataType: CustomFieldDataType;
  destination: CustomFieldDestination;
  includeInPayslip?: boolean;
  availableInPayslip?: boolean; // Alias for includeInPayslip
  isVisible?: boolean;
  description?: string;
  defaultValue?: any;
  createdAt: string;
}

export interface ColumnImportControl {
  excelHeader?: string;
  excelColumn: string; // Primary or alias for excelHeader
  mappedField?: string; // Standard ColumnMapping key, custom field key, '__ignore__', or '__new_custom__'
  suggestedField: string; // Primary or alias for mappedField
  isCustom?: boolean;
  isStandard: boolean; // Alias for !isCustom
  customDefinition?: Partial<CustomFieldDefinition>;
  shouldFetch?: boolean; // HR Fetch/Import toggle (YES/NO)
  fetch: boolean; // Primary or alias for shouldFetch
  destination: CustomFieldDestination;
  sampleValues?: any[];
  sampleValue?: any;
  status?: 'mapped' | 'unmapped' | 'ambiguous' | 'ignored';
  ambiguityType?: 'lop_days_vs_amount' | 'esi_deduction_vs_number';
  category?: 'employee' | 'identification' | 'bank' | 'salary' | 'attendance' | 'custom' | 'unknown';
  dataType?: CustomFieldDataType;
}

export interface SavedImportConfig {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  mapping?: ColumnMapping;
  columnControls?: ColumnImportControl[];
  customFieldDefinitions?: CustomFieldDefinition[];
  duplicateStrategy?: 'update' | 'skip';
  overwriteEmptyCells?: boolean;
  lopSourcePrecedence?: 'excel' | 'attendance' | 'manual';
  controls?: Record<string, {
    mappedField: string;
    shouldFetch: boolean;
    isCustom: boolean;
    customLabel?: string;
    customDataType?: CustomFieldDataType;
    destination?: CustomFieldDestination;
    includeInPayslip?: boolean;
  }>;
}

export interface ImportHistoryRecord {
  id: string;
  timestamp: string;
  fileName: string;
  sheetName?: string;
  totalRows?: number;
  importedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  rejectedCount?: number;
  ignoredColumns?: string[];
  customFieldsImported?: string[];
  summaryNotes?: string;
  importedFields?: string[];
  ignoredFields?: string[];
}

export interface CompanySettings {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  cityStateZip: string;
  phone: string;
  contactPhone?: string;
  email: string;
  contactEmail?: string;
  website: string;
  taxRegistrationNumber: string; // GSTIN / EIN / CIN
  taxId?: string;
  currencySymbol: string;
  currencyName: string;
  showCurrencySymbol?: boolean;
  logoDataUrl?: string;
  logoDarkDataUrl?: string;
  companyIconDataUrl?: string;
  signatureDataUrl?: string;
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
  payslipNote: string;
  themeColor: string;
  secondaryColor?: string;
  accentColor?: string;
  buttonColors?: any;
  surfaceColors?: any;
  brandColors?: any;
  showLogoOnPayslip?: boolean;
  showCompanyNameOnPayslip?: boolean;
  showAddressOnPayslip?: boolean;
  showContactOnPayslip?: boolean;
  payslipHeaderAlignment?: 'left' | 'center' | 'right';
  payslipFooterInfo?: string;
  emailDisplayName?: string;
  emailSignature?: string;
  emailFooterText?: string;
}

export interface GeneratedPayslipRecord {
  id: string; // Unique key: `${employeeId}_${month}_${year}`
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  month: string;
  year: number;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  generatedAt: string; // ISO string
  fileName: string;
  pdfBase64?: string;
  pdfDataUri?: string;
  generationMethod?: 'Bulk Payroll' | 'Manual Entry';
  driveFileId?: string;
  emailStatus?: 'Pending' | 'Sent' | 'Failed';
}

export interface PayrollPeriod {
  month: string; // "January", "February", etc.
  year: number;
}

export interface PayslipCustomFieldLayout {
  key: string;
  label: string;
  showInPdf?: boolean;
  isVisible?: boolean;
  align?: 'left' | 'center' | 'right';
  section?: 'employee' | 'earnings' | 'deductions' | 'footer' | 'header';
}

export interface PayslipElementConfig {
  key: string;
  label?: string;
  visible?: boolean;
  sectionPlacement?: 'employeeInfo' | 'earnings' | 'deductions' | 'finalSummary';
  align?: 'left' | 'center' | 'right';
  width?: 'half' | 'full' | 'auto';
  spacing?: 'compact' | 'normal' | 'spacious';
  fontFamily?: 'inherit' | 'helvetica' | 'sans' | 'times' | 'courier';
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'bold';
  textColor?: string;
  backgroundColor?: string;
  borderStyle?: 'none' | 'subtle' | 'solid';
  valueFormat?: 'auto' | 'currency' | 'number' | 'date' | 'text' | 'masked';
  order?: number;
}

export type PayslipTemplatePreset =
  | 'professional_corporate'
  | 'minimal_clean'
  | 'detailed_breakdown'
  | 'classic'
  | 'modern'
  | 'compact';

export interface PayslipLayoutSettings {
  // Visibility Toggles
  showLogo: boolean;
  showTaxId: boolean;
  showPayslipNumber?: boolean;
  showEmployeeId: boolean;
  showName: boolean;
  showDepartment: boolean;
  showDesignation: boolean;
  showJoiningDate: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  showPaidDays: boolean;
  showUnpaidDays: boolean;
  showLopDays: boolean;
  showLopAmount: boolean;
  showTotalWorkingDays: boolean;
  showPresentDays: boolean;
  showAbsentDays: boolean;
  showBankAccount: boolean;
  maskBankAccount?: boolean;
  showBankName: boolean;
  showIfscCode: boolean;
  showBranchName: boolean;
  showAccountHolderName: boolean;
  showPan: boolean;
  showUan: boolean;
  showEsiNumber: boolean;
  showPfNumber: boolean;
  showAadhaar: boolean;
  showBasic: boolean;
  showHra: boolean;
  showSpecialAllowance: boolean;
  showOtherAllowances: boolean;
  showCtc?: boolean;
  showEmployerPf?: boolean;
  showEmployerEsi?: boolean;
  showGrossEarnings?: boolean;
  showEmployeePf?: boolean;
  showPf: boolean;
  showEsi: boolean;
  showProfessionalTax: boolean;
  showTds: boolean;
  showLoan?: boolean;
  showLateDeduction?: boolean;
  showLopDeduction?: boolean;
  showOtherDeductions: boolean;
  showTotalDeductions?: boolean;
  showNetSalary?: boolean;
  showSignatures: boolean;
  showFooterNote: boolean;

  // Customizable Labels
  labelPayslipNumber?: string;
  labelEmployeeId: string;
  labelName: string;
  labelDepartment: string;
  labelDesignation: string;
  labelJoiningDate: string;
  labelEmail?: string;
  labelPhone?: string;
  labelPaidDays: string;
  labelUnpaidDays: string;
  labelLopDays: string;
  labelLopAmount: string;
  labelTotalWorkingDays: string;
  labelPresentDays: string;
  labelAbsentDays: string;
  labelBankAccount: string;
  labelBankName: string;
  labelIfscCode: string;
  labelBranchName: string;
  labelAccountHolderName: string;
  labelPan: string;
  labelUan: string;
  labelEsiNumber: string;
  labelPfNumber: string;
  labelAadhaar: string;
  labelCtc?: string;
  labelEmployerPf?: string;
  labelEmployerEsi?: string;
  labelGrossEarnings?: string;
  labelEmployeePf?: string;
  labelBasic: string;
  labelHra: string;
  labelSpecialAllowance: string;
  labelOtherAllowances: string;
  labelPf: string;
  labelEsi: string;
  labelProfessionalTax: string;
  labelTds: string;
  labelLoan?: string;
  labelLateDeduction?: string;
  labelLopDeduction?: string;
  labelOtherDeductions: string;
  labelTotalDeductions?: string;
  labelNetSalary: string;
  labelEarnings: string;
  labelDeductions: string;

  // Per-field Element Inspector Configuration & Custom Fields Layout
  fieldConfigs?: Record<string, PayslipElementConfig>;
  customFieldLayouts?: PayslipCustomFieldLayout[];
  customFieldsMeta?: Array<{
    key: string;
    label: string;
    sampleValue?: string;
    sectionPlacement?: 'employeeInfo' | 'earnings' | 'deductions' | 'finalSummary';
    visible?: boolean;
  }>;

  alignHeader: 'left' | 'center' | 'right';
  primaryColor: string;
  secondaryColor?: string;
  sectionOrder?: Array<'employeeInfo' | 'salaryTable' | 'netPay' | 'notes' | 'signatures'>;
  fontFamily?: 'helvetica' | 'times' | 'courier' | 'sans';
  headerFontSize?: number;
  bodyFontSize?: number;
  tableBorderStyle?: 'grid' | 'horizontal' | 'minimal';
  cellPadding?: 'compact' | 'standard' | 'spacious';
  logoSize?: 'small' | 'medium' | 'large';
  logoPosition?: 'left' | 'center' | 'right';
  orientation?: 'portrait' | 'landscape';
  marginMm?: number;
  showPaymentDate?: boolean;
  labelPaymentDate?: string;
  customTextBlocks?: Array<{
    id: string;
    title: string;
    content: string;
    position: 'afterEmployeeInfo' | 'afterNetPay' | 'footer';
    visible: boolean;
  }>;
  templatePreset?: PayslipTemplatePreset;
}

export const DEFAULT_LAYOUT_SETTINGS: PayslipLayoutSettings = {
  showLogo: true,
  showTaxId: true,
  showPayslipNumber: false,
  showEmployeeId: true,
  showName: true,
  showDepartment: true,
  showDesignation: true,
  showJoiningDate: true,
  showEmail: true,
  showPhone: true,
  showPaidDays: true,
  showUnpaidDays: true,
  showLopDays: true,
  showLopAmount: true,
  showTotalWorkingDays: true,
  showPresentDays: false,
  showAbsentDays: false,
  showBankAccount: true,
  maskBankAccount: false,
  showBankName: true,
  showIfscCode: true,
  showBranchName: false,
  showAccountHolderName: false,
  showPan: true,
  showUan: true,
  showEsiNumber: true,
  showPfNumber: true,
  showAadhaar: false,
  showCtc: true,
  showEmployerPf: true,
  showEmployerEsi: true,
  showGrossEarnings: true,
  showEmployeePf: true,
  showBasic: true,
  showHra: true,
  showSpecialAllowance: true,
  showOtherAllowances: true,
  showPf: true,
  showEsi: true,
  showProfessionalTax: true,
  showTds: true,
  showLoan: true,
  showLateDeduction: true,
  showLopDeduction: true,
  showOtherDeductions: true,
  showTotalDeductions: true,
  showNetSalary: true,
  showSignatures: true,
  showFooterNote: true,

  labelPayslipNumber: 'Payslip Number',
  labelEmployeeId: 'Employee ID',
  labelName: 'Employee Name',
  labelDepartment: 'Department',
  labelDesignation: 'Designation',
  labelJoiningDate: 'Joining Date',
  labelEmail: 'Email',
  labelPhone: 'Phone',
  labelPaidDays: 'Paid Days',
  labelUnpaidDays: 'Loss of Pay (LOP)',
  labelLopDays: 'LOP Days',
  labelLopAmount: 'LOP Deduction',
  labelTotalWorkingDays: 'Total Working Days',
  labelPresentDays: 'Present Days',
  labelAbsentDays: 'Absent Days',
  labelBankAccount: 'Bank Account No',
  labelBankName: 'Bank Name',
  labelIfscCode: 'IFSC Code',
  labelBranchName: 'Branch Name',
  labelAccountHolderName: 'Account Holder Name',
  labelPan: 'PAN',
  labelUan: 'UAN',
  labelEsiNumber: 'ESI Number',
  labelPfNumber: 'PF Number',
  labelAadhaar: 'Aadhaar Number',
  labelCtc: 'Cost to Company (CTC)',
  labelEmployerPf: 'Employer PF',
  labelEmployerEsi: 'Employer ESI',
  labelGrossEarnings: 'TOTAL GROSS EARNINGS',
  labelEmployeePf: 'Employee PF',
  labelBasic: 'Basic Salary',
  labelHra: 'HRA',
  labelSpecialAllowance: 'Special Allowance',
  labelOtherAllowances: 'Other Allowances',
  labelPf: 'Employee PF (EPF)',
  labelEsi: 'ESI',
  labelProfessionalTax: 'Professional Tax (PT)',
  labelTds: 'TDS / Income Tax',
  labelLoan: 'Staff Loan / Advance',
  labelLateDeduction: 'Late Deduction',
  labelLopDeduction: 'Loss of Pay (LOP)',
  labelOtherDeductions: 'Other Deductions',
  labelTotalDeductions: 'TOTAL DEDUCTIONS',
  labelNetSalary: 'NET SALARY PAYABLE',
  labelEarnings: 'EARNINGS',
  labelDeductions: 'DEDUCTIONS',

  fieldConfigs: {},
  customFieldLayouts: [],
  customFieldsMeta: [],

  alignHeader: 'left',
  primaryColor: '#CB1417',
  secondaryColor: '#18181B',
  sectionOrder: ['employeeInfo', 'salaryTable', 'netPay', 'notes', 'signatures'],
  fontFamily: 'helvetica',
  headerFontSize: 15,
  bodyFontSize: 8,
  tableBorderStyle: 'grid',
  cellPadding: 'standard',
  logoSize: 'medium',
  logoPosition: 'left',
  orientation: 'portrait',
  marginMm: 14,
  showPaymentDate: true,
  labelPaymentDate: 'Payment Date',
  customTextBlocks: [],
  templatePreset: 'professional_corporate'
};


export interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  senderName: string;
  senderEmail: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
}

export interface ServerSmtpStatus {
  isConfigured: boolean;
  isVerified: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  senderEmail?: string;
  senderName?: string;
  hasPassword?: boolean;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  senderName: 'Apex HR Payroll',
  senderEmail: 'payroll@apexenterprise.com',
  emailSubjectTemplate: 'Payslip for {{month}} {{year}} - {{employeeName}}',
  emailBodyTemplate: 'Dear {{employeeName}},\n\nPlease find attached your official payslip for the pay period {{month}} {{year}}.\n\nBest regards,\nHR Department\n{{companyName}}'
};
