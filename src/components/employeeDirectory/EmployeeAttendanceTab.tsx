import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  RefreshCw,
  Sun,
  Coffee,
  CheckCheck
} from 'lucide-react';
import { DirectoryEmployee } from '../../types/employeeDirectory';
import { useTheme } from '../../context/ThemeContext';
import { apiClient } from '../../utils/apiClient';

interface EmployeeAttendanceTabProps {
  employee: DirectoryEmployee;
}

export const EmployeeAttendanceTab: React.FC<EmployeeAttendanceTabProps> = ({
  employee
}) => {
  const { isDark } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState('October');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [isLoading, setIsLoading] = useState(false);

  // Mock / real attendance summary for employee
  const summary = {
    totalWorkingDays: 31,
    presentDays: 27,
    absentDays: 2,
    halfDays: 1,
    paidLeaves: 1,
    approvedLopDays: 2,
    lateArrivals: 3,
    overtimeHours: 4.5,
    shiftName: 'General Corporate Shift',
    shiftTiming: '09:30 AM – 06:30 PM',
    shiftNetHours: 8.0,
    breakMinutes: 60
  };

  // Recent punches
  const punchHistory = [
    { date: '2026-10-31', inTime: '09:28 AM', outTime: '06:35 PM', hours: 8.1, status: 'Present', notes: 'On Time' },
    { date: '2026-10-30', inTime: '09:42 AM', outTime: '06:30 PM', hours: 7.8, status: 'Late', notes: '12 min grace exceeded' },
    { date: '2026-10-29', inTime: '09:25 AM', outTime: '06:40 PM', hours: 8.25, status: 'Present', notes: 'On Time' },
    { date: '2026-10-28', inTime: '09:30 AM', outTime: '01:30 PM', hours: 4.0, status: 'Half Day', notes: 'Personal emergency' },
    { date: '2026-10-27', inTime: '—', outTime: '—', hours: 0, status: 'LOP', notes: 'Unapproved Absence (LOP)' },
    { date: '2026-10-26', inTime: '—', outTime: '—', hours: 0, status: 'LOP', notes: 'Unapproved Absence (LOP)' },
    { date: '2026-10-25', inTime: '—', outTime: '—', hours: 0, status: 'Weekly Off', notes: 'Sunday' },
    { date: '2026-10-24', inTime: '—', outTime: '—', hours: 0, status: 'Weekly Off', notes: 'Saturday' },
    { date: '2026-10-23', inTime: '09:20 AM', outTime: '07:30 PM', hours: 9.15, status: 'Present + OT', notes: '1 hr overtime' }
  ];

  return (
    <div className="space-y-6 text-xs">
      {/* Shift & Schedule Summary Card */}
      <div className={`p-5 rounded-xl border space-y-4 ${
        isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 dark:border-zinc-800 border-zinc-200">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-brand-primary" />
            <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>
              Assigned Shift & Daily Schedule
            </h4>
          </div>
          <span className="font-semibold text-[11px] text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            {summary.shiftName}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-zinc-500 block text-[11px]">Shift Timing</span>
            <span className="font-semibold">{summary.shiftTiming}</span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Net Daily Target</span>
            <span className="font-semibold">{summary.shiftNetHours} Hours / day</span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Lunch / Break</span>
            <span className="font-semibold">{summary.breakMinutes} Minutes</span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Weekly Off Policy</span>
            <span className="font-semibold">Sat & Sun (5-Day Week)</span>
          </div>
        </div>
      </div>

      {/* Monthly Attendance Metrics KPI Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>
            Attendance Summary: {selectedMonth} {selectedYear}
          </h4>
          <span className="text-zinc-500 text-[11px]">
            Total Days in Month: <strong className={isDark ? 'text-white' : 'text-black'}>{summary.totalWorkingDays}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
            <span className="text-[11px] text-zinc-500 block">Present Days</span>
            <span className="text-lg font-bold text-emerald-500">{summary.presentDays}</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
            <span className="text-[11px] text-zinc-500 block">Absent Days</span>
            <span className="text-lg font-bold text-red-500">{summary.absentDays}</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
            <span className="text-[11px] text-zinc-500 block">Half Days</span>
            <span className="text-lg font-bold text-amber-500">{summary.halfDays}</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
            <span className="text-[11px] text-zinc-500 block">Approved LOP</span>
            <span className="text-lg font-bold text-rose-500">{summary.approvedLopDays} Days</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
            <span className="text-[11px] text-zinc-500 block">Late Arrivals</span>
            <span className="text-lg font-bold text-amber-500">{summary.lateArrivals}</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
            <span className="text-[11px] text-zinc-500 block">Overtime</span>
            <span className="text-lg font-bold text-blue-500">+{summary.overtimeHours} hrs</span>
          </div>
        </div>
      </div>

      {/* Recent Device & Biometric Punches Table */}
      <div className={`border rounded-xl p-5 space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
        <div className="flex items-center justify-between border-b pb-2">
          <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
            <Clock className="w-4 h-4 text-brand-primary" />
            <span>Biometric Device Punch Logs (Recent Records)</span>
          </h4>
          <span className="text-[11px] text-zinc-500">
            Automated sync from biometric edge controllers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b text-[11px] font-semibold uppercase ${isDark ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-600'}`}>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">In Time</th>
                <th className="py-2 px-3">Out Time</th>
                <th className="py-2 px-3">Net Hours</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Remarks / Approvals</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-zinc-800 divide-zinc-100">
              {punchHistory.map((p, idx) => (
                <tr key={idx} className={isDark ? 'hover:bg-[#18181B]' : 'hover:bg-[#F9FAFB]'}>
                  <td className="py-2.5 px-3 font-mono font-medium">{p.date}</td>
                  <td className="py-2.5 px-3 font-mono">{p.inTime}</td>
                  <td className="py-2.5 px-3 font-mono">{p.outTime}</td>
                  <td className="py-2.5 px-3 font-mono font-semibold">{p.hours > 0 ? `${p.hours} hrs` : '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.status.includes('Present')
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        : p.status.includes('Late')
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                        : p.status.includes('LOP')
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                        : p.status.includes('Weekly')
                        ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30'
                        : 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400 text-[11px]">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
