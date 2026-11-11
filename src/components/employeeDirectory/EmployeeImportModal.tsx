import React, { useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Check
} from 'lucide-react';
import { DirectoryEmployee } from '../../types/employeeDirectory';
import { ColumnMapping } from '../../types/payroll';
import { readWorkbookSafe, parseSpecificSheet } from '../../utils/excelParser';
import { autoDetectColumnMapping } from '../../utils/columnDetector';
import { useTheme } from '../../context/ThemeContext';

interface EmployeeImportModalProps {
  existingEmployees: DirectoryEmployee[];
  onImportComplete: (imported: DirectoryEmployee[]) => Promise<void>;
  onClose: () => void;
}

export const EmployeeImportModal: React.FC<EmployeeImportModalProps> = ({
  existingEmployees,
  onImportComplete,
  onClose
}) => {
  const { isDark } = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // File & Raw Data State
  const [fileName, setFileName] = useState<string>('');
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | Uint8Array | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Mapping State
  const [mapping, setMapping] = useState<ColumnMapping>({
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
    payrollYear: ''
  });

  // Duplicate Handling Option ('skip' or 'overwrite')
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'overwrite'>('skip');
  const [importSummary, setImportSummary] = useState<{ newCount: number; duplicateCount: number; invalidCount: number } | null>(null);
  const [processedEmployees, setProcessedEmployees] = useState<DirectoryEmployee[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = new Uint8Array(evt.target?.result as ArrayBuffer);
        setFileBuffer(buffer);

        const wb = readWorkbookSafe(buffer, file.name);
        const sheets = wb.SheetNames || [];
        if (sheets.length === 0) {
          throw new Error('Workbook contains no sheets.');
        }

        setSheetNames(sheets);
        const defaultSheet = sheets[0];
        setActiveSheet(defaultSheet);

        const parsed = parseSpecificSheet(buffer, defaultSheet, file.name);
        setHeaders(parsed.headers);
        setRawRows(parsed.rows);

        const autoMapping = autoDetectColumnMapping(parsed.headers);
        setMapping(autoMapping);
        setStep(2);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to parse spreadsheet file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetChange = (sheetName: string) => {
    setActiveSheet(sheetName);
    if (!fileBuffer) return;
    try {
      const parsed = parseSpecificSheet(fileBuffer, sheetName, fileName);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMapping(autoDetectColumnMapping(parsed.headers));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to switch sheet.');
    }
  };

  const handlePreviewImport = () => {
    if (!mapping.employeeId || !mapping.name) {
      setErrorMsg('Mapping for "Employee ID" and "Employee Name" (Legal Name) are required.');
      return;
    }

    const existingMap = new Map<string, DirectoryEmployee>();
    existingEmployees.forEach(e => existingMap.set(e.employeeId.toUpperCase(), e));

    let newCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const mappedList: DirectoryEmployee[] = [];

    const now = new Date().toISOString();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rawId = row[mapping.employeeId];
      const rawName = row[mapping.name];

      const empId = rawId !== undefined && rawId !== null ? String(rawId).trim().toUpperCase() : '';
      const legalName = rawName !== undefined && rawName !== null ? String(rawName).trim() : '';

      if (!empId || !legalName) {
        invalidCount++;
        continue;
      }

      const isDuplicate = existingMap.has(empId);
      if (isDuplicate) {
        duplicateCount++;
        if (duplicateStrategy === 'skip') {
          continue;
        }
      } else {
        newCount++;
      }

      const department = (mapping.department && row[mapping.department]) ? String(row[mapping.department]).trim() : 'General';
      const designation = (mapping.designation && row[mapping.designation]) ? String(row[mapping.designation]).trim() : 'Staff';
      const workEmail = (mapping.email && row[mapping.email]) ? String(row[mapping.email]).trim() : `${empId.toLowerCase()}@enterprise.com`;
      const primaryPhone = (row['Phone'] || row['Mobile'] || '9999999999');
      const joiningDate = (mapping.joiningDate && row[mapping.joiningDate]) ? String(row[mapping.joiningDate]).trim() : now.split('T')[0];
      const panNumber = (mapping.pan && row[mapping.pan]) ? String(row[mapping.pan]).trim().toUpperCase() : undefined;
      const uanNumber = (mapping.uan && row[mapping.uan]) ? String(row[mapping.uan]).trim() : undefined;
      const esicNumber = (mapping.esiNumber && row[mapping.esiNumber]) ? String(row[mapping.esiNumber]).trim() : undefined;
      const bankAccount = (mapping.bankAccount && row[mapping.bankAccount]) ? String(row[mapping.bankAccount]).trim() : undefined;
      const bankName = (mapping.bankName && row[mapping.bankName]) ? String(row[mapping.bankName]).trim() : undefined;
      const ifscCode = (mapping.ifscCode && row[mapping.ifscCode]) ? String(row[mapping.ifscCode]).trim().toUpperCase() : undefined;
      const branchName = (mapping.branchName && row[mapping.branchName]) ? String(row[mapping.branchName]).trim() : undefined;
      const accountHolderName = (mapping.accountHolderName && row[mapping.accountHolderName]) ? String(row[mapping.accountHolderName]).trim() : undefined;

      const newEmp: DirectoryEmployee = {
        id: `import_${empId}_${Date.now()}_${i}`,
        employeeId: empId,
        createdAt: now,
        updatedAt: now,
        legalName,
        workEmail,
        primaryPhone: String(primaryPhone),
        currentAddress: 'Corporate Headquarters',
        permanentAddress: 'Corporate Headquarters',
        emergencyContactName: 'HR Department',
        emergencyContactRelationship: 'Administrator',
        emergencyContactPhone: '9999999999',
        joiningDate,
        employmentType: 'Full-Time',
        employmentStatus: 'Active',
        department,
        designation,
        workLocation: 'Main Office',
        probationStatus: 'Confirmed',
        panNumber,
        uanNumber,
        esicNumber,
        esiNumber: esicNumber,
        accountNumber: bankAccount,
        bankName,
        ifscCode,
        branchName,
        accountHolderName,
        qualifications: []
      };

      mappedList.push(newEmp);
    }

    setImportSummary({ newCount, duplicateCount, invalidCount });
    setProcessedEmployees(mappedList);
    setStep(3);
  };

  const handleCommitImport = async () => {
    setIsSubmitting(true);
    try {
      await onImportComplete(processedEmployees);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error committing import.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#222222] bg-[#141416]' : 'border-[#E4E4E7] bg-[#FAFAFC]'}`}>
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-[#CB1417]" />
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              Import Employees from Spreadsheet (XLSX, XLS, CSV)
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDark ? 'hover:bg-[#222226] text-[#A1A1AA]' : 'hover:bg-[#E4E4E7] text-[#71717A]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 py-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#CB1417]/10 border border-[#CB1417]/25 text-[#CB1417] flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                  Select Payroll or Employee Directory Spreadsheet
                </h4>
                <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                  Supports Excel (.xlsx, .xls) and CSV files. Leading zeros in Employee IDs will be perfectly preserved.
                </p>
              </div>

              <div className="pt-4 max-w-sm mx-auto">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className={`w-full p-3 rounded-xl border cursor-pointer text-xs ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                  }`}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <div>
                  <span className="font-bold text-[#CB1417]">File: {fileName}</span>
                  <p className="text-zinc-500 text-[11px]">{rawRows.length} total rows detected</p>
                </div>
                {sheetNames.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-semibold mb-1">Select Worksheet</label>
                    <select
                      value={activeSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className={`px-3 py-1.5 rounded-lg border text-xs ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                      }`}
                    >
                      {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <h4 className={`font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                  Column Mapping (Auto-detected)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Employee ID Column *</label>
                    <select
                      value={mapping.employeeId}
                      onChange={(e) => setMapping({ ...mapping, employeeId: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border text-xs ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                      }`}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Employee Legal Name Column *</label>
                    <select
                      value={mapping.name}
                      onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border text-xs ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                      }`}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Department Column</label>
                    <select
                      value={mapping.department}
                      onChange={(e) => setMapping({ ...mapping, department: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border text-xs ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                      }`}
                    >
                      <option value="">-- None / Default --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Designation Column</label>
                    <select
                      value={mapping.designation}
                      onChange={(e) => setMapping({ ...mapping, designation: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border text-xs ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                      }`}
                    >
                      <option value="">-- None / Default --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-dashed">
                  <label className="block font-semibold mb-1">Duplicate Employee ID Strategy</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="accent-[#CB1417]"
                      />
                      <span>Skip existing employee records</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'overwrite'}
                        onChange={() => setDuplicateStrategy('overwrite')}
                        className="accent-[#CB1417]"
                      />
                      <span>Overwrite / Update existing records</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handlePreviewImport}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
                >
                  <span>Preview Import</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && importSummary && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-zinc-50 dark:bg-zinc-900 space-y-3">
                <h4 className={`font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                  Import Validation Summary
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                    <div className="text-lg font-bold">{importSummary.newCount}</div>
                    <div className="text-[10px] uppercase font-semibold">New Records</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                    <div className="text-lg font-bold">{importSummary.duplicateCount}</div>
                    <div className="text-[10px] uppercase font-semibold">Duplicates ({duplicateStrategy})</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                    <div className="text-lg font-bold">{importSummary.invalidCount}</div>
                    <div className="text-[10px] uppercase font-semibold">Invalid / Skipped</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold cursor-pointer"
                >
                  Back to Mapping
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || processedEmployees.length === 0}
                  onClick={handleCommitImport}
                  className="flex items-center space-x-2 px-5 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Importing...' : `Confirm & Import ${processedEmployees.length} Records`}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
