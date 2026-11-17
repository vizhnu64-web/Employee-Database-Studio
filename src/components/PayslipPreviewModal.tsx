import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Printer,
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, GeneratedPayslipRecord, PayslipLayoutSettings, DEFAULT_LAYOUT_SETTINGS } from '../types/payroll';
import { numberToWords } from '../utils/numberToWords';
import { generatePayslipPdf, getSafeFileName } from '../utils/pdfGenerator';
import { resolvePayslipSectionsData } from '../utils/payslipFieldRegistry';
import { localDB } from '../utils/dbStorage';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';

interface PayslipPreviewModalProps {
  employee: EmployeeRecord | null;
  settings: CompanySettings;
  month: string;
  year: number;
  onClose: () => void;
  onSavedToHistory?: (record: GeneratedPayslipRecord) => void;
  layoutSettings?: PayslipLayoutSettings;
  generationMethod?: 'Bulk Payroll' | 'Manual Entry';
}

export const PayslipPreviewModal: React.FC<PayslipPreviewModalProps> = ({
  employee,
  settings,
  month,
  year,
  onClose,
  onSavedToHistory,
  layoutSettings,
  generationMethod = 'Bulk Payroll'
}) => {
  const { isDark } = useTheme();
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [driveStatus, setDriveStatus] = useState<{ success: boolean; message: string } | null>(null);

  const layout: PayslipLayoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    ...(layoutSettings || {})
  };

  const accentColor = layout.primaryColor || settings.themeColor || '#CB1417';
  const secondaryColor = layout.secondaryColor || '#18181B';
  const isLandscape = layout.orientation === 'landscape';

  const previewFontClass =
    layout.fontFamily === 'times'
      ? 'font-serif'
      : layout.fontFamily === 'courier'
        ? 'font-mono'
        : 'font-sans';

  const logoSizeClass =
    layout.logoSize === 'small'
      ? 'w-11 h-11'
      : layout.logoSize === 'large'
        ? 'w-20 h-20'
        : 'w-14 h-14';

  const cellPadClass =
    layout.cellPadding === 'compact'
      ? 'px-2.5 py-1'
      : layout.cellPadding === 'spacious'
        ? 'px-3.5 py-2.5'
        : 'px-3 py-1.5';

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

  const persistLocalHistory = async (fileName: string, extra?: Partial<GeneratedPayslipRecord>) => {
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
      fileName,
      generationMethod,
      ...extra
    };
    await localDB.saveGeneratedRecord(historyRecord);
    if (onSavedToHistory) {
      onSavedToHistory(historyRecord);
    }
    return historyRecord;
  };

  const handleDownloadPdf = async () => {
    const doc = generatePayslipPdf(employee, settings, month, year, layout);
    const fileName = getSafeFileName(employee, month, year);
    doc.save(fileName);
    await persistLocalHistory(fileName);
  };

  const handleSaveToDrive = async () => {
    setIsSavingDrive(true);
    setDriveStatus(null);
    try {
      const doc = generatePayslipPdf(employee, settings, month, year, layout);
      const fileName = getSafeFileName(employee, month, year);
      const pdfDataUri = doc.output('datauristring');

      const res = await apiClient.request('/payroll/save-payslip-pdf', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: employee.employeeId,
          employeeName: employee.name,
          department: employee.department || 'General',
          designation: employee.designation || 'Staff',
          month,
          year,
          grossEarnings: employee.calculatedGross,
          totalDeductions: employee.calculatedDeductions,
          netSalary: employee.calculatedNet,
          pdfBase64: pdfDataUri,
          fileName,
          generationMethod
        })
      });

      await persistLocalHistory(fileName, {
        driveFileId: res.driveFileId || undefined
      });

      setDriveStatus({
        success: true,
        message: res.driveFileId
          ? `Archived "${fileName}" to Google Drive.`
          : `Saved "${fileName}" to cloud storage.`
      });
    } catch (err: any) {
      setDriveStatus({
        success: false,
        message: err.message || 'Connect your Google account in Company Settings to archive payslips to Google Drive.'
      });
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handlePrint = () => {
    const doc = generatePayslipPdf(employee, settings, month, year, layout);
    doc.autoPrint();
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    const existing = document.getElementById('eds-hidden-print-frame');
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'eds-hidden-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // fallback handled quietly
      }
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    };
    document.body.appendChild(iframe);
  };

  const netWords = numberToWords(employee.calculatedNet, settings.currencyName || 'USD');
  const resolved = resolvePayslipSectionsData(employee, settings, month, year, layout, false);

  const renderCustomBlocks = (slot: 'afterEmployeeInfo' | 'afterNetPay' | 'footer') => {
    const blocks = (layout.customTextBlocks || []).filter(b => b.visible !== false && b.position === slot && b.content?.trim());
    if (blocks.length === 0) return null;
    return (
      <div className="space-y-2 my-3">
        {blocks.map(blk => (
          <div key={blk.id} className="p-2.5 rounded border border-[#E5E5E8] bg-[#FAFAFC]">
            <div className="font-bold text-[10px] uppercase tracking-wide" style={{ color: accentColor }}>
              {blk.title || 'Notice'}
            </div>
            <p className="text-[11px] text-[#3F3F46] whitespace-pre-line mt-0.5">{blk.content}</p>
          </div>
        ))}
      </div>
    );
  };

  const defaultOrder: Array<'employeeInfo' | 'salaryTable' | 'netPay' | 'notes' | 'signatures'> = [
    'employeeInfo',
    'salaryTable',
    'netPay',
    'notes',
    'signatures',
  ];
  const sectionOrder = Array.isArray(layout.sectionOrder) && layout.sectionOrder.length > 0 ? layout.sectionOrder : defaultOrder;
  const renderedSections: Array<React.ReactNode> = [];
  const seenSections = new Set<string>();

  const renderSection = (sec: 'employeeInfo' | 'salaryTable' | 'netPay' | 'notes' | 'signatures') => {
    if (sec === 'employeeInfo') {
      return (
        <div key="employeeInfo">
          <div className="my-4 bg-[#FAFAFC] rounded border border-[#E5E5E8] p-3">
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
              {resolved.infoFields.map((field) => {
                const cfg = field.styleConfig;
                const alignClass =
                  cfg.align === 'center' ? 'text-center' : cfg.align === 'left' ? 'text-left' : 'text-right';
                const weightClass =
                  cfg.fontWeight === 'normal' ? 'font-normal' : cfg.fontWeight === 'medium' ? 'font-semibold' : 'font-bold';
                return (
                  <div
                    key={field.key}
                    className={`flex justify-between pb-1 truncate ${cfg.width === 'full' ? 'col-span-2' : ''} ${
                      cfg.borderStyle === 'solid'
                        ? 'border border-[#D4D4D8] px-1.5 py-0.5 rounded'
                        : cfg.borderStyle === 'none'
                          ? ''
                          : 'border-b border-[#E5E5E8]'
                    }`}
                    style={{
                      backgroundColor: cfg.backgroundColor || undefined,
                      fontSize: cfg.fontSize ? `${cfg.fontSize + 3}px` : undefined,
                    }}
                  >
                    <span className="text-[#71717A] font-medium truncate min-w-0 mr-2">{field.label}:</span>
                    <span
                      className={`font-mono ${weightClass} ${alignClass} text-[#000000] ${
                        field.displayValue.length <= 18 ? 'shrink-0' : 'truncate max-w-[62%]'
                      }`}
                      style={{ color: cfg.textColor || undefined }}
                      title={field.displayValue}
                    >
                      {field.displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {renderCustomBlocks('afterEmployeeInfo')}
        </div>
      );
    }

    if (sec === 'salaryTable') {
      return (
        <div key="salaryTable" className="grid grid-cols-2 gap-4 my-4">
          <div className={`rounded overflow-hidden ${layout.tableBorderStyle === 'minimal' ? '' : 'border border-[#E5E5E8]'}`}>
            <div className="text-white px-3 py-2 flex justify-between font-bold text-[11px]" style={{ backgroundColor: accentColor }}>
              <span>{layout.labelEarnings || 'EARNINGS'}</span>
              <span>AMOUNT</span>
            </div>
            <div className={`${layout.tableBorderStyle === 'minimal' ? '' : 'divide-y divide-[#F4F4F6]'} text-xs`}>
              {resolved.earningRows.map((earn) => {
                const cfg = earn.styleConfig;
                return (
                  <div
                    key={earn.key}
                    className={`${cellPadClass} flex justify-between hover:bg-[#FAFAFC]`}
                    style={{ backgroundColor: cfg.backgroundColor || undefined }}
                  >
                    <span className="text-[#52525B]">{earn.label}</span>
                    <span
                      className="font-mono font-medium text-[#000000] tabular-nums"
                      style={{ color: cfg.textColor || undefined }}
                    >
                      {earn.displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
            {layout.showGrossEarnings !== false && (
              <div className="bg-[#F8F8FA] px-3 py-2.5 border-t-2 border-[#000000] flex justify-between font-bold text-[#000000]">
                <span>{resolved.grossTotal.label}</span>
                <span className="font-mono text-[#000000] tabular-nums">{resolved.grossTotal.displayValue}</span>
              </div>
            )}
          </div>

          <div className={`rounded overflow-hidden ${layout.tableBorderStyle === 'minimal' ? '' : 'border border-[#E5E5E8]'}`}>
            <div className="text-white px-3 py-2 flex justify-between font-bold text-[11px]" style={{ backgroundColor: secondaryColor }}>
              <span>{layout.labelDeductions || 'DEDUCTIONS'}</span>
              <span>AMOUNT</span>
            </div>
            <div className={`${layout.tableBorderStyle === 'minimal' ? '' : 'divide-y divide-[#F4F4F6]'} text-xs`}>
              {resolved.deductionRows.map((ded) => {
                const cfg = ded.styleConfig;
                return (
                  <div
                    key={ded.key}
                    className={`${cellPadClass} flex justify-between hover:bg-[#FAFAFC]`}
                    style={{ backgroundColor: cfg.backgroundColor || undefined }}
                  >
                    <span className="text-[#52525B]">{ded.label}</span>
                    <span
                      className="font-mono font-medium text-[#ED1F24] tabular-nums"
                      style={{ color: cfg.textColor || undefined }}
                    >
                      {ded.displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
            {layout.showTotalDeductions !== false && (
              <div className="bg-[#F8F8FA] px-3 py-2.5 border-t-2 border-[#000000] flex justify-between font-bold text-[#000000]">
                <span>{resolved.deductionTotal.label}</span>
                <span className="font-mono text-[#ED1F24] tabular-nums">{resolved.deductionTotal.displayValue}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (sec === 'netPay') {
      if (layout.showNetSalary === false) return null;
      return (
        <div key="netPay">
          <div className="my-4 p-4 bg-[#FFFFFF] border-2 rounded-lg flex items-center justify-between" style={{ borderColor: accentColor }}>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: accentColor }}>
                {resolved.netPaySummary.label || 'Net Salary Payable'}
              </span>
              <span className="text-xs italic text-[#52525B] mt-1 block">
                Amount in Words: {netWords}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold font-mono tabular-nums" style={{ color: accentColor }}>
                {resolved.netPaySummary.displayValue}
              </span>
            </div>
          </div>
          {renderCustomBlocks('afterNetPay')}
        </div>
      );
    }

    if (sec === 'notes') {
      return (
        <div key="notes">
          {layout.showFooterNote && settings.payslipNote && (
            <p className="text-[10px] text-zinc-500 italic my-3">
              Note: {settings.payslipNote}
            </p>
          )}
          {renderCustomBlocks('footer')}
        </div>
      );
    }

    if (sec === 'signatures' && layout.showSignatures) {
      return (
        <div key="signatures" className="mt-8 pt-6 border-t border-[#E5E5E8] flex items-end justify-between">
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
      );
    }

    return null;
  };

  for (const s of [...sectionOrder, ...defaultOrder]) {
    if (!seenSections.has(s)) {
      seenSections.add(s);
      renderedSections.push(renderSection(s));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className={`border rounded-2xl ${isLandscape ? 'max-w-5xl' : 'max-w-4xl'} w-full my-6 shadow-2xl flex flex-col max-h-[92vh] transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Modal Top Bar */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${isDark ? 'border-[#222222]' : 'border-[#E4E4E7]'}`}>
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#CB1417] shrink-0" />
            <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>
              Payslip Preview: {employee.employeeId} - {employee.name}
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded bg-[#CB1417]/10 text-[#CB1417] border border-[#CB1417]/25 font-semibold shrink-0">
              {isLandscape ? 'A4 Landscape' : 'A4 Portrait'}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
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
              type="button"
              onClick={handleSaveToDrive}
              disabled={isSavingDrive}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-60 ${
                isDark
                  ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2A2A2E]'
                  : 'bg-white hover:bg-zinc-100 text-black border-zinc-300'
              }`}
            >
              {isSavingDrive ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CB1417]" /> : <CloudUpload className="w-3.5 h-3.5 text-[#CB1417]" />}
              <span>{isSavingDrive ? 'Archiving...' : 'Save to Google Drive'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-semibold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
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

        {driveStatus && (
          <div className={`mx-4 mt-3 px-3.5 py-2.5 rounded-xl border text-xs flex items-center space-x-2 shrink-0 ${
            driveStatus.success
              ? isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
              : isDark ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}>
            {driveStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-[#ED1F24] shrink-0" />}
            <span>{driveStatus.message}</span>
          </div>
        )}

        {/* Scrollable Document Sheet: ALWAYS white paper with crisp typography */}
        <div className={`p-6 overflow-y-auto flex justify-center ${isDark ? 'bg-[#000000]' : 'bg-[#F4F4F6]'}`}>
          <div className={`bg-[#FFFFFF] text-[#000000] rounded-md shadow-2xl w-full ${isLandscape ? 'max-w-4xl' : 'max-w-2xl'} p-8 border border-[#E5E5E8] text-xs ${previewFontClass} select-text`}>
            {/* Payslip Header */}
            <div
              className={`flex pb-4 border-b-2 border-[#000000] gap-4 ${
                layout.alignHeader === 'center'
                  ? 'flex-col items-center text-center'
                  : layout.alignHeader === 'right'
                    ? 'flex-row-reverse items-start justify-between text-right'
                    : 'items-start justify-between'
              }`}
            >
              <div className={`flex items-start gap-4 ${layout.logoPosition === 'right' ? 'flex-row-reverse' : layout.logoPosition === 'center' ? 'flex-col items-center text-center' : ''}`}>
                {layout.showLogo && settings.logoDataUrl ? (
                  <img
                    src={settings.logoDataUrl}
                    alt="Company Logo"
                    className={`${logoSizeClass} object-contain rounded border border-[#E5E5E8] p-1 shrink-0`}
                  />
                ) : layout.showLogo ? (
                  <div
                    className={`${logoSizeClass} rounded text-white flex items-center justify-center font-bold text-lg shrink-0`}
                    style={{ backgroundColor: accentColor }}
                  >
                    {settings.companyName.charAt(0) || 'E'}
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

              <div className={layout.alignHeader === 'center' ? 'text-center' : 'text-right'}>
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: accentColor }}>
                  Official Payslip
                </span>
                <span className="text-xs font-bold text-[#000000] block mt-0.5">
                  {month.toUpperCase()} {year}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-semibold inline-block mt-1"
                  style={{ color: accentColor, backgroundColor: `${accentColor}18` }}
                >
                  Confidential
                </span>
              </div>
            </div>

            {/* Dynamic Ordered Sections */}
            {renderedSections}

            {layout.showFooterNote && (
              <p className="mt-6 text-[9px] text-[#A1A1AA] text-center">
                This document was generated securely by Employee Database Studio{settings.companyName ? ` for ${settings.companyName}` : ''}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
