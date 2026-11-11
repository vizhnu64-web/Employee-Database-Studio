import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Calculator,
  ArrowRight,
  Wrench,
  Info
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, ValidationIssue } from '../types/payroll';
import { validateBatch } from '../utils/payrollValidator';
import { useTheme } from '../context/ThemeContext';

interface ValidationViewProps {
  employees: EmployeeRecord[];
  onBatchUpdated: (updated: EmployeeRecord[]) => void;
  onNavigateToGenerator: () => void;
  settings: CompanySettings;
  selectedMonth?: string;
  selectedYear?: number;
}

export const ValidationView: React.FC<ValidationViewProps> = ({
  employees,
  onBatchUpdated,
  onNavigateToGenerator,
  settings,
  selectedMonth = 'October',
  selectedYear = 2026
}) => {
  const { isDark } = useTheme();
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'errors' | 'warnings'>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const allIssues: Array<{ employee: EmployeeRecord; issue: ValidationIssue }> = [];
  employees.forEach(emp => {
    emp.issues.forEach(issue => {
      allIssues.push({ employee: emp, issue });
    });
  });

  const errorCount = allIssues.filter(i => i.issue.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.issue.severity === 'warning').length;
  const totalEmployees = employees.length;
  const validEmployees = employees.filter(e => e.isValid && e.issues.length === 0).length;

  const handleAutoFixAll = () => {
    const updated = employees.map(emp => {
      return {
        ...emp,
        providedGross: emp.calculatedGross,
        providedDeductions: emp.calculatedDeductions,
        providedNet: emp.calculatedNet
      };
    });

    const revalidated = validateBatch(updated, { month: selectedMonth, year: selectedYear });
    onBatchUpdated(revalidated);
    setSuccessMessage('Successfully reconciled all discrepancies to match exact deterministic component sums.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleFixEmployee = (empId: string) => {
    const updated = employees.map(emp => {
      if (emp.id === empId || emp.employeeId === empId) {
        return {
          ...emp,
          providedGross: emp.calculatedGross,
          providedDeductions: emp.calculatedDeductions,
          providedNet: emp.calculatedNet
        };
      }
      return emp;
    });

    const revalidated = validateBatch(updated, { month: selectedMonth, year: selectedYear });
    onBatchUpdated(revalidated);
  };

  const displayedIssues = allIssues.filter(item => {
    if (filterSeverity === 'errors') return item.issue.severity === 'error';
    if (filterSeverity === 'warnings') return item.issue.severity === 'warning';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider mb-1">
            <Calculator className="w-4 h-4 text-[#CB1417]" />
            <span>Deterministic Arithmetic & Integrity Audit • {selectedMonth} {selectedYear}</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Payroll Verification & Math Audit ({selectedMonth} {selectedYear})
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Cross-verifies components: Gross = Basic + Allowances, Deductions = PF + Tax + Others, Net = Gross - Deductions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {warningCount > 0 && (
            <button
              onClick={handleAutoFixAll}
              className="flex items-center space-x-2 px-3.5 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-semibold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Auto-Fix Math Discrepancies</span>
            </button>
          )}

          <button
            onClick={onNavigateToGenerator}
            disabled={errorCount > 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-md ${
              errorCount > 0
                ? isDark
                  ? 'bg-[#18181B] text-[#71717A] cursor-not-allowed border border-[#27272A]'
                  : 'bg-[#E4E4E7] text-[#A1A1AA] cursor-not-allowed border border-[#D4D4D8]'
                : 'bg-[#CB1417] hover:bg-[#ED1F24] text-white shadow-[#CB1417]/30 cursor-pointer'
            }`}
          >
            <span>Proceed to Generator</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {successMessage && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Audit Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Validated */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div>
            <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Perfect Math & Verification</p>
            <p className="text-2xl font-bold text-[#CB1417] mt-1 tabular-nums">{validEmployees} / {totalEmployees}</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Ready for payslip export</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#CB1417]/10 border border-[#CB1417]/25 flex items-center justify-center text-[#CB1417]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Discrepancies */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div>
            <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Total Discrepancies Flagged</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${warningCount > 0 ? 'text-[#ED1F24]' : isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              {warningCount}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Component sum vs sheet mismatch</p>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              warningCount > 0
                ? 'bg-[#ED1F24]/15 border border-[#ED1F24]/30 text-[#ED1F24]'
                : isDark
                ? 'bg-[#18181B] border border-[#27272A] text-[#71717A]'
                : 'bg-[#F4F4F6] border border-[#E4E4E7] text-[#A1A1AA]'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Fatal Errors */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div>
            <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Fatal Validation Errors</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${errorCount > 0 ? 'text-[#ED1F24]' : isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              {errorCount}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Missing ID, duplicate, negative salary</p>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              errorCount > 0
                ? 'bg-[#ED1F24]/20 border border-[#ED1F24]/40 text-[#ED1F24]'
                : isDark
                ? 'bg-[#18181B] border border-[#27272A] text-[#71717A]'
                : 'bg-[#F4F4F6] border border-[#E4E4E7] text-[#A1A1AA]'
            }`}
          >
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Mathematical Rules Explanation Card */}
      <div
        className={`border rounded-xl p-5 text-xs transition ${
          isDark ? 'bg-[#070708] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
        }`}
      >
        <h3 className={`font-semibold flex items-center space-x-2 mb-2 ${isDark ? 'text-white' : 'text-black'}`}>
          <Info className="w-4 h-4 text-[#CB1417]" />
          <span>Strict Deterministic Arithmetic Formulas Enforced</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px] mt-3">
          <div className={`p-2.5 rounded border ${isDark ? 'bg-[#111113] border-[#27272A]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
            <span className="text-[#CB1417] font-bold block mb-1">Gross Earnings:</span>
            <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}>Basic + HRA + Special Allowance + Other Allowances</span>
          </div>
          <div className={`p-2.5 rounded border ${isDark ? 'bg-[#111113] border-[#27272A]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
            <span className="text-[#ED1F24] font-bold block mb-1">Total Deductions:</span>
            <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}>PF + ESI + Professional Tax + TDS + Other Deductions</span>
          </div>
          <div className={`p-2.5 rounded border ${isDark ? 'bg-[#111113] border-[#27272A]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
            <span className="text-[#CB1417] font-bold block mb-1">Net Salary Payable:</span>
            <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}>Gross Earnings - Total Deductions</span>
          </div>
        </div>
      </div>

      {/* Issue Filter Tabs */}
      <div className={`flex items-center space-x-2 border-b pb-2 text-xs ${isDark ? 'border-[#222222]' : 'border-[#E4E4E7]'}`}>
        <button
          onClick={() => setFilterSeverity('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            filterSeverity === 'all'
              ? 'bg-[#CB1417] text-white font-semibold'
              : isDark
              ? 'text-[#A1A1AA] hover:text-white'
              : 'text-[#71717A] hover:text-black'
          }`}
        >
          All Issues ({allIssues.length})
        </button>
        <button
          onClick={() => setFilterSeverity('errors')}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            filterSeverity === 'errors'
              ? 'bg-[#ED1F24] text-white font-semibold'
              : isDark
              ? 'text-[#A1A1AA] hover:text-white'
              : 'text-[#71717A] hover:text-black'
          }`}
        >
          Fatal Errors ({errorCount})
        </button>
        <button
          onClick={() => setFilterSeverity('warnings')}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            filterSeverity === 'warnings'
              ? 'bg-[#CB1417] text-white font-semibold'
              : isDark
              ? 'text-[#A1A1AA] hover:text-white'
              : 'text-[#71717A] hover:text-black'
          }`}
        >
          Math Discrepancies ({warningCount})
        </button>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {displayedIssues.length === 0 ? (
          <div
            className={`border rounded-xl p-10 text-center transition ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <CheckCircle2 className="w-10 h-10 text-[#CB1417] mx-auto mb-2" />
            <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>All Records 100% Mathematically Verified</h4>
            <p className={`text-xs mt-1 max-w-sm mx-auto ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Every employee record conforms to deterministic arithmetic rules and contains complete required data.
            </p>
            <button
              onClick={onNavigateToGenerator}
              className="mt-4 px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-2 transition cursor-pointer"
            >
              <span>Generate Payslips Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          displayedIssues.map((item, idx) => {
            const isError = item.issue.severity === 'error';
            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                  isError
                    ? isDark
                      ? 'bg-[#2E0B0D]/50 border-[#57151A] text-[#FCA5A5]'
                      : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                    : isDark
                    ? 'bg-[#1D080A]/60 border-[#471216] text-[#FCA5A5]'
                    : 'bg-[#FFF5F5] border-[#FED7D7] text-[#991B1B]'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {isError ? (
                    <ShieldAlert className="w-5 h-5 text-[#ED1F24] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#ED1F24] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                        {item.employee.employeeId} - {item.employee.name || 'Unnamed Employee'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#CB1417]/20 text-[#CB1417] border border-[#CB1417]/30">
                        {item.issue.field}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">
                      {item.issue.message}
                    </p>
                    {item.issue.expected !== undefined && item.issue.actual !== undefined && (
                      <div className={`mt-1 text-[11px] font-mono tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                        Calculated Sum: <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>{settings.currencySymbol}{item.issue.expected}</span> | Sheet Value: <span className="text-[#CB1417] font-semibold">{settings.currencySymbol}{item.issue.actual}</span>
                      </div>
                    )}
                  </div>
                </div>

                {item.issue.canAutoFix && (
                  <button
                    onClick={() => handleFixEmployee(item.employee.id)}
                    className="self-start sm:self-center px-3 py-1.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Apply Sum</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
