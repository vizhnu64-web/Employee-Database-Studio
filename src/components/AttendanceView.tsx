import React, { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  Download,
  Plus,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  Server,
  Database,
  Key,
  FileText,
  Check,
  X,
  Briefcase,
  Award,
  Settings,
  History,
  Eye,
  Trash2,
  RefreshCw,
  FileCheck,
  Paperclip,
  CheckSquare
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  designation?: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workingHours: number;
  status: 'Present' | 'Absent' | 'Half Day' | 'Paid Leave' | 'Unpaid Leave' | 'Weekly Off' | 'Public Holiday' | 'Company Holiday' | 'Late Arrival' | 'Missing Punch' | 'Extra Work Candidate';
  source: string;
  approved: boolean;
  remarks?: string;
}

export interface DeviceItem {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  ip: string;
  port: string;
  protocol: string;
  location: string;
  status: 'Online' | 'Offline';
  lastSync: string;
  punchesCount: number;
}

export interface HolidayItem {
  id: string;
  date: string;
  name: string;
  category: 'Public Holiday' | 'Festival' | 'Company Holiday' | 'Special Declared';
  paid: boolean;
  scope: string;
}

export interface ExtraWorkItem {
  id: string;
  employeeId: string;
  name: string;
  date: string;
  type: string;
  hours: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Clarification Requested';
  compensation: 'Additional Payment' | 'Compensatory Off' | 'Both' | 'Record Only' | 'Pending Decision';
  proof?: string;
  reason: string;
  remarks?: string;
}

