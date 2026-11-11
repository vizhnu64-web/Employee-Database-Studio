import { ColumnMapping, ColumnImportControl, CustomFieldDataType, CustomFieldDestination } from '../types/payroll';

/**
 * Common variations of column headers for payroll spreadsheets.
 * Order within patterns prioritizes exact specific terms over broader terms.
 */
export const HEADER_PATTERNS: Record<keyof ColumnMapping, string[]> = {
  employeeId: [
    'employee id', 'emp id', 'empid', 'staff id', 'employee code', 'emp code',
    'id', 'badge no', 'payroll id', 'employee number', 'emp_no', 'emp no', 'staff code'
  ],
  name: [
    'employee name', 'emp name', 'name', 'full name', 'staff name',
    'employee', 'worker name', 'employee_name', 'legal name'
  ],
  email: [
    'email', 'email address', 'official email', 'work email', 'mail id', 'e-mail', 'mail'
  ],
  phone: [
    'phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'contact', 'telephone', 'mobile no', 'cell'
  ],
  department: [
    'department', 'dept', 'division', 'dept name', 'team', 'department name'
  ],
  designation: [
    'designation', 'role', 'job title', 'title', 'position', 'post', 'designation name'
  ],
  joiningDate: [
    'joining date', 'date of joining', 'doj', 'hire date', 'start date', 'joined on', 'date of join'
  ],
  employmentStatus: [
    'employment status', 'status', 'employee status', 'work status', 'emp status'
  ],
  totalWorkingDays: [
    'total working days', 'total days', 'working days', 'month days', 'days in month', 'calendar days'
  ],
  paidDays: [
    'paid days', 'days worked', 'present days', 'payable days',
    'effective days', 'days'
  ],
  presentDays: [
    'present days', 'days present', 'attended days', 'actual present days'
  ],
  absentDays: [
    'absent days', 'days absent'
  ],
  paidLeave: [
    'paid leave', 'paid leaves', 'casual leave', 'sick leave', 'earned leave', 'cl', 'sl', 'el'
  ],
  unpaidLeave: [
    'unpaid leave', 'unpaid leaves'
  ],
  // Legacy alias mapping: general unpaid days
  unpaidDays: [
    'unpaid days', 'lwp days', 'leaves without pay'
  ],
  lopDays: [
    'lop days', 'loss of pay days', 'lop day', 'unpaid days', 'lop_days', 'loss of pay (days)', 'lop (days)'
  ],
  lopAmount: [
    'lop amount', 'loss of pay amount', 'lop amt', 'lop deduction', 'loss of pay deduction', 'lop_amount', 'loss of pay (amount)', 'lop (amount)', 'lop cut'
  ],
  bankAccount: [
    'bank account number', 'bank account no', 'account number', 'account no', 'acc no',
    'bank account', 'bank a/c', 'a/c no', 'a/c number', 'bank ac no', 'bank ac number',
    'account_no', 'bank_account', 'ac no'
  ],
  bankName: [
    'bank name', 'bank', 'bank_name', 'name of bank', 'banking partner', 'depository bank'
  ],
  ifscCode: [
    'ifsc code', 'ifsc', 'bank ifsc', 'ifsc_code', 'rtgs ifsc', 'neft ifsc', 'branch ifsc'
  ],
  branchName: [
    'branch name', 'branch', 'bank branch', 'branch_name'
  ],
  accountHolderName: [
    'account holder name', 'account holder', 'holder name', 'beneficiary name', 'a/c holder name', 'account name'
  ],
  pan: [
    'pan', 'pan number', 'pan no', 'tax id', 'ssn', 'national id', 'pan_no'
  ],
  uan: [
    'uan', 'uan number', 'uan no', 'universal account number', 'uan_no'
  ],
  esiNumber: [
    'esi number', 'esi no', 'esi insurance no', 'ip number', 'esi ip no',
    'insurance number', 'esic no', 'esic number', 'esic ip', 'esi_no', 'esi code'
  ],
  pfNumber: [
    'pf number', 'pf no', 'epf number', 'epf no', 'pf member id', 'member id'
  ],
  aadhaarNumber: [
    'aadhaar number', 'aadhaar no', 'aadhaar', 'aadhar number', 'aadhar no', 'aadhar', 'uid', 'uidai'
  ],
  ctc: [
    'ctc', 'cost to company', 'annual ctc', 'monthly ctc', 'total ctc', 'cost_to_company', 'ctc salary'
  ],
  employerPf: [
    'employer pf', 'employer provident fund', 'employer pf contribution', 'pf employer', 'er pf', 'er_pf', 'employer_pf', 'epf employer'
  ],
  employerEsi: [
    'employer esi', 'employer esi contribution', 'company esi', 'company esi contribution', 'er esi', 'employer s esi', 'esi employer contribution', 'employer_esi'
  ],
  employeePf: [
    'employee pf', 'employee provident fund', 'ee pf', 'ee_pf', 'employee_pf', 'pf employee', 'epf employee'
  ],
  loan: [
    'loan', 'loan deduction', 'staff loan', 'loan recovery', 'salary loan', 'loan emi', 'company loan', 'loan amount', 'staff_loan', 'advance', 'salary advance', 'loan_deduction'
  ],
  lateDeduction: [
    'late', 'late deduction', 'late penalty', 'late mark deduction', 'late arrival deduction', 'late cut', 'late_deduction', 'late ded', 'late mark', 'late_mark', 'late fine', 'late fee', 'late_deductions'
  ],
  lopDeduction: [
    'lop deduction', 'loss of pay deduction', 'lop amount', 'loss of pay amount', 'lop amt', 'lop_amount', 'loss of pay (amount)', 'lop cut'
  ],
  basic: [
    'basic', 'basic salary', 'basic pay', 'basic wage', 'base salary', 'base pay'
  ],
  hra: [
    'hra', 'house rent allowance', 'rent allowance', 'house rent'
  ],
  specialAllowance: [
    'special allowance', 'special pay', 'special allow', 'spl allowance', 'spl allow', 'spl pay', 'spl_pay'
  ],
  otherAllowances: [
    'other allowances', 'other allowance', 'allowance', 'allowances', 'conveyance',
    'medical allowance', 'variable pay', 'bonus', 'da', 'dearness allowance'
  ],
  providedGross: [
    'gross', 'gross salary', 'gross earnings', 'gross pay', 'total earnings', 'total gross'
  ],
  pf: [
    'pf', 'provident fund', 'epf', 'employee pf', 'pf deduction', 'epf deduction'
  ],
  esi: [
    'esi deduction', 'esi', 'esic deduction', 'esic', 'employee state insurance', 'state insurance', 'health insurance', 'esi contrib'
  ],
  professionalTax: [
    'professional tax', 'pt', 'prof tax', 'p tax', 'ptax'
  ],
  tds: [
    'tds', 'tax deducted at source', 'income tax', 'tax', 'it deduction', 'withholding tax'
  ],
  otherDeductions: [
    'other deductions', 'other deduction', 'deduction', 'deductions', 'salary advance', 'advance'
  ],
  providedDeductions: [
    'total deductions', 'total deduction', 'deductions total', 'gross deductions'
  ],
  providedNet: [
    'net salary', 'net pay', 'take home', 'take home pay', 'net amount', 'payable amount', 'final pay'
  ],
  payrollMonth: [
    'month', 'payroll month', 'salary month', 'pay month', 'period month'
  ],
  payrollYear: [
    'year', 'payroll year', 'salary year', 'pay year', 'period year'
  ]
};

