import React, { useState } from 'react';
import {
  History,
  Search,
  Download,
  Trash2,
  Database,
  AlertCircle
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, GeneratedPayslipRecord } from '../types/payroll';
import { localDB } from '../utils/dbStorage';
import { generatePayslipPdf } from '../utils/pdfGenerator';
import { useTheme } from '../context/ThemeContext';

interface HistoryViewProps {
  history: GeneratedPayslipRecord[];
  onHistoryCleared: () => void;
  onPreviewEmployee: (emp: EmployeeRecord) => void;
  employees: EmployeeRecord[];
  settings: CompanySettings;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onHistoryCleared,
  employees,
  settings
}) => {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const periods = Array.from(new Set(history.map(h => `${h.month} ${h.year}`)));

  const filteredHistory = history.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      item.employeeId.toLowerCase().includes(term) ||
      item.employeeName.toLowerCase().includes(term) ||
      item.department.toLowerCase().includes(term);

    const matchesPeriod =
      filterPeriod === 'all' || `${item.month} ${item.year}` === filterPeriod;

    return matchesSearch && matchesPeriod;
  });

  const handleClearHistory = async () => {
    await localDB.clearHistory();
    onHistoryCleared();
    setShowClearConfirm(false);
  };

  const handleDownloadHistoricalPdf = async (record: GeneratedPayslipRecord) => {
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch(`/api/payroll/payslip-pdf/${record.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.signedUrl) {
          const a = document.createElement('a');
          a.href = data.signedUrl;
          a.download = record.fileName || 'payslip.pdf';
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }
      }
    } catch (e) {
      console.warn('[Storage] Cloud download fell back to local generation:', e);
    }

    const match = employees.find(e => e.employeeId.toLowerCase() === record.employeeId.toLowerCase()) || {
      id: record.id,
      employeeId: record.employeeId,
      name: record.employeeName,
      department: record.department,
      designation: record.designation,
      basic: record.grossEarnings * 0.6,
      hra: record.grossEarnings * 0.25,
      otherAllowances: record.grossEarnings * 0.15,
      calculatedGross: record.grossEarnings,
      pf: record.totalDeductions * 0.7,
      esi: 0,
      professionalTax: 200,
      tds: record.totalDeductions * 0.3 - 200,
      otherDeductions: 0,
      calculatedDeductions: record.totalDeductions,
      calculatedNet: record.netSalary,
      isValid: true,
      issues: []
    };

    const doc = generatePayslipPdf(match, settings, record.month, record.year);
    doc.save(record.fileName);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider mb-1">
            <Database className="w-4 h-4 text-[#CB1417]" />
            <span>Local Database Audit Trail</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Generated Payslip History
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Archived logs of all payslips generated on this device with audit timestamps and duplicate keys.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer self-start md:self-auto ${
              isDark
                ? 'bg-[#2E0B0D] hover:bg-[#451013] text-[#FCA5A5] border-[#57151A]'
                : 'bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History Logs</span>
          </button>
        )}
      </div>

      {/* Confirmation Modal for Clearing History */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className={`border rounded-xl max-w-md w-full p-6 shadow-2xl transition ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <AlertCircle className="w-5 h-5 text-[#CB1417]" />
              <span>Clear Generation History?</span>
            </h3>
            <p className={`text-xs mt-2 ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
              This will remove all <strong className={isDark ? 'text-white' : 'text-black tabular-nums'}>{history.length} audit history records</strong> from the local SQLite / IndexedDB database.
            </p>
            <div className="mt-5 flex justify-end space-x-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark
                    ? 'text-[#A1A1AA] hover:text-white bg-[#141416] border-[#27272A]'
                    : 'text-[#52525B] hover:text-black bg-[#F4F4F6] border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#CB1417] hover:bg-[#ED1F24] transition cursor-pointer"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div
        className={`border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div className="relative w-full sm:w-80">
          <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`} />
          <input
            type="text"
            placeholder="Search by ID, name, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#CB1417] border ${
              isDark
                ? 'bg-[#000000] border-[#27272A] text-white placeholder-[#71717A]'
                : 'bg-[#FFFFFF] border-[#D4D4D8] text-black placeholder-[#A1A1AA]'
            }`}
          />
        </div>

        {periods.length > 0 && (
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className={`text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#CB1417] border w-full sm:w-auto ${
              isDark
                ? 'bg-[#000000] border-[#27272A] text-white'
                : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
            }`}
          >
            <option value="all">All Pay Periods ({history.length})</option>
            {periods.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {/* History Table */}
      <div
        className={`border rounded-xl overflow-hidden shadow-xs transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className={`text-[11px] font-semibold border-b ${
              isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#222222]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'
            }`}>
              <tr>
                <th className="p-3">Emp ID</th>
                <th className="p-3">Employee Name</th>
                <th className="p-3">Period</th>
                <th className="p-3">Gross</th>
                <th className="p-3">Deductions</th>
                <th className="p-3 text-right">Net Salary</th>
                <th className="p-3">Generated At</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E1E22]' : 'divide-[#F4F4F6]'}`}>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`p-10 text-center ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
                    No generation history recorded yet. Generate payslips from the Payslip Generator tab to see audit logs.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(item => (
                  <tr key={item.id} className={`transition ${isDark ? 'hover:bg-[#121214]' : 'hover:bg-[#F8F9FA]'}`}>
                    <td className={`p-3 font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                      {item.employeeId}
                    </td>
                    <td className={`p-3 font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                      {item.employeeName}
                    </td>
                    <td className={`p-3 font-medium ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>
                      {item.month} {item.year}
                    </td>
                    <td className={`p-3 font-mono tabular-nums ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
                      {settings.currencySymbol} {item.grossEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-mono text-[#ED1F24] tabular-nums">
                      - {settings.currencySymbol} {item.totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#CB1417] tabular-nums">
                      {settings.currencySymbol} {item.netSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-3 font-mono text-[11px] tabular-nums ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>
                      {new Date(item.generatedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDownloadHistoricalPdf(item)}
                        title="Re-download PDF"
                        className={`px-2.5 py-1 rounded border text-xs inline-flex items-center space-x-1 transition cursor-pointer ${
                          isDark
                            ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]'
                            : 'bg-white hover:bg-[#F4F4F5] text-black border-[#E4E4E7]'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5 text-[#CB1417]" />
                        <span>Re-download</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
