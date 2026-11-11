import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  FileText,
  Archive,
  History,
  Settings,
  Database,
  Calendar,
  Sliders,
  Mail,
  Contact,
  LogOut,
  KeyRound,
  User as UserIcon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { YearSelector } from './YearSelector';
import { AuthUser } from '../utils/apiClient';

export type ActiveTab =
  | 'dashboard'
  | 'directory'
  | 'import'
  | 'records'
  | 'validation'
  | 'generator'
  | 'export'
  | 'history'
  | 'layout'
  | 'email'
  | 'settings'
  | 'server_admin'
  | 'client_connection'
  | 'users'
  | 'attendance'
  | 'backup'
  | 'license';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  totalEmployees: number;
  invalidCount: number;
  historyCount: number;
  directoryCount?: number;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  totalEmployees,
  invalidCount,
  historyCount,
  directoryCount = 0,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  currentUser,
  onLogout,
  onOpenChangePassword,
  isMobileOpen,
  onCloseMobile
}) => {
  const { isDark } = useTheme();
  const userRole = currentUser?.role || 'admin';

  // Role-based visible tab definitions
  const allWorkspaceNav = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['admin', 'hr', 'payroll', 'readonly']
    },
    {
      id: 'directory' as ActiveTab,
      label: 'Employee Database',
      icon: Contact,
      badge: directoryCount > 0 ? String(directoryCount) : undefined,
      badgeColor: isDark ? 'bg-[#18181B] text-[#D4D4D8]' : 'bg-[#E4E4E7] text-[#27272A]',
      allowedRoles: ['admin', 'hr', 'readonly']
    },
    {
      id: 'attendance' as ActiveTab,
      label: 'Attendance Management',
      icon: Calendar,
      allowedRoles: ['admin', 'hr']
    },
    {
      id: 'import' as ActiveTab,
      label: 'Import & Map',
      icon: FileSpreadsheet,
      allowedRoles: ['admin', 'payroll']
    },
    {
      id: 'records' as ActiveTab,
      label: 'Payroll Batch',
      icon: Users,
      badge: totalEmployees > 0 ? String(totalEmployees) : undefined,
      badgeColor: isDark ? 'bg-[#18181B] text-[#D4D4D8]' : 'bg-[#E4E4E7] text-[#27272A]',
      allowedRoles: ['admin', 'payroll']
    },
    {
      id: 'validation' as ActiveTab,
      label: 'Math & Validation',
      icon: CheckCircle2,
      badge: invalidCount > 0 ? String(invalidCount) : undefined,
      badgeColor: invalidCount > 0 ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : undefined,
      allowedRoles: ['admin', 'payroll']
    },
    {
      id: 'generator' as ActiveTab,
      label: 'Payslip Generator',
      icon: FileText,
      allowedRoles: ['admin', 'payroll']
    },
    {
      id: 'export' as ActiveTab,
      label: 'Export Center',
      icon: Archive,
      allowedRoles: ['admin', 'payroll']
    },
    {
      id: 'history' as ActiveTab,
      label: 'Generation History',
      icon: History,
      badge: historyCount > 0 ? String(historyCount) : undefined,
      badgeColor: isDark ? 'bg-[#18181B] text-[#D4D4D8]' : 'bg-[#E4E4E7] text-[#27272A]',
      allowedRoles: ['admin', 'payroll', 'readonly']
    },
    {
      id: 'layout' as ActiveTab,
      label: 'Layout Customizer',
      icon: Sliders,
      allowedRoles: ['admin']
    },
    {
      id: 'email' as ActiveTab,
      label: 'Email Delivery',
      icon: Mail,
      allowedRoles: ['admin', 'payroll']
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Company Settings',
      icon: Settings,
      allowedRoles: ['admin']
    }
  ];

  const workspaceNav = allWorkspaceNav.filter(item => item.allowedRoles.includes(userRole));

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-35 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r flex flex-col justify-between shrink-0 select-none transition-transform duration-200 ease-in-out md:translate-x-0 md:static ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        } overflow-y-auto ${
          isDark
            ? 'bg-[#000000] border-[#222222]'
            : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
      {/* Navigation Links */}
      <div className="p-3 space-y-4">
        {/* User Profile Summary Card */}
        {currentUser && (
          <div className={`p-3 rounded-xl border flex flex-col space-y-2 ${
            isDark ? 'bg-[#0E0E10] border-[#222222]' : 'bg-[#F4F4F6] border-[#E4E4E7]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs"
                  style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-text)' }}
                >
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold truncate leading-tight">{currentUser.fullName}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">@{currentUser.username}</div>
                </div>
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                currentUser.role === 'admin'
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                  : currentUser.role === 'hr'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : currentUser.role === 'payroll'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  : 'bg-purple-500/10 text-purple-500 border-purple-500/30'
              }`}>
                {currentUser.role}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t dark:border-zinc-800 border-zinc-200 text-[11px]">
              <button
                type="button"
                onClick={onOpenChangePassword}
                className="text-zinc-500 hover:text-blue-500 flex items-center space-x-1 cursor-pointer"
                title="Change password"
              >
                <KeyRound className="w-3 h-3" />
                <span>Password</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="text-rose-500 hover:text-rose-600 font-semibold flex items-center space-x-1 cursor-pointer"
                title="Log out of session"
              >
                <LogOut className="w-3 h-3" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Workspace Section */}
        <div className="space-y-1">
          <div
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
              isDark ? 'text-[#71717A]' : 'text-[#71717A]'
            }`}
          >
            Payroll Workspace
          </div>
          {workspaceNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                style={isActive ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-text)' } : undefined}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'font-semibold shadow-sm'
                    : isDark
                    ? 'text-[#D4D4D8] hover:bg-[#141414] hover:text-white'
                    : 'text-[#27272A] hover:bg-[#F4F4F6] hover:text-black'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 ${isActive ? '' : isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}
                    style={isActive ? { color: 'var(--brand-primary-text)' } : undefined}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Bottom Payroll Period & Connection Widget */}
      <div
        className={`p-3 border-t space-y-3 transition-colors ${
          isDark
            ? 'border-[#222222] bg-[#0A0A0A]'
            : 'border-[#E4E4E7] bg-[#F8F9FA]'
        }`}
      >
        {/* Period Selector with Unlimited Year Support */}
        <div
          className={`rounded-lg p-2.5 border ${
            isDark
              ? 'bg-[#111113] border-[#222222]'
              : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="flex items-center space-x-1.5 text-[11px] font-medium text-[#71717A] mb-1.5">
            <Calendar className="w-3.5 h-3.5 text-brand-primary" />
            <span>Payroll Period</span>
          </div>
          <YearSelector
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </div>

        {/* Central Server Indicator */}
        <div className={`flex items-center justify-between text-[11px] px-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-brand-primary" />
            <span>Cloud Central Server</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected to central cloud server" />
        </div>
      </div>
    </aside>
    </>
  );
};
