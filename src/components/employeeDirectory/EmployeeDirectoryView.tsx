import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  UserX,
  UserCheck,
  FileText,
  Download,
  Upload,
  PlusCircle,
  RefreshCw,
  ArrowUpDown,
  Building2,
  FileCheck2,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import {
  DirectoryEmployee,
  EmployeeDocument,
  EmployeeFilterOptions,
  VerificationStatus
} from '../../types/employeeDirectory';
import {
  filterAndSearchEmployees,
  calculateOnboardingChecklist,
  SEED_DIRECTORY_EMPLOYEES
} from '../../utils/employeeDb';
import { useTheme } from '../../context/ThemeContext';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { EmployeeFormModal } from './EmployeeFormModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EmployeeImportModal } from './EmployeeImportModal';

interface EmployeeDirectoryViewProps {
  directoryEmployees: DirectoryEmployee[];
  documents: EmployeeDocument[];
  onSaveEmployee: (employee: DirectoryEmployee) => Promise<void>;
  onSaveBatchEmployees?: (employees: DirectoryEmployee[]) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onSaveDocument: (doc: EmployeeDocument) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onSyncToPayrollBatch?: (employees: DirectoryEmployee[]) => void;
  payrollHistoryCountForEmployee?: (empId: string) => number;
}

