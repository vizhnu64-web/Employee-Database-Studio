import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Plus, 
  Trash2, 
  History,
  Calculator,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { EmployeeRecord, CompanySettings, PayslipLayoutSettings, GeneratedPayslipRecord } from '../types/payroll';
import { generatePayslipPdf, getSafeFileName } from '../utils/pdfGenerator';
import { localDB } from '../utils/dbStorage';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';

interface PayslipManualEditorModalProps {
  employee: EmployeeRecord;
  settings: CompanySettings;
  month: string;
  year: number;
  layoutSettings: PayslipLayoutSettings;
  onSaveUpdatedRecord: (record: EmployeeRecord, generatedRecord: GeneratedPayslipRecord) => void;
  onClose: () => void;
}

interface CustomAdjustment {
  id: string;
  type: 'earning' | 'deduction';
  label: string;
  amount: number;
}

export const PayslipManualEditorModal: React.FC<PayslipManualEditorModalProps> = ({
  employee,
  settings,
  month,
  year,
  layoutSettings,
  onSaveUpdatedRecord,
  onClose
}) => {
  const { isDark } = useTheme();

  // Working state for editable fields
  const [ctc, setCtc] = useState<number>(employee.ctc || 55008);
  const [employerPf, setEmployerPf] = useState<number>(employee.employerPf ?? 3000);
  const [employerEsi, setEmployerEsi] = useState<number>(employee.employerEsi ?? 500);

  // Earnings
  const [basic, setBasic] = useState<number>(employee.basic || 25000);
  const [hra, setHra] = useState<number>(employee.hra || 12000);
  const [specialAllowance, setSpecialAllowance] = useState<number>(employee.specialAllowance || 8658);
  const [otherAllowances, setOtherAllowances] = useState<number>(employee.otherAllowances || 3000);

  // Employee Deductions
  const [employeePf, setEmployeePf] = useState<number>(employee.employeePf ?? employee.pf ?? 3000);
  const [employeeEsi, setEmployeeEsi] = useState<number>(employee.esi ?? 0);
  const [pt, setPt] = useState<number>(employee.professionalTax ?? 208);
  const [tds, setTds] = useState<number>(employee.tds ?? 0);
  const [loan, setLoan] = useState<number>(employee.loan ?? 0);
  const [lateDeduction, setLateDeduction] = useState<number>(employee.lateDeduction ?? 0);
  const [lopDays, setLopDays] = useState<number>(employee.lopDays ?? employee.unpaidDays ?? 2);
  const [lopDeduction, setLopDeduction] = useState<number>(employee.lopDeduction ?? employee.lopAmount ?? 3226);

  // Dynamic Adjustments
  const [adjustments, setAdjustments] = useState<CustomAdjustment[]>([]);
  const [newAdjLabel, setNewAdjLabel] = useState('');
  const [newAdjAmount, setNewAdjAmount] = useState<number>(0);
  const [newAdjType, setNewAdjType] = useState<'earning' | 'deduction'>('deduction');

  // Reason & Audit
  const [revisionReason, setRevisionReason] = useState<string>('Post-generation statutory attendance correction');
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch revisions for this payslip
  const payslipRecordId = `${employee.employeeId.trim()}_${month}_${year}`.toLowerCase();

  useEffect(() => {
    async function loadRevisions() {
      try {
        const res = await apiClient.request(`/payroll/payslip-revisions/${payslipRecordId}`).catch(() => null);
        if (res?.revisions) setRevisionHistory(res.revisions);
      } catch (e) {}
    }
    loadRevisions();
  }, [payslipRecordId]);

  // Dynamic calculations: Total Earnings = CTC - Employer PF - Employer ESI
  const additionalEarnings = adjustments
    .filter(a => a.type === 'earning')
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const totalEarnings = Math.max(0, Math.round(ctc - employerPf - employerEsi + additionalEarnings));

  const additionalDeductions = adjustments
    .filter(a => a.type === 'deduction')
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Total Deductions = EE PF + EE ESI + PT + TDS + Loan + Late + LOP + Other + Dynamic Deductions
  const totalDeductions = Math.round(
    employeePf +
    employeeEsi +
    pt +
    tds +
    loan +
    lateDeduction +
    lopDeduction +
    additionalDeductions
  );

  const calculatedNet = Math.max(0, totalEarnings - totalDeductions);

  const handleAddAdjustment = () => {
    if (!newAdjLabel.trim() || !newAdjAmount) {
      alert('Please specify an adjustment label and amount.');
      return;
    }
    const item: CustomAdjustment = {
      id: `adj_${Date.now()}`,
      type: newAdjType,
      label: newAdjLabel.trim(),
      amount: Math.abs(newAdjAmount)
    };
    setAdjustments([...adjustments, item]);
    setNewAdjLabel('');
    setNewAdjAmount(0);
  };

  const handleRemoveAdjustment = (id: string) => {
    setAdjustments(adjustments.filter(a => a.id !== id));
  };

  const handleSaveAndRegenerate = async (status: 'draft' | 'approved' = 'approved') => {
    if (!revisionReason.trim()) {
      alert('A revision reason is mandatory to edit a generated payslip.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedEmpRecord: EmployeeRecord = {
        ...employee,
        ctc,
        employerPf,
        employerEsi,
        basic,
        hra,
        specialAllowance,
        otherAllowances,
        employeePf,
        pf: employeePf,
        esi: employeeEsi,
        professionalTax: pt,
        tds,
        loan,
        lateDeduction,
        lopDays,
        unpaidDays: lopDays,
        lopDeduction,
        lopAmount: lopDeduction,
        calculatedGross: totalEarnings,
        calculatedDeductions: totalDeductions,
        calculatedNet
      };

      // Regenerate PDF
      const doc = generatePayslipPdf(updatedEmpRecord, settings, month, year, layoutSettings);
      const fileName = getSafeFileName(updatedEmpRecord, month, year);
      const pdfDataUri = doc.output('datauristring');

      const updatedHistoryRecord: GeneratedPayslipRecord = {
        id: payslipRecordId,
        employeeId: employee.employeeId,
        employeeName: employee.name,
        department: employee.department || 'General',
        designation: employee.designation || 'Staff',
        month,
        year,
        grossEarnings: totalEarnings,
        totalDeductions,
        netSalary: calculatedNet,
        generatedAt: new Date().toISOString(),
        fileName,
        pdfDataUri
      };

      // Save to local DB & API
      await localDB.saveGeneratedRecord(updatedHistoryRecord);

      // Log revision via API
      await apiClient.request('/payroll/payslip-revisions', {
        method: 'POST',
        body: JSON.stringify({
          payslipId: payslipRecordId,
          employeeId: employee.employeeId,
          month,
          year,
          newGross: totalEarnings,
          newDeductions: totalDeductions,
          newNet: calculatedNet,
          reason: revisionReason,
          status,
          changes: {
            ctc,
            employerPf,
            employerEsi,
            lopDays,
            lopDeduction,
            adjustments
          }
        })
      }).catch(() => null);

      onSaveUpdatedRecord(updatedEmpRecord, updatedHistoryRecord);
      onClose();
    } catch (err: any) {
      alert(`Failed to save payslip revision: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`border rounded-2xl max-w-4xl w-full my-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden ${
        isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
      }`}>
        {/* Top Header */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-[#222222]' : 'border-[#E4E4E7]'}`}>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-sm font-bold">
              Manual Payslip Revision & Recalculation: {employee.name} ({employee.employeeId})
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/25 font-semibold">
              {month} {year}
            </span>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Formula Verification Notice */}
          <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 flex items-center space-x-2">
            <Calculator className="w-4 h-4 shrink-0" />
            <span>
              <strong>Statutory Formula Enforced:</strong> Total Earnings = CTC − Employer PF − Employer ESI. Employer contributions are excluded from employee deductions.
            </span>
          </div>

          {/* 3-Column Grid of Editable Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. CTC & Employer Contributions */}
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center space-x-1.5">
                <span>1. CTC & Contributions</span>
              </h4>

              <div>
                <label className="font-semibold block mb-1">Monthly CTC (₹)</label>
                <input
                  type="number"
                  value={ctc}
                  onChange={(e) => setCtc(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono font-bold ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Employer PF (₹)</label>
                <input
                  type="number"
                  value={employerPf}
                  onChange={(e) => setEmployerPf(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono text-amber-500 ${isDark ? 'bg-black border-zinc-800' : 'bg-white border-zinc-300'}`}
                />
                <span className="text-[10px] text-zinc-500 block mt-0.5">Deducted from CTC</span>
              </div>

              <div>
                <label className="font-semibold block mb-1">Employer ESI (₹)</label>
                <input
                  type="number"
                  value={employerEsi}
                  onChange={(e) => setEmployerEsi(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono text-amber-500 ${isDark ? 'bg-black border-zinc-800' : 'bg-white border-zinc-300'}`}
                />
                <span className="text-[10px] text-zinc-500 block mt-0.5">Deducted from CTC</span>
              </div>
            </div>

            {/* 2. Employee Statutory Deductions */}
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center space-x-1.5">
                <span>2. Statutory Deductions</span>
              </h4>

              <div>
                <label className="font-semibold block mb-1">Employee PF (₹)</label>
                <input
                  type="number"
                  value={employeePf}
                  onChange={(e) => setEmployeePf(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Employee ESI (₹)</label>
                <input
                  type="number"
                  value={employeeEsi}
                  onChange={(e) => setEmployeeEsi(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Professional Tax (₹)</label>
                <input
                  type="number"
                  value={pt}
                  onChange={(e) => setPt(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">TDS / Income Tax (₹)</label>
                <input
                  type="number"
                  value={tds}
                  onChange={(e) => setTds(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>

            {/* 3. LOP & Loan Deductions */}
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center space-x-1.5">
                <span>3. LOP & Loan Penalties</span>
              </h4>

              <div>
                <label className="font-semibold block mb-1">Approved LOP Days</label>
                <input
                  type="number"
                  step="0.5"
                  value={lopDays}
                  onChange={(e) => setLopDays(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">LOP Deduction (₹)</label>
                <input
                  type="number"
                  value={lopDeduction}
                  onChange={(e) => setLopDeduction(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono font-semibold ${isDark ? 'bg-black border-zinc-800 text-rose-400' : 'bg-white border-zinc-300 text-rose-700'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Staff Loan Recovery (₹)</label>
                <input
                  type="number"
                  value={loan}
                  onChange={(e) => setLoan(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Late Penalty (₹)</label>
                <input
                  type="number"
                  value={lateDeduction}
                  onChange={(e) => setLateDeduction(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>
          </div>

          {/* Custom Adjustments Rows */}
          <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500">
              Additional Post-Generation Adjustments
            </h4>

            {adjustments.length > 0 && (
              <div className="space-y-2">
                {adjustments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg border dark:border-zinc-800 border-zinc-200">
                    <span className="font-semibold">{a.label}</span>
                    <div className="flex items-center space-x-3">
                      <span className={`font-mono font-bold ${a.type === 'earning' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {a.type === 'earning' ? '+ ' : '− '}₹{a.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdjustment(a.id)}
                        className="text-red-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <select
                value={newAdjType}
                onChange={(e) => setNewAdjType(e.target.value as any)}
                className={`rounded px-2.5 py-1.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              >
                <option value="deduction">Deduction (Subtract)</option>
                <option value="earning">Earning / Bonus (Add)</option>
              </select>

              <input
                type="text"
                placeholder="Adjustment description"
                value={newAdjLabel}
                onChange={(e) => setNewAdjLabel(e.target.value)}
                className={`flex-1 rounded px-3 py-1.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              />

              <input
                type="number"
                placeholder="Amount (₹)"
                value={newAdjAmount || ''}
                onChange={(e) => setNewAdjAmount(Number(e.target.value) || 0)}
                className={`w-28 rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              />

              <button
                type="button"
                onClick={handleAddAdjustment}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer inline-flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Reason for Revision Input */}
          <div>
            <label className="font-semibold block mb-1">Reason for Post-Generation Revision *</label>
            <input
              type="text"
              required
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="e.g. Late biometric sync, manager-approved LOP waiver, tax adjustment"
              className={`w-full rounded px-3 py-2 border font-medium ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
            />
          </div>

          {/* Live Recalculated Summary Card */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isDark ? 'bg-[#000000] border-brand-primary/40' : 'bg-zinc-50 border-brand-primary/40'
          }`}>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500">Recalculated Net Payable</span>
              <div className="text-2xl font-black font-mono text-emerald-500">
                ₹{calculatedNet.toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-400 space-x-3">
                <span>Earnings: <strong className="text-emerald-400">₹{totalEarnings.toLocaleString()}</strong></span>
                <span>•</span>
                <span>Deductions: <strong className="text-rose-400">₹{totalDeductions.toLocaleString()}</strong></span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveAndRegenerate('draft')}
                className={`px-3 py-2 rounded-lg font-semibold border transition cursor-pointer ${
                  isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveAndRegenerate('approved')}
                className="px-4 py-2 rounded-lg font-bold btn-primary transition cursor-pointer flex items-center space-x-1.5 shadow-md"
              >
                {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Approve & Regenerate PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
