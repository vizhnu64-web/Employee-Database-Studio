import * as XLSX from 'xlsx';
import {
  ColumnMapping,
  EmployeeRecord,
  ColumnImportControl,
  CustomFieldDefinition
} from '../types/payroll';
import { DirectoryEmployee } from '../types/employeeDirectory';
import { validateBatch } from './payrollValidator';
import { getDaysInMonth } from './dateUtils';
import { autoDetectColumnMapping, detectAllColumns } from './columnDetector';

export interface ParsedWorkbook {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: Record<string, any>[];
  totalRawRows: number;
  rawGridPreview?: string[][]; // Top raw rows for manual header selection
  headerRowIndex?: number;
  emptyColumns?: string[];
  duplicateColumns?: string[];
}

const MAX_SPREADSHEET_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Reads and validates an Excel workbook or CSV file.
 * Handles binary ArrayBuffers/Uint8Arrays safely without buffer pool offset issues,
 * decodes CSV files using proper UTF-8 text decoding, and guards against
 * SheetJS falling back to CSV delimiter parsing on raw binary ZIP bytes.
 */
export function readWorkbookSafe(
  data: ArrayBuffer | Uint8Array | string,
  fileName?: string
): XLSX.WorkBook {
  if (!data) {
    throw new Error('The imported file is empty or contains no readable data.');
  }

  if (typeof data === 'string') {
    if (data.length > MAX_SPREADSHEET_SIZE_BYTES) {
      throw new Error('The imported spreadsheet exceeds the maximum allowed file size of 25 MB.');
    }
  } else if (data instanceof ArrayBuffer) {
    if (data.byteLength > MAX_SPREADSHEET_SIZE_BYTES) {
      throw new Error('The imported spreadsheet exceeds the maximum allowed file size of 25 MB.');
    }
  } else if (data instanceof Uint8Array) {
    if (data.byteLength > MAX_SPREADSHEET_SIZE_BYTES) {
      throw new Error('The imported spreadsheet exceeds the maximum allowed file size of 25 MB.');
    }
  }

  // Handle string input
  if (typeof data === 'string') {
    if (data.length === 0) {
      throw new Error('The imported file is empty or contains no readable data.');
    }
    if (data.startsWith('PK\x03\x04') || data.includes('[Content_Types].xml')) {
      throw new Error(
        'Invalid file encoding: the Excel workbook was decoded as text instead of binary. Please upload the original .xlsx file.'
      );
    }
    const cleanCsv = data.replace(/^\uFEFF/, '');
    try {
      return XLSX.read(cleanCsv, {
        type: 'string',
        cellText: true,
        cellDates: true,
        raw: false
      });
    } catch (err: any) {
      throw new Error(`Failed to parse CSV file: ${err.message || 'Invalid format.'}`);
    }
  }

  // Normalize Uint8Array / ArrayBuffer to exact isolated slice
  let uint8: Uint8Array;
  if (data instanceof Uint8Array) {
    uint8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (data instanceof ArrayBuffer) {
    uint8 = new Uint8Array(data);
  } else {
    throw new Error('Unsupported file data format passed to Excel parser.');
  }

  if (uint8.byteLength === 0) {
    throw new Error('The imported file is empty or contains no readable data.');
  }

  // Detect and align shifted ZIP header
  if (uint8.length >= 4 && (uint8[0] !== 0x50 || uint8[1] !== 0x4B)) {
    const limit = Math.min(uint8.length - 4, 8192);
    for (let i = 0; i < limit; i++) {
      if (
        uint8[i] === 0x50 &&
        uint8[i + 1] === 0x4B &&
        (uint8[i + 2] === 0x03 || uint8[i + 2] === 0x05 || uint8[i + 2] === 0x07)
      ) {
        uint8 = uint8.subarray(i);
        break;
      }
    }
  }

  // Detect and align shifted OLE2 header
  if (uint8.length >= 8 && (uint8[0] !== 0xD0 || uint8[1] !== 0xCF)) {
    const limit = Math.min(uint8.length - 8, 8192);
    for (let i = 0; i < limit; i++) {
      if (
        uint8[i] === 0xD0 &&
        uint8[i + 1] === 0xCF &&
        uint8[i + 2] === 0x11 &&
        uint8[i + 3] === 0xE0
      ) {
        uint8 = uint8.subarray(i);
        break;
      }
    }
  }

  const isZip =
    uint8.length >= 4 &&
    uint8[0] === 0x50 &&
    uint8[1] === 0x4B &&
    (uint8[2] === 0x03 || uint8[2] === 0x05 || uint8[2] === 0x07);

  const isOle =
    uint8.length >= 4 &&
    uint8[0] === 0xD0 &&
    uint8[1] === 0xCF &&
    uint8[2] === 0x11 &&
    uint8[3] === 0xE0;

  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const isExcelExt = ['xlsx', 'xls', 'xlsm', 'xlsb', 'xltx'].includes(ext);
  const isCsvExt = ext === 'csv';

  if (isCsvExt || (!isZip && !isOle && !isExcelExt)) {
    const sample = uint8.subarray(0, Math.min(uint8.length, 1024));
    if (sample.includes(0x00)) {
      throw new Error(
        'The imported file contains unsupported binary data and could not be parsed as an Excel workbook or CSV.'
      );
    }

    try {
      const textDecoder = new TextDecoder('utf-8');
      const csvText = textDecoder.decode(uint8).replace(/^\uFEFF/, '');
      return XLSX.read(csvText, {
        type: 'string',
        cellText: true,
        cellDates: true,
        raw: false
      });
    } catch (csvErr: any) {
      throw new Error(`Failed to parse CSV file: ${csvErr.message || 'Invalid format.'}`);
    }
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(uint8, {
      type: 'array',
      cellText: true,
      cellDates: true,
      raw: false // Preserves text formats such as '00101'
    });
  } catch (err: any) {
    throw new Error(
      `Unable to parse Excel file: ${err.message || 'The file may be corrupted, password-protected, or in an unsupported format.'}`
    );
  }

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('The imported Excel file contains no readable worksheets.');
  }

  const firstSheet = workbook.Sheets[sheetNames[0]];
  if (firstSheet) {
    const rawRows = XLSX.utils.sheet_to_json<any[]>(firstSheet, {
      header: 1,
      defval: '',
      raw: false
    });
    if (rawRows && rawRows.length > 0) {
      const row0Str = JSON.stringify(rawRows[0] || []);
      if (
        row0Str.includes('[Content_Types].xml') ||
        row0Str.includes('xl/_rels') ||
        row0Str.includes('xl/workbook.xml') ||
        /PK[\x00-\x1F]/.test(row0Str)
      ) {
        throw new Error(
          'Unable to parse Excel file: the workbook structure is corrupt or unreadable. Please open and re-save the file in Microsoft Excel or another spreadsheet editor.'
        );
      }
    }
  }

  return workbook;
}

