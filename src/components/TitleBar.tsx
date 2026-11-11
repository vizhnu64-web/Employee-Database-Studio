import React from 'react';
import { HardDrive, ShieldCheck, Download, Sparkles, FileSpreadsheet, Sun, Moon, LogOut, KeyRound, User as UserIcon, Menu, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { CompanySettings } from '../types/payroll';
import { AuthUser } from '../utils/apiClient';

interface TitleBarProps {
  onLoadDemoData: () => void;
  onDownloadTemplate: () => void;
  totalEmployees: number;
  selectedMonth: string;
  selectedYear: number;
  companySettings?: CompanySettings;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onLoadDemoData,
  onDownloadTemplate,
  totalEmployees,
  selectedMonth,
  selectedYear,
  companySettings,
  currentUser,
  onLogout,
  onOpenChangePassword,
  isMobileMenuOpen,
  onToggleMobileMenu
}) => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <header
      className={`h-14 border-b px-3 sm:px-4 flex items-center justify-between select-none shrink-0 z-30 transition-colors duration-150 ${
        isDark
          ? 'bg-[#000000] border-[#222222] text-white'
          : 'bg-[#FFFFFF] border-[#E4E4E7] text-black'
      }`}
    >
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className={`p-1.5 rounded-lg border md:hidden transition cursor-pointer ${
              isDark
                ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
            }`}
            aria-label="Toggle Navigation Menu"
            title="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        )}

        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md font-bold text-xs tracking-wider border overflow-hidden shrink-0"
          style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-text)', borderColor: 'var(--brand-primary)' }}
        >
          {companySettings?.logoDataUrl ? (
            <img src={companySettings.logoDataUrl} alt="Logo" className="w-full h-full object-contain p-0.5 bg-white" />
          ) : (
            <span>PDS</span>
          )}
        </div>
        <div className="truncate">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm tracking-tight truncate">PeopleDesk Studio</span>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border hidden sm:inline-block ${
                isDark
                  ? 'bg-[#18181B] text-[#D4D4D8] border-[#27272A]'
                  : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
              }`}
            >
              Enterprise Cloud
            </span>
          </div>
          <p className={`text-[11px] truncate hidden xs:block ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            {companySettings?.companyName || 'Corporate Edition'} • Cloud Multi-User Platform
          </p>
        </div>
      </div>

      {/* Center Status / Batch Period */}
      <div className="hidden lg:flex items-center space-x-4 text-xs">
        <div className="flex items-center space-x-1.5 font-medium">
          <span className="text-zinc-400">Current Period:</span>
          <span className="font-semibold font-mono text-brand-primary">
            {selectedMonth} {selectedYear}
          </span>
        </div>
        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex items-center space-x-1.5 font-medium">
          <span className="text-zinc-400">Active Records:</span>
          <span className="font-semibold font-mono text-emerald-500">
            {totalEmployees} Employees
          </span>
        </div>
      </div>

      {/* Right Controls & User Session */}
      <div className="flex items-center space-x-3">
        {/* Quick Tools */}
        <button
          onClick={onDownloadTemplate}
          className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
            isDark
              ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300'
              : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
          }`}
          title="Download Sample Payroll Import Excel Template"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
          <span>Excel Template</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg border transition cursor-pointer ${
            isDark
              ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300'
              : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
        </button>

        {/* User Account Widget & Logout */}
        {currentUser && (
          <div className="flex items-center space-x-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold leading-tight">{currentUser.fullName}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-mono font-semibold">
                {currentUser.role}
              </span>
            </div>

            <button
              onClick={onOpenChangePassword}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-600 hover:text-black'
              }`}
              title="Change Account Password"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onLogout}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-lg text-xs font-bold transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