export function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Standard fields categorized by functional domain
 */
export const FIELD_CATEGORIES: Record<string, ColumnImportControl['category']> = {
  employeeId: 'employee',
  name: 'employee',
  email: 'employee',
  phone: 'employee',
  department: 'employee',
  designation: 'employee',
  joiningDate: 'employee',
  employmentStatus: 'employee',
  pan: 'identification',
  uan: 'identification',
  esiNumber: 'identification',
  pfNumber: 'identification',
  aadhaarNumber: 'identification',
  bankName: 'bank',
  bankAccount: 'bank',
  ifscCode: 'bank',
  branchName: 'bank',
  accountHolderName: 'bank',
  totalWorkingDays: 'attendance',
  paidDays: 'attendance',
  presentDays: 'attendance',
  absentDays: 'attendance',
  paidLeave: 'attendance',
  unpaidLeave: 'attendance',
  unpaidDays: 'attendance',
  lopDays: 'attendance',
  lopAmount: 'attendance',
  ctc: 'salary',
  employerPf: 'salary',
  employerEsi: 'salary',
  employeePf: 'salary',
  loan: 'salary',
  lateDeduction: 'salary',
  lopDeduction: 'attendance',
  basic: 'salary',
  hra: 'salary',
  specialAllowance: 'salary',
  otherAllowances: 'salary',
  providedGross: 'salary',
  pf: 'salary',
  esi: 'salary',
  professionalTax: 'salary',
  tds: 'salary',
  otherDeductions: 'salary',
  providedDeductions: 'salary',
  providedNet: 'salary',
  payrollMonth: 'salary',
  payrollYear: 'salary'
};