/**
 * Extracts headers and rows from a specific worksheet, optionally with manual header row selection.
 */
export function extractSheetData(
  worksheet: XLSX.WorkSheet | undefined,
  sheetNames: string[],
  activeSheet: string,
  manualHeaderRowIndex?: number
): ParsedWorkbook {
  if (!worksheet) {
    return {
      sheetNames,
      activeSheet,
      headers: [],
      rows: [],
      totalRawRows: 0,
      rawGridPreview: [],
      headerRowIndex: 0,
      emptyColumns: [],
      duplicateColumns: []
    };
  }

  const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false
  });

  if (!jsonData || jsonData.length === 0) {
    return {
      sheetNames,
      activeSheet,
      headers: [],
      rows: [],
      totalRawRows: 0,
      rawGridPreview: [],
      headerRowIndex: 0,
      emptyColumns: [],
      duplicateColumns: []
    };
  }

  // Capture top 12 rows for the raw grid preview so HR can inspect or select header row
  const rawGridPreview: string[][] = jsonData.slice(0, 12).map(row =>
    (Array.isArray(row) ? row : []).map(c => String(c ?? '').trim())
  );

  // Locate header row: either manual override or first non-empty row
  let headerRowIndex = 0;
  if (typeof manualHeaderRowIndex === 'number' && manualHeaderRowIndex >= 0 && manualHeaderRowIndex < jsonData.length) {
    headerRowIndex = manualHeaderRowIndex;
  } else {
    while (headerRowIndex < jsonData.length) {
      const row = jsonData[headerRowIndex] as any[];
      if (row && row.some(cell => String(cell || '').trim() !== '')) {
        break;
      }
      headerRowIndex++;
    }
  }

  if (headerRowIndex >= jsonData.length) {
    return {
      sheetNames,
      activeSheet,
      headers: [],
      rows: [],
      totalRawRows: 0,
      rawGridPreview,
      headerRowIndex: 0,
      emptyColumns: [],
      duplicateColumns: []
    };
  }

  const rawHeaders = (jsonData[headerRowIndex] as any[]) || [];

  for (const h of rawHeaders) {
    const str = String(h || '');
    if (str.includes('[Content_Types]') || /PK[\x00-\x1F]/.test(str)) {
      throw new Error(
        'Unable to parse Excel file: detected raw compressed archive data instead of spreadsheet columns.'
      );
    }
  }

  // Detect duplicates and sanitize headers
  const seenHeaderCounts = new Map<string, number>();
  const duplicateColumns: string[] = [];

  const headers = rawHeaders.map((h, i) => {
    const clean = String(h !== undefined && h !== null ? h : '').replace(/^\uFEFF/, '').trim();
    const baseName = clean || `Column_${i + 1}`;
    const count = seenHeaderCounts.get(baseName) || 0;
    seenHeaderCounts.set(baseName, count + 1);

    if (count > 0) {
      duplicateColumns.push(baseName);
      return `${baseName}_${count + 1}`;
    }
    return baseName;
  });

  // Extract subsequent data rows
  const rows: Record<string, any>[] = [];
  for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
    const rowArray = jsonData[r] as any[];
    if (!rowArray || rowArray.every(val => String(val || '').trim() === '')) {
      continue; // Skip entirely empty rows
    }

    const rowObj: Record<string, any> = Object.create(null);
    headers.forEach((header, colIndex) => {
      const cleanHeader = header === '__proto__' || header === 'constructor' || header === 'prototype'
        ? `Safe_${header}`
        : header;
      const rawVal = rowArray[colIndex] !== undefined && rowArray[colIndex] !== null
        ? String(rowArray[colIndex]).trim()
        : '';
      rowObj[cleanHeader] = rawVal;
    });
    rows.push(rowObj);
  }

  // Detect empty columns (where all row values are empty strings)
  const emptyColumns: string[] = headers.filter(h => {
    return rows.length > 0 && rows.every(r => !r[h] || String(r[h]).trim() === '');
  });

  return {
    sheetNames,
    activeSheet,
    headers,
    rows,
    totalRawRows: rows.length,
    rawGridPreview,
    headerRowIndex,
    emptyColumns,
    duplicateColumns
  };
}

