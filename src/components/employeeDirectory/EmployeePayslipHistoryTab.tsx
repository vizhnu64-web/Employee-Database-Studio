import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Eye, 
  Calendar, 
  CheckCircle2, 
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { DirectoryEmployee } from '../../types/employeeDirectory';
import { GeneratedPayslipRecord } from '../../types/payroll';
import { localDB } from '../../utils/dbStorage';
import { useTheme } from '../../context/ThemeContext';

interface EmployeePayslipHistoryTabProps {
  employee: DirectoryEmployee;
  onPreviewPayslip?: (record: any) => void;
}

export const EmployeePayslipHistoryTab: React.FC<EmployeePayslipHistoryTabProps> = ({
  employee,
  onPreviewPayslip
}) => {
  const { isDark } = useTheme();
  const [history, setHistory] = useState<GeneratedPayslipRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPayslips() {
      setIsLoading(true);
      try {
        const all = await localDB.getHistory();
        const filtered = all.filter(
          h => h.employeeId?.toUpperCase() === employee.employeeId?.toUpperCase()
        );
        setHistory(filtered);
      } catch (e) {
        console.error('Error loading employee payslip history:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadPayslips();
  }, [employee.employeeId]);

  const handleDownloadPdf = (rec: GeneratedPayslipRecord) => {
    if (rec.pdfDataUri) {
      const link = document.createElement('a');
      link.href = rec.pdfDataUri;
      link.download = `Payslip_${rec.employeeId}_${rec.month}_${rec.year}.pdf`;
      link.click();
    } else {
      alert('PDF data URI not available for this record.');
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Header Summary */}
      <div className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-brand-primary uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>Generated Payslips Record Archive</span>
          </div>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            All official salary slips generated, validated, and distributed for {employee.legalName}.
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
          {history.length} Payslip{history.length === 1 ? '' : 's'} on Record
        </span>
      </div>

      {history.length === 0 ? (
        <div className={`p-10 rounded-xl border text-center space-y-3 ${
          isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'
        }`}>
          <FileText className="w-10 h-10 text-zinc-500 mx-auto opacity-40" />
          <h4 className="font-bold text-sm">No Payslips Generated Yet</h4>
          <p className="text-zinc-500 max-w-sm mx-auto text-xs">
            Generate payslips for this employee using the Payroll Batch and Payslip Generator modules.
          </p>
        </div>
      ) : (
        <div className={`border rounded-xl overflow-hidden shadow-xs ${
          isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'
        }`}>
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b text-[11px] font-semibold uppercase ${
                isDark ? 'bg-[#18181B] text-zinc-400 border-zinc-800' : 'bg-zinc-50 text-zinc-600 border-zinc-200'
              }`}>
                <th className="py-2.5 px-3">Payroll Period</th>
                <th className="py-2.5 px-3">Total Earnings</th>
                <th className="py-2.5 px-3">Total Deductions</th>
                <th className="py-2.5 px-3">Net Salary</th>
                <th className="py-2.5 px-3">Generated At</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-zinc-800 divide-zinc-100">
              {history.map((rec) => (
                <tr key={rec.id} className={isDark ? 'hover:bg-[#1C1C20]' : 'hover:bg-[#F9FAFB]'}>
                  <td className="py-3 px-3 font-semibold">
                    {rec.month} {rec.year}
                  </td>
                  <td className="py-3 px-3 font-mono font-medium text-emerald-500">
                    ₹{rec.grossEarnings?.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-mono font-medium text-rose-500">
                    ₹{rec.totalDeductions?.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    ₹{rec.netSalary?.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-zinc-500">
                    {new Date(rec.generatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    {onPreviewPayslip && (
                      <button
                        type="button"
                        onClick={() => onPreviewPayslip(rec)}
                        className="px-2.5 py-1 rounded border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 transition cursor-pointer inline-flex items-center space-x-1 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    )}
                    {rec.pdfDataUri && (
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(rec)}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition cursor-pointer inline-flex items-center space-x-1 font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