export const STANDARD_FIELD_LABELS: Record<string, string> = {
  employeeId: 'Employee ID',
  name: 'Employee Name',
  email: 'Official / Work Email',
  phone: 'Phone Number',
  department: 'Department',
  designation: 'Designation / Role',
  joiningDate: 'Date of Joining',
  employmentStatus: 'Employment Status',
  pan: 'PAN (Income Tax)',
  uan: 'UAN (EPFO)',
  esiNumber: 'ESI Number (IP No)',
  pfNumber: 'PF Number',
  aadhaarNumber: 'Aadhaar Number',
  bankName: 'Bank Name',
  bankAccount: 'Bank Account Number',
  ifscCode: 'IFSC Code',
  branchName: 'Bank Branch Name',
  accountHolderName: 'Account Holder Name',
  totalWorkingDays: 'Total Working Days',
  paidDays: 'Paid Days',
  presentDays: 'Present Days',
  absentDays: 'Absent Days',
  paidLeave: 'Paid Leave',
  unpaidLeave: 'Unpaid Leave',
  unpaidDays: 'Unpaid Days (LOP)',
  lopDays: 'Loss of Pay (LOP) Days',
  lopAmount: 'Loss of Pay (LOP) Amount',
  ctc: 'Cost to Company (CTC)',
  employerPf: 'Employer PF (Deducted from CTC)',
  employerEsi: 'Employer ESI (Deducted from CTC)',
  employeePf: 'Employee PF (Deduction)',
  loan: 'Staff Loan / Advance',
  lateDeduction: 'Late Deduction',
  lopDeduction: 'Loss of Pay (LOP) Deduction',
  basic: 'Basic Salary',
  hra: 'House Rent Allowance (HRA)',
  specialAllowance: 'Special Allowance',
  otherAllowances: 'Other Allowances',
  providedGross: 'Gross Earnings (in Sheet)',
  pf: 'Provident Fund (EPF/PF)',
  esi: 'ESI Deduction (Employee)',
  professionalTax: 'Professional Tax (PT)',
  tds: 'TDS / Income Tax',
  otherDeductions: 'Other Deductions',
  providedDeductions: 'Total Deductions (in Sheet)',
  providedNet: 'Net Salary (in Sheet)',
  payrollMonth: 'Payroll Month',
  payrollYear: 'Payroll Year'
};

/**
 * Standard recommended fields that should be selected by default
 */
export const RECOMMENDED_STANDARD_FIELDS = new Set<string>([
  'employeeId',
  'name',
  'email',
  'department',
  'designation',
  'joiningDate',
  'pan',
  'uan',
  'esiNumber',
  'bankName',
  'bankAccount',
  'ifscCode',
  'paidDays',
  'lopDays',
  'lopAmount',
  'ctc',
  'employerPf',
  'employerEsi',
  'employeePf',
  'basic',
  'hra',
  'specialAllowance',
  'otherAllowances',
  'pf',
  'esi',
  'professionalTax',
  'tds',
  'loan',
  'lateDeduction',
  'lopDeduction',
  'providedGross',
  'providedNet'
]);

/**
 * Determine default destination for a given field
 */
