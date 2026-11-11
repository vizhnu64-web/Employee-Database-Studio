import React, { useState } from 'react';
import {
  Archive,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, GeneratedPayslipRecord, PayslipLayoutSettings } from '../types/payroll';
import { generateBulkPayslipsZip } from '../utils/pdfGenerator';
import * as XLSX from 'xlsx';
import { useTheme } from '../context/ThemeContext';

interface ExportCenterViewProps {
  employees: EmployeeRecord[];
  history: GeneratedPayslipRecord[];
  settings: CompanySettings;
  selectedMonth: string;
  selectedYear: number;
  layoutSettings?: PayslipLayoutSettings;
}

export const ExportCenterView: React.FC<ExportCenterViewProps> = ({
  employees,
  settings,
  selectedMonth,
  selectedYear,
  layoutSettings
}) => {
  const { isDark } = useTheme();
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);

  const handleExportZip = async () => {
    if (employees.length === 0) return;
    setIsExportingZip(true);
    setZipProgress('Starting PDF compilation...');

    try {
      const zipBlob = await generateBulkPayslipsZip(
        employees,
        settings,
        selectedMonth,
        selectedYear,
        (current, total, name) => {
          setZipProgress(`Processing ${current} of ${total}: ${name}`);
        },
        layoutSettings
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip_Bundle_${selectedMonth}_${selectedYear}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setIsExportingZip(false);
      setZipProgress(null);
    }
  };

  const handleExportSummaryExcel = () => {
    if (employees.length === 0) return;

    const data = [
      [
        'Employee ID', 'Employee Name', 'Department', 'Designation', 'Paid Days', 'LOP Days',
        'Basic', 'HRA', 'Special Allowance', 'Other Allowances', 'Gross Earnings',
        'PF', 'ESI', 'Professional Tax', 'TDS', 'Other Deductions', 'Total Deductions',
        'Net Salary', 'Month', 'Year', 'Bank Account', 'PAN'
      ],
      ...employees.map(e => [
        e.employeeId,
        e.name,
        e.department || 'General',
        e.designation || 'Staff',
        e.paidDays ?? 30,
        e.unpaidDays ?? 0,
        e.basic,
        e.hra,
        e.specialAllowance || 0,
        e.otherAllowances || 0,
        e.calculatedGross,
        e.pf,
        e.esi,
        e.professionalTax,
        e.tds,
        e.otherDeductions || 0,
        e.calculatedDeductions,
        e.calculatedNet,
        selectedMonth,
        selectedYear,
        e.bankAccount || '',
        e.pan || ''
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll Summary Register');
    XLSX.writeFile(wb, `Payroll_Summary_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const totalGross = employees.reduce((sum, e) => sum + e.calculatedGross, 0);
  const totalDeductions = employees.reduce((sum, e) => sum + e.calculatedDeductions, 0);
  const totalNet = employees.reduce((sum, e) => sum + e.calculatedNet, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`border rounded-xl p-6 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <h2 className={`text-xl font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
          <Archive className="w-5 h-5 text-[#CB1417]" />
          <span>Export Center & Distribution Hub</span>
        </h2>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
          Generate complete corporate bundles, individual PDFs, and audit registers for distribution.
        </p>
      </div>

      {/* Export Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bulk ZIP Card */}
        <div
          className={`border rounded-xl p-6 flex flex-col justify-between space-y-4 transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#CB1417]/10 border border-[#CB1417]/25 text-[#CB1417] flex items-center justify-center">
              <Archive className="w-5 h-5" />
            </div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>All Employees PDF ZIP Archive</h3>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Generates a verified A4 portrait PDF for each employee and packages all files into a single compressed .zip file.
            </p>

            <div className={`pt-2 text-[11px] space-y-1 font-mono ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              <div>Period: {selectedMonth} {selectedYear}</div>
              <div className="tabular-nums">Included: {employees.length} Employees</div>
              <div className="tabular-nums">Estimated output: ~{(employees.length * 45 / 1024).toFixed(1)} MB ZIP archive</div>
            </div>
          </div>

          <button
            onClick={handleExportZip}
            disabled={employees.length === 0 || isExportingZip}
            className={`w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-bold transition shadow-md ${
              employees.length === 0 || isExportingZip
                ? isDark
                  ? 'bg-[#18181B] text-[#71717A] cursor-not-allowed border border-[#27272A]'
                  : 'bg-[#E4E4E7] text-[#A1A1AA] cursor-not-allowed border border-[#D4D4D8]'
                : 'bg-[#CB1417] hover:bg-[#ED1F24] text-white shadow-[#CB1417]/25 cursor-pointer'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>{isExportingZip ? zipProgress || 'Exporting...' : 'Export Complete ZIP Archive'}</span>
          </button>
        </div>

        {/* Audit Payroll Register Excel */}
        <div
          className={`border rounded-xl p-6 flex flex-col justify-between space-y-4 transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#CB1417]/10 border border-[#CB1417]/25 text-[#CB1417] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Payroll Summary Register (.xlsx)</h3>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Exports a consolidated spreadsheet register with all employee salaries, component breakdowns, bank accounts, and verification tags.
            </p>

            <div className={`pt-2 text-[11px] space-y-1 font-mono tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              <div>Total Gross: {settings.currencySymbol} {totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div>Total Deductions: {settings.currencySymbol} {totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div>Total Net Payable: {settings.currencySymbol} {totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <button
            onClick={handleExportSummaryExcel}
            disabled={employees.length === 0}
            className={`w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-bold transition border ${
              employees.length === 0
                ? isDark
                  ? 'bg-[#18181B] text-[#71717A] cursor-not-allowed border-[#27272A]'
                  : 'bg-[#E4E4E7] text-[#A1A1AA] cursor-not-allowed border-[#D4D4D8]'
                : isDark
                ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2E2E33] cursor-pointer'
                : 'bg-white hover:bg-[#F4F4F6] text-black border-[#E4E4E7] cursor-pointer'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#CB1417]" />
            <span>Export Payroll Register (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
