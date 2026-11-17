import React, { useEffect, useState } from 'react';
import {
  FileText,
  Download,
  Send,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  User,
  Eye,
  CloudUpload,
  Users
} from 'lucide-react';
import {
  CompanySettings,
  EmployeeRecord,
  PayslipLayoutSettings,
  GeneratedPayslipRecord
} from '../types/payroll';
import { DirectoryEmployee } from '../types/employeeDirectory';
import { generatePayslipPdf, getSafeFileName } from '../utils/pdfGenerator';
import { calculateSalary } from '../utils/salaryCalculator';
import { localDB } from '../utils/dbStorage';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';
import { subscribeGoogleSession } from '../utils/googleAuthClient';
import { getDaysInMonth } from '../utils/dateUtils';

interface ManualPayslipViewProps {
  settings: CompanySettings;
  layoutSettings: PayslipLayoutSettings;
  directoryEmployees?: DirectoryEmployee[];
  onAddDirectoryEmployee?: (emp: DirectoryEmployee) => Promise<void> | void;
  onPreviewPayslip?: (record: EmployeeRecord) => void;
  onRecordGenerated: (record: GeneratedPayslipRecord) => void;
  showToast: (msg: string) => void;
}

export const ManualPayslipView: React.FC<ManualPayslipViewProps> = ({
  settings,
  layoutSettings,
  directoryEmployees = [],
  onAddDirectoryEmployee,
  onPreviewPayslip,
  onRecordGenerated,
  showToast
}) => {
  const { isDark } = useTheme();
  const sym = settings.currencySymbol || '$';

  // Employee details
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string>('');
  const [saveToDirectory, setSaveToDirectory] = useState<boolean>(false);
  const [employeeId, setEmployeeId] = useState('EMP-MANUAL-01');
  const [employeeName, setEmployeeName] = useState('Jane Doe');
  const [employeeEmail, setEmployeeEmail] = useState('jane.doe@company.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [department, setDepartment] = useState('Human Resources');
  const [designation, setDesignation] = useState('HR Specialist');
  const [joiningDate, setJoiningDate] = useState('2024-01-15');
  const [paymentDate, setPaymentDate] = useState('2026-10-31');
  const [pan, setPan] = useState('ABCDE1234F');
  const [uan, setUan] = useState('100987654321');
  const [pfNumber, setPfNumber] = useState('MH/BAN/0012345/000/000102');
  const [esiNumber, setEsiNumber] = useState('3100123456789');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [bankAccount, setBankAccount] = useState('987654321098');
  const [ifscCode, setIfscCode] = useState('HDFC0000240');
  const [branchName, setBranchName] = useState('Indiranagar Main');
  const [accountHolderName, setAccountHolderName] = useState('Jane Doe');

  // Payroll Period & Attendance
  const [month, setMonth] = useState('October');
  const [year, setYear] = useState<number>(2026);
  const [totalWorkingDays, setTotalWorkingDays] = useState<number>(22);
  const [paidDays, setPaidDays] = useState<number>(31);
  const [lopDays, setLopDays] = useState<number>(0);
  const [lopDeduction, setLopDeduction] = useState<number>(0);
  const [autoProrateLop, setAutoProrateLop] = useState<boolean>(true);

  // Earnings Breakdown & CTC (Gross = CTC - Employer PF - Employer ESI)
  const [autoCtcFromComponents, setAutoCtcFromComponents] = useState<boolean>(true);
  const [basic, setBasic] = useState<number>(30000);
  const [hra, setHra] = useState<number>(15000);
  const [specialAllowance, setSpecialAllowance] = useState<number>(12000);
  const [otherAllowances, setOtherAllowances] = useState<number>(8000);
  const [manualCtc, setManualCtc] = useState<number>(65000);
  const [employerPf, setEmployerPf] = useState<number>(3500);
  const [employerEsi, setEmployerEsi] = useState<number>(500);

  // Statutory & Voluntary Deductions
  const [employeePf, setEmployeePf] = useState<number>(3500);
  const [employeeEsi, setEmployeeEsi] = useState<number>(0);
  const [professionalTax, setProfessionalTax] = useState<number>(200);
  const [tds, setTds] = useState<number>(2500);
  const [loanDeduction, setLoanDeduction] = useState<number>(0);
  const [lateDeduction, setLateDeduction] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);

  // Custom adjustments
  const [adjustments, setAdjustments] = useState<Array<{ id: string; type: 'earning' | 'deduction'; label: string; amount: number }>>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newType, setNewType] = useState<'earning' | 'deduction'>('earning');

  // Action & Feedback states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ success: boolean; text: string } | null>(null);
  const [lastGeneratedPdf, setLastGeneratedPdf] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  // Delivery provider state
  const [emailStatus, setEmailStatus] = useState<{
    smtpConfigured: boolean;
    smtpVerified: boolean;
    gmailConnected: boolean;
    gmailEmail?: string | null;
  }>({ smtpConfigured: false, smtpVerified: false, gmailConnected: false });
  const [emailProvider, setEmailProvider] = useState<'smtp' | 'gmail'>('smtp');

  useEffect(() => {
    const refreshEmailStatus = () => {
      apiClient
        .request('/email/status')
        .then((res) => {
          if (res.success) {
            const next = {
              smtpConfigured: Boolean(res.smtpConfigured),
              smtpVerified: Boolean(res.smtpVerified),
              gmailConnected: Boolean(res.gmailConnected),
              gmailEmail: res.gmailEmail || null,
            };
            setEmailStatus(next);
            if (!next.smtpVerified && next.gmailConnected) {
              setEmailProvider('gmail');
            }
          }
        })
        .catch(() => {});
    };

    refreshEmailStatus();
    const unsub = subscribeGoogleSession(refreshEmailStatus);
    return () => unsub();
  }, []);

  const componentsSum4 = Math.max(0, Math.round((basic + hra + specialAllowance + otherAllowances) * 100) / 100);
  const ctc = autoCtcFromComponents ? componentsSum4 : manualCtc;

  // Auto-calculate LOP deduction when lopDays changes if autoProrateLop is checked
  const handleLopDaysChange = (days: number) => {
    const clean = Math.max(0, days);
    setLopDays(clean);
    const monthDays = getDaysInMonth(year, month) || 30;
    setPaidDays(Math.max(0, monthDays - clean));
    if (autoProrateLop) {
      const baseGross = Math.max(0, ctc - employerPf - employerEsi);
      setLopDeduction(Math.round((baseGross / monthDays) * clean));
    }
  };

  const handleSelectDirectoryEmployee = (dirId: string) => {
    setSelectedDirectoryId(dirId);
    const emp = directoryEmployees.find((e) => e.id === dirId || e.employeeId === dirId);
    if (!emp) return;

    setEmployeeId(emp.employeeId);
    setEmployeeName(emp.legalName);
    setEmployeeEmail(emp.workEmail || emp.personalEmail || '');
    setPhone(emp.primaryPhone || '');
    setDepartment(emp.department || '');
    setDesignation(emp.designation || '');
    setJoiningDate(emp.joiningDate || '');
    setPan(emp.panNumber || '');
    setUan(emp.uanNumber || '');
    setPfNumber(emp.pfNumber || '');
    setEsiNumber(emp.esiNumber || emp.esicNumber || '');
    setBankName(emp.bankName || '');
    setBankAccount(emp.accountNumber || '');
    setIfscCode(emp.ifscCode || '');
    setBranchName(emp.branchName || '');
    setAccountHolderName(emp.accountHolderName || emp.legalName || '');

    const dirBasic = emp.standardBasic || 0;
    const dirHra = emp.standardHra || 0;
    const dirOther = emp.standardAllowances || 0;
    const dirErEsi = emp.standardEmployerEsi || 0;
    setEmployerEsi(dirErEsi);

    if (dirBasic > 0 || dirHra > 0 || dirOther > 0) {
      setBasic(dirBasic);
      setHra(dirHra);
      const remainder = emp.standardCtc ? Math.max(0, emp.standardCtc - (dirBasic + dirHra + dirOther)) : 0;
      setSpecialAllowance(remainder);
      setOtherAllowances(dirOther);
      const totalCtc = emp.standardCtc && emp.standardCtc > 0 ? emp.standardCtc : (dirBasic + dirHra + dirOther);
      setManualCtc(totalCtc);
      setAutoCtcFromComponents(totalCtc === dirBasic + dirHra + remainder + dirOther);
    } else if (emp.standardCtc && emp.standardCtc > 0) {
      setManualCtc(emp.standardCtc);
      const estBasic = Math.round(emp.standardCtc * 0.5);
      const estHra = Math.round(emp.standardCtc * 0.25);
      setBasic(estBasic);
      setHra(estHra);
      setSpecialAllowance(Math.max(0, emp.standardCtc - estBasic - estHra));
      setOtherAllowances(0);
      setAutoCtcFromComponents(true);
    }
    showToast(`Prefilled details from directory for ${emp.legalName}.`);
  };

  // Authoritative Payroll Calculation via calculateSalary + custom adjustments
  const customEarnings = adjustments.filter((a) => a.type === 'earning').map((a) => ({ label: a.label, amount: Number(a.amount) }));
  const customDeductions = adjustments.filter((a) => a.type === 'deduction').map((a) => ({ label: a.label, amount: Number(a.amount) }));
  const additionalEarningsSum = customEarnings.reduce((sum, a) => sum + a.amount, 0);
  const additionalDeductionsSum = customDeductions.reduce((sum, a) => sum + a.amount, 0);

  const calc = calculateSalary({
    ctc,
    basic,
    hra,
    specialAllowance,
    otherAllowances,
    employerPf,
    employerEsi,
    employeePf,
    employeeEsi,
    professionalTax,
    tds,
    loan: loanDeduction,
    lateDeduction,
    otherDeductions,
    lopDeduction,
  });

  const baseEarnings = Math.max(0, calc.calculatedGross);
  const totalEarnings = Math.max(0, Math.round((baseEarnings + additionalEarningsSum) * 100) / 100);
  const totalDeductions = Math.round((calc.calculatedDeductions + additionalDeductionsSum) * 100) / 100;
  const netSalary = Math.round((totalEarnings - totalDeductions) * 100) / 100;

  const handleAddAdjustment = () => {
    setErrorMsg(null);
    if (!newLabel.trim() || !newAmount || newAmount <= 0) {
      setErrorMsg('Enter both an adjustment label and a positive amount.');
      return;
    }
    setAdjustments([
      ...adjustments,
      {
        id: `adj_${Date.now()}`,
        type: newType,
        label: newLabel.trim(),
        amount: Math.abs(newAmount),
      },
    ]);
    setNewLabel('');
    setNewAmount(0);
  };

  const handleRemoveAdjustment = (id: string) => {
    setAdjustments(adjustments.filter((a) => a.id !== id));
  };

  const buildEmployeeRecord = (): EmployeeRecord => {
    return {
      id: `manual_${employeeId}_${Date.now()}`,
      employeeId: employeeId.trim(),
      name: employeeName.trim(),
      email: employeeEmail.trim(),
      phone: phone.trim(),
      department: department.trim(),
      designation: designation.trim(),
      joiningDate,
      paymentDate,
      pan: pan.trim(),
      uan: uan.trim(),
      pfNumber: pfNumber.trim(),
      esiNumber: esiNumber.trim(),
      bankName: bankName.trim(),
      bankAccount: bankAccount.trim(),
      ifscCode: ifscCode.trim(),
      branchName: branchName.trim(),
      accountHolderName: (accountHolderName || employeeName).trim(),
      ctc,
      basic,
      hra,
      specialAllowance,
      otherAllowances,
      calculatedGross: totalEarnings,
      employerPf,
      employerEsi,
      pf: employeePf,
      employeePf,
      esi: employeeEsi,
      professionalTax,
      tds,
      loan: loanDeduction,
      lateDeduction,
      otherDeductions,
      totalWorkingDays,
      paidDays,
      lopDays,
      unpaidDays: lopDays,
      lopDeduction,
      lopAmount: lopDeduction,
      customEarnings,
      customDeductions,
      calculatedDeductions: totalDeductions,
      calculatedNet: netSalary,
      isValid: true,
      issues: [],
    };
  };

  const maybeSyncToDirectory = async () => {
    if (!saveToDirectory || !onAddDirectoryEmployee || !employeeId.trim() || !employeeName.trim()) return;
    const now = new Date().toISOString();
    const newDirEmp: DirectoryEmployee = {
      id: selectedDirectoryId || `dir_${employeeId.trim()}_${Date.now()}`,
      employeeId: employeeId.trim(),
      createdAt: now,
      updatedAt: now,
      legalName: employeeName.trim(),
      workEmail: employeeEmail.trim(),
      primaryPhone: phone.trim(),
      currentAddress: '',
      permanentAddress: '',
      emergencyContactName: '',
      emergencyContactRelationship: '',
      emergencyContactPhone: '',
      joiningDate: joiningDate || now.slice(0, 10),
      employmentType: 'Full-Time',
      employmentStatus: 'Active',
      department: department.trim() || 'General',
      designation: designation.trim() || 'Staff',
      workLocation: 'Head Office',
      probationStatus: 'Confirmed',
      qualifications: [],
      panNumber: pan.trim(),
      uanNumber: uan.trim(),
      pfNumber: pfNumber.trim(),
      esiNumber: esiNumber.trim(),
      esicNumber: esiNumber.trim(),
      bankName: bankName.trim(),
      accountNumber: bankAccount.trim(),
      ifscCode: ifscCode.trim(),
      branchName: branchName.trim(),
      accountHolderName: (accountHolderName || employeeName).trim(),
      standardCtc: ctc,
      standardBasic: basic,
      standardHra: hra,
      standardAllowances: otherAllowances,
      standardEmployerEsi: employerEsi,
    };
    await onAddDirectoryEmployee(newDirEmp);
  };

  const handlePreview = () => {
    setErrorMsg(null);
    if (!employeeId.trim() || !employeeName.trim()) {
      setErrorMsg('Employee ID and Full Legal Name are required before previewing.');
      return;
    }
    const record = buildEmployeeRecord();
    if (onPreviewPayslip) {
      onPreviewPayslip(record);
    }
  };

  const generateAndRecordLocally = async (downloadImmediately: boolean) => {
    if (!employeeId.trim() || !employeeName.trim()) {
      setErrorMsg('Please fill in Employee ID and Full Legal Name.');
      return null;
    }

    const record = buildEmployeeRecord();
    const doc = generatePayslipPdf(record, settings, month, year, layoutSettings);
    const fileName = getSafeFileName(record, month, year);
    const pdfDataUri = doc.output('datauristring');

    if (downloadImmediately) {
      doc.save(fileName);
    }

    setLastGeneratedPdf(pdfDataUri);
    setLastFileName(fileName);

    await maybeSyncToDirectory();

    const historyRecord: GeneratedPayslipRecord = {
      id: `manual_${employeeId.trim()}_${month}_${year}`.toLowerCase(),
      employeeId: employeeId.trim(),
      employeeName: employeeName.trim(),
      department: department.trim() || 'General',
      designation: designation.trim() || 'Staff',
      month,
      year,
      grossEarnings: totalEarnings,
      totalDeductions,
      netSalary,
      generatedAt: new Date().toISOString(),
      fileName,
      pdfDataUri,
      generationMethod: 'Manual Entry',
    };

    await localDB.saveGeneratedRecord(historyRecord);
    onRecordGenerated(historyRecord);
    return { record, fileName, pdfDataUri, historyRecord };
  };

  const handleGeneratePdf = async () => {
    setErrorMsg(null);
    setStatusBanner(null);
    setIsGenerating(true);
    try {
      const result = await generateAndRecordLocally(false);
      if (result) {
        showToast(`Generated manual payslip for ${result.record.name}.`);
        setStatusBanner({ success: true, text: `Generated "${result.fileName}" (${sym}${netSalary.toLocaleString()}). Ready to download, archive to Drive, or email.` });
      }
    } catch (err: any) {
      setErrorMsg(`Failed to generate payslip PDF: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    setErrorMsg(null);
    if (!lastGeneratedPdf || !lastFileName) {
      setIsGenerating(true);
      try {
        const res = await generateAndRecordLocally(true);
        if (res) showToast(`Downloaded "${res.fileName}".`);
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setIsGenerating(false);
      }
      return;
    }
    const a = document.createElement('a');
    a.href = lastGeneratedPdf;
    a.download = lastFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloaded manual payslip PDF.');
  };

  const handleSaveToDrive = async () => {
    setErrorMsg(null);
    setStatusBanner(null);
    setIsSavingDrive(true);
    try {
      const result = await generateAndRecordLocally(false);
      if (!result) return;

      const res = await apiClient.request('/payroll/save-payslip-pdf', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: result.record.employeeId,
          employeeName: result.record.name,
          department: result.record.department,
          designation: result.record.designation,
          month,
          year,
          grossEarnings: totalEarnings,
          totalDeductions,
          netSalary,
          pdfBase64: result.pdfDataUri,
          fileName: result.fileName,
          generationMethod: 'Manual Entry',
        }),
      });

      const updatedHist: GeneratedPayslipRecord = {
        ...result.historyRecord,
        driveFileId: res.driveFileId || undefined,
      };
      await localDB.saveGeneratedRecord(updatedHist);
      onRecordGenerated(updatedHist);

      setStatusBanner({
        success: true,
        text: res.driveFileId
          ? `Archived "${result.fileName}" directly to Google Drive.`
          : `Archived "${result.fileName}" to your linked Google Drive workspace.`,
      });
    } catch (err: any) {
      setStatusBanner({
        success: false,
        text: err.message || 'Sign in with Google in Company Settings -> Google Account Connection to save PDFs to Google Drive.',
      });
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleSendDirectEmail = async () => {
    setErrorMsg(null);
    setStatusBanner(null);
    if (!employeeEmail.trim() || !employeeEmail.includes('@')) {
      setErrorMsg('Enter a valid single recipient email address to send this payslip.');
      return;
    }

    setIsSendingEmail(true);
    try {
      const result = await generateAndRecordLocally(false);
      if (!result) return;

      const res = await apiClient.request('/email/send', {
        method: 'POST',
        body: JSON.stringify({
          provider: emailProvider,
          payslipId: result.historyRecord.id,
          recipientEmail: employeeEmail.trim(),
          recipientName: employeeName.trim(),
          employeeId: employeeId.trim(),
          subject: `Payslip for ${month} ${year} - ${employeeName.trim()}`,
          bodyText: `Dear ${employeeName.trim()},\n\nPlease find attached your official payslip for ${month} ${year}.\n\nNet Salary Payable: ${sym}${netSalary.toLocaleString()}\n\nBest regards,\nHR Department\n${settings.companyName}`,
          attachmentName: result.fileName,
          pdfBase64: result.pdfDataUri,
        }),
      });

      if (res.success) {
        const updatedHist: GeneratedPayslipRecord = {
          ...result.historyRecord,
          emailStatus: 'Sent',
        };
        await localDB.saveGeneratedRecord(updatedHist);
        onRecordGenerated(updatedHist);
        setStatusBanner({
          success: true,
          text: res.message || `Sent payslip to ${employeeEmail.trim()} via ${emailProvider === 'gmail' ? 'HR Gmail API' : 'Company SMTP'}.`,
        });
      } else {
        setStatusBanner({ success: false, text: res.error || 'Failed to send payslip email.' });
      }
    } catch (err: any) {
      setStatusBanner({ success: false, text: err.message || 'Failed to dispatch payslip email.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const canSendGmail = emailStatus.gmailConnected;
  const canSendSmtp = emailStatus.smtpConfigured && emailStatus.smtpVerified;
  const emailSendReady = emailProvider === 'gmail' ? canSendGmail : canSendSmtp;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'} shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#CB1417]/10 border border-[#CB1417]/30 flex items-center justify-center text-[#CB1417] font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Manual Payslip Entry</h1>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Create independent ad-hoc payslips with live CTC calculation, layout parity preview, Google Drive archiving, and direct email dispatch.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onPreviewPayslip && (
            <button
              type="button"
              onClick={handlePreview}
              className={`px-3.5 py-2.5 rounded-xl font-semibold text-xs border transition cursor-pointer flex items-center space-x-1.5 ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              <Eye className="w-4 h-4 text-[#CB1417]" />
              <span>Preview Payslip</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGenerating}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-[#CB1417] hover:bg-[#ED1F24] text-white shadow-md shadow-[#CB1417]/25 transition cursor-pointer flex items-center space-x-2"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span>Generate PDF Payslip</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGenerating}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2.5 ${
          isDark ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
        }`}>
          <AlertTriangle className="w-4 h-4 text-[#ED1F24] shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {statusBanner && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2.5 ${
          statusBanner.success
            ? isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
            : isDark ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
        }`}>
          {statusBanner.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-[#ED1F24] shrink-0" />}
          <span>{statusBanner.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Employee Directory Selector & Identity */}
          <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-[#222222] border-[#E4E4E7] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#CB1417] flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Employee Details & Period</span>
              </h3>

              {directoryEmployees.length > 0 && (
                <div className="flex items-center space-x-2 text-xs">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <select
                    value={selectedDirectoryId}
                    onChange={(e) => handleSelectDirectoryEmployee(e.target.value)}
                    aria-label="Prefill from Employee Directory"
                    className={`rounded-lg px-2.5 py-1 border text-xs ${
                      isDark ? 'bg-black border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-black'
                    }`}
                  >
                    <option value="">Prefill from Directory ({directoryEmployees.length})...</option>
                    {directoryEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeId} — {emp.legalName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Employee ID *</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Work Email</label>
                <input
                  type="email"
                  value={employeeEmail}
                  onChange={(e) => setEmployeeEmail(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Payroll Period</label>
                <div className="flex space-x-2">
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    aria-label="Payroll month"
                    className={`flex-1 rounded-xl px-2.5 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value) || 2026)}
                    aria-label="Payroll year"
                    className={`w-20 rounded-xl px-2.5 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Joining Date</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>

            {onAddDirectoryEmployee && (
              <label className="inline-flex items-center space-x-2 text-xs cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={saveToDirectory}
                  onChange={(e) => setSaveToDirectory(e.target.checked)}
                  className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                />
                <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                  Also save / update this staff member in Employee Database Directory
                </span>
              </label>
            )}
          </div>

          {/* Bank & Statutory Details (Section B - All 9 Fields) */}
          <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#CB1417]">
              Bank & Statutory Identifiers (Section B)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Bank Account No</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono uppercase ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Branch Name</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">PAN Number</label>
                <input
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono uppercase ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">UAN Number</label>
                <input
                  type="text"
                  value={uan}
                  onChange={(e) => setUan(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">PF Number</label>
                <input
                  type="text"
                  value={pfNumber}
                  onChange={(e) => setPfNumber(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">ESI Number</label>
                <input
                  type="text"
                  value={esiNumber}
                  onChange={(e) => setEsiNumber(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>
          </div>

          {/* Attendance & LOP */}
          <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#CB1417]">
                Attendance & Loss of Pay (LOP)
              </h3>
              <label className="inline-flex items-center space-x-1.5 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoProrateLop}
                  onChange={(e) => setAutoProrateLop(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
                />
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Auto-prorate LOP amount</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Total Working Days</label>
                <input
                  type="number"
                  value={totalWorkingDays}
                  onChange={(e) => setTotalWorkingDays(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Paid Days</label>
                <input
                  type="number"
                  value={paidDays}
                  onChange={(e) => setPaidDays(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">LOP Days</label>
                <input
                  type="number"
                  value={lopDays}
                  onChange={(e) => handleLopDaysChange(Number(e.target.value) || 0)}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">LOP Deduction ({sym})</label>
                <input
                  type="number"
                  value={lopDeduction}
                  onChange={(e) => setLopDeduction(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>
          </div>

          {/* Salary & Statutory Inputs */}
          <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center space-x-2">
                <Calculator className="w-4 h-4" />
                <span>CTC, Earnings Breakdown & Statutory Deductions</span>
              </h3>
              <label className="inline-flex items-center space-x-1.5 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCtcFromComponents}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoCtcFromComponents(checked);
                    if (!checked) setManualCtc(componentsSum4);
                  }}
                  className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
                />
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                  Auto-sum CTC from Earnings Components
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Basic Salary ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={basic}
                  onChange={(e) => setBasic(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">HRA ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={hra}
                  onChange={(e) => setHra(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Special Allowance ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={specialAllowance}
                  onChange={(e) => setSpecialAllowance(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Other Allowances ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={otherAllowances}
                  onChange={(e) => setOtherAllowances(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
              <div>
                <label className="font-semibold block mb-1">
                  Monthly CTC ({sym}) {autoCtcFromComponents && <span className="text-[10px] text-zinc-500 font-normal">(Auto-sum)</span>}
                </label>
                <input
                  type="number"
                  min={0}
                  value={ctc}
                  disabled={autoCtcFromComponents}
                  onChange={(e) => setManualCtc(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono font-bold ${
                    autoCtcFromComponents
                      ? isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-300 text-zinc-700'
                      : isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'
                  }`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Employer PF ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={employerPf}
                  onChange={(e) => setEmployerPf(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono text-[#CB1417] ${isDark ? 'bg-black border-zinc-800' : 'bg-white border-zinc-300'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Employer ESI ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={employerEsi}
                  onChange={(e) => setEmployerEsi(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono text-[#CB1417] ${isDark ? 'bg-black border-zinc-800' : 'bg-white border-zinc-300'}`}
                />
              </div>
            </div>

            {calc.ctcMismatch && (
              <div className={`p-3 rounded-xl border text-[11px] flex items-center space-x-2 ${
                isDark ? 'bg-amber-950/30 border-amber-800/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  CTC mismatch warning: Entered CTC ({sym}{ctc.toLocaleString()}) differs from Basic + HRA + Special + Other ({sym}{componentsSum4.toLocaleString()}). Values are preserved without mutation.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 text-xs pt-3 border-t dark:border-zinc-800 border-zinc-200">
              <div>
                <label className="font-semibold block mb-1">Employee PF ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={employeePf}
                  onChange={(e) => setEmployeePf(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Employee ESI ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={employeeEsi}
                  onChange={(e) => setEmployeeEsi(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Professional Tax ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={professionalTax}
                  onChange={(e) => setProfessionalTax(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">TDS / Income Tax ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={tds}
                  onChange={(e) => setTds(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Staff Loan / Advance ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={loanDeduction}
                  onChange={(e) => setLoanDeduction(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Late Deduction ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={lateDeduction}
                  onChange={(e) => setLateDeduction(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Other Deductions ({sym})</label>
                <input
                  type="number"
                  min={0}
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>
          </div>

          {/* Custom Additions / Deductions */}
          <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500">
              Custom Earnings & Deductions
            </h3>

            {adjustments.length > 0 && (
              <div className="space-y-2">
                {adjustments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-xl border dark:border-zinc-800 border-zinc-200 text-xs">
                    <span className="font-semibold">{a.label}</span>
                    <div className="flex items-center space-x-3">
                      <span className={`font-mono font-bold ${a.type === 'earning' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {a.type === 'earning' ? '+ ' : '− '}
                        {sym}
                        {a.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdjustment(a.id)}
                        aria-label={`Remove ${a.label}`}
                        className="text-red-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 text-xs">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                aria-label="Adjustment type"
                className={`rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              >
                <option value="earning">Earning (+)</option>
                <option value="deduction">Deduction (−)</option>
              </select>

              <input
                type="text"
                placeholder="Description (e.g. Performance Bonus)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className={`flex-1 rounded-xl px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              />

              <input
                type="number"
                placeholder={`Amount (${sym})`}
                value={newAmount || ''}
                onChange={(e) => setNewAmount(Number(e.target.value) || 0)}
                className={`w-full sm:w-32 rounded-xl px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              />

              <button
                type="button"
                onClick={handleAddAdjustment}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer inline-flex items-center justify-center space-x-1 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Live Summary & Cloud / Email Actions */}
        <div className="space-y-6">
          <div className={`p-6 rounded-2xl border space-y-5 ${isDark ? 'bg-[#0D0D0E] border-[#CB1417]/30' : 'bg-white border-[#CB1417]/30'} shadow-md`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#CB1417] flex items-center space-x-2">
              <Calculator className="w-4 h-4" />
              <span>Live Calculation Summary</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b dark:border-zinc-800 border-zinc-200">
                <span className="text-zinc-500">Monthly CTC:</span>
                <span className="font-mono font-semibold tabular-nums">{sym}{ctc.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-zinc-800 border-zinc-200">
                <span className="text-zinc-500">Employer PF + ESI (Excluded):</span>
                <span className="font-mono text-zinc-400 tabular-nums">− {sym}{(employerPf + employerEsi).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-zinc-800 border-zinc-200">
                <span className="text-zinc-500">Total Gross Earnings:</span>
                <span className="font-mono font-bold text-emerald-500 tabular-nums">{sym}{totalEarnings.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b dark:border-zinc-800 border-zinc-200">
                <span className="text-zinc-500">Total Deductions:</span>
                <span className="font-mono font-bold text-[#ED1F24] tabular-nums">{sym}{totalDeductions.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-3 rounded-xl px-3 bg-[#CB1417]/10 border border-[#CB1417]/30 text-[#CB1417]">
                <span className="font-bold">Net Salary Payable:</span>
                <span className="font-mono font-black text-sm tabular-nums">{sym}{netSalary.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGeneratePdf}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-[#CB1417] hover:bg-[#ED1F24] text-white shadow-md shadow-[#CB1417]/25 transition cursor-pointer flex items-center justify-center space-x-2"
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>Generate PDF Payslip</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Payslip</span>
              </button>

              <button
                type="button"
                disabled={isSavingDrive}
                onClick={handleSaveToDrive}
                className={`w-full py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer flex items-center justify-center space-x-2 ${
                  isDark ? 'bg-[#18181B] hover:bg-[#27272A] border-[#27272A] text-white' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-300 text-black'
                }`}
              >
                {isSavingDrive ? <RefreshCw className="w-4 h-4 animate-spin text-[#CB1417]" /> : <CloudUpload className="w-4 h-4 text-[#CB1417]" />}
                <span>{isSavingDrive ? 'Archiving to Drive...' : 'Save to Google Drive'}</span>
              </button>
            </div>

            {/* Direct Email Box */}
            <div className="pt-4 border-t dark:border-zinc-800 border-zinc-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold">Direct Email Delivery</span>
                <span className={`text-[10px] font-semibold ${emailSendReady ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {emailSendReady ? 'Ready' : 'Needs Setup'}
                </span>
              </div>

              <select
                value={emailProvider}
                onChange={(e) => setEmailProvider(e.target.value as 'smtp' | 'gmail')}
                aria-label="Direct email delivery provider"
                className={`w-full rounded-xl px-3 py-2 border text-xs ${
                  isDark ? 'bg-black border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-black'
                }`}
              >
                <option value="smtp">
                  Company SMTP {canSendSmtp ? '(Verified)' : '(Unverified)'}
                </option>
                <option value="gmail">
                  HR Gmail API {canSendGmail ? `(${emailStatus.gmailEmail || 'Connected'})` : '(Not Connected)'}
                </option>
              </select>

              <button
                type="button"
                disabled={isSendingEmail || !emailSendReady}
                onClick={handleSendDirectEmail}
                title={!emailSendReady ? 'Configure selected email provider in Company Settings first.' : 'Send this payslip directly'}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed text-white transition cursor-pointer flex items-center justify-center space-x-2"
              >
                {isSendingEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isSendingEmail ? 'Sending Email...' : 'Send Payslip by Email'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