export function getDefaultDestination(fieldKey: string, isCustom = false): CustomFieldDestination {
  if (['employeeId', 'name', 'email', 'phone', 'department', 'designation', 'joiningDate', 'employmentStatus'].includes(fieldKey)) {
    return 'both';
  }
  if (['pan', 'uan', 'esiNumber', 'pfNumber', 'aadhaarNumber', 'bankName', 'bankAccount', 'ifscCode', 'branchName', 'accountHolderName'].includes(fieldKey)) {
    return 'both';
  }
  if (isCustom) {
    return 'both';
  }
  return 'payroll';
}

/**
 * Given a list of headers extracted from an Excel sheet, automatically matches
 * the most likely candidate for each column mapping field.
 * Handles disambiguation for ESI Number vs ESI deduction and LOP Days vs LOP Amount.
 */
export function autoDetectColumnMapping(headers: string[], sampleRows: Record<string, any>[] = []): ColumnMapping {
  const mapping: ColumnMapping = {
    employeeId: '',
    name: '',
    email: '',
    department: '',
    designation: '',
    joiningDate: '',
    paidDays: '',
    unpaidDays: '',
    bankAccount: '',
    pan: '',
    uan: '',
    esiNumber: '',
    ctc: '',
    employerPf: '',
    employeePf: '',
    loan: '',
    lateDeduction: '',
    lopDeduction: '',
    basic: '',
    hra: '',
    specialAllowance: '',
    otherAllowances: '',
    providedGross: '',
    pf: '',
    esi: '',
    professionalTax: '',
    tds: '',
    otherDeductions: '',
    providedDeductions: '',
    providedNet: '',
    payrollMonth: '',
    payrollYear: '',
    bankName: '',
    ifscCode: '',
    branchName: '',
    accountHolderName: '',
    phone: '',
    employmentStatus: '',
    pfNumber: '',
    aadhaarNumber: '',
    totalWorkingDays: '',
    presentDays: '',
    absentDays: '',
    paidLeave: '',
    unpaidLeave: '',
    lopDays: '',
    lopAmount: ''
  };

  const usedHeaders = new Set<string>();

  // Special Pre-Pass: Employer PF vs Employee PF
  // Employer PF is deducted from CTC to arrive at Total Gross; it must NEVER be confused with Employee PF deduction
  const hasEmployerPf = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['employerpf', 'employerprovidentfund', 'employerpfcontribution', 'erpf', 'pfemployer', 'epfemployer', 'employer_pf'].includes(norm);
  });
  if (hasEmployerPf) {
    mapping.employerPf = hasEmployerPf;
    usedHeaders.add(hasEmployerPf);
  }

  const hasEmployerEsi = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['employeresi', 'employeresicontribution', 'companyesi', 'companyesicontribution', 'r esi', 'er_esi', 'employer_esi', 'esiemployercontribution'].includes(norm);
  });
  if (hasEmployerEsi) {
    mapping.employerEsi = hasEmployerEsi;
    usedHeaders.add(hasEmployerEsi);
  }

  const hasEmployeePf = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['employeepf', 'employeeprovidentfund', 'eepf', 'pfemployee', 'epfemployee', 'employee_pf', 'pfdeduction', 'epfdeduction'].includes(norm);
  });
  if (hasEmployeePf) {
    mapping.employeePf = hasEmployeePf;
    mapping.pf = hasEmployeePf;
    usedHeaders.add(hasEmployeePf);
  }

  // Special Pre-Pass: CTC (Cost to Company)
  const hasCtc = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['ctc', 'costtocompany', 'annualctc', 'monthlyctc', 'totalctc', 'cost_to_company', 'ctcsalary'].includes(norm);
  });
  if (hasCtc) {
    mapping.ctc = hasCtc;
    usedHeaders.add(hasCtc);
  }

  // Special Pre-Pass: Loan & Late Deduction
  const hasLoan = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['loan', 'loandeduction', 'staffloan', 'loanrecovery', 'salaryloan', 'loanemi', 'companyloan', 'loanamount', 'staff_loan', 'advance', 'salaryadvance', 'loan_deduction'].includes(norm);
  });
  if (hasLoan) {
    mapping.loan = hasLoan;
    usedHeaders.add(hasLoan);
  }

  const hasLate = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['late', 'latededuction', 'latepenalty', 'latemarkdeduction', 'latearrivaldeduction', 'latecut', 'late_deduction', 'lateded', 'latemark', 'late_mark', 'late_fine', 'late_fee', 'late_deductions'].includes(norm);
  });
  if (hasLate) {
    mapping.lateDeduction = hasLate;
    usedHeaders.add(hasLate);
  }

  // Helper: check sample values to see if column contains day count (0-31 integer) or currency amount
  const isLikelyDays = (header: string): boolean => {
    if (!sampleRows || sampleRows.length === 0) return true;
    const values = sampleRows.map(r => r[header]).filter(v => v !== undefined && v !== null && v !== '');
    if (values.length === 0) return true;
    return values.every(v => {
      const num = Number(String(v).replace(/[^0-9.-]/g, ''));
      return !isNaN(num) && num >= 0 && num <= 31 && Number.isInteger(num);
    });
  };

  // Helper: check sample values to see if column contains identification code / alphanumeric string vs small decimal deduction
  const isLikelyIdentificationCode = (header: string): boolean => {
    if (!sampleRows || sampleRows.length === 0) return false;
    const values = sampleRows.map(r => r[header]).filter(v => v !== undefined && v !== null && v !== '');
    if (values.length === 0) return false;
    return values.some(v => {
      const str = String(v).trim();
      return str.length >= 10 || /[A-Za-z]/.test(str);
    });
  };

  // Special Pre-Pass: Explicit LOP Days vs LOP Amount detection
  const hasLopDays = headers.find(h => {
    const norm = normalize(h);
    return ['lopdays', 'lossofpaydays', 'unpaiddays', 'lopday', 'absentdays'].includes(norm);
  });
  const hasLopAmount = headers.find(h => {
    const norm = normalize(h);
    return ['lopamount', 'lossofpayamount', 'lopamt', 'lopdeduction', 'lossofpaydeduction', 'lopcut'].includes(norm);
  });
  const genericLop = headers.find(h => {
    const norm = normalize(h);
    return norm === 'lop' || norm === 'lossofpay';
  });

  if (hasLopDays) {
    mapping.lopDays = hasLopDays;
    mapping.unpaidDays = hasLopDays;
    usedHeaders.add(hasLopDays);
  }
  if (hasLopAmount) {
    mapping.lopAmount = hasLopAmount;
    mapping.lopDeduction = hasLopAmount;
    usedHeaders.add(hasLopAmount);
  }

  // If only a generic "LOP" column exists and wasn't already mapped
  if (genericLop && !mapping.lopDays && !mapping.lopAmount) {
    if (isLikelyDays(genericLop)) {
      mapping.lopDays = genericLop;
      mapping.unpaidDays = genericLop;
    } else {
      mapping.lopAmount = genericLop;
      mapping.lopDeduction = genericLop;
    }
    usedHeaders.add(genericLop);
  }

  // Special Pre-Pass: Explicit ESI Number vs ESI Deduction
  const hasEsiNo = headers.find(h => {
    const norm = normalize(h);
    return ['esino', 'esinumber', 'esicno', 'esicnumber', 'ipnumber', 'esiipno', 'esicode'].includes(norm);
  });
  const hasEsiDeduction = headers.find(h => {
    const norm = normalize(h);
    return ['esideduction', 'esicdeduction', 'esicontrib', 'esicontribution', 'esiemployee'].includes(norm);
  });
  const genericEsi = headers.find(h => {
    const norm = normalize(h);
    return norm === 'esi' || norm === 'esic';
  });

  if (hasEsiNo) {
    mapping.esiNumber = hasEsiNo;
    usedHeaders.add(hasEsiNo);
  }
  if (hasEsiDeduction) {
    mapping.esi = hasEsiDeduction;
    usedHeaders.add(hasEsiDeduction);
  }
  if (genericEsi && !mapping.esi && !mapping.esiNumber) {
    if (isLikelyIdentificationCode(genericEsi)) {
      mapping.esiNumber = genericEsi;
    } else {
      mapping.esi = genericEsi;
    }
    usedHeaders.add(genericEsi);
  }

  // Special Pre-Pass: Bank Details
  const bankAccountHeader = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return [
      'bankaccountnumber', 'bankaccountno', 'accountnumber', 'accountno', 'accno',
      'bankaccount', 'bankac', 'a/cno', 'acno', 'bankacno', 'account_no', 'bank_account'
    ].includes(norm);
  });
  if (bankAccountHeader) {
    mapping.bankAccount = bankAccountHeader;
    usedHeaders.add(bankAccountHeader);
  }

  const bankNameHeader = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['bankname', 'bank', 'bank_name', 'nameofbank', 'bankingpartner'].includes(norm);
  });
  if (bankNameHeader) {
    mapping.bankName = bankNameHeader;
    usedHeaders.add(bankNameHeader);
  }

  const ifscHeader = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['ifsc', 'ifsccode', 'bankifsc', 'branchifsc', 'ifsc_code'].includes(norm);
  });
  if (ifscHeader) {
    mapping.ifscCode = ifscHeader;
    usedHeaders.add(ifscHeader);
  }

  const branchHeader = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['branchname', 'branch', 'bankbranch', 'branch_name'].includes(norm);
  });
  if (branchHeader) {
    mapping.branchName = branchHeader;
    usedHeaders.add(branchHeader);
  }

  const holderHeader = headers.find(h => {
    if (usedHeaders.has(h)) return false;
    const norm = normalize(h);
    return ['accountholdername', 'accountholder', 'holdername', 'beneficiaryname', 'acholdername'].includes(norm);
  });
  if (holderHeader) {
    mapping.accountHolderName = holderHeader;
    usedHeaders.add(holderHeader);
  }

  // Pass 1: Exact / High-confidence matches for remaining fields
  for (const [key, patterns] of Object.entries(HEADER_PATTERNS) as Array<[keyof ColumnMapping, string[]]>) {
    if (mapping[key]) continue;

    const matchedHeader = headers.find(h => {
      if (usedHeaders.has(h)) return false;
      const normH = normalize(h);
      return patterns.some(p => normalize(p) === normH);
    });

    if (matchedHeader) {
      mapping[key] = matchedHeader;
      usedHeaders.add(matchedHeader);
    }
  }

  // Pass 2: Substring matches for remaining fields
  for (const [key, patterns] of Object.entries(HEADER_PATTERNS) as Array<[keyof ColumnMapping, string[]]>) {
    if (mapping[key]) continue;

    const matchedHeader = headers.find(h => {
      if (usedHeaders.has(h)) return false;
      const normH = normalize(h);
      const words = h.toLowerCase().split(/[^a-z0-9]+/);
      return patterns.some(p => {
        const normP = normalize(p);
        if (normP.length < 3) return false;
        if (normP.length <= 3) {
          return normH === normP || words.includes(normP);
        }
        return normH === normP || words.includes(normP) || normH.includes(normP) || (normP.length > 5 && normP.includes(normH));
      });
    });

    if (matchedHeader) {
      mapping[key] = matchedHeader;
      usedHeaders.add(matchedHeader);
    }
  }

  return mapping;
}