/**
 * Parses an ArrayBuffer, Uint8Array, or string containing an Excel or CSV file.
 * Preserves cell formats so leading zeros in Employee IDs are not stripped.
 */
export function parseExcelFile(
  data: ArrayBuffer | Uint8Array | string,
  fileName?: string,
  manualHeaderRowIndex?: number
): ParsedWorkbook {
  const workbook = readWorkbookSafe(data, fileName);
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('The imported workbook contains no sheets.');
  }

  const activeSheet = sheetNames[0];
  const worksheet = workbook.Sheets[activeSheet];
  return extractSheetData(worksheet, sheetNames, activeSheet, manualHeaderRowIndex);
}

/**
 * Parses a specific sheet within an existing workbook
 */
export function parseSpecificSheet(
  workbookData: ArrayBuffer | Uint8Array | string,
  sheetName: string,
  fileName?: string,
  manualHeaderRowIndex?: number
): ParsedWorkbook {
  const workbook = readWorkbookSafe(workbookData, fileName);
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('The imported workbook contains no sheets.');
  }

  const activeSheet = workbook.Sheets[sheetName] ? sheetName : sheetNames[0];
  const worksheet = workbook.Sheets[activeSheet];
  return extractSheetData(worksheet, sheetNames, activeSheet, manualHeaderRowIndex);
}

export interface AdvancedMapOptions {
  mapping?: ColumnMapping;
  defaultMonth?: string;
  defaultYear?: number;
  controls?: ColumnImportControl[];
  columnControls?: ColumnImportControl[];
  lopPrecedence?: 'excel' | 'attendance' | 'manual';
  lopSourcePrecedence?: 'excel' | 'attendance' | 'manual';
  customFieldDefs?: CustomFieldDefinition[];
  customFieldDefinitions?: CustomFieldDefinition[];
  existingEmployees?: DirectoryEmployee[];
  duplicateStrategy?: 'update' | 'skip';
  overwriteEmptyCells?: boolean;
  ambiguousLopInterpretation?: 'days' | 'amount' | 'ignore';
}

/**
 * Transforms raw sheet rows into structured EmployeeRecord objects using column mapping and HR fetch controls,
 * preserving strings, bank details, ESI, separating LOP Days vs LOP Amount, and capturing custom fields.
 */
