import React from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  ArrowRight,
  FileSpreadsheet,
  Download,
  Trash2,
  Sparkles,
  Building2,
  ShieldCheck,
  ChevronRight,
  Archive
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, GeneratedPayslipRecord } from '../types/payroll';
import { useTheme } from '../context/ThemeContext';

interface DashboardViewProps {
  employees: EmployeeRecord[];
  history: GeneratedPayslipRecord[];
  settings: CompanySettings;
  selectedMonth: string;
  selectedYear: number;
  onNavigate: (tab: any) => void;
  onTriggerImport: () => void;
  onLoadDemoData: () => void;
  onDownloadTemplate: () => void;
  onClearData: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  employees,
  history,
  settings,
  selectedMonth,
  selectedYear,
  onNavigate,
  onTriggerImport,
  onLoadDemoData,
  onDownloadTemplate,
  onClearData
}) => {
  const { isDark } = useTheme();

  const totalEmployees = employees.length;
  const validEmployees = employees.filter(e => e.isValid).length;
  const reviewRequired = employees.filter(e => !e.isValid || e.issues.length > 0).length;

  const totalGross = employees.reduce((acc, e) => acc + (e.calculatedGross || 0), 0);
  const totalNet = employees.reduce((acc, e) => acc + (e.calculatedNet || 0), 0);

  const periodGenerated = history.filter(
    h => h.month === selectedMonth && h.year === selectedYear
  ).length;

  const departments: Record<string, number> = {};
  employees.forEach(e => {
    const dept = e.department || 'General';
    departments[dept] = (departments[dept] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome / Header Banner with Brand Accent */}
      <div
        className={`border rounded-xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
          isDark
            ? 'bg-gradient-to-r from-[#170506] via-[#0E0E10] to-[#170506] border-[#331113]'
            : 'bg-gradient-to-r from-[#FFF5F5] via-[#FFFFFF] to-[#FFF5F5] border-[#FED7D7]'
        }`}
      >
        <div className="flex items-center space-x-4">
          {settings.logoDataUrl && (
            <div className="w-12 h-12 rounded-xl p-1 bg-white border border-zinc-200 shrink-0 flex items-center justify-center shadow-xs">
              <img src={settings.logoDataUrl} alt={settings.companyName} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-brand-primary" />
              <span>{settings.companyName || 'Corporate'} • Payroll Terminal</span>
            </div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
              Payroll Workspace: {selectedMonth} {selectedYear}
            </h1>
            <p className={`text-xs mt-1 max-w-xl ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
              {settings.companyName} • Deterministic payroll math audit, vector PDF payslips, and ZIP export.
            </p>
          </div>
        </div>

        {/* Action button cluster */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onTriggerImport}
            className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-semibold shadow-md transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Excel / CSV</span>
          </button>

          {totalEmployees === 0 && (
            <button
              onClick={onLoadDemoData}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark
                  ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2E2E33]'
                  : 'bg-white hover:bg-[#F4F4F5] text-black border-[#E4E4E7]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
              <span>Load 10-Staff Sample</span>
            </button>
          )}

          <button
            onClick={onDownloadTemplate}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isDark
                ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2E2E33]'
                : 'bg-white hover:bg-[#F4F4F5] text-black border-[#E4E4E7]'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-brand-primary" />
            <span>Template (.xlsx)</span>
          </button>

          {totalEmployees > 0 && (
            <button
              onClick={onClearData}
              title="Clear imported dataset"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark
                  ? 'bg-[#2E0B0D] hover:bg-[#451013] text-[#FCA5A5] border-[#57151A]'
                  : 'bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Data</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7] shadow-xs'
          }`}
        >
          <div>
            <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Total Employees</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${isDark ? 'text-white' : 'text-black'}`}>{totalEmployees}</p>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              Across {Object.keys(departments).length || 0} departments
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#CB1417]/10 border border-[#CB1417]/25 flex items-center justify-center text-[#CB1417]">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Valid Records */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7] shadow-xs'
          }`}
        >
          <div>
            <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Validated Records</p>
            <p className="text-2xl font-bold text-[#CB1417] mt-1 tabular-nums">{validEmployees}</p>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Ready for PDF rendering</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#CB1417]/10 border border-[#CB1417]/25 flex items-center justify-center text-[#CB1417]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Review Required */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7] shadow-xs'
          }`}
        >
          <div>
            <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Requires Review</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${reviewRequired > 0 ? 'text-[#ED1F24]' : isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              {reviewRequired}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              {reviewRequired > 0 ? 'Math discrepancies flagged' : 'Zero errors detected'}
            </p>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              reviewRequired > 0
                ? 'bg-[#ED1F24]/15 border border-[#ED1F24]/30 text-[#ED1F24]'
                : isDark
                ? 'bg-[#18181B] border border-[#27272A] text-[#71717A]'
                : 'bg-[#F4F4F6] border border-[#E4E4E7] text-[#A1A1AA]'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Total Net Payroll */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7] shadow-xs'
          }`}
        >
          <div>
            <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Total Net Payroll</p>
            <p className="text-xl font-bold text-[#CB1417] mt-1 truncate tabular-nums">
              {settings.currencySymbol} {totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`text-[11px] mt-1 truncate tabular-nums ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              Gross: {settings.currencySymbol} {totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#CB1417]/10 border border-[#CB1417]/25 flex items-center justify-center text-[#CB1417]">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Discrepancy warning banner if any review items */}
      {reviewRequired > 0 && (
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition ${
            isDark
              ? 'bg-[#200708] border-[#57151A] text-[#FCA5A5]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-brand-accent shrink-0" />
            <div>
              <h4 className="text-xs font-semibold">
                Mathematical discrepancies or validation warnings detected in {reviewRequired} record(s)
              </h4>
              <p className="text-[11px] opacity-90 mt-0.5">
                Deterministic calculations detected differences between spreadsheet provided totals and component sums.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('validation')}
            className="flex items-center space-x-1.5 px-3 py-1.5 btn-primary rounded text-xs font-semibold transition cursor-pointer"
          >
            <span>Audit & Resolve</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Workflow Stepper Grid */}
      <div
        className={`border rounded-xl p-5 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-black'}`}>
          Payslip Generation Pipeline
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1: Import */}
          <div
            onClick={() => onNavigate('import')}
            className={`p-4 rounded-lg border transition cursor-pointer group ${
              isDark
                ? 'bg-[#141416] border-[#26262B] hover:border-brand-primary/60 hover:bg-[#1A1A1E]'
                : 'bg-[#F9F9FB] border-[#E4E4E7] hover:border-brand-primary/60 hover:bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Step 1</span>
              <FileSpreadsheet className="w-4 h-4 text-[#71717A] group-hover:text-brand-primary transition" />
            </div>
            <h4 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Import & Map</h4>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Select Excel/CSV, detect column headers, and preserve employee IDs.
            </p>
            <div className="mt-3 flex items-center text-[11px] text-brand-primary font-semibold">
              <span className="tabular-nums">{totalEmployees > 0 ? `${totalEmployees} loaded` : 'Choose file'}</span>
              <ChevronRight className="w-3 h-3 ml-1" />
            </div>
          </div>

          {/* Step 2: Validation */}
          <div
            onClick={() => onNavigate('validation')}
            className={`p-4 rounded-lg border transition cursor-pointer group ${
              isDark
                ? 'bg-[#141416] border-[#26262B] hover:border-brand-primary/60 hover:bg-[#1A1A1E]'
                : 'bg-[#F9F9FB] border-[#E4E4E7] hover:border-brand-primary/60 hover:bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Step 2</span>
              <CheckCircle2 className="w-4 h-4 text-[#71717A] group-hover:text-brand-primary transition" />
            </div>
            <h4 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Math Audit & Rules</h4>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Validate Gross = Basic + HRA + Allowances and Net = Gross - Deductions.
            </p>
            <div className="mt-3 flex items-center text-[11px] text-brand-primary font-semibold">
              <span className="tabular-nums">{reviewRequired === 0 ? 'All verified' : `${reviewRequired} to review`}</span>
              <ChevronRight className="w-3 h-3 ml-1" />
            </div>
          </div>

          {/* Step 3: Generator */}
          <div
            onClick={() => onNavigate('generator')}
            className={`p-4 rounded-lg border transition cursor-pointer group ${
              isDark
                ? 'bg-[#141416] border-[#26262B] hover:border-brand-primary/60 hover:bg-[#1A1A1E]'
                : 'bg-[#F9F9FB] border-[#E4E4E7] hover:border-brand-primary/60 hover:bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Step 3</span>
              <FileText className="w-4 h-4 text-[#71717A] group-hover:text-brand-primary transition" />
            </div>
            <h4 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Payslip Generator</h4>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Preview A4 portrait design, check duplicate protection, and generate.
            </p>
            <div className="mt-3 flex items-center text-[11px] text-brand-primary font-semibold">
              <span className="tabular-nums">{periodGenerated > 0 ? `${periodGenerated} generated` : 'Preview & render'}</span>
              <ChevronRight className="w-3 h-3 ml-1" />
            </div>
          </div>

          {/* Step 4: Export */}
          <div
            onClick={() => onNavigate('export')}
            className={`p-4 rounded-lg border transition cursor-pointer group ${
              isDark
                ? 'bg-[#141416] border-[#26262B] hover:border-brand-primary/60 hover:bg-[#1A1A1E]'
                : 'bg-[#F9F9FB] border-[#E4E4E7] hover:border-brand-primary/60 hover:bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Step 4</span>
              <Archive className="w-4 h-4 text-[#71717A] group-hover:text-brand-primary transition" />
            </div>
            <h4 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Export Center</h4>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Bundle all generated payslips into a single ZIP file or export summary.
            </p>
            <div className="mt-3 flex items-center text-[11px] text-brand-primary font-semibold">
              <span>Bulk ZIP download</span>
              <ChevronRight className="w-3 h-3 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns: Department Breakdown & Standalone Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Departments */}
        <div
          className={`border rounded-xl p-5 transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Building2 className="w-4 h-4 text-brand-primary" />
              <span>Department Distribution</span>
            </h3>
            <span className={`text-xs tabular-nums ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>{Object.keys(departments).length} Active Depts</span>
          </div>
          {Object.keys(departments).length === 0 ? (
            <div className={`py-8 text-center text-xs ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              No employee records loaded yet. Import an Excel spreadsheet to begin.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(departments).map(([dept, count]) => {
                const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
                return (
                  <div
                    key={dept}
                    className={`flex items-center justify-between text-xs py-1.5 border-b last:border-0 ${
                      isDark ? 'border-[#1E1E22]' : 'border-[#F4F4F6]'
                    }`}
                  >
                    <span className={`font-medium ${isDark ? 'text-[#E4E4E7]' : 'text-[#27272A]'}`}>{dept}</span>
                    <div className="flex items-center space-x-3">
                      <span className={`tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>{count} staff ({pct}%)</span>
                      <div className={`w-20 rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-[#1C1C20]' : 'bg-[#E4E4E7]'}`}>
                        <div className="bg-brand-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Enterprise Cloud Architecture & Data Security */}
        <div
          className={`border rounded-xl p-5 transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
            <ShieldCheck className="w-4 h-4 text-[#CB1417]" />
            <span>Enterprise Cloud Architecture & Security</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className={`p-2.5 rounded border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#F9F9FB] border-[#E4E4E7]'}`}>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Enterprise Cloud & Browser Security</p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                Strict role-based access control, cryptographic password hashing, and authenticated REST APIs protect all employee and payroll records.
              </p>
            </div>
            <div className={`p-2.5 rounded border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#F9F9FB] border-[#E4E4E7]'}`}>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Hosted PostgreSQL & Client Persistence</p>
              <p className="text-[11px] mt-0.5 font-mono text-[#CB1417]">
                Cloud PostgreSQL Database • IndexedDB Local Cache
              </p>
            </div>
            <div className={`p-2.5 rounded border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#F9F9FB] border-[#E4E4E7]'}`}>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Vector PDF Rendering</p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                Direct client-side jsPDF rendering generates sharp A4 print-ready payslips in your company's custom brand colors with instant browser downloads.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
