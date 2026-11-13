import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  Download,
  Archive,
  Eye,
  RefreshCw,
  ShieldCheck,
  CheckSquare,
  Square,
  FileCheck,
  Edit
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, GeneratedPayslipRecord, PayslipLayoutSettings, DEFAULT_LAYOUT_SETTINGS } from '../types/payroll';
import { generateBulkPayslipsZip, generatePayslipPdf, getSafeFileName } from '../utils/pdfGenerator';
import { localDB } from '../utils/dbStorage';
import { useTheme } from '../context/ThemeContext';
import { PayslipManualEditorModal } from './PayslipManualEditorModal';
import { apiClient } from '../utils/apiClient';

interface GeneratorViewProps {
  employees: EmployeeRecord[];
  settings: CompanySettings;
  selectedMonth: string;
  selectedYear: number;
  onPreviewEmployee: (emp: EmployeeRecord) => void;
  onRecordGenerated: (record: GeneratedPayslipRecord) => void;
  history: GeneratedPayslipRecord[];
  layoutSettings?: PayslipLayoutSettings;
}

export const GeneratorView: React.FC<GeneratorViewProps> = ({
  employees,
  settings,
  selectedMonth,
  selectedYear,
  onPreviewEmployee,
  onRecordGenerated,
  history,
  layoutSettings
}) => {
  const { isDark } = useTheme();
  const showSymbol = settings.showCurrencySymbol !== false;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [duplicateConfirmTarget, setDuplicateConfirmTarget] = useState<EmployeeRecord | null>(null);
  const [bulkDuplicateWarning, setBulkDuplicateWarning] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);

  useEffect(() => {
    const validIds = employees.filter(e => e.isValid).map(e => e.id);
    setSelectedIds(validIds);
  }, [employees]);

  const existingMap = new Map<string, GeneratedPayslipRecord>();
  history.forEach(h => {
    if (h.month === selectedMonth && h.year === selectedYear) {
      existingMap.set(h.employeeId.toLowerCase(), h);
    }
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleGenerateSingle = async (employee: EmployeeRecord, forceOverwrite = false) => {
    const existing = existingMap.get(employee.employeeId.toLowerCase());
    if (existing && !forceOverwrite) {
      setDuplicateConfirmTarget(employee);
      return;
    }

    setDuplicateConfirmTarget(null);

    const doc = generatePayslipPdf(employee, settings, selectedMonth, selectedYear, layoutSettings);
    const fileName = getSafeFileName(employee, selectedMonth, selectedYear);
    const pdfDataUri = doc.output('datauristring');
    doc.save(fileName);

    const historyRecord: GeneratedPayslipRecord = {
      id: `${employee.employeeId.trim()}_${selectedMonth}_${selectedYear}`.toLowerCase(),
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department || 'General',
      designation: employee.designation || 'Staff',
      month: selectedMonth,
      year: selectedYear,
      grossEarnings: employee.calculatedGross,
      totalDeductions: employee.calculatedDeductions,
      netSalary: employee.calculatedNet,
      generatedAt: new Date().toISOString(),
      fileName
    };

    // Upload to Supabase Storage backend
    try {
      const token = apiClient.getToken();
      await fetch('/api/payroll/save-payslip-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          employeeId: employee.employeeId,
          employeeName: employee.name,
          department: employee.department,
          designation: employee.designation,
          month: selectedMonth,
          year: selectedYear,
          grossEarnings: employee.calculatedGross,
          totalDeductions: employee.calculatedDeductions,
          netSalary: employee.calculatedNet,
          pdfBase64: pdfDataUri,
          fileName
        })
      });
    } catch (e) {
      console.warn('[Storage] Failed to sync generated payslip to cloud bucket:', e);
    }

    await localDB.saveGeneratedRecord(historyRecord);
    onRecordGenerated(historyRecord);

    setSuccessToast(`Generated and downloaded ${fileName}`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleStartBulkExport = async (forceOverwrite = false) => {
    const targetEmployees = employees.filter(e => selectedIds.includes(e.id));
    if (targetEmployees.length === 0) return;

    const hasExisting = targetEmployees.some(e => existingMap.has(e.employeeId.toLowerCase()));
    if (hasExisting && !forceOverwrite && !bulkDuplicateWarning) {
      setBulkDuplicateWarning(true);
      return;
    }

    setBulkDuplicateWarning(false);
    setIsGeneratingBulk(true);
    setBulkProgress({ current: 0, total: targetEmployees.length, name: 'Starting...' });

    try {
      const zipBlob = await generateBulkPayslipsZip(
        targetEmployees,
        settings,
        selectedMonth,
        selectedYear,
        (current, total, name) => {
          setBulkProgress({ current, total, name });
        },
        layoutSettings
      );

      for (const emp of targetEmployees) {
        const fileName = getSafeFileName(emp, selectedMonth, selectedYear);
        const pdfDoc = generatePayslipPdf(emp, settings, selectedMonth, selectedYear, layoutSettings);
        const pdfDataUri = pdfDoc.output('datauristring');

        const historyRecord: GeneratedPayslipRecord = {
          id: `${emp.employeeId.trim()}_${selectedMonth}_${selectedYear}`.toLowerCase(),
          employeeId: emp.employeeId,
          employeeName: emp.name,
          department: emp.department || 'General',
          designation: emp.designation || 'Staff',
          month: selectedMonth,
          year: selectedYear,
          grossEarnings: emp.calculatedGross,
          totalDeductions: emp.calculatedDeductions,
          netSalary: emp.calculatedNet,
          generatedAt: new Date().toISOString(),
          fileName
        };

        try {
          const token = apiClient.getToken();
          await fetch('/api/payroll/save-payslip-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              employeeId: emp.employeeId,
              employeeName: emp.name,
              department: emp.department,
              designation: emp.designation,
              month: selectedMonth,
              year: selectedYear,
              grossEarnings: emp.calculatedGross,
              totalDeductions: emp.calculatedDeductions,
              netSalary: emp.calculatedNet,
              pdfBase64: pdfDataUri,
              fileName
            })
          });
        } catch (e) {
          console.warn('[Storage] Failed to upload bulk payslip to cloud bucket:', e);
        }

        await localDB.saveGeneratedRecord(historyRecord);
        onRecordGenerated(historyRecord);
      }

      const defaultZipName = `Payslips_${selectedMonth}_${selectedYear}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultZipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessToast(`Generated ZIP containing ${targetEmployees.length} PDF payslips!`);
    } catch (err: any) {
      alert(`Bulk generation error: ${err.message}`);
    } finally {
      setIsGeneratingBulk(false);
      setBulkProgress(null);
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  const selectedCount = selectedIds.length;
  const invalidInSelection = employees.filter(e => selectedIds.includes(e.id) && !e.isValid).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4 text-brand-primary" />
            <span>A4 Portrait PDF Generator</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Generate Payslips for {selectedMonth} {selectedYear}
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Select employees, preview interactive layouts, and export individual PDFs or bundled ZIP archives.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleStartBulkExport(false)}
            disabled={selectedCount === 0 || isGeneratingBulk}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-bold shadow-md transition cursor-pointer ${
              selectedCount === 0 || isGeneratingBulk
                ? isDark
                  ? 'bg-[#18181B] text-[#71717A] cursor-not-allowed border border-[#27272A]'
                  : 'bg-[#E4E4E7] text-[#A1A1AA] cursor-not-allowed border border-[#D4D4D8]'
                : 'btn-primary'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span className="tabular-nums">Generate & Download ZIP ({selectedCount} Selected)</span>
          </button>
        </div>
      </div>

      {successToast && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border animate-in fade-in ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Warning if invalid records in selection */}
      {invalidInSelection > 0 && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#200708] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
        }`}>
          <AlertTriangle className="w-5 h-5 text-[#ED1F24] shrink-0" />
          <div>
            <span className="font-semibold tabular-nums">{invalidInSelection} record(s) in your selection have validation warnings or errors.</span>
            <p className="opacity-90 mt-0.5">
              Payslips generated from incomplete salary data may require review. Please audit math in the Validation tab.
            </p>
          </div>
        </div>
      )}

      {/* Selection Control Bar */}
      <div
        className={`border rounded-xl p-4 flex items-center justify-between text-xs transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSelectAll}
            className={`flex items-center space-x-2 font-medium cursor-pointer ${
              isDark ? 'text-[#D4D4D8] hover:text-white' : 'text-[#27272A] hover:text-black'
            }`}
          >
            {selectedIds.length === employees.length ? (
              <CheckSquare className="w-4 h-4 text-brand-primary" />
            ) : (
              <Square className={`w-4 h-4 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`} />
            )}
            <span className="tabular-nums">Select All ({employees.length})</span>
          </button>
          <span className={isDark ? 'text-[#333333]' : 'text-[#D4D4D8]'}>|</span>
          <span className={`tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            {selectedCount} employee(s) ready for generation
          </span>
        </div>

        <div className="text-[11px] text-[#CB1417] flex items-center space-x-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-[#CB1417]" />
          <span>Duplicate protection active</span>
        </div>
      </div>

      {/* Employees Table with Generation Status */}
      <div
        className={`border rounded-xl overflow-hidden shadow-xs transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className={`text-[11px] font-semibold border-b select-none ${
              isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#222222]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'
            }`}>
              <tr>
                <th className="p-3 w-10 text-center">
                  <span className="sr-only">Select</span>
                </th>
                <th className="p-3">Emp ID</th>
                <th className="p-3">Employee Name</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-right">Net Payable</th>
                <th className="p-3 text-center">Generation Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E1E22]' : 'divide-[#F4F4F6]'}`}>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`p-10 text-center ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
                    No employee records loaded. Import an Excel spreadsheet first.
                  </td>
                </tr>
              ) : (
                employees.map(emp => {
                  const isSelected = selectedIds.includes(emp.id);
                  const existingRecord = existingMap.get(emp.employeeId.toLowerCase());

                  return (
                    <tr
                      key={emp.id}
                      className={`transition ${
                        isSelected
                          ? isDark ? 'bg-[#180708]' : 'bg-[#FFF5F5]'
                          : isDark ? 'hover:bg-[#121214]' : 'hover:bg-[#F8F9FA]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleSelect(emp.id)}
                          className="cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#CB1417]" />
                          ) : (
                            <Square className={`w-4 h-4 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`} />
                          )}
                        </button>
                      </td>

                      {/* ID */}
                      <td className={`p-3 font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                        {emp.employeeId}
                      </td>

                      {/* Name */}
                      <td className={`p-3 font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                        {emp.name || <span className="text-[#ED1F24] italic">Missing Name</span>}
                      </td>

                      {/* Dept */}
                      <td className={isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}>
                        {emp.department || 'General'}
                      </td>

                      {/* Net */}
                      <td className="p-3 text-right font-mono font-bold text-[#CB1417] tabular-nums">
                        {showSymbol ? `${settings.currencySymbol} ` : ''}{emp.calculatedNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Duplicate / Existing Status */}
                      <td className="p-3 text-center">
                        {existingRecord ? (
                          <span
                            className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#CB1417]/10 border border-[#CB1417]/30 text-[#CB1417]"
                            title={`Generated on ${new Date(existingRecord.generatedAt).toLocaleString()}`}
                          >
                            <FileCheck className="w-3 h-3 text-[#CB1417]" />
                            <span className="tabular-nums">Generated ({new Date(existingRecord.generatedAt).toLocaleDateString()})</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            isDark ? 'bg-[#18181B] border-[#27272A] text-[#71717A]' : 'bg-[#F4F4F6] border-[#E4E4E7] text-[#71717A]'
                          }`}>
                            <span>Not Generated</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            title="Edit Payslip & Post-Generation Adjustments"
                            className={`flex items-center space-x-1 px-2.5 py-1 rounded border text-xs font-medium transition cursor-pointer ${
                              isDark
                                ? 'bg-[#18181B] hover:bg-[#27272A] text-amber-400 border-amber-500/30'
                                : 'bg-[#FFFFFF] hover:bg-[#FEF3C7] text-amber-700 border-amber-300'
                            }`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => onPreviewEmployee(emp)}
                            title="Interactive A4 Preview"
                            className={`flex items-center space-x-1 px-2.5 py-1 rounded border text-xs font-medium transition cursor-pointer ${
                              isDark
                                ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]'
                                : 'bg-[#FFFFFF] hover:bg-[#F4F4F5] text-black border-[#E4E4E7]'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          <button
                            onClick={() => handleGenerateSingle(emp)}
                            title={existingRecord ? 'Regenerate Payslip PDF' : 'Generate Payslip PDF'}
                            className="flex items-center space-x-1 px-2.5 py-1 btn-primary rounded text-xs font-semibold shadow-xs transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{existingRecord ? 'Regenerate' : 'PDF'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Duplicate Confirmation Modal */}
      {duplicateConfirmTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className={`border rounded-xl max-w-md w-full p-6 shadow-2xl transition ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <AlertTriangle className="w-5 h-5 text-[#CB1417]" />
              <span>Duplicate Payslip Protection</span>
            </h3>
            <p className={`text-xs mt-2 ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
              A payslip for <strong className={isDark ? 'text-white' : 'text-black'}>{duplicateConfirmTarget.name}</strong> ({duplicateConfirmTarget.employeeId}) has already been generated for <strong className={isDark ? 'text-white' : 'text-black'}>{selectedMonth} {selectedYear}</strong>.
            </p>
            <p className={`text-xs mt-2 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Are you sure you want to regenerate and overwrite this payslip with the current values?
            </p>

            <div className="mt-5 flex justify-end space-x-3">
              <button
                onClick={() => setDuplicateConfirmTarget(null)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark
                    ? 'text-[#A1A1AA] hover:text-white bg-[#141416] border-[#27272A]'
                    : 'text-[#52525B] hover:text-black bg-[#F4F4F6] border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleGenerateSingle(duplicateConfirmTarget, true)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#CB1417] hover:bg-[#ED1F24] transition cursor-pointer"
              >
                Confirm & Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Duplicate Confirmation Warning Modal */}
      {bulkDuplicateWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className={`border rounded-xl max-w-md w-full p-6 shadow-2xl transition ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <AlertTriangle className="w-5 h-5 text-[#CB1417]" />
              <span>Existing Payslips Detected</span>
            </h3>
            <p className={`text-xs mt-2 ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
              Some of the selected employees have already had payslips generated for <strong className={isDark ? 'text-white' : 'text-black'}>{selectedMonth} {selectedYear}</strong>.
            </p>
            <p className={`text-xs mt-2 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Do you want to proceed and regenerate payslips for all {selectedCount} selected employees into a new ZIP archive?
            </p>

            <div className="mt-5 flex justify-end space-x-3">
              <button
                onClick={() => setBulkDuplicateWarning(false)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark
                    ? 'text-[#A1A1AA] hover:text-white bg-[#141416] border-[#27272A]'
                    : 'text-[#52525B] hover:text-black bg-[#F4F4F6] border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleStartBulkExport(true)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#CB1417] hover:bg-[#ED1F24] transition cursor-pointer"
              >
                Proceed & Regenerate All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generation Progress Modal */}
      {isGeneratingBulk && bulkProgress && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className={`border rounded-xl max-w-sm w-full p-6 shadow-2xl text-center transition ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#CB1417]/15 text-[#CB1417] flex items-center justify-center mx-auto mb-3 animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Generating Local PDF Documents...</h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Rendering {bulkProgress.name} ({bulkProgress.current} of {bulkProgress.total})
            </p>

            {/* Progress Bar (Pigment Red #ED1F24 fill) */}
            <div className={`w-full rounded-full h-2 my-4 overflow-hidden ${isDark ? 'bg-[#1C1C20]' : 'bg-[#E4E4E7]'}`}>
              <div
                className="bg-[#ED1F24] h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.round((bulkProgress.current / (bulkProgress.total || 1)) * 100)}%`
                }}
              />
            </div>

            <p className="text-[11px] font-mono text-[#CB1417] font-semibold tabular-nums">
              {Math.round((bulkProgress.current / (bulkProgress.total || 1)) * 100)}% Completed
            </p>
          </div>
        </div>
      )}

      {/* Manual Payslip Editor Modal */}
      {editingEmployee && (
        <PayslipManualEditorModal
          employee={editingEmployee}
          settings={settings}
          month={selectedMonth}
          year={selectedYear}
          layoutSettings={layoutSettings || DEFAULT_LAYOUT_SETTINGS}
          onSaveUpdatedRecord={(updatedEmp, genRecord) => {
            onRecordGenerated(genRecord);
            setSuccessToast(`Successfully revised payslip for ${updatedEmp.name}.`);
            setEditingEmployee(null);
          }}
          onClose={() => setEditingEmployee(null)}
        />
      )}
    </div>
  );
};
