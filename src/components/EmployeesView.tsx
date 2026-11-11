import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Eye,
  Trash2,
  ArrowUpDown,
  X,
  Save,
  ShieldAlert
} from 'lucide-react';
import { CompanySettings, EmployeeRecord } from '../types/payroll';
import { validateEmployeeRecord } from '../utils/payrollValidator';
import { useTheme } from '../context/ThemeContext';

interface EmployeesViewProps {
  employees: EmployeeRecord[];
  onUpdateEmployee: (updated: EmployeeRecord) => void;
  onPreviewPayslip: (employee: EmployeeRecord) => void;
  onClearData: () => void;
  settings: CompanySettings;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  onUpdateEmployee,
  onPreviewPayslip,
  onClearData,
  settings
}) => {
  const { isDark } = useTheme();
  const showSymbol = settings.showCurrencySymbol !== false;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'issues'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'employeeId' | 'name' | 'department' | 'calculatedNet'>('employeeId');
  const [sortAsc, setSortAsc] = useState(true);

  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        e.employeeId.toLowerCase().includes(term) ||
        e.name.toLowerCase().includes(term) ||
        (e.department && e.department.toLowerCase().includes(term)) ||
        (e.designation && e.designation.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'valid' && e.isValid && e.issues.length === 0) ||
        (statusFilter === 'issues' && (!e.isValid || e.issues.length > 0));

      const matchesDept = deptFilter === 'all' || e.department === deptFilter;

      return matchesSearch && matchesStatus && matchesDept;
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [employees, searchTerm, statusFilter, deptFilter, sortField, sortAsc]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleEditChange = (field: keyof EmployeeRecord, value: any) => {
    if (!editingEmployee) return;
    setEditingEmployee({
      ...editingEmployee,
      [field]: value
    });
  };

  const handleSaveEdit = () => {
    if (!editingEmployee) return;
    const allIds = employees.map(e => e.id === editingEmployee.id ? editingEmployee.employeeId : e.employeeId);
    const validated = validateEmployeeRecord(editingEmployee, allIds);

    const updatedRecord: EmployeeRecord = {
      ...editingEmployee,
      calculatedGross: validated.calculatedGross,
      calculatedDeductions: validated.calculatedDeductions,
      calculatedNet: validated.calculatedNet,
      isValid: validated.isValid,
      issues: validated.issues
    };

    onUpdateEmployee(updatedRecord);
    setEditingEmployee(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Summary & Actions */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-4 ${isDark ? 'border-[#222222]' : 'border-[#E4E4E7]'}`}>
        <div>
          <h2 className={`text-lg font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
            <Users className="w-5 h-5 text-[#CB1417]" />
            <span>Employee Master & Payroll Records</span>
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Showing {filteredEmployees.length} of {employees.length} employees. Search, inspect, and audit individual salaries.
          </p>
        </div>

        {employees.length > 0 && (
          <button
            onClick={onClearData}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition self-start sm:self-auto cursor-pointer ${
              isDark
                ? 'bg-[#2E0B0D] hover:bg-[#451013] text-[#FCA5A5] border-[#57151A]'
                : 'bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Dataset</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Search */}
        <div className="relative w-full md:w-80">
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
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className={`absolute right-2.5 top-2.5 ${isDark ? 'text-[#71717A] hover:text-white' : 'text-[#A1A1AA] hover:text-black'}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className={`flex items-center p-1 rounded-lg border text-xs ${isDark ? 'bg-[#000000] border-[#222222]' : 'bg-[#F4F4F6] border-[#E4E4E7]'}`}>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#CB1417] text-white font-semibold'
                  : isDark
                  ? 'text-[#A1A1AA] hover:text-white'
                  : 'text-[#71717A] hover:text-black'
              }`}
            >
              All ({employees.length})
            </button>
            <button
              onClick={() => setStatusFilter('valid')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                statusFilter === 'valid'
                  ? 'bg-[#CB1417] text-white font-semibold'
                  : isDark
                  ? 'text-[#A1A1AA] hover:text-white'
                  : 'text-[#71717A] hover:text-black'
              }`}
            >
              Valid ({employees.filter(e => e.isValid).length})
            </button>
            <button
              onClick={() => setStatusFilter('issues')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                statusFilter === 'issues'
                  ? 'bg-[#ED1F24] text-white font-semibold'
                  : isDark
                  ? 'text-[#A1A1AA] hover:text-white'
                  : 'text-[#71717A] hover:text-black'
              }`}
            >
              Review ({employees.filter(e => !e.isValid || e.issues.length > 0).length})
            </button>
          </div>

          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className={`text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CB1417] border ${
                isDark
                  ? 'bg-[#000000] border-[#27272A] text-white'
                  : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
              }`}
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Records Table */}
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
                <th
                  onClick={() => toggleSort('employeeId')}
                  className="p-3 cursor-pointer hover:text-[#CB1417]"
                >
                  <div className="flex items-center space-x-1">
                    <span>Emp ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="p-3 cursor-pointer hover:text-[#CB1417]"
                >
                  <div className="flex items-center space-x-1">
                    <span>Employee Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('department')}
                  className="p-3 cursor-pointer hover:text-[#CB1417]"
                >
                  <div className="flex items-center space-x-1">
                    <span>Department / Role</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 text-right">Basic</th>
                <th className="p-3 text-right">Gross Earnings</th>
                <th className="p-3 text-right">Deductions</th>
                <th
                  onClick={() => toggleSort('calculatedNet')}
                  className="p-3 text-right cursor-pointer hover:text-[#CB1417]"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Net Pay</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E1E22]' : 'divide-[#F4F4F6]'}`}>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className={`p-10 text-center ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
                    No matching employee records found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const hasIssues = emp.issues.length > 0;
                  const hasErrors = !emp.isValid;

                  return (
                    <tr
                      key={emp.id}
                      className={`transition ${isDark ? 'hover:bg-[#121214]' : 'hover:bg-[#F8F9FA]'}`}
                    >
                      {/* Emp ID (preserving leading zeros) */}
                      <td className={`p-3 font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                        {emp.employeeId}
                      </td>

                      {/* Name */}
                      <td className="p-3">
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                          {emp.name || <span className="text-[#ED1F24] italic">Missing Name</span>}
                        </div>
                        {emp.email && <div className={`text-[10px] ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>{emp.email}</div>}
                      </td>

                      {/* Department / Role */}
                      <td className="p-3">
                        <div className={isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}>{emp.department || 'General'}</div>
                        <div className={`text-[10px] ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>{emp.designation || 'Staff'}</div>
                      </td>

                      {/* Basic */}
                      <td className={`p-3 text-right font-mono tabular-nums ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
                        {showSymbol ? `${settings.currencySymbol} ` : ''}{emp.basic.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Gross Earnings */}
                      <td className={`p-3 text-right font-mono font-medium tabular-nums ${isDark ? 'text-white' : 'text-black'}`}>
                        {showSymbol ? `${settings.currencySymbol} ` : ''}{emp.calculatedGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Deductions */}
                      <td className="p-3 text-right font-mono text-[#ED1F24] tabular-nums">
                        - {showSymbol ? `${settings.currencySymbol} ` : ''}{emp.calculatedDeductions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Net Pay */}
                      <td className="p-3 text-right font-mono font-bold text-[#CB1417] tabular-nums">
                        {showSymbol ? `${settings.currencySymbol} ` : ''}{emp.calculatedNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        {hasErrors ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ED1F24]/15 border border-[#ED1F24]/40 text-[#ED1F24]">
                            <ShieldAlert className="w-3 h-3 text-[#ED1F24]" />
                            <span>Error</span>
                          </span>
                        ) : hasIssues ? (
                          <span
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ED1F24]/10 border border-[#ED1F24]/30 text-[#ED1F24]"
                            title={emp.issues[0].message}
                          >
                            <AlertTriangle className="w-3 h-3 text-[#ED1F24]" />
                            <span>Discrepancy</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#CB1417]/10 border border-[#CB1417]/30 text-[#CB1417]">
                            <CheckCircle2 className="w-3 h-3 text-[#CB1417]" />
                            <span>Verified</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onPreviewPayslip(emp)}
                            title="Preview Payslip PDF"
                            className={`p-1.5 rounded border transition cursor-pointer ${
                              isDark
                                ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]'
                                : 'bg-[#FFFFFF] hover:bg-[#F4F4F5] text-black border-[#E4E4E7]'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingEmployee({ ...emp })}
                            title="Inspect & Edit Record"
                            className="p-1.5 bg-[#CB1417]/10 hover:bg-[#CB1417]/20 text-[#CB1417] rounded border border-[#CB1417]/30 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
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

      {/* Slide-over Edit Drawer */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg border-l h-full p-6 flex flex-col justify-between overflow-y-auto shadow-2xl transition ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-[#222222]' : 'border-[#E4E4E7]'}`}>
                <div>
                  <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                    <Edit3 className="w-4 h-4 text-[#CB1417]" />
                    <span>Edit Record: {editingEmployee.employeeId}</span>
                  </h3>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                    Modify parameters and immediately recalculate verified salary totals.
                  </p>
                </div>
                <button
                  onClick={() => setEditingEmployee(null)}
                  className={`p-1 rounded-lg transition cursor-pointer ${
                    isDark ? 'text-[#A1A1AA] hover:text-white hover:bg-[#18181B]' : 'text-[#71717A] hover:text-black hover:bg-[#F4F4F6]'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 text-xs">
                {/* ID & Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Employee ID *</label>
                    <input
                      type="text"
                      value={editingEmployee.employeeId}
                      onChange={(e) => handleEditChange('employeeId', e.target.value)}
                      className={`w-full rounded px-2.5 py-1.5 font-mono border focus:outline-none focus:border-[#CB1417] ${
                        isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Employee Name *</label>
                    <input
                      type="text"
                      value={editingEmployee.name}
                      onChange={(e) => handleEditChange('name', e.target.value)}
                      className={`w-full rounded px-2.5 py-1.5 border focus:outline-none focus:border-[#CB1417] ${
                        isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                      }`}
                    />
                  </div>
                </div>

                {/* Dept & Designation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Department</label>
                    <input
                      type="text"
                      value={editingEmployee.department || ''}
                      onChange={(e) => handleEditChange('department', e.target.value)}
                      className={`w-full rounded px-2.5 py-1.5 border focus:outline-none focus:border-[#CB1417] ${
                        isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Designation</label>
                    <input
                      type="text"
                      value={editingEmployee.designation || ''}
                      onChange={(e) => handleEditChange('designation', e.target.value)}
                      className={`w-full rounded px-2.5 py-1.5 border focus:outline-none focus:border-[#CB1417] ${
                        isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                      }`}
                    />
                  </div>
                </div>

                {/* Paid Days & LOP */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Paid Days</label>
                    <input
                      type="number"
                      value={editingEmployee.paidDays ?? 30}
                      onChange={(e) => handleEditChange('paidDays', Number(e.target.value))}
                      className={`w-full rounded px-2.5 py-1.5 border focus:outline-none focus:border-[#CB1417] ${
                        isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Loss of Pay (LOP) Days</label>
                    <input
                      type="number"
                      value={editingEmployee.unpaidDays ?? 0}
                      onChange={(e) => handleEditChange('unpaidDays', Number(e.target.value))}
                      className={`w-full rounded px-2.5 py-1.5 border focus:outline-none focus:border-[#CB1417] ${
                        isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                      }`}
                    />
                  </div>
                </div>

                {/* Earnings Section */}
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#F9F9FB] border-[#E4E4E7]'}`}>
                  <span className="text-[11px] font-bold text-[#CB1417] uppercase tracking-wider block">
                    Earnings Components
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Basic Salary</label>
                      <input
                        type="number"
                        value={editingEmployee.basic}
                        onChange={(e) => handleEditChange('basic', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>HRA</label>
                      <input
                        type="number"
                        value={editingEmployee.hra}
                        onChange={(e) => handleEditChange('hra', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Special Allowance</label>
                      <input
                        type="number"
                        value={editingEmployee.specialAllowance || 0}
                        onChange={(e) => handleEditChange('specialAllowance', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Other Allowances</label>
                      <input
                        type="number"
                        value={editingEmployee.otherAllowances || 0}
                        onChange={(e) => handleEditChange('otherAllowances', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Deductions Section */}
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#F9F9FB] border-[#E4E4E7]'}`}>
                  <span className="text-[11px] font-bold text-[#ED1F24] uppercase tracking-wider block">
                    Deductions Components
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Provident Fund (PF)</label>
                      <input
                        type="number"
                        value={editingEmployee.pf}
                        onChange={(e) => handleEditChange('pf', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>ESI</label>
                      <input
                        type="number"
                        value={editingEmployee.esi}
                        onChange={(e) => handleEditChange('esi', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Professional Tax (PT)</label>
                      <input
                        type="number"
                        value={editingEmployee.professionalTax}
                        onChange={(e) => handleEditChange('professionalTax', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>TDS / Income Tax</label>
                      <input
                        type="number"
                        value={editingEmployee.tds}
                        onChange={(e) => handleEditChange('tds', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Bank & Statutory Section */}
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#F9F9FB] border-[#E4E4E7]'}`}>
                  <span className="text-[11px] font-bold text-[#CB1417] uppercase tracking-wider block">
                    Bank & Statutory Details
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Bank Account Number</label>
                      <input
                        type="text"
                        value={editingEmployee.bankAccount || ''}
                        onChange={(e) => handleEditChange('bankAccount', e.target.value)}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Bank Name</label>
                      <input
                        type="text"
                        value={editingEmployee.bankName || ''}
                        onChange={(e) => handleEditChange('bankName', e.target.value)}
                        className={`w-full rounded px-2 py-1 border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>IFSC Code</label>
                      <input
                        type="text"
                        value={editingEmployee.ifscCode || ''}
                        onChange={(e) => handleEditChange('ifscCode', e.target.value.toUpperCase())}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>ESI Number</label>
                      <input
                        type="text"
                        value={editingEmployee.esiNumber || ''}
                        onChange={(e) => handleEditChange('esiNumber', e.target.value)}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>PAN Number</label>
                      <input
                        type="text"
                        value={editingEmployee.pan || ''}
                        onChange={(e) => handleEditChange('pan', e.target.value.toUpperCase())}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>LOP Amount (Rs)</label>
                      <input
                        type="number"
                        value={editingEmployee.lopAmount || 0}
                        onChange={(e) => handleEditChange('lopAmount', Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 font-mono border focus:outline-none focus:border-[#CB1417] ${
                          isDark ? 'bg-[#000000] border-[#2A2A2E] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className={`pt-4 border-t flex justify-end space-x-3 mt-6 ${isDark ? 'border-[#222222]' : 'border-[#E4E4E7]'}`}>
              <button
                onClick={() => setEditingEmployee(null)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark
                    ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2A2A2E]'
                    : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-semibold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save & Recalculate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
