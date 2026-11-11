import React, { useState } from 'react';
import { AlertTriangle, Trash2, UserX, X, ShieldAlert } from 'lucide-react';
import { DirectoryEmployee } from '../../types/employeeDirectory';
import { useTheme } from '../../context/ThemeContext';

interface DeleteConfirmModalProps {
  employee: DirectoryEmployee;
  payrollHistoryCount: number;
  onDeactivate: () => void;
  onPermanentDelete: () => void;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  employee,
  payrollHistoryCount,
  onDeactivate,
  onPermanentDelete,
  onClose
}) => {
  const { isDark } = useTheme();
  const [confirmInput, setConfirmInput] = useState('');

  const isConfirmed = confirmInput.trim().toUpperCase() === employee.employeeId.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`max-w-lg w-full rounded-2xl border shadow-2xl p-6 space-y-5 transition-colors ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[#ED1F24]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                Delete or Deactivate Employee
              </h3>
              <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                {employee.legalName} ({employee.employeeId}) • {employee.department}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDark ? 'hover:bg-[#222226] text-[#A1A1AA]' : 'hover:bg-[#E4E4E7] text-[#71717A]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if payroll history exists */}
        {payrollHistoryCount > 0 ? (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              isDark
                ? 'bg-[#2E1D0A] border-[#664314] text-[#FDE68A]'
                : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
            }`}
          >
            <div className="flex items-center space-x-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Historical Payroll Audit Protection</span>
            </div>
            <p>
              This employee is associated with <strong>{payrollHistoryCount} generated payslip records</strong> in the payroll system.
            </p>
            <p>
              Permanently deleting this record will remove their profile and all uploaded identity documents.
              <strong> Deactivating the employee</strong> is strongly recommended to preserve historical statutory and compliance records while preventing future payroll generation.
            </p>
          </div>
        ) : (
          <p className={`text-xs ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
            Are you sure you want to remove this employee record from the HR database? This will permanently delete their profile, education records, and all associated documents.
          </p>
        )}

        {/* Permanent Delete Confirmation Input */}
        <div className={`p-4 rounded-xl border space-y-2 text-xs ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
          <label className={`block font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
            To confirm permanent deletion, type <span className="font-mono text-[#ED1F24]">{employee.employeeId}</span> below:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={`Type ${employee.employeeId} to confirm`}
            className={`w-full px-3 py-2 rounded-lg border text-xs outline-none uppercase font-mono transition ${
              isDark
                ? 'bg-[#18181B] border-[#27272A] text-white focus:border-[#CB1417]'
                : 'bg-[#FFFFFF] border-[#E4E4E7] text-black focus:border-[#CB1417]'
            }`}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {payrollHistoryCount > 0 && employee.employmentStatus !== 'Inactive' && employee.employmentStatus !== 'Resigned' && (
            <button
              onClick={onDeactivate}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md shadow-amber-500/20"
            >
              <UserX className="w-4 h-4" />
              <span>Deactivate Employee (Recommended)</span>
            </button>
          )}

          <div className="flex items-center space-x-2 w-full sm:w-auto sm:ml-auto">
            <button
              onClick={onClose}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#27272A]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onPermanentDelete}
              disabled={!isConfirmed}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-bold bg-[#CB1417] hover:bg-[#ED1F24] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md shadow-[#CB1417]/25"
            >
              <Trash2 className="w-4 h-4" />
              <span>Permanently Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