/**
 * Suggest a data type for a column based on its sample values
 */
export function inferDataType(sampleValues: any[]): CustomFieldDataType {
  const nonEmpties = sampleValues.filter(v => v !== undefined && v !== null && String(v).trim() !== '');
  if (nonEmpties.length === 0) return 'text';

  // Boolean check
  const isBool = nonEmpties.every(v => {
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === 'false' || s === 'yes' || s === 'no' || s === 'y' || s === 'n';
  });
  if (isBool) return 'boolean';

  // Date check (YYYY-MM-DD or DD/MM/YYYY)
  const isDate = nonEmpties.every(v => {
    const s = String(v).trim();
    if (!/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(s) && !/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(s)) return false;
    return !isNaN(Date.parse(s));
  });
  if (isDate) return 'date';

  // Currency / Numeric checks
  const isNumber = nonEmpties.every(v => {
    const s = String(v).replace(/[$₹€£,\s]/g, '').trim();
    return s !== '' && !isNaN(Number(s));
  });
  if (isNumber) {
    const hasDecimal = nonEmpties.some(v => String(v).includes('.'));
    const hasCurrencySymbol = nonEmpties.some(v => /[$₹€£]/.test(String(v)));
    if (hasCurrencySymbol) return 'currency';
    return hasDecimal ? 'decimal' : 'number';
  }

  return 'text';
}