export const EmployeeDirectoryView: React.FC<EmployeeDirectoryViewProps> = ({
  directoryEmployees,
  documents,
  onSaveEmployee,
  onSaveBatchEmployees,
  onDeleteEmployee,
  onSaveDocument,
  onDeleteDocument,
  onSyncToPayrollBatch,
  payrollHistoryCountForEmployee
}) => {
  const { isDark } = useTheme();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedVerification, setSelectedVerification] = useState('All');

  // Modal States
  const [profileEmployee, setProfileEmployee] = useState<DirectoryEmployee | null>(null);
  const [formEmployee, setFormEmployee] = useState<DirectoryEmployee | null | undefined>(undefined); // null = add new, undefined = closed
  const [deleteEmployee, setDeleteEmployee] = useState<DirectoryEmployee | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    directoryEmployees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [directoryEmployees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    const filters: EmployeeFilterOptions = {
      searchQuery,
      department: selectedDept,
      employmentStatus: selectedStatus,
      verificationStatus: selectedVerification
    };
    return filterAndSearchEmployees(directoryEmployees, documents, filters);
  }, [directoryEmployees, documents, searchQuery, selectedDept, selectedStatus, selectedVerification]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = directoryEmployees.length;
    const active = directoryEmployees.filter(e => e.employmentStatus === 'Active').length;
    const probation = directoryEmployees.filter(e => e.employmentStatus === 'Probation').length;
    const inactive = directoryEmployees.filter(e =>
      e.employmentStatus === 'Inactive' || e.employmentStatus === 'Resigned' || e.employmentStatus === 'Terminated'
    ).length;

    let fullyVerifiedCount = 0;
    directoryEmployees.forEach(emp => {
      const empDocs = documents.filter(d => d.employeeId === emp.employeeId);
      const checklist = calculateOnboardingChecklist(empDocs);
      if (checklist.isComplete) fullyVerifiedCount++;
    });

    return { total, active, probation, inactive, fullyVerifiedCount };
  }, [directoryEmployees, documents]);

  // Handlers
  const handleToggleActive = async (emp: DirectoryEmployee) => {
    const newStatus = (emp.employmentStatus === 'Active' || emp.employmentStatus === 'Probation')
      ? 'Inactive'
      : 'Active';

    const updated: DirectoryEmployee = {
      ...emp,
      employmentStatus: newStatus,
      updatedAt: new Date().toISOString()
    };

    await onSaveEmployee(updated);
    showToast(`${emp.legalName} has been marked as ${newStatus}.`);

    if (profileEmployee?.id === emp.id) {
      setProfileEmployee(updated);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteEmployee) return;
    const empId = deleteEmployee.id;
    const empName = deleteEmployee.legalName;
    await onDeleteEmployee(empId);
    setDeleteEmployee(null);
    if (profileEmployee?.id === empId) setProfileEmployee(null);
    showToast(`Permanently deleted employee record for ${empName}.`);
  };

  const handleDeactivateFromModal = async () => {
    if (!deleteEmployee) return;
    await handleToggleActive(deleteEmployee);
    setDeleteEmployee(null);
  };

  const handleSyncAllFilteredToPayroll = () => {
    if (filteredEmployees.length === 0) {
      alert('No employee records in current view to sync.');
      return;
    }
    if (onSyncToPayrollBatch) {
      onSyncToPayrollBatch(filteredEmployees);
      showToast(`Synced ${filteredEmployees.length} employees into active payroll batch.`);
    }
  };

  const handleExportDirectoryCsv = () => {
    if (directoryEmployees.length === 0) return;
    const headers = [
      'Employee ID',
      'Legal Name',
      'Preferred Name',
      'Department',
      'Designation',
      'Joining Date',
      'Employment Type',
      'Status',
      'Work Email',
      'Primary Phone',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'PAN',
      'Aadhaar'
    ];

    const rows = directoryEmployees.map(e => [
      `"${e.employeeId}"`,
      `"${e.legalName}"`,
      `"${e.preferredName || ''}"`,
      `"${e.department}"`,
      `"${e.designation}"`,
      `"${e.joiningDate}"`,
      `"${e.employmentType}"`,
      `"${e.employmentStatus}"`,
      `"${e.workEmail}"`,
      `"${e.primaryPhone}"`,
      `"${e.bankName || ''}"`,
      `"${e.accountNumber || ''}"`,
      `"${e.ifscCode || ''}"`,
      `"${e.panNumber || ''}"`,
      `"${e.aadhaarNumber || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Employee_Database_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported employee directory as CSV.');
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
            <Building2 className="w-4 h-4 text-[#CB1417]" />
            <span>Master HR Personnel & Records Center</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Employee Database & Document Management
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Centralized employee profiles, qualifications, government IDs, bank accounts, and verified document storage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportDirectoryCsv}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
            }`}
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
            }`}
            title="Import Employees from Excel / CSV"
          >
            <Upload className="w-3.5 h-3.5 text-[#CB1417]" />
            <span>Import Excel</span>
          </button>

          {onSyncToPayrollBatch && (
            <button
              onClick={handleSyncAllFilteredToPayroll}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                isDark ? 'bg-[#141416] hover:bg-[#222226] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
              title="Add current filtered employees to monthly payroll calculation"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#CB1417]" />
              <span>Sync to Payroll ({filteredEmployees.length})</span>
            </button>
          )}

          <button
            onClick={() => setFormEmployee(null)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className={`p-4 rounded-xl border transition ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>
              Total Staff
            </span>
            <Users className="w-4 h-4 text-[#CB1417]" />
          </div>
          <div className={`text-xl font-bold mt-1.5 tabular-nums ${isDark ? 'text-white' : 'text-black'}`}>
            {stats.total}
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>
              Active
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums text-emerald-500">
            {stats.active}
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>
              Probation
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums text-blue-500">
            {stats.probation}
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>
              Inactive / Exit
            </span>
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
          </div>
          <div className={`text-xl font-bold mt-1.5 tabular-nums ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {stats.inactive}
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>
              Verified Docs
            </span>
            <FileCheck2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums text-emerald-500">
            {stats.fullyVerifiedCount} / {stats.total}
          </div>
        </div>
      </div>

      {/* Global Search & Multi-Field Filters Bar */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row items-stretch md:items-center gap-3 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, name, email, department, role, qualification, or document..."
            className={`w-full pl-9 pr-3 py-2 rounded-lg border text-xs outline-none transition ${
              isDark
                ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]'
                : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Department Filter */}
          <div className="flex items-center space-x-1.5">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={`px-3 py-2 rounded-lg border text-xs outline-none cursor-pointer ${
                isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
              }`}
            >
              <option value="All">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`px-3 py-2 rounded-lg border text-xs outline-none cursor-pointer ${
                isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
              }`}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Probation">Probation</option>
              <option value="Notice Period">Notice Period</option>
              <option value="Inactive">Inactive</option>
              <option value="Resigned">Resigned</option>
            </select>
          </div>

          {/* Document Verification Filter */}
          <div className="flex items-center space-x-1.5">
            <select
              value={selectedVerification}
              onChange={(e) => setSelectedVerification(e.target.value)}
              className={`px-3 py-2 rounded-lg border text-xs outline-none cursor-pointer ${
                isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
              }`}
            >
              <option value="All">All Documents</option>
              <option value="All Verified">All Verified</option>
              <option value="Pending">Pending Review</option>
              <option value="Missing Documents">Missing Required Docs</option>
            </select>
          </div>

          {(searchQuery || selectedDept !== 'All' || selectedStatus !== 'All' || selectedVerification !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDept('All');
                setSelectedStatus('All');
                setSelectedVerification('All');
              }}
              className="px-2.5 py-2 text-xs text-[#CB1417] hover:underline font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Employees Directory Table */}
      {filteredEmployees.length === 0 ? (
        <div
          className={`p-12 rounded-xl border text-center space-y-4 transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <Users className="w-12 h-12 text-[#CB1417] mx-auto opacity-70" />
          <div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              {directoryEmployees.length === 0 ? 'No Employee Records in Database' : 'No Employees Match Your Filter'}
            </h3>
            <p className={`text-xs mt-1 max-w-md mx-auto ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              {directoryEmployees.length === 0
                ? 'Your employee database is currently empty. Click "Add Employee" to create your first HR profile.'
                : 'Try adjusting your search terms or resetting your filters to see all employee records.'}
            </p>
          </div>

          <div className="flex justify-center space-x-3 pt-2">
            {directoryEmployees.length === 0 ? (
              <button
                onClick={() => setFormEmployee(null)}
                className="px-4 py-2 bg-[#CB1417] text-white rounded-lg text-xs font-bold hover:bg-[#ED1F24] transition cursor-pointer shadow-md shadow-[#CB1417]/25"
              >
                Add First Employee
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDept('All');
                  setSelectedStatus('All');
                  setSelectedVerification('All');
                }}
                className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`border rounded-xl overflow-hidden transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#222222]' : 'bg-[#F4F4F6] text-[#71717A] border-[#E4E4E7]'}`}>
                <tr>
                  <th className="p-3.5 font-semibold">Staff ID & Employee</th>
                  <th className="p-3.5 font-semibold">Department & Role</th>
                  <th className="p-3.5 font-semibold">Contact</th>
                  <th className="p-3.5 font-semibold">Status</th>
                  <th className="p-3.5 font-semibold">Onboarding Docs</th>
                  <th className="p-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#222226]' : 'divide-[#E4E4E7]'}`}>
                {filteredEmployees.map(emp => {
                  const empDocs = documents.filter(d => d.employeeId === emp.employeeId);
                  const checklist = calculateOnboardingChecklist(empDocs);

                  return (
                    <tr
                      key={emp.id}
                      className={`transition ${isDark ? 'hover:bg-[#141416]' : 'hover:bg-[#FAFAFC]'}`}
                    >
                      {/* Name & ID */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-[#CB1417]/15 border border-[#CB1417]/30 flex items-center justify-center font-bold text-[#CB1417] text-xs shrink-0">
                            {emp.legalName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className={`font-semibold cursor-pointer hover:underline ${isDark ? 'text-white' : 'text-black'}`} onClick={() => setProfileEmployee(emp)}>
                                {emp.legalName}
                              </span>
                              {emp.preferredName && emp.preferredName !== emp.legalName && (
                                <span className="text-[10px] text-zinc-500">
                                  ({emp.preferredName})
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] font-bold text-[#CB1417]">
                              {emp.employeeId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="p-3.5">
                        <div>
                          <span className={`font-medium ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>
                            {emp.designation}
                          </span>
                          <span className="block text-[11px] text-zinc-500">
                            {emp.department} • Joined {emp.joiningDate}
                          </span>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-3.5">
                        <div>
                          <span className={`font-mono text-[11px] block ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                            {emp.workEmail}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {emp.primaryPhone}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          emp.employmentStatus === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : emp.employmentStatus === 'Probation'
                            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            : emp.employmentStatus === 'Notice Period'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                        }`}>
                          {emp.employmentStatus}
                        </span>
                      </td>

                      {/* Onboarding Documents */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => setProfileEmployee(emp)}
                          className="flex items-center space-x-1.5 cursor-pointer text-left group"
                        >
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                            checklist.isComplete
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          }`}>
                            {checklist.totalCompleted} / {checklist.totalRequired} Docs
                          </span>
                          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200">
                            ({empDocs.length} total)
                          </span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setProfileEmployee(emp)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              isDark ? 'hover:bg-[#222226] border-[#2A2A2E] text-zinc-300' : 'hover:bg-[#E4E4E7] border-zinc-200 text-zinc-700'
                            }`}
                            title="View Full Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setFormEmployee(emp)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              isDark ? 'hover:bg-[#222226] border-[#2A2A2E] text-zinc-300' : 'hover:bg-[#E4E4E7] border-zinc-200 text-zinc-700'
                            }`}
                            title="Edit Profile"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {onSyncToPayrollBatch && (
                            <button
                              onClick={() => {
                                onSyncToPayrollBatch([emp]);
                                showToast(`Added ${emp.legalName} into active payroll batch.`);
                              }}
                              className={`p-1.5 rounded-lg border transition cursor-pointer text-[#CB1417] ${
                                isDark ? 'hover:bg-[#222226] border-[#2A2A2E]' : 'hover:bg-[#E4E4E7] border-zinc-200'
                              }`}
                              title="Add to Current Payroll Batch"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setDeleteEmployee(emp)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer text-red-500 ${
                              isDark ? 'hover:bg-red-950/30 border-[#2A2A2E]' : 'hover:bg-red-50 border-zinc-200'
                            }`}
                            title="Delete or Deactivate Employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileEmployee && (
        <EmployeeProfileModal
          employee={profileEmployee}
          documents={documents}
          onEdit={(emp) => {
            setProfileEmployee(null);
            setFormEmployee(emp);
          }}
          onDeleteRequest={(emp) => {
            setProfileEmployee(null);
            setDeleteEmployee(emp);
          }}
          onToggleStatus={handleToggleActive}
          onAddToPayroll={onSyncToPayrollBatch ? (emp) => {
            onSyncToPayrollBatch([emp]);
            showToast(`Added ${emp.legalName} to current payroll calculation.`);
          } : undefined}
          onSaveDocument={onSaveDocument}
          onDeleteDocument={onDeleteDocument}
          onClose={() => setProfileEmployee(null)}
        />
      )}

      {/* Add / Edit Form Modal */}
      {formEmployee !== undefined && (
        <EmployeeFormModal
          initialEmployee={formEmployee}
          existingEmployees={directoryEmployees}
          onSave={onSaveEmployee}
          onClose={() => setFormEmployee(undefined)}
        />
      )}

      {/* Delete / Deactivate Confirm Modal */}
      {deleteEmployee && (
        <DeleteConfirmModal
          employee={deleteEmployee}
          payrollHistoryCount={payrollHistoryCountForEmployee ? payrollHistoryCountForEmployee(deleteEmployee.employeeId) : 0}
          onDeactivate={handleDeactivateFromModal}
          onPermanentDelete={handleExecuteDelete}
          onClose={() => setDeleteEmployee(null)}
        />
      )}

      {/* Excel Import Modal */}
      {showImportModal && (
        <EmployeeImportModal
          existingEmployees={directoryEmployees}
          onImportComplete={async (imported) => {
            if (onSaveBatchEmployees) {
              await onSaveBatchEmployees(imported);
            } else {
              for (const emp of imported) {
                await onSaveEmployee(emp);
              }
            }
            setShowImportModal(false);
            showToast(`Successfully imported ${imported.length} employee records.`);
          }}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
};