export function mapRowsToEmployeeRecords(
  rows: Record<string, any>[],
  mappingOrOptions: ColumnMapping | AdvancedMapOptions,
  defaultMonthParam?: string,
  defaultYearParam?: number,
  additionalOptions?: Partial<AdvancedMapOptions>
): EmployeeRecord[] {
  let mapping: ColumnMapping;
  let defaultMonth: string = 'October';
  let defaultYear: number = 2026;
  let controls: ColumnImportControl[] | undefined;
  let lopPrecedence: 'excel' | 'attendance' | 'manual' = 'excel';
  let customFieldDefs: CustomFieldDefinition[] = [];
  let existingEmployees: DirectoryEmployee[] = [];
  let overwriteEmptyCells = false;
  let ambiguousLopInterpretation: 'days' | 'amount' | 'ignore' = 'days';

  if (
    mappingOrOptions &&
    typeof mappingOrOptions === 'object' &&
    'mapping' in mappingOrOptions &&
    (mappingOrOptions as any).mapping
  ) {
    const opts = mappingOrOptions as AdvancedMapOptions;
    mapping = opts.mapping!;
    defaultMonth = opts.defaultMonth || defaultMonthParam || 'October';
    defaultYear = opts.defaultYear || defaultYearParam || 2026;
    controls = opts.controls || opts.columnControls;
    lopPrecedence = opts.lopPrecedence || opts.lopSourcePrecedence || 'excel';
    customFieldDefs = opts.customFieldDefs || opts.customFieldDefinitions || [];
    existingEmployees = opts.existingEmployees || [];
    overwriteEmptyCells = opts.overwriteEmptyCells || false;
    ambiguousLopInterpretation = opts.ambiguousLopInterpretation || 'days';
  } else {
    mapping = (mappingOrOptions as ColumnMapping) || ({} as ColumnMapping);
    defaultMonth = defaultMonthParam || 'October';
    defaultYear = defaultYearParam || 2026;
    if (additionalOptions) {
      controls = additionalOptions.controls || additionalOptions.columnControls;
      lopPrecedence = additionalOptions.lopPrecedence || additionalOptions.lopSourcePrecedence || 'excel';
      customFieldDefs = additionalOptions.customFieldDefs || additionalOptions.customFieldDefinitions || [];
      existingEmployees = additionalOptions.existingEmployees || [];
      overwriteEmptyCells = additionalOptions.overwriteEmptyCells || false;
      ambiguousLopInterpretation = additionalOptions.ambiguousLopInterpretation || 'days';
    }
  }

  // Build a lookup of existing directory employees by ID for existing data protection
  const existingMap = new Map<string, DirectoryEmployee>();
  existingEmployees.forEach(emp => {
    if (emp.employeeId) existingMap.set(emp.employeeId.trim().toUpperCase(), emp);
  });

  // Helper: check if a standard field is enabled for fetching
  const isFieldFetched = (fieldKey: keyof ColumnMapping): boolean => {
    if (!controls || controls.length === 0) return true;
    const colHeader = mapping[fieldKey];
    if (!colHeader) return true;
    const ctrl = controls.find(c => {
      const colName = c.excelColumn || (c as any).excelHeader;
      return colName && colName.toLowerCase() === colHeader.toLowerCase();
    });
    if (!ctrl) return true;
    return ctrl.fetch !== undefined ? ctrl.fetch : ((ctrl as any).shouldFetch !== undefined ? (ctrl as any).shouldFetch : true);
  };

  const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  const parseString = (val: any): string | undefined => {
    if (val === undefined || val === null) return undefined;
    const str = String(val).trim();
    return str === '' ? undefined : str;
  };

  const rawRecords = rows.map((row, index) => {
    // Preserve Employee ID as exact string (handles leading zeros like '00105')
    const rawEmpId = mapping.employeeId && row[mapping.employeeId] !== undefined
      ? String(row[mapping.employeeId]).trim()
      : '';
    const employeeId = rawEmpId || `EMP-${String(index + 1).padStart(3, '0')}`;
    const existingEmp = existingMap.get(employeeId.toUpperCase());

    // Employee Name
    let name = '';
    if (isFieldFetched('name') && mapping.name && row[mapping.name] !== undefined && String(row[mapping.name]).trim() !== '') {
      name = String(row[mapping.name]).trim();
    } else if (existingEmp?.legalName) {
      name = existingEmp.legalName;
    }

    // Helper for strings: respects fetch control, preserves existing if blank unless overwriteEmptyCells is true
    const resolveStrField = (
      fieldKey: keyof ColumnMapping,
      existingVal?: string,
      fallback?: string
    ): string | undefined => {
      if (!isFieldFetched(fieldKey)) {
        return existingVal || fallback;
      }
      const col = mapping[fieldKey];
      const val = col ? parseString(row[col]) : undefined;
      if (val !== undefined) return val;
      if (!overwriteEmptyCells && existingVal !== undefined) return existingVal;
      return fallback;
    };

    const email = resolveStrField('email', existingEmp?.workEmail);
    const phone = resolveStrField('phone', existingEmp?.primaryPhone);
    const department = resolveStrField('department', existingEmp?.department, 'General') || 'General';
    const designation = resolveStrField('designation', existingEmp?.designation, 'Staff') || 'Staff';
    const joiningDate = resolveStrField('joiningDate', existingEmp?.joiningDate);
    const employmentStatus = resolveStrField('employmentStatus', existingEmp?.employmentStatus, 'Active') || 'Active';

    // Payroll Period
    const payrollMonth = isFieldFetched('payrollMonth') && mapping.payrollMonth && row[mapping.payrollMonth]
      ? String(row[mapping.payrollMonth]).trim()
      : defaultMonth;

    const payrollYear = isFieldFetched('payrollYear') && mapping.payrollYear && row[mapping.payrollYear]
      ? parseNum(row[mapping.payrollYear])
      : defaultYear;

    const defaultDays = getDaysInMonth(payrollYear, payrollMonth);

    // Attendance Fields
    const totalWorkingDays = isFieldFetched('totalWorkingDays') && mapping.totalWorkingDays && row[mapping.totalWorkingDays] !== undefined
      ? parseNum(row[mapping.totalWorkingDays])
      : defaultDays;

    const paidDays = isFieldFetched('paidDays') && mapping.paidDays && row[mapping.paidDays] !== undefined
      ? parseNum(row[mapping.paidDays])
      : defaultDays;

    const presentDays = isFieldFetched('presentDays') && mapping.presentDays && row[mapping.presentDays] !== undefined
      ? parseNum(row[mapping.presentDays])
      : undefined;

    const absentDays = isFieldFetched('absentDays') && mapping.absentDays && row[mapping.absentDays] !== undefined
      ? parseNum(row[mapping.absentDays])
      : undefined;

    const paidLeave = isFieldFetched('paidLeave') && mapping.paidLeave && row[mapping.paidLeave] !== undefined
      ? parseNum(row[mapping.paidLeave])
      : undefined;

    const unpaidLeave = isFieldFetched('unpaidLeave') && mapping.unpaidLeave && row[mapping.unpaidLeave] !== undefined
      ? parseNum(row[mapping.unpaidLeave])
      : undefined;

    // Loss of Pay (LOP) Fields: LOP Days vs LOP Amount
    let lopDays = 0;
    if (isFieldFetched('lopDays') && mapping.lopDays && row[mapping.lopDays] !== undefined) {
      lopDays = parseNum(row[mapping.lopDays]);
    } else if (isFieldFetched('unpaidDays') && mapping.unpaidDays && row[mapping.unpaidDays] !== undefined) {
      lopDays = parseNum(row[mapping.unpaidDays]);
    }

    let lopAmount = 0;
    if (isFieldFetched('lopAmount') && mapping.lopAmount && row[mapping.lopAmount] !== undefined) {
      lopAmount = parseNum(row[mapping.lopAmount]);
    }

    if (ambiguousLopInterpretation === 'amount') {
      if (lopDays > 0 && lopAmount === 0) {
        lopAmount = lopDays;
        lopDays = 0;
      }
    }

    // Identifiers & Statutory
    const pan = resolveStrField('pan', existingEmp?.panNumber);
    const uan = resolveStrField('uan', existingEmp?.uanNumber);
    const esiNumber = resolveStrField('esiNumber', existingEmp?.esiNumber || existingEmp?.esicNumber);
    const pfNumber = resolveStrField('pfNumber');
    const aadhaarNumber = resolveStrField('aadhaarNumber', existingEmp?.aadhaarNumber);

    // Bank Information: Never truncate, preserve leading zeros
    const bankAccount = resolveStrField('bankAccount', existingEmp?.accountNumber);
    const bankName = resolveStrField('bankName', existingEmp?.bankName);
    const ifscCode = resolveStrField('ifscCode', existingEmp?.ifscCode);
    const branchName = resolveStrField('branchName', existingEmp?.branchName);
    const accountHolderName = resolveStrField('accountHolderName', existingEmp?.accountHolderName || name);

    // CTC, Employer PF & Employee PF
    const ctc = isFieldFetched('ctc') && mapping.ctc && row[mapping.ctc] !== undefined && row[mapping.ctc] !== ''
      ? parseNum(row[mapping.ctc])
      : (existingEmp?.standardCtc || undefined);
    const employerPf = isFieldFetched('employerPf') && mapping.employerPf && row[mapping.employerPf] !== undefined ? parseNum(row[mapping.employerPf]) : 0;
    const employerEsi = isFieldFetched('employerEsi') && mapping.employerEsi && row[mapping.employerEsi] !== undefined && row[mapping.employerEsi] !== ''
      ? parseNum(row[mapping.employerEsi])
      : (existingEmp?.standardEmployerEsi || 0);
    const employeePf = isFieldFetched('employeePf') && mapping.employeePf && row[mapping.employeePf] !== undefined
      ? parseNum(row[mapping.employeePf])
      : (isFieldFetched('pf') && mapping.pf ? parseNum(row[mapping.pf]) : 0);

    // Earnings
    const basic = isFieldFetched('basic') && mapping.basic ? parseNum(row[mapping.basic]) : (existingEmp?.standardBasic || 0);
    const hra = isFieldFetched('hra') && mapping.hra ? parseNum(row[mapping.hra]) : (existingEmp?.standardHra || 0);
    const specialAllowance = isFieldFetched('specialAllowance') && mapping.specialAllowance ? parseNum(row[mapping.specialAllowance]) : 0;
    const otherAllowances = isFieldFetched('otherAllowances') && mapping.otherAllowances
      ? parseNum(row[mapping.otherAllowances])
      : (existingEmp?.standardAllowances || 0);

    const providedGross = isFieldFetched('providedGross') && mapping.providedGross && row[mapping.providedGross] !== ''
      ? parseNum(row[mapping.providedGross])
      : undefined;

    // Deductions
    const pf = employeePf;
    const esi = isFieldFetched('esi') && mapping.esi ? parseNum(row[mapping.esi]) : 0;
    const professionalTax = isFieldFetched('professionalTax') && mapping.professionalTax ? parseNum(row[mapping.professionalTax]) : 0;
    const tds = isFieldFetched('tds') && mapping.tds ? parseNum(row[mapping.tds]) : 0;
    const loan = isFieldFetched('loan') && mapping.loan ? parseNum(row[mapping.loan]) : 0;
    const lateDeduction = isFieldFetched('lateDeduction') && mapping.lateDeduction ? parseNum(row[mapping.lateDeduction]) : 0;
    const lopDeduction = lopAmount > 0 ? lopAmount : (isFieldFetched('lopDeduction') && mapping.lopDeduction ? parseNum(row[mapping.lopDeduction]) : 0);

    // Other Deductions: include other deductions excluding explicit items
    let otherDeductions = isFieldFetched('otherDeductions') && mapping.otherDeductions
      ? parseNum(row[mapping.otherDeductions])
      : 0;

    const providedDeductions = isFieldFetched('providedDeductions') && mapping.providedDeductions && row[mapping.providedDeductions] !== ''
      ? parseNum(row[mapping.providedDeductions])
      : undefined;

    const providedNet = isFieldFetched('providedNet') && mapping.providedNet && row[mapping.providedNet] !== ''
      ? parseNum(row[mapping.providedNet])
      : undefined;

    // LOP Conflict Check between imported Excel LOP and attendance-based policy
    let lopConflict = false;
    let lopConflictDetails: string | undefined = undefined;

    if (lopDays > 0 && basic > 0 && defaultDays > 0) {
      const dailyRate = Math.round(((basic + hra) / defaultDays) * 100) / 100;
      const calculatedAttendanceLopAmount = Math.round(dailyRate * lopDays * 100) / 100;

      if (lopAmount > 0 && Math.abs(lopAmount - calculatedAttendanceLopAmount) > 1.0) {
        lopConflict = true;
        lopConflictDetails = `Imported LOP Amount (${lopAmount}) differs from attendance-calculated deduction (${calculatedAttendanceLopAmount} for ${lopDays} days at rate ${dailyRate}/day).`;
      }
    }

    // Dynamic Custom Fields Extraction
    const customFields: Record<string, any> = {
      ...(existingEmp?.customFields || {})
    };

    // Extract any column that is not mapped to a standard field
    Object.keys(row).forEach(colName => {
      const isMappedToStandard = Object.entries(mapping).some(([fieldKey, mappedCol]) => {
        return fieldKey !== 'custom_fields' && mappedCol && mappedCol.toLowerCase() === colName.toLowerCase();
      });
      if (isMappedToStandard) return;

      // Check controls if provided
      if (controls && controls.length > 0) {
        const ctrl = controls.find(c => {
          const cName = c.excelColumn || (c as any).excelHeader;
          return cName && cName.toLowerCase() === colName.toLowerCase();
        });
        if (ctrl) {
          const shouldFetch = ctrl.fetch !== undefined ? ctrl.fetch : (ctrl as any).shouldFetch;
          if (!shouldFetch) return;
        }
      }

      const rawVal = row[colName];
      if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
        return;
      }

      const def = customFieldDefs.find(d =>
        d.name?.toLowerCase() === colName.toLowerCase() ||
        d.key?.toLowerCase() === colName.toLowerCase() ||
        d.label?.toLowerCase() === colName.toLowerCase()
      );

      const targetKey = def?.key || colName;
      const dt = def?.dataType || 'text';

      let parsedVal: any = rawVal;
      if (dt === 'number' || dt === 'decimal' || dt === 'currency') {
        parsedVal = parseNum(rawVal);
      } else if (dt === 'boolean') {
        parsedVal = ['true', 'yes', '1', 'y'].includes(String(rawVal).toLowerCase().trim());
      } else {
        parsedVal = String(rawVal).trim();
      }

      customFields[targetKey] = parsedVal;
      if (targetKey !== colName) {
        customFields[colName] = parsedVal;
      }
    });

    return {
      id: `row-${index + 1}`,
      employeeId,
      name,
      email,
      phone,
      department,
      designation,
      joiningDate,
      employmentStatus,
      paidDays,
      unpaidDays: lopDays, // Legacy / backward compatibility
      totalWorkingDays,
      presentDays,
      absentDays,
      paidLeave,
      unpaidLeave,
      lopDays,
      lopAmount,
      lopSource: lopPrecedence,
      lopConflict,
      lopConflictDetails,
      bankAccount,
      bankName,
      ifscCode,
      branchName,
      accountHolderName,
      pan,
      uan,
      esiNumber,
      pfNumber,
      aadhaarNumber,
      ctc,
      employerPf,
      employerEsi,
      employeePf,
      loan,
      lateDeduction,
      lopDeduction,
      basic,
      hra,
      specialAllowance,
      otherAllowances,
      providedGross,
      pf,
      esi,
      professionalTax,
      otherDeductions,
      providedDeductions,
      providedNet,
      payrollMonth,
      payrollYear,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined
    };
  });

  return validateBatch(rawRecords, { month: defaultMonth, year: defaultYear });
}