/**
 * Generates the full set of ColumnImportControls for EVERY header detected in the uploaded sheet.
 * This powers the mandatory "IMPORT FIELD CONTROL" screen.
 */
export function detectAllColumns(
  headers: string[],
  rows: Record<string, any>[] = []
): ColumnImportControl[] & { controls: ColumnImportControl[]; mapping: ColumnMapping } {
  const autoMapping = autoDetectColumnMapping(headers, rows);
  const mappedHeaders = new Map<string, keyof ColumnMapping>();

  for (const [key, header] of Object.entries(autoMapping) as Array<[keyof ColumnMapping, string]>) {
    if (header) {
      mappedHeaders.set(header, key);
    }
  }

  const controls: ColumnImportControl[] = headers.map(header => {
    // Gather 3 sample non-empty values
    const samples: any[] = [];
    for (const r of rows) {
      if (r[header] !== undefined && r[header] !== null && String(r[header]).trim() !== '') {
        samples.push(r[header]);
        if (samples.length >= 3) break;
      }
    }

    const normHeader = normalize(header);

    // Check if header is a recognized standard field
    const matchedStandardKey = mappedHeaders.get(header);

    // Ignored columns (e.g. internal remarks, S.No, Index)
    const isIgnoreCandidate = [
      'sno', 'slno', 'serialno', 'index', 'remarks', 'internalremarks', 'comment', 'comments', 'notes'
    ].includes(normHeader);

    // Check for ambiguity
    let status: ColumnImportControl['status'] = 'unmapped';
    let ambiguityType: ColumnImportControl['ambiguityType'] = undefined;
    let mappedField = '';
    let isCustom = false;
    let category: ColumnImportControl['category'] = 'unknown';

    if (matchedStandardKey) {
      mappedField = matchedStandardKey;
      category = FIELD_CATEGORIES[matchedStandardKey] || 'unknown';
      status = 'mapped';

      // Ambiguity check: single generic "LOP" column
      if (normHeader === 'lop' || normHeader === 'lossofpay') {
        status = 'ambiguous';
        ambiguityType = 'lop_days_vs_amount';
      }

      // Ambiguity check: single generic "ESI" column
      if (normHeader === 'esi' || normHeader === 'esic') {
        status = 'ambiguous';
        ambiguityType = 'esi_deduction_vs_number';
      }
    } else if (isIgnoreCandidate) {
      mappedField = '__ignore__';
      status = 'ignored';
      category = 'unknown';
    } else {
      // Detected additional / custom field!
      mappedField = '__new_custom__';
      isCustom = true;
      status = 'unmapped';
      category = 'custom';
    }

    const cleanLabel = header
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();

    const sanitizedKey = header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || `custom_${Date.now().toString(36)}`;

    const inferredType = inferDataType(samples);
    const isStandard = !isCustom;
    const shouldFetch = !isIgnoreCandidate && mappedField !== '__ignore__';
    const effectiveSuggested = (mappedField === '__ignore__' || mappedField === '__new_custom__') ? '' : mappedField;

    return {
      excelHeader: header,
      excelColumn: header,
      mappedField,
      suggestedField: effectiveSuggested,
      isCustom,
      isStandard,
      dataType: inferredType,
      customDefinition: isCustom ? {
        id: sanitizedKey,
        key: sanitizedKey,
        label: cleanLabel,
        dataType: inferredType,
        destination: 'both',
        includeInPayslip: true
      } : undefined,
      shouldFetch,
      fetch: shouldFetch,
      destination: matchedStandardKey ? getDefaultDestination(matchedStandardKey) : 'both',
      sampleValues: samples,
      sampleValue: samples[0],
      status,
      ambiguityType,
      category
    };
  });

  const output: any = controls;
  output.controls = controls;
  output.mapping = autoMapping;
  return output;
}
