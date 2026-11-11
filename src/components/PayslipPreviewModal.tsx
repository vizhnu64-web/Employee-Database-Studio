import React, { useEffect } from 'react';
import {
  X,
  Download,
  Printer
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, GeneratedPayslipRecord, PayslipLayoutSettings, DEFAULT_LAYOUT_SETTINGS } from '../types/payroll';
import { numberToWords } from '../utils/numberToWords';
import { generatePayslipPdf, getSafeFileName } from '../utils/pdfGenerator';
import { getDaysInMonth } from '../utils/dateUtils';
import { localDB } from '../utils/dbStorage';
import { useTheme } from '../context/ThemeContext';

interface PayslipPreviewModalProps {
  employee: EmployeeRecord | null;
  settings: CompanySettings;
  month: string;
  year: number;
  onClose: () => void;
  onSavedToHistory?: (record: GeneratedPayslipRecord) => void;
  layoutSettings?: PayslipLayoutSettings;
}

export const PayslipPreviewModal: React.FC<PayslipPreviewModalProps> = ({
  employee,
  settings,
  month,
  year,
  onClose,
  onSavedToHistory,
  layoutSettings
}) => {
  const { isDark } = useTheme();

  const layout: PayslipLayoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    ...(layoutSettings || {})
  };

  const showSymbol = settings.showCurrencySymbol !== false;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!employee) return null;

  const handleDownloadPdf = async () => {
    const doc = generatePayslipPdf(employee, settings, month, year, layoutSettings);
    const fileName = getSafeFileName(employee, month, year);
    doc.save(fileName);

    const historyRecord: GeneratedPayslipRecord = {
      id: `${employee.employeeId.trim()}_${month}_${year}`.toLowerCase(),
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department || 'General',
      designation: employee.designation || 'Staff',
      month,
      year,
      grossEarnings: employee.calculatedGross,
      totalDeductions: employee.calculatedDeductions,
      netSalary: employee.calculatedNet,
      generatedAt: new Date().toISOString(),
      fileName
    };

    await localDB.saveGeneratedRecord(historyRecord);
    if (onSavedToHistory) {
      onSavedToHistory(historyRecord);
    }
  };

  const handlePrint = () => {
    const doc = generatePayslipPdf(employee, settings, month, year, layoutSettings);
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  };

  const netWords = numberToWords(employee.calculatedNet, settings.currencyName || 'USD');

  const allEmpFields: Array<{ label: string; val: string }> = [];
  const addEmpField = (show: boolean | undefined, label: string, val: any) => {
    if (show === false) return;
    const strVal = val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : '—';
    allEmpFields.push({ label, val: strVal });
  };

  addEmpField(layout.showEmployeeId, layout.labelEmployeeId || 'Employee ID', employee.employeeId);
  addEmpField(layout.showName, layout.labelName || 'Employee Name', employee.name);
  addEmpField(layout.showDepartment, layout.labelDepartment || 'Department', employee.department);
  addEmpField(layout.showDesignation, layout.labelDesignation || 'Designation', employee.designation);
  addEmpField(layout.showJoiningDate, layout.labelJoiningDate || 'Joining Date', employee.joiningDate);

  if (layout.showCtc !== false && employee.ctc !== undefined) {
    const ctcStr = showSymbol ? `${settings.currencySymbol} ${employee.ctc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : employee.ctc.toLocaleString();
    addEmpField(true, layout.labelCtc || 'Cost to Company (CTC)', ctcStr);
  }
  if (layout.showEmployerPf !== false && employee.employerPf !== undefined && employee.employerPf > 0) {
    const epfStr = showSymbol ? `${settings.currencySymbol} ${employee.employerPf.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : employee.employerPf.toLocaleString();
    addEmpField(true, layout.labelEmployerPf || 'Employer PF', epfStr);
  }
  if (layout.showEmployerEsi !== false && employee.employerEsi !== undefined && employee.employerEsi > 0) {
    const esiStr = showSymbol ? `${settings.currencySymbol} ${employee.employerEsi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : employee.employerEsi.toLocaleString();
    addEmpField(true, layout.labelEmployerEsi || 'Employer ESI', esiStr);
  }

  if (layout.showTotalWorkingDays && employee.totalWorkingDays !== undefined) {
    addEmpField(true, layout.labelTotalWorkingDays || 'Total Working Days', `${employee.totalWorkingDays} Days`);
  }
  addEmpField(layout.showPaidDays, layout.labelPaidDays || 'Paid Days', `${employee.paidDays ?? getDaysInMonth(year, month)} Days`);

  if (layout.showLopDays !== false && employee.lopDays !== undefined && employee.lopDays > 0) {
    addEmpField(true, layout.labelLopDays || 'LOP Days', `${employee.lopDays} Days`);
  } else if (layout.showUnpaidDays !== false) {
    addEmpField(true, layout.labelUnpaidDays || 'Loss of Pay (LOP)', `${employee.unpaidDays ?? employee.lopDays ?? 0} Days`);
  }

  addEmpField(layout.showPan, layout.labelPan || 'PAN', employee.pan);
  addEmpField(layout.showUan, layout.labelUan || 'UAN', employee.uan);
  addEmpField(layout.showEsiNumber, layout.labelEsiNumber || 'ESI Number', employee.esiNumber);
  if (layout.showPfNumber && employee.pfNumber) {
    addEmpField(true, layout.labelPfNumber || 'PF Number', employee.pfNumber);
  }
  if (layout.showAadhaar && employee.aadhaarNumber) {
    addEmpField(true, layout.labelAadhaar || 'Aadhaar Number', employee.aadhaarNumber);
  }

  addEmpField(layout.showBankName, layout.labelBankName || 'Bank Name', employee.bankName);
  addEmpField(layout.showBankAccount, layout.labelBankAccount || 'Bank Account No', employee.bankAccount);
  addEmpField(layout.showIfscCode, layout.labelIfscCode || 'IFSC Code', employee.ifscCode);
  if (layout.showBranchName && employee.branchName) {
    addEmpField(true, layout.labelBranchName || 'Branch Name', employee.branchName);
  }
  if (layout.showAccountHolderName && employee.accountHolderName) {
    addEmpField(true, layout.labelAccountHolderName || 'Account Holder Name', employee.accountHolderName);
  }

  if (employee.customFields && typeof employee.customFields === 'object') {
    const customLayouts = layout.customFieldLayouts || [];
    const seenCustomKeys = new Set<string>();
    Object.entries(employee.customFields).forEach(([key, val]) => {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenCustomKeys.has(normKey)) return;
      seenCustomKeys.add(normKey);

      const cfg = customLayouts.find(c => c.key === key || c.key.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
      if (cfg && cfg.showInPdf === false) return;
      const lowerKey = key.toLowerCase();
      if (typeof val === 'number' && (
        lowerKey.includes('allowance') ||
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
        lowerKey.includes('ctc')
      )) {
        return;
      }
      const fieldLabel = cfg?.label || key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      addEmpField(true, fieldLabel, val);
    });
  }

  const earningsList: Array<{ label: string; amount: number }> = [
    layout.showBasic !== false ? { label: layout.labelBasic || 'Basic Salary', amount: employee.basic } : null,
    layout.showHra !== false ? { label: layout.labelHra || 'HRA', amount: employee.hra } : null,
    layout.showSpecialAllowance !== false ? { label: layout.labelSpecialAllowance || 'Special Allowance', amount: employee.specialAllowance || 0 } : null,
    layout.showOtherAllowances !== false ? { label: layout.labelOtherAllowances || 'Other Allowances', amount: employee.otherAllowances || 0 } : null,
    employee.conveyance ? { label: 'Conveyance Allowance', amount: employee.conveyance } : null,
    employee.medicalAllowance ? { label: 'Medical Allowance', amount: employee.medicalAllowance } : null,
  ].filter(Boolean) as { label: string; amount: number }[];

  if (employee.customFields) {
    const seenEarnKeys = new Set<string>();
    Object.entries(employee.customFields).forEach(([key, val]) => {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenEarnKeys.has(normKey)) return;
      seenEarnKeys.add(normKey);
      if (typeof val === 'number' && key.toLowerCase().includes('allowance')) {
        const label = key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        earningsList.push({ label, amount: val });
      }
    });
  }

  const deductionsList: Array<{ label: string; amount: number }> = [
    layout.showPf !== false ? { label: layout.labelPf || 'Provident Fund (EPF)', amount: employee.pf } : null,
    layout.showEsi !== false ? { label: layout.labelEsi || 'ESI', amount: employee.esi } : null,
    layout.showProfessionalTax !== false ? { label: layout.labelProfessionalTax || 'Professional Tax', amount: employee.professionalTax } : null,
    layout.showTds !== false ? { label: layout.labelTds || 'TDS / Income Tax', amount: employee.tds } : null,
    (layout.showLoan !== false && employee.loan && employee.loan > 0)
      ? { label: layout.labelLoan || 'Staff Loan / Advance', amount: employee.loan }
      : null,
    (layout.showLateDeduction !== false && employee.lateDeduction && employee.lateDeduction > 0)
      ? { label: layout.labelLateDeduction || 'Late Deduction', amount: employee.lateDeduction }
      : null,
    (layout.showLopAmount !== false && employee.lopAmount && employee.lopAmount > 0)
      ? { label: layout.labelLopAmount || 'Loss of Pay (LOP) Deduction', amount: employee.lopAmount }
      : null,
    layout.showOtherDeductions !== false ? { label: layout.labelOtherDeductions || 'Other Deductions', amount: employee.otherDeductions || 0 } : null,
  ].filter(Boolean) as { label: string; amount: number }[];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className={`border rounded-2xl max-w-4xl w-full my-8 shadow-2xl flex flex-col max-h-[92vh] transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Modal Top Bar */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-[#222222]' : 'border-[#E4E4E7]'}`}>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#CB1417]" />
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              Payslip Preview: {employee.employeeId} - {employee.name}
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded bg-[#CB1417]/10 text-[#CB1417] border border-[#CB1417]/25 font-semibold">
              TBT A4 Specification
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark
                  ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2A2A2E]'
                  : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-semibold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isDark ? 'text-[#A1A1AA] hover:text-white hover:bg-[#18181B]' : 'text-[#71717A] hover:text-black hover:bg-[#F4F4F6]'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Document Sheet: ALWAYS white with black text and TBT #CB1417 accents */}
        <div className={`p-6 overflow-y-auto flex justify-center ${isDark ? 'bg-[#000000]' : 'bg-[#F4F4F6]'}`}>
          <div className="bg-[#FFFFFF] text-[#000000] rounded-md shadow-2xl w-full max-w-2xl p-8 border border-[#E5E5E8] text-xs font-sans select-text">
            {/* Payslip Header */}
            <div className="flex items-start justify-between pb-4 border-b-2 border-[#000000]">
              <div className="flex items-start space-x-4">
                {layout.showLogo && settings.logoDataUrl ? (
                  <img
                    src={settings.logoDataUrl}
                    alt="Company Logo"
                    className="w-16 h-16 object-contain rounded border border-[#E5E5E8] p-1"
                  />
                ) : layout.showLogo ? (
                  <div className="w-14 h-14 rounded bg-[#CB1417] text-white flex items-center justify-center font-bold text-lg">
                    {settings.companyName.charAt(0) || 'T'}
                  </div>
                ) : null}
                <div>
                  <h1 className="text-lg font-bold text-[#000000] tracking-tight leading-snug">
                    {settings.companyName}
                  </h1>
                  <p className="text-[11px] text-[#52525B]">
                    {[settings.addressLine1, settings.addressLine2, settings.cityStateZip].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-[10px] text-[#71717A] mt-0.5">
                    {[settings.email ? `Email: ${settings.email}` : '', settings.phone ? `Phone: ${settings.phone}` : ''].filter(Boolean).join(' | ')}
                  </p>
                  {layout.showTaxId && settings.taxRegistrationNumber && (
                    <p className="text-[10px] text-[#71717A] font-mono">
                      Tax/Registration ID: {settings.taxRegistrationNumber}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#CB1417] block">
                  Official Payslip
                </span>
                <span className="text-xs font-bold text-[#000000] block mt-0.5">
                  {month.toUpperCase()} {year}
                </span>
                <span className="text-[10px] text-[#CB1417] bg-[#CB1417]/10 px-2 py-0.5 rounded font-semibold inline-block mt-1">
                  Confidential
                </span>
              </div>
            </div>

            {/* Employee Information Table */}
            <div className="my-5 bg-[#FAFAFC] rounded border border-[#E5E5E8] p-3">
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                {allEmpFields.map((field, idx) => (
                  <div key={idx} className="flex justify-between border-b border-[#E5E5E8] pb-1 truncate">
                    <span className="text-[#71717A] font-medium shrink-0 mr-2">{field.label}:</span>
                    <span className="font-mono font-bold text-[#000000] truncate text-right" title={field.val}>{field.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dual Earnings vs Deductions Table */}
            <div className="grid grid-cols-2 gap-4 my-5">
              {/* Earnings Column */}
              <div className="border border-[#E5E5E8] rounded overflow-hidden">
                <div className="bg-[#CB1417] text-white px-3 py-2 flex justify-between font-bold text-[11px]">
                  <span>{layout.labelEarnings || 'EARNINGS'}</span>
                  <span>AMOUNT</span>
                </div>
                <div className="divide-y divide-[#F4F4F6] text-xs">
                  {earningsList.map((earn, i) => (
                    <div key={i} className="px-3 py-2 flex justify-between hover:bg-[#FAFAFC]">
                      <span className="text-[#52525B]">{earn.label}</span>
                      <span className="font-mono font-medium text-[#000000] tabular-nums">
                        {showSymbol ? `${settings.currencySymbol} ` : ''}{earn.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-[#F8F8FA] px-3 py-2.5 border-t-2 border-[#000000] flex justify-between font-bold text-[#000000]">
                  <span>TOTAL GROSS</span>
                  <span className="font-mono text-[#000000] tabular-nums">
                    {showSymbol ? `${settings.currencySymbol} ` : ''}{employee.calculatedGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Deductions Column */}
              <div className="border border-[#E5E5E8] rounded overflow-hidden">
                <div className="bg-[#18181B] text-white px-3 py-2 flex justify-between font-bold text-[11px]">
                  <span>{layout.labelDeductions || 'DEDUCTIONS'}</span>
                  <span>AMOUNT</span>
                </div>
                <div className="divide-y divide-[#F4F4F6] text-xs">
                  {deductionsList.map((ded, i) => (
                    <div key={i} className="px-3 py-2 flex justify-between hover:bg-[#FAFAFC]">
                      <span className="text-[#52525B]">{ded.label}</span>
                      <span className="font-mono font-medium text-[#ED1F24] tabular-nums">
                        {showSymbol ? `${settings.currencySymbol} ` : ''}{ded.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-[#F8F8FA] px-3 py-2.5 border-t-2 border-[#000000] flex justify-between font-bold text-[#000000]">
                  <span>TOTAL DEDUCTIONS</span>
                  <span className="font-mono text-[#ED1F24] tabular-nums">
                    {showSymbol ? `${settings.currencySymbol} ` : ''}{employee.calculatedDeductions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Salary Payable Banner */}
            <div className="my-5 p-4 bg-[#FFFFFF] border-2 border-[#CB1417] rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#CB1417] uppercase tracking-wider block">
                  {layout.labelNetSalary || 'Net Salary Payable'}
                </span>
                <span className="text-xs italic text-[#52525B] mt-1 block">
                  Amount in Words: {netWords}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-[#CB1417] font-mono tabular-nums">
                  {showSymbol ? `${settings.currencySymbol} ` : ''}{employee.calculatedNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Note */}
            {layout.showFooterNote && settings.payslipNote && (
              <p className="text-[10px] text-zinc-500 italic mb-4">
                Note: {settings.payslipNote}
              </p>
            )}

            {/* Signatures & Footer */}
            {layout.showSignatures && (
              <div className="mt-10 pt-6 border-t border-[#E5E5E8] flex items-end justify-between">
                <div>
                  <div className="w-36 border-b border-[#000000] mb-1" />
                  <span className="text-[10px] text-[#71717A] font-medium">Employee Signature</span>
                </div>

                <div className="text-right">
                  {settings.signatureDataUrl && (
                    <img
                      src={settings.signatureDataUrl}
                      alt="Authorized Signature"
                      className="h-10 object-contain ml-auto mb-1"
                    />
                  )}
                  <div className="w-44 border-b border-[#000000] mb-1 ml-auto" />
                  <span className="text-[10px] text-[#71717A] font-medium block">
                    {settings.authorizedSignatoryTitle || 'Authorized Signatory'}
                  </span>
                  {settings.authorizedSignatoryName && (
                    <span className="text-[10px] font-bold text-[#000000] block">
                      {settings.authorizedSignatoryName}
                    </span>
                  )}
                </div>
              </div>
            )}

            <p className="mt-6 text-[9px] text-[#A1A1AA] text-center">
              This document was generated securely by PeopleDesk Studio for Tamil Business Tribe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
