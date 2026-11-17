import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  FileText,
  Sliders,
  History,
  Settings,
  Mail,
  Contact,
  Calculator,
  Calendar
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { YearSelector } from './YearSelector';

export type ActiveTab =
  | 'dashboard'
  | 'directory'
  | 'import'
  | 'records'
  | 'manual_payslip'
  | 'generator'
  | 'layout'
  | 'email'
  | 'history'
  | 'settings';

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
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  totalEmployees,
  historyCount,
  directoryCount = 0,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  isMobileOpen,
  onCloseMobile
}) => {
  const { isDark } = useTheme();

  const workspaceNav = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'directory' as ActiveTab,
      label: 'Employee Database',
      icon: Contact,
      badge: directoryCount > 0 ? String(directoryCount) : undefined,
      badgeColor: isDark ? 'bg-[#18181B] text-[#D4D4D8]' : 'bg-[#E4E4E7] text-[#27272A]',
    },
    {
      id: 'import' as ActiveTab,
      label: 'Excel Import',
      icon: FileSpreadsheet,
    },
    {
      id: 'records' as ActiveTab,
      label: 'Payroll Processing',
      icon: Users,
      badge: totalEmployees > 0 ? String(totalEmployees) : undefined,
      badgeColor: isDark ? 'bg-[#18181B] text-[#D4D4D8]' : 'bg-[#E4E4E7] text-[#27272A]',
    },
    {
      id: 'manual_payslip' as ActiveTab,
      label: 'Manual Payslip',
      icon: Calculator,
    },
    {
      id: 'generator' as ActiveTab,
      label: 'Payslip Generator',
      icon: FileText,
    },
    {
      id: 'layout' as ActiveTab,
      label: 'Layout Customizer',
      icon: Sliders,
    },
    {
      id: 'email' as ActiveTab,
      label: 'Email Delivery',
      icon: Mail,
    },
    {
      id: 'history' as ActiveTab,
      label: 'Generation History',
      icon: History,
      badge: historyCount > 0 ? String(historyCount) : undefined,
      badgeColor: isDark ? 'bg-[#18181B] text-[#D4D4D8]' : 'bg-[#E4E4E7] text-[#27272A]',
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Company Settings',
      icon: Settings,
    }
  ];

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
          <div className="px-3 py-2 border-b border-zinc-200/70 dark:border-zinc-900">
            <div className="text-xs font-extrabold tracking-wider uppercase text-brand-primary">
              Employee Database Studio
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">HR, Payroll &amp; Google Workspace</div>
          </div>

          <nav aria-label="Workspace Navigation" className="space-y-1">
            {workspaceNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  style={isActive ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-text)' } : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'font-bold shadow-sm'
                      : isDark
                      ? 'text-[#D4D4D8] hover:bg-[#141414] hover:text-white'
                      : 'text-[#27272A] hover:bg-[#F4F4F6] hover:text-black'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${isActive ? '' : isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}
                      style={isActive ? { color: 'var(--brand-primary-text)' } : undefined}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badgeColor
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Payroll Period Widget */}
        <div
          className={`p-3 border-t space-y-2.5 transition-colors ${
            isDark
              ? 'border-[#222222] bg-[#0A0A0A]'
              : 'border-[#E4E4E7] bg-[#F8F9FA]'
          }`}
        >
          <div
            className={`rounded-xl p-2.5 border ${
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

          <div className={`flex items-center justify-between text-[11px] px-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            <span className="truncate font-medium">Direct HR Workspace</span>
            <span className="text-[10px] font-mono font-semibold text-brand-primary">v2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