export const AttendanceView: React.FC = () => {
  const { isDark } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState<string>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState('October');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);
  const [showAddExtraWorkModal, setShowAddExtraWorkModal] = useState(false);
  const [approvingExtraWork, setApprovingExtraWork] = useState<ExtraWorkItem | null>(null);

  // Settings State
  const [lopDenominator, setLopDenominator] = useState('30_days');
  const [salaryTestAmount, setSalaryTestAmount] = useState(30000);
  const [testLopDays, setTestLopDays] = useState(2);

  // Shift settings
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [gracePeriod, setGracePeriod] = useState(15);
  const [minFullDayHours, setMinFullDayHours] = useState(8);
  const [minHalfDayHours, setMinHalfDayHours] = useState(4);

  // Attendance Records State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([
    { id: 'att_1', employeeId: '00101', name: 'Alexander Wright', department: 'Engineering', designation: 'Lead Architect', date: '2026-10-01', checkIn: '09:00 AM', checkOut: '06:00 PM', workingHours: 9.0, status: 'Present', source: 'ZKTeco Biometric', approved: true },
    { id: 'att_2', employeeId: '00102', name: 'Sophia Chen', department: 'Product', designation: 'Senior Product Manager', date: '2026-10-01', checkIn: '09:15 AM', checkOut: '06:10 PM', workingHours: 8.9, status: 'Present', source: 'ZKTeco Biometric', approved: true },
    { id: 'att_3', employeeId: '00103', name: 'Liam Patel', department: 'Engineering', designation: 'Software Engineer', date: '2026-10-01', checkIn: '--', checkOut: '--', workingHours: 0, status: 'Paid Leave', source: 'HR Portal', approved: true },
    { id: 'att_4', employeeId: '00104', name: 'Emma Watson', department: 'HR & Admin', designation: 'HR Generalist', date: '2026-10-01', checkIn: '09:30 AM', checkOut: '06:00 PM', workingHours: 8.5, status: 'Late Arrival', source: 'eSSL Biometric', approved: true },
    { id: 'att_5', employeeId: '00105', name: 'Noah Khan', department: 'Sales', designation: 'Account Executive', date: '2026-10-01', checkIn: '--', checkOut: '--', workingHours: 0, status: 'Absent', source: 'System', approved: false },
    { id: 'att_6', employeeId: '00106', name: 'Olivia Martin', department: 'Operations', designation: 'Operations Manager', date: '2026-10-01', checkIn: '08:55 AM', checkOut: '--', workingHours: 4.0, status: 'Missing Punch', source: 'ZKTeco Biometric', approved: false }
  ]);

  // Devices State
  const [devices, setDevices] = useState<DeviceItem[]>([
    { id: 'dev_1', name: 'Main Office Gate ZKTeco', manufacturer: 'ZKTeco', model: 'iFace402', ip: '192.168.1.201', port: '4370', protocol: 'TCP/IP Push SDK', location: 'Reception Entrance', status: 'Online', lastSync: '2026-11-01 10:30 AM', punchesCount: 1420 },
    { id: 'dev_2', name: 'Cafeteria eSSL Terminal', manufacturer: 'eSSL', model: 'K40 Pro', ip: '192.168.1.202', port: '4370', protocol: 'TCP/IP Push SDK', location: 'Cafeteria Floor 2', status: 'Online', lastSync: '2026-11-01 10:15 AM', punchesCount: 890 }
  ]);

  // Holidays State
  const [holidays, setHolidays] = useState<HolidayItem[]>([
    { id: 'hol_1', date: '2026-01-26', name: 'Republic Day', category: 'Public Holiday', paid: true, scope: 'All Company' },
    { id: 'hol_2', date: '2026-05-01', name: 'May Day / Labor Day', category: 'Public Holiday', paid: true, scope: 'All Company' },
    { id: 'hol_3', date: '2026-08-15', name: 'Independence Day', category: 'Public Holiday', paid: true, scope: 'All Company' },
    { id: 'hol_4', date: '2026-10-02', name: 'Gandhi Jayanti', category: 'Public Holiday', paid: true, scope: 'All Company' },
    { id: 'hol_5', date: '2026-11-08', name: 'Diwali Festival', category: 'Festival', paid: true, scope: 'All Company' }
  ]);

  // Extra Works State
  const [extraWorks, setExtraWorks] = useState<ExtraWorkItem[]>([
    { id: 'ew_1', employeeId: '00101', name: 'Alexander Wright', date: '2026-10-04', type: 'Sunday Work', hours: 8.0, status: 'Pending', compensation: 'Pending Decision', proof: 'server_migration_ticket.pdf', reason: 'Emergency server room migration and rack cabling' },
    { id: 'ew_2', employeeId: '00103', name: 'Liam Patel', date: '2026-10-02', type: 'Holiday Work (Gandhi Jayanti)', hours: 6.5, status: 'Approved', compensation: 'Compensatory Off', proof: 'client_critical_hotfix.png', reason: 'High priority production incident support' }
  ]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; timestamp: string; user: string; action: string; details: string }>>([
    { id: 'log_1', timestamp: '2026-11-01 10:30', user: 'admin', action: 'Biometric Sync', details: 'Synced 48 punch records from Main Office Gate ZKTeco' },
    { id: 'log_2', timestamp: '2026-11-01 09:45', user: 'hr_lead', action: 'Approval', details: 'Approved Extra Work for Liam Patel (Compensatory Off)' }
  ]);

  // Form states for adding attendance
  const [newEmpId, setNewEmpId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Engineering');
  const [newDate, setNewDate] = useState('2026-10-01');
  const [newCheckIn, setNewCheckIn] = useState('09:00 AM');
  const [newCheckOut, setNewCheckOut] = useState('06:00 PM');
  const [newStatus, setNewStatus] = useState<AttendanceRecord['status']>('Present');
  const [newRemarks, setNewRemarks] = useState('');

  // Form states for adding device
  const [newDevName, setNewDevName] = useState('');
  const [newDevMaker, setNewDevMaker] = useState('ZKTeco');
  const [newDevModel, setNewDevModel] = useState('iFace402');
  const [newDevIp, setNewDevIp] = useState('192.168.1.205');
  const [newDevPort, setNewDevPort] = useState('4370');
  const [newDevLoc, setNewDevLoc] = useState('Branch Office Gate');

  // Form states for adding holiday
  const [newHolDate, setNewHolDate] = useState('2026-12-25');
  const [newHolName, setNewHolName] = useState('Christmas Day');
  const [newHolCategory, setNewHolCategory] = useState<HolidayItem['category']>('Public Holiday');

  // Form states for extra work
  const [ewEmpId, setEwEmpId] = useState('00102');
  const [ewName, setEwName] = useState('Sophia Chen');
  const [ewDate, setEwDate] = useState('2026-10-11');
  const [ewType, setEwType] = useState('Sunday Work');
  const [ewHours, setEwHours] = useState(8);
  const [ewReason, setEwReason] = useState('Product launch sprint release deployment');
  const [ewProofFileName, setEwProofFileName] = useState<string>('');

  // Compensation decision form state
  const [chosenComp, setChosenComp] = useState<ExtraWorkItem['compensation']>('Additional Payment');

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Filtered attendance records
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      const matchSearch = searchTerm === '' ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = departmentFilter === 'All' || r.department === departmentFilter;
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [attendanceRecords, searchTerm, departmentFilter, statusFilter]);

  // Subtabs list
  const subTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Calendar },
    { id: 'daily', label: 'Daily Register', icon: Users },
    { id: 'weekly', label: 'Weekly Summary', icon: Clock },
    { id: 'monthly', label: 'Monthly Matrix', icon: FileSpreadsheet },
    { id: 'yearly', label: 'Yearly Trend', icon: History },
    { id: 'devices', label: 'Attendance Devices', icon: Server },
    { id: 'import', label: 'Import Punch Log', icon: Upload },
    { id: 'approvals', label: 'Approvals & Corrections', icon: ShieldCheck },
    { id: 'holidays', label: 'Holiday Calendar', icon: Calendar },
    { id: 'extrawork', label: 'Extra Working Days', icon: Briefcase },
    { id: 'rules', label: 'Rules & LOP Settings', icon: Settings },
    { id: 'reports', label: 'Reports & Exports', icon: Download },
    { id: 'audit', label: 'Audit History', icon: FileCheck }
  ];

  // Handlers
  const handleCreateAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpId.trim() || !newName.trim()) {
      alert('Employee ID and Name are required.');
      return;
    }
    const newRec: AttendanceRecord = {
      id: `att_${Date.now()}`,
      employeeId: newEmpId.trim(),
      name: newName.trim(),
      department: newDept,
      date: newDate,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      workingHours: 9.0,
      status: newStatus,
      source: 'HR Manual Entry',
      approved: true,
      remarks: newRemarks
    };
    setAttendanceRecords(prev => [newRec, ...prev]);
    setAuditLogs(prev => [{
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      user: 'HR Manager',
      action: 'Manual Attendance Added',
      details: `Added ${newRec.status} record for ${newRec.name} (${newRec.employeeId})`
    }, ...prev]);
    setShowAddAttendanceModal(false);
    showToastMsg(`Attendance recorded for ${newRec.name}.`);
  };

  const handleCreateDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName.trim()) {
      alert('Device name is required.');
      return;
    }
    const dev: DeviceItem = {
      id: `dev_${Date.now()}`,
      name: newDevName.trim(),
      manufacturer: newDevMaker,
      model: newDevModel,
      ip: newDevIp,
      port: newDevPort,
      protocol: 'TCP/IP Push SDK',
      location: newDevLoc,
      status: 'Online',
      lastSync: 'Just now',
      punchesCount: 0
    };
    setDevices(prev => [...prev, dev]);
    setShowAddDeviceModal(false);
    showToastMsg(`Connected biometric terminal ${dev.name} (${dev.ip}).`);
  };

  const handleCreateHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolName.trim()) {
      alert('Holiday name is required.');
      return;
    }
    const hol: HolidayItem = {
      id: `hol_${Date.now()}`,
      date: newHolDate,
      name: newHolName.trim(),
      category: newHolCategory,
      paid: true,
      scope: 'All Company'
    };
    setHolidays(prev => [...prev, hol]);
    setShowAddHolidayModal(false);
    showToastMsg(`Added company holiday "${hol.name}" for ${hol.date}.`);
  };

  const handleCreateExtraWork = (e: React.FormEvent) => {
    e.preventDefault();
    const item: ExtraWorkItem = {
      id: `ew_${Date.now()}`,
      employeeId: ewEmpId,
      name: ewName,
      date: ewDate,
      type: ewType,
      hours: Number(ewHours),
      status: 'Pending',
      compensation: 'Pending Decision',
      proof: ewProofFileName || 'manual_approval_memo.pdf',
      reason: ewReason
    };
    setExtraWorks(prev => [item, ...prev]);
    setShowAddExtraWorkModal(false);
    showToastMsg(`Extra working day recorded for ${item.name}. Ready for HR compensation approval.`);
  };

  const handleConfirmCompensation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingExtraWork) return;
    setExtraWorks(prev => prev.map(ew => {
      if (ew.id === approvingExtraWork.id) {
        return {
          ...ew,
          status: 'Approved',
          compensation: chosenComp
        };
      }
      return ew;
    }));
    setAuditLogs(prev => [{
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      user: 'HR / Payroll Specialist',
      action: 'Extra Work Approved',
      details: `Approved ${chosenComp} for ${approvingExtraWork.name} on ${approvingExtraWork.date}`
    }, ...prev]);
    setApprovingExtraWork(null);
    showToastMsg(`Approved ${chosenComp} for ${approvingExtraWork.name}.`);
  };

  const handleExportCSV = (reportType: string) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (reportType === 'daily') {
      csvContent += 'Employee ID,Name,Department,Date,Check-In,Check-Out,Hours,Status,Source\n';
      filteredRecords.forEach(r => {
        csvContent += `${r.employeeId},"${r.name}","${r.department}",${r.date},${r.checkIn},${r.checkOut},${r.workingHours},${r.status},"${r.source}"\n`;
      });
    } else {
      csvContent += 'Employee ID,Name,Date,Type,Hours,Status,Compensation,Reason\n';
      extraWorks.forEach(w => {
        csvContent += `${w.employeeId},"${w.name}",${w.date},"${w.type}",${w.hours},${w.status},"${w.compensation}","${w.reason}"\n`;
      });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PeopleDeskStudio_${reportType}_Attendance_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToastMsg(`Downloaded ${reportType} attendance report as CSV.`);
  };

  // LOP Calculation Simulation
  const denominatorVal = lopDenominator === 'calendar_days' ? 31 : lopDenominator === '30_days' ? 30 : 22;
  const dailyRate = Math.round(salaryTestAmount / denominatorVal);
  const totalLopDeduction = dailyRate * testLopDays;
  const netPayable = salaryTestAmount - totalLopDeduction;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4 text-brand-primary" />
            <span>Enterprise Attendance & Payroll Integration</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Attendance Management System
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Centralized biometric sync, shift definitions, annual holiday calendar, LOP automation, and Sunday/holiday extra work workflows.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowAddAttendanceModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer btn-primary shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manual Attendance</span>
          </button>
          <button
            onClick={() => setActiveSubTab('devices')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
              isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2A2A2E]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
            }`}
          >
            <Server className="w-4 h-4 text-brand-primary" />
            <span>Biometric Devices</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs Bar */}
      <div className={`flex items-center space-x-1 border-b overflow-x-auto pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={isActive ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-text)' } : undefined}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'shadow-sm'
                  : isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-[#141416]'
                  : 'text-zinc-600 hover:text-black hover:bg-[#F4F4F6]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* SUBTAB 1: DASHBOARD */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => { setStatusFilter('Present'); setActiveSubTab('daily'); }}
              className={`border rounded-xl p-4 flex items-center justify-between cursor-pointer transition hover:scale-[1.01] ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}
            >
              <div>
                <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Present Today</p>
                <p className="text-2xl font-extrabold mt-1 text-emerald-500">2 Records</p>
                <p className="text-[11px] mt-0.5 text-emerald-600 dark:text-emerald-400 font-medium">Click to view present employees</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => { setStatusFilter('Absent'); setActiveSubTab('daily'); }}
              className={`border rounded-xl p-4 flex items-center justify-between cursor-pointer transition hover:scale-[1.01] ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}
            >
              <div>
                <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Absent Today</p>
                <p className="text-2xl font-extrabold mt-1 text-red-500">1 Record</p>
                <p className="text-[11px] mt-0.5 text-red-600 dark:text-red-400 font-medium">LOP candidate for review</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                <X className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => { setStatusFilter('Paid Leave'); setActiveSubTab('daily'); }}
              className={`border rounded-xl p-4 flex items-center justify-between cursor-pointer transition hover:scale-[1.01] ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}
            >
              <div>
                <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Approved Leaves</p>
                <p className={`text-2xl font-extrabold mt-1 ${isDark ? 'text-white' : 'text-black'}`}>1 Record</p>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Paid Leave / Casual</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#CB1417]/10 text-[#CB1417] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => setActiveSubTab('extrawork')}
              className={`border rounded-xl p-4 flex items-center justify-between cursor-pointer transition hover:scale-[1.01] ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}
            >
              <div>
                <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Sunday / Holiday Extra Work</p>
                <p className="text-2xl font-extrabold mt-1 text-amber-500">{extraWorks.length} Records</p>
                <p className="text-[11px] mt-0.5 text-amber-600 dark:text-amber-400 font-medium">Pending HR Compensation</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Quick Registry Preview */}
          <div className={`border rounded-xl p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Today's Live Attendance Feed</h3>
              <button
                onClick={() => setActiveSubTab('daily')}
                className="text-xs font-semibold text-[#CB1417] hover:underline cursor-pointer"
              >
                Open Full Daily Register →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                  <tr>
                    <th className="p-3">Emp ID</th>
                    <th className="p-3">Employee Name</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Check In</th>
                    <th className="p-3">Check Out</th>
                    <th className="p-3">Hours</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Source</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
                  {attendanceRecords.slice(0, 5).map(r => (
                    <tr key={r.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                      <td className="p-3 font-mono font-medium">{r.employeeId}</td>
                      <td className="p-3 font-semibold">{r.name}</td>
                      <td className="p-3 opacity-80">{r.department}</td>
                      <td className="p-3 font-mono">{r.checkIn}</td>
                      <td className="p-3 font-mono">{r.checkOut}</td>
                      <td className="p-3 font-mono font-bold">{r.workingHours}h</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'Present' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' :
                          r.status === 'Paid Leave' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30' :
                          r.status === 'Late Arrival' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' :
                          'bg-red-500/10 text-red-500 border border-red-500/30'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-500">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: DAILY ATTENDANCE */}
      {activeSubTab === 'daily' && (
        <div className="space-y-4">
          <div className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search employee or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-lg text-xs border focus:outline-none focus:border-[#CB1417] ${
                    isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'
                  }`}
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className={`rounded-lg px-3 py-2 text-xs border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              >
                <option value="All">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Product">Product</option>
                <option value="HR & Admin">HR & Admin</option>
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`rounded-lg px-3 py-2 text-xs border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              >
                <option value="All">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Paid Leave">Paid Leave</option>
                <option value="Late Arrival">Late Arrival</option>
                <option value="Missing Punch">Missing Punch</option>
              </select>

              {(searchTerm || departmentFilter !== 'All' || statusFilter !== 'All') && (
                <button
                  onClick={() => { setSearchTerm(''); setDepartmentFilter('All'); setStatusFilter('All'); }}
                  className="text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExportCSV('daily')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 cursor-pointer ${
                  isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setShowAddAttendanceModal(true)}
                className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Record</span>
              </button>
            </div>
          </div>

          <div className={`border rounded-xl overflow-hidden ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                <tr>
                  <th className="p-3">Emp ID</th>
                  <th className="p-3">Employee Name</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Check-In</th>
                  <th className="p-3">Check-Out</th>
                  <th className="p-3 font-mono">Hours</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Source</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
                {filteredRecords.map(r => (
                  <tr key={r.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                    <td className="p-3 font-mono font-medium">{r.employeeId}</td>
                    <td className="p-3 font-semibold">{r.name}</td>
                    <td className="p-3 opacity-80">{r.department}</td>
                    <td className="p-3 font-mono">{r.date}</td>
                    <td className="p-3 font-mono">{r.checkIn}</td>
                    <td className="p-3 font-mono">{r.checkOut}</td>
                    <td className="p-3 font-mono font-bold">{r.workingHours}h</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'Present' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' :
                        r.status === 'Paid Leave' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30' :
                        r.status === 'Late Arrival' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' :
                        r.status === 'Missing Punch' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/30' :
                        'bg-red-500/10 text-red-500 border border-red-500/30'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-500">{r.source}</td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingAttendance(r);
                          setNewStatus(r.status);
                          setNewCheckIn(r.checkIn);
                          setNewCheckOut(r.checkOut);
                        }}
                        className="text-xs font-semibold text-[#CB1417] hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete attendance record for ${r.name}?`)) {
                            setAttendanceRecords(prev => prev.filter(x => x.id !== r.id));
                            showToastMsg(`Deleted record for ${r.name}`);
                          }
                        }}
                        className="text-xs font-semibold text-red-500 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: WEEKLY SUMMARY */}
      {activeSubTab === 'weekly' && (
        <div className={`border rounded-xl p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Weekly Attendance Summary</h3>
              <p className="text-xs text-zinc-500">Working days, leaves, overtime, and total hours per employee for the current week.</p>
            </div>
            <button
              onClick={() => handleExportCSV('weekly')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 cursor-pointer dark:border-zinc-800 border-zinc-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Summary</span>
            </button>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
              <tr>
                <th className="p-3">Emp ID</th>
                <th className="p-3">Employee Name</th>
                <th className="p-3">Present Days</th>
                <th className="p-3">Absent Days</th>
                <th className="p-3">Paid Leaves</th>
                <th className="p-3">Weekly Offs</th>
                <th className="p-3">Overtime</th>
                <th className="p-3 font-mono font-bold">Total Hours</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
              {attendanceRecords.map((r, i) => (
                <tr key={r.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                  <td className="p-3 font-mono">{r.employeeId}</td>
                  <td className="p-3 font-semibold">{r.name}</td>
                  <td className="p-3 font-bold text-emerald-500">{5 - (i % 2)}</td>
                  <td className="p-3 font-bold text-red-500">{i % 2}</td>
                  <td className="p-3 font-mono">{i === 2 ? 1 : 0}</td>
                  <td className="p-3 font-mono">2 (Sat/Sun)</td>
                  <td className="p-3 font-mono text-amber-500">{i === 0 ? '4.0h' : '0.0h'}</td>
                  <td className="p-3 font-mono font-bold">{(40 - (i % 2) * 8)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 4: MONTHLY MATRIX */}
      {activeSubTab === 'monthly' && (
        <div className={`border rounded-xl p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 dark:border-zinc-800 border-zinc-200">
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Monthly Attendance Register Matrix</h3>
              <p className="text-xs text-zinc-500">Day-by-day attendance status for {selectedMonth} {selectedYear}.</p>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
              >
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                onClick={() => handleExportCSV('monthly')}
                className="px-3 py-1.5 bg-[#CB1417] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Export Matrix
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                <tr>
                  <th className="p-2.5">Emp ID</th>
                  <th className="p-2.5">Name</th>
                  {Array.from({ length: 15 }, (_, i) => (
                    <th key={i} className="p-2 text-center font-mono">{i + 1}</th>
                  ))}
                  <th className="p-2.5 text-center">Present</th>
                  <th className="p-2.5 text-center">LOP</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
                {attendanceRecords.map(r => (
                  <tr key={r.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                    <td className="p-2.5 font-mono">{r.employeeId}</td>
                    <td className="p-2.5 font-semibold whitespace-nowrap">{r.name}</td>
                    {Array.from({ length: 15 }, (_, i) => {
                      const day = i + 1;
                      const isSunday = day % 7 === 4;
                      const isSat = day % 7 === 3;
                      const status = isSunday ? 'WO' : isSat ? 'WO' : day === 2 ? 'H' : 'P';
                      return (
                        <td key={i} className="p-1.5 text-center font-mono font-bold text-[10px]">
                          <span className={`inline-block w-5 h-5 leading-5 rounded ${
                            status === 'P' ? 'bg-emerald-500/10 text-emerald-500' :
                            status === 'WO' ? 'bg-zinc-500/10 text-zinc-400' :
                            'bg-purple-500/10 text-purple-500'
                          }`}>
                            {status}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-2.5 text-center font-bold text-emerald-500 font-mono">11</td>
                    <td className="p-2.5 text-center font-bold text-red-500 font-mono">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 5: YEARLY TREND */}
      {activeSubTab === 'yearly' && (
        <div className={`border rounded-xl p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Annual Attendance Trend ({selectedYear})</h3>
              <p className="text-xs text-zinc-500">Cumulative employee presence, leaves, and LOP across 12 months.</p>
            </div>
            <button
              onClick={() => showToastMsg('Annual audit summary exported to Excel.')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 cursor-pointer dark:border-zinc-800 border-zinc-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Annual Report</span>
            </button>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
              <tr>
                <th className="p-3">Month</th>
                <th className="p-3">Working Days</th>
                <th className="p-3">Avg Attendance %</th>
                <th className="p-3">Total Present</th>
                <th className="p-3">Total LOP Days</th>
                <th className="p-3">Extra Work Days</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'].map((m, idx) => (
                <tr key={m} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                  <td className="p-3 font-semibold">{m} {selectedYear}</td>
                  <td className="p-3 font-mono">22</td>
                  <td className="p-3 font-mono font-bold text-emerald-500">{94 + (idx % 4)}%</td>
                  <td className="p-3 font-mono">{450 + idx * 8}</td>
                  <td className="p-3 font-mono text-red-500">{4 + (idx % 3)}</td>
                  <td className="p-3 font-mono text-amber-500">{2 + (idx % 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 6: DEVICES */}
      {activeSubTab === 'devices' && (
        <div className="space-y-6">
          <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider mb-1">
                <Server className="w-4 h-4 text-[#CB1417]" />
                <span>Biometric Hardware Integration</span>
              </div>
              <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
                Fingerprint & Face Reader Devices (ZKTeco, eSSL, Realtime)
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Connect TCP/IP biometric terminals to the central LAN server to pull punch logs automatically.
              </p>
            </div>
            <button
              onClick={() => setShowAddDeviceModal(true)}
              className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Biometric Device</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map(d => (
              <div key={d.id} className={`border rounded-xl p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>{d.name}</h4>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{d.manufacturer} — {d.model} ({d.location})</p>
                  </div>
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{d.status}</span>
                  </span>
                </div>

                <div className={`grid grid-cols-2 gap-3 text-xs p-3 rounded-lg border ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div>
                    <span className="text-zinc-500 block">IP Address / Port</span>
                    <span className="font-mono font-semibold">{d.ip}:{d.port}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Last Synced</span>
                    <span className="font-mono">{d.lastSync}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Imported Punches</span>
                    <span className="font-mono font-bold text-[#CB1417]">{d.punchesCount} logs</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Protocol</span>
                    <span className="font-mono">{d.protocol}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t dark:border-zinc-800 border-zinc-200">
                  <button
                    onClick={() => {
                      if (confirm(`Remove device ${d.name}?`)) {
                        setDevices(prev => prev.filter(x => x.id !== d.id));
                        showToastMsg(`Removed device ${d.name}.`);
                      }
                    }}
                    className="text-xs text-red-500 hover:underline cursor-pointer"
                  >
                    Delete
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => showToastMsg(`Ping response from ${d.ip}: OK (Latency: 14ms). Model confirmed.`)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        isDark ? 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800' : 'bg-zinc-100 hover:bg-zinc-200 text-black border-zinc-300'
                      }`}
                    >
                      Test Connection
                    </button>
                    <button
                      onClick={() => {
                        setDevices(prev => prev.map(x => x.id === d.id ? { ...x, lastSync: 'Just now', punchesCount: x.punchesCount + 24 } : x));
                        showToastMsg(`Successfully pulled 24 new punches from ${d.name}`);
                      }}
                      className="px-3 py-1.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer flex items-center space-x-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync Now</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 7: IMPORT ATTENDANCE */}
      {activeSubTab === 'import' && (
        <div className={`border rounded-xl p-6 space-y-5 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-black'}`}>Import Punch Logs from CSV / Excel</h3>
            <p className="text-xs text-zinc-500">Upload attendance punch logs exported from biometric hardware software or attendance spreadsheets.</p>
          </div>

          <div className={`border-2 border-dashed rounded-xl p-8 text-center space-y-3 ${isDark ? 'border-zinc-800 bg-black/40' : 'border-zinc-300 bg-zinc-50'}`}>
            <Upload className="w-8 h-8 text-[#CB1417] mx-auto" />
            <h4 className="font-semibold text-xs">Drag & drop punch log file or browse computer</h4>
            <p className="text-[11px] text-zinc-400">Supports .CSV, .XLS, .XLSX format up to 25 MB</p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) showToastMsg(`Loaded file "${f.name}". Ready to map columns.`);
              }}
              className="hidden"
              id="attendanceFileInput"
            />
            <label
              htmlFor="attendanceFileInput"
              className="inline-block px-4 py-2 bg-[#CB1417] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#ED1F24]"
            >
              Select Attendance Spreadsheet
            </label>
          </div>

          <div className={`p-4 rounded-xl border text-xs space-y-2 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
            <span className="font-bold block">Expected Columns:</span>
            <span className="font-mono text-zinc-500">EmployeeID, Date, PunchIn, PunchOut, Department, Remarks</span>
          </div>
        </div>
      )}

      {/* SUBTAB 8: APPROVALS & CORRECTIONS */}
      {activeSubTab === 'approvals' && (
        <div className={`border rounded-xl p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Missing Punch Corrections & Leave Approvals</h3>
            <p className="text-xs text-zinc-500">Review employee punch regularization requests and unverified absences.</p>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
              <tr>
                <th className="p-3">Emp ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Date</th>
                <th className="p-3">Correction Requested</th>
                <th className="p-3">Reason</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
              <tr className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                <td className="p-3 font-mono">00106</td>
                <td className="p-3 font-semibold">Olivia Martin</td>
                <td className="p-3 font-mono">2026-10-01</td>
                <td className="p-3 font-mono text-amber-500">Missing Out Punch &rarr; 06:15 PM</td>
                <td className="p-3 text-zinc-400">Power cut at main gate reader during departure</td>
                <td className="p-3 text-right space-x-2">
                  <button
                    onClick={() => {
                      setAttendanceRecords(prev => prev.map(r => r.employeeId === '00106' ? { ...r, checkOut: '06:15 PM', status: 'Present', workingHours: 9.3, approved: true } : r));
                      showToastMsg('Approved missing punch correction for Olivia Martin.');
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => showToastMsg('Rejected correction request.')}
                    className="px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-[11px] font-bold cursor-pointer"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 9: HOLIDAYS */}
      {activeSubTab === 'holidays' && (
        <div className="space-y-6">
          <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider mb-1">
                <Calendar className="w-4 h-4 text-[#CB1417]" />
                <span>Annual Leave Calendar & Weekly Offs</span>
              </div>
              <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
                Company Holidays & Weekly Off Configuration
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Configured public holidays and weekly offs do not automatically generate LOP deductions.
              </p>
            </div>
            <button
              onClick={() => setShowAddHolidayModal(true)}
              className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Holiday</span>
            </button>
          </div>

          <div className={`border rounded-xl overflow-hidden ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Holiday Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Applicable Scope</th>
                  <th className="p-3 text-center">Paid Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
                {holidays.map(h => (
                  <tr key={h.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                    <td className="p-3 font-mono font-medium">{h.date}</td>
                    <td className="p-3 font-semibold">{h.name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#CB1417]/10 text-[#CB1417] border border-[#CB1417]/30">
                        {h.category}
                      </span>
                    </td>
                    <td className="p-3 opacity-80">{h.scope}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                        Paid Holiday (No LOP)
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Remove holiday "${h.name}"?`)) {
                            setHolidays(prev => prev.filter(x => x.id !== h.id));
                            showToastMsg(`Deleted holiday "${h.name}".`);
                          }
                        }}
                        className="text-xs font-semibold text-red-500 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 10: EXTRA WORKING DAYS & COMPENSATION */}
      {activeSubTab === 'extrawork' && (
        <div className="space-y-6">
          <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider mb-1">
                <Briefcase className="w-4 h-4 text-[#CB1417]" />
                <span>Sunday & Holiday Extra Work Workflow</span>
              </div>
              <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
                Extra Working Days & HR Compensation Decisions
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                HR decides compensation separately for every approved extra working day (Additional Payment or Compensatory Off).
              </p>
            </div>
            <button
              onClick={() => setShowAddExtraWorkModal(true)}
              className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Extra Work with Proof</span>
            </button>
          </div>

          <div className={`border rounded-xl overflow-hidden ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                <tr>
                  <th className="p-3">Emp ID</th>
                  <th className="p-3">Employee Name</th>
                  <th className="p-3">Work Date</th>
                  <th className="p-3">Work Type</th>
                  <th className="p-3 font-mono">Hours</th>
                  <th className="p-3">Proof Document</th>
                  <th className="p-3">HR Compensation</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
                {extraWorks.map(ew => (
                  <tr key={ew.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                    <td className="p-3 font-mono font-medium">{ew.employeeId}</td>
                    <td className="p-3 font-semibold">{ew.name}</td>
                    <td className="p-3 font-mono">{ew.date}</td>
                    <td className="p-3">{ew.type}</td>
                    <td className="p-3 font-mono font-bold">{ew.hours}h</td>
                    <td className="p-3">
                      <span className="flex items-center space-x-1 text-zinc-400 font-mono text-[11px]">
                        <Paperclip className="w-3 h-3 text-[#CB1417]" />
                        <span>{ew.proof || 'Attached memo'}</span>
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#CB1417]/10 text-[#CB1417] border border-[#CB1417]/30">
                        {ew.compensation}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ew.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {ew.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {ew.status === 'Pending' ? (
                        <button
                          onClick={() => {
                            setApprovingExtraWork(ew);
                            setChosenComp('Additional Payment');
                          }}
                          className="px-3 py-1 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded text-xs font-bold cursor-pointer"
                        >
                          Decide Compensation
                        </button>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">Approved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 11: RULES & LOP SETTINGS */}
      {activeSubTab === 'rules' && (
        <div className="space-y-6">
          <div className={`border rounded-xl p-6 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>LOP Calculation & Salary Denominator Policy</h3>
            <p className={`text-xs mb-5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Configure how Loss of Pay (LOP) deductions are computed for fixed monthly salary earners.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-4">
                <div>
                  <label className="font-semibold block mb-1.5">LOP Denominator Basis *</label>
                  <select
                    value={lopDenominator}
                    onChange={(e) => setLopDenominator(e.target.value)}
                    className={`w-full rounded-lg px-3.5 py-2.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  >
                    <option value="calendar_days">Calendar Days in Month (e.g. 28, 29, 30, or 31 days)</option>
                    <option value="30_days">Fixed 30-Day Basis (Standard Corporate Policy)</option>
                    <option value="working_days">Configured Working Days Only (e.g. 22 days)</option>
                  </select>
                  <p className="text-[11px] text-zinc-500 mt-1">Formula: LOP Deduction = (Monthly Salary / Denominator) × Approved LOP Days</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Standard Shift Start</label>
                    <input
                      type="time"
                      value={shiftStart}
                      onChange={(e) => setShiftStart(e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Standard Shift End</label>
                    <input
                      type="time"
                      value={shiftEnd}
                      onChange={(e) => setShiftEnd(e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Grace Period (Minutes)</label>
                    <input
                      type="number"
                      value={gracePeriod}
                      onChange={(e) => setGracePeriod(Number(e.target.value))}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Min Hours for Full Day</label>
                    <input
                      type="number"
                      value={minFullDayHours}
                      onChange={(e) => setMinFullDayHours(Number(e.target.value))}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                </div>

                <button
                  onClick={() => showToastMsg('Attendance policy and LOP settings saved.')}
                  className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg font-bold shadow-md cursor-pointer"
                >
                  Save Policy Configuration
                </button>
              </div>

              {/* Live Calculator Card */}
              <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <h4 className="font-bold flex items-center space-x-1.5 text-sm">
                  <Award className="w-4 h-4 text-[#CB1417]" />
                  <span>Live LOP Formula Simulator</span>
                </h4>

                <div>
                  <label className="font-medium block mb-1 text-[11px]">Monthly Base Salary (₹ / $)</label>
                  <input
                    type="number"
                    value={salaryTestAmount}
                    onChange={(e) => setSalaryTestAmount(Number(e.target.value))}
                    className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div>
                  <label className="font-medium block mb-1 text-[11px]">Approved LOP Days</label>
                  <input
                    type="number"
                    value={testLopDays}
                    onChange={(e) => setTestLopDays(Number(e.target.value))}
                    className={`w-full rounded px-3 py-1.5 border font-mono ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div className="pt-2 border-t dark:border-zinc-800 border-zinc-200 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Configured Denominator:</span>
                    <span className="font-bold">{denominatorVal} Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Daily LOP Rate:</span>
                    <span className="font-bold">₹{dailyRate.toLocaleString()} / day</span>
                  </div>
                  <div className="flex justify-between text-red-500 font-bold">
                    <span>Total LOP Deduction:</span>
                    <span>- ₹{totalLopDeduction.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-500 font-bold text-xs pt-1 border-t dark:border-zinc-800 border-zinc-200">
                    <span>Payable Salary after LOP:</span>
                    <span>₹{netPayable.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 12: REPORTS & EXPORTS */}
      {activeSubTab === 'reports' && (
        <div className={`border rounded-xl p-6 space-y-5 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-black'}`}>Attendance & Statutory Reports Generator</h3>
            <p className="text-xs text-zinc-500">Download executive reports for monthly payroll compliance and audit verification.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <FileSpreadsheet className="w-6 h-6 text-[#CB1417]" />
              <h4 className="font-bold text-sm">Monthly Attendance Register</h4>
              <p className="text-[11px] text-zinc-400">Complete employee-wise present, absent, and holiday distribution.</p>
              <button
                onClick={() => handleExportCSV('monthly')}
                className="w-full py-2 bg-[#CB1417] text-white rounded font-bold cursor-pointer"
              >
                Download Excel (.xlsx)
              </button>
            </div>

            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <h4 className="font-bold text-sm">Loss of Pay (LOP) Audit Sheet</h4>
              <p className="text-[11px] text-zinc-400">Approved unpaid absences and computed salary deductions for payroll.</p>
              <button
                onClick={() => handleExportCSV('lop')}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold cursor-pointer"
              >
                Download LOP Report
              </button>
            </div>

            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <Briefcase className="w-6 h-6 text-blue-500" />
              <h4 className="font-bold text-sm">Extra Work & Overtime Report</h4>
              <p className="text-[11px] text-zinc-400">Sunday and holiday work approvals with compensation records.</p>
              <button
                onClick={() => handleExportCSV('extra_work')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer"
              >
                Download Extra Work CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 13: AUDIT HISTORY */}
      {activeSubTab === 'audit' && (
        <div className={`border rounded-xl p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Attendance & Approval Audit Trail</h3>
            <p className="text-xs text-zinc-500">Immutable chronological record of biometric synchronizations, manual regularizations, and HR decisions.</p>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-zinc-400 border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Authorized User</th>
                <th className="p-3">Action Type</th>
                <th className="p-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
              {auditLogs.map(log => (
                <tr key={log.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-zinc-50'}>
                  <td className="p-3 font-mono opacity-80">{log.timestamp}</td>
                  <td className="p-3 font-semibold">{log.user}</td>
                  <td className="p-3 font-medium text-[#CB1417]">{log.action}</td>
                  <td className="p-3 opacity-90">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: ADD ATTENDANCE ENTRY */}
      {showAddAttendanceModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Plus className="w-4 h-4 text-[#CB1417]" />
                <span>Add Manual Attendance Record</span>
              </h3>
              <button onClick={() => setShowAddAttendanceModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAttendance} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value)}
                    placeholder="e.g. 00108"
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Employee Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Rachel Adams"
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Department</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="HR & Admin">HR & Admin</option>
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Attendance Date *</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Check-In Time</label>
                  <input
                    type="text"
                    value={newCheckIn}
                    onChange={(e) => setNewCheckIn(e.target.value)}
                    placeholder="09:00 AM"
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Check-Out Time</label>
                  <input
                    type="text"
                    value={newCheckOut}
                    onChange={(e) => setNewCheckOut(e.target.value)}
                    placeholder="06:00 PM"
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Attendance Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                >
                  <option value="Present">Present (Full Day)</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Paid Leave">Paid Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave (LOP)</option>
                  <option value="Absent">Absent</option>
                  <option value="Weekly Off">Weekly Off</option>
                  <option value="Public Holiday">Public Holiday</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">HR Remarks / Authorization Reason</label>
                <textarea
                  rows={2}
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  placeholder="e.g. Authorized off-site client meeting"
                  className={`w-full rounded p-2.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t dark:border-zinc-800 border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowAddAttendanceModal(false)}
                  className={`px-4 py-2 rounded-lg border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BIOMETRIC DEVICE */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Server className="w-4 h-4 text-[#CB1417]" />
                <span>Add Biometric Reader Terminal</span>
              </h3>
              <button onClick={() => setShowAddDeviceModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDevice} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Device Name *</label>
                <input
                  type="text"
                  required
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  placeholder="e.g. Warehouse North Gate"
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Manufacturer *</label>
                  <select
                    value={newDevMaker}
                    onChange={(e) => setNewDevMaker(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  >
                    <option value="ZKTeco">ZKTeco</option>
                    <option value="eSSL">eSSL</option>
                    <option value="Realtime">Realtime</option>
                    <option value="Matrix">Matrix</option>
                    <option value="Other">Other Compatible</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Model Number</label>
                  <input
                    type="text"
                    value={newDevModel}
                    onChange={(e) => setNewDevModel(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Static IP Address *</label>
                  <input
                    type="text"
                    required
                    value={newDevIp}
                    onChange={(e) => setNewDevIp(e.target.value)}
                    placeholder="192.168.1.205"
                    className={`w-full rounded px-3 py-2 font-mono border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Communication Port</label>
                  <input
                    type="text"
                    value={newDevPort}
                    onChange={(e) => setNewDevPort(e.target.value)}
                    className={`w-full rounded px-3 py-2 font-mono border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Device Physical Location</label>
                <input
                  type="text"
                  value={newDevLoc}
                  onChange={(e) => setNewDevLoc(e.target.value)}
                  placeholder="e.g. 1st Floor Reception"
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t dark:border-zinc-800 border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowAddDeviceModal(false)}
                  className={`px-4 py-2 rounded-lg border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white font-bold rounded-lg cursor-pointer"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD HOLIDAY */}
      {showAddHolidayModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#CB1417]" />
                <span>Add Annual Calendar Holiday</span>
              </h3>
              <button onClick={() => setShowAddHolidayModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateHoliday} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Holiday Name *</label>
                <input
                  type="text"
                  required
                  value={newHolName}
                  onChange={(e) => setNewHolName(e.target.value)}
                  placeholder="e.g. New Year's Day"
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Holiday Date *</label>
                  <input
                    type="date"
                    required
                    value={newHolDate}
                    onChange={(e) => setNewHolDate(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Category</label>
                  <select
                    value={newHolCategory}
                    onChange={(e) => setNewHolCategory(e.target.value as any)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  >
                    <option value="Public Holiday">Public Holiday</option>
                    <option value="Festival">Festival Holiday</option>
                    <option value="Company Holiday">Company Holiday</option>
                    <option value="Special Declared">Special Declared</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t dark:border-zinc-800 border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowAddHolidayModal(false)}
                  className={`px-4 py-2 rounded-lg border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD EXTRA WORK WITH PROOF */}
      {showAddExtraWorkModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-[#CB1417]" />
                <span>Add Extra Working Day (Sunday/Holiday)</span>
              </h3>
              <button onClick={() => setShowAddExtraWorkModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExtraWork} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={ewEmpId}
                    onChange={(e) => setEwEmpId(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Employee Name *</label>
                  <input
                    type="text"
                    required
                    value={ewName}
                    onChange={(e) => setEwName(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Work Date *</label>
                  <input
                    type="date"
                    required
                    value={ewDate}
                    onChange={(e) => setEwDate(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Work Type</label>
                  <select
                    value={ewType}
                    onChange={(e) => setEwType(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  >
                    <option value="Sunday Work">Sunday Work</option>
                    <option value="Weekly Off Work">Weekly Off Work</option>
                    <option value="Public Holiday Work">Public Holiday Work</option>
                    <option value="Company Holiday Work">Company Holiday Work</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Total Hours Worked *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={ewHours}
                  onChange={(e) => setEwHours(Number(e.target.value))}
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Reason for Extra Work *</label>
                <textarea
                  required
                  rows={2}
                  value={ewReason}
                  onChange={(e) => setEwReason(e.target.value)}
                  placeholder="e.g. Critical client outage resolution"
                  className={`w-full rounded p-2.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Upload Document Proof (PDF / PNG / JPG)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    id="proofFileInput"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setEwProofFileName(f.name);
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="proofFileInput"
                    className={`px-3 py-2 rounded border cursor-pointer font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-100 border-zinc-300 text-black'}`}
                  >
                    Browse File
                  </label>
                  <span className="text-zinc-500 truncate">{ewProofFileName || 'No file chosen'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t dark:border-zinc-800 border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowAddExtraWorkModal(false)}
                  className={`px-4 py-2 rounded-lg border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white font-bold rounded-lg cursor-pointer"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DECIDE EXTRA WORK COMPENSATION */}
      {approvingExtraWork && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-emerald-500" />
                <span>Approve & Decide Compensation</span>
              </h3>
              <button onClick={() => setApprovingExtraWork(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`p-3 rounded-lg border text-xs space-y-1 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <div><strong>Employee:</strong> {approvingExtraWork.name} ({approvingExtraWork.employeeId})</div>
              <div><strong>Date:</strong> {approvingExtraWork.date} ({approvingExtraWork.type})</div>
              <div><strong>Recorded Hours:</strong> {approvingExtraWork.hours} Hours</div>
              <div><strong>Reason:</strong> {approvingExtraWork.reason}</div>
            </div>

            <form onSubmit={handleConfirmCompensation} className="space-y-4 text-xs">
              <div>
                <label className="font-bold block mb-2">Mandatory HR Compensation Selection *</label>
                <div className="space-y-2">
                  {[
                    { val: 'Additional Payment', label: '1. Additional Payment (Added separately to payroll batch)' },
                    { val: 'Compensatory Off', label: '2. Compensatory Off (Credited to employee comp-off leave balance)' },
                    { val: 'Both', label: '3. Both Additional Payment & Comp-Off (If policy permits)' },
                    { val: 'Record Only', label: '4. Record Only (Historical attendance record without salary/leave credit)' }
                  ].map(opt => (
                    <label
                      key={opt.val}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition ${
                        chosenComp === opt.val
                          ? 'border-[#CB1417] bg-[#CB1417]/10 text-white font-semibold'
                          : isDark ? 'border-zinc-800 hover:bg-zinc-900' : 'border-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="compensationChoice"
                        value={opt.val}
                        checked={chosenComp === opt.val}
                        onChange={() => setChosenComp(opt.val as any)}
                        className="w-4 h-4 text-[#CB1417] focus:ring-[#CB1417] cursor-pointer"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t dark:border-zinc-800 border-zinc-200">
                <button
                  type="button"
                  onClick={() => setApprovingExtraWork(null)}
                  className={`px-4 py-2 rounded-lg border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Confirm & Finalize Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