/**
 * Generates a realistic sample Excel file buffer that HR can download and test.
 * Includes standard employee details, statutory, banking, attendance, LOP, and custom columns.
 */
export function createSampleWorkbookBuffer(): Uint8Array {
  const data = [
    [
      'Employee ID', 'Employee Name', 'Department', 'Designation', 'Joining Date',
      'Email', 'Phone', 'ESI Number', 'Bank Name', 'IFSC Code', 'Bank Account Number',
      'Branch Name', 'Account Holder Name', 'PAN', 'UAN', 'Basic Salary', 'HRA',
      'Special Allowance', 'Other Allowances', 'Gross Earnings', 'PF', 'ESI',
      'Professional Tax', 'TDS', 'Other Deductions', 'Total Deductions', 'Net Salary',
      'Paid Days', 'LOP Days', 'LOP Amount', 'Cost Centre', 'Location', 'Custom Allowance'
    ],
    ['00101', 'Alexander Wright', 'Engineering', 'Lead Architect', '2021-03-15', 'alex.wright@acme.corp', '+91 98765 00101', '3100123456789', 'HDFC Bank Ltd', 'HDFC0000240', '001012345678', 'Indiranagar', 'Alexander Wright', 'ABCDE1234F', '100987654321', 75000, 30000, 15000, 5000, 125000, 9000, 0, 200, 8500, 0, 17700, 107300, 30, 0, 0, 'CC-ENG-101', 'Bengaluru HQ', 2500],
    ['00102', 'Sophia Chen', 'Product', 'Product Director', '2020-07-01', 'sophia.chen@acme.corp', '+91 98765 00102', '3100123456790', 'State Bank of India', 'SBIN0001827', '002012345679', 'Velachery', 'Sophia Chen', 'BCDEF2345G', '100987654322', 70000, 28000, 14000, 4000, 116000, 8400, 0, 200, 7200, 0, 15800, 100200, 30, 0, 0, 'CC-PRD-201', 'Chennai OMR', 2000],
    ['00103', 'Marcus Aurelius Vance', 'Operations', 'Operations Manager', '2022-01-10', 'marcus.v@acme.corp', '+91 98765 00103', '3100123456791', 'ICICI Bank Ltd', 'ICIC0000018', '003012345680', 'T. Nagar', 'Marcus Aurelius Vance', 'CDEFG3456H', '100987654323', 55000, 22000, 10000, 3000, 90000, 6600, 0, 200, 4500, 0, 11300, 78700, 29, 1, 2566.67, 'CC-OPS-301', 'Mumbai Hub', 1500],
    ['00104', 'Elena Rostova', 'Design', 'Senior UI/UX Designer', '2022-09-20', 'elena.r@acme.corp', '+91 98765 00104', '3100123456792', 'Axis Bank Ltd', 'UTIB0000123', '004012345681', 'Koramangala', 'Elena Rostova', 'DEFGH4567J', '100987654324', 48000, 19200, 8000, 2800, 78000, 5760, 0, 200, 3500, 0, 9460, 68540, 30, 0, 0, 'CC-DSG-401', 'Bengaluru HQ', 1200],
    ['00105', 'David Kim', 'Engineering', 'Fullstack Engineer', '2023-04-12', 'david.kim@acme.corp', '+91 98765 00105', '3100123456793', 'HDFC Bank Ltd', 'HDFC0000240', '005012345682', 'Indiranagar', 'David Kim', 'EFGHI5678K', '100987654325', 42000, 16800, 7000, 2200, 68000, 5040, 0, 200, 2800, 0, 8040, 59960, 30, 0, 0, 'CC-ENG-102', 'Bengaluru HQ', 1000],
    ['00106', 'Priya Sharma', 'Human Resources', 'HR Specialist', '2021-11-05', 'priya.s@acme.corp', '+91 98765 00106', '3100123456794', 'Kotak Mahindra Bank', 'KKBK0000456', '006012345683', 'Connaught Place', 'Priya Sharma', 'FGHIJ6789L', '100987654326', 40000, 16000, 6000, 2000, 64000, 4800, 0, 200, 2500, 0, 7500, 56500, 30, 0, 0, 'CC-HR-501', 'Delhi NCR', 1000],
    ['00107', 'Liam O\'Connor', 'Marketing', 'Growth Specialist', '2023-08-01', 'liam.oc@acme.corp', '+91 98765 00107', '3100123456795', 'State Bank of India', 'SBIN0001827', '007012345684', 'Velachery', 'Liam O\'Connor', 'GHIJK7890M', '100987654327', 38000, 15200, 5000, 1800, 60000, 4560, 0, 200, 2100, 0, 6860, 53140, 28, 2, 3546.67, 'CC-MKT-601', 'Chennai OMR', 800],
    ['00108', 'Fatima Al-Sayed', 'Finance', 'Financial Analyst', '2022-05-18', 'fatima.as@acme.corp', '+91 98765 00108', '3100123456796', 'ICICI Bank Ltd', 'ICIC0000018', '008012345685', 'T. Nagar', 'Fatima Al-Sayed', 'HIJKL8901N', '100987654328', 45000, 18000, 7500, 2500, 73000, 5400, 0, 200, 3100, 0, 8700, 64300, 30, 0, 0, 'CC-FIN-701', 'Mumbai Hub', 1500],
    ['00109', 'Jackson Miller', 'Customer Success', 'Support Lead', '2023-02-14', 'jackson.m@acme.corp', '+91 98765 00109', '3100123456797', 'Axis Bank Ltd', 'UTIB0000123', '009012345686', 'Koramangala', 'Jackson Miller', 'IJKLM9012P', '100987654329', 35000, 14000, 4500, 1500, 55000, 4200, 0, 200, 1800, 0, 6200, 48800, 30, 0, 0, 'CC-CS-801', 'Bengaluru HQ', 500],
    ['00110', 'Zoe Martinez', 'Quality Assurance', 'QA Automation Engineer', '2023-10-01', 'zoe.m@acme.corp', '+91 98765 00110', '3100123456798', 'HDFC Bank Ltd', 'HDFC0000240', '010012345687', 'Indiranagar', 'Zoe Martinez', 'JKLMN0123Q', '100987654330', 41000, 16400, 6500, 2100, 66000, 4920, 0, 200, 2600, 0, 7720, 58280, 30, 0, 0, 'CC-QA-901', 'Chennai OMR', 1000]
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'October 2026 Payroll');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
}
