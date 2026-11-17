import React from 'react';
import { FileSpreadsheet, Sun, Moon, Menu, X, ShieldCheck, CloudOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { CompanySettings } from '../types/payroll';
import { GoogleSessionState, WorkspaceLinks } from '../utils/googleAuthClient';

interface TitleBarProps {
  onDownloadTemplate: () => void;
  totalEmployees: number;
  selectedMonth: string;
  selectedYear: number;
  companySettings?: CompanySettings;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  googleSession?: GoogleSessionState;
  workspaceLinks?: WorkspaceLinks;
  onOpenGoogleSettings?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onDownloadTemplate,
  totalEmployees,
  selectedMonth,
  selectedYear,
  companySettings,
  isMobileMenuOpen,
  onToggleMobileMenu,
  googleSession,
  workspaceLinks,
  onOpenGoogleSettings,
}) => {
  const { toggleTheme, isDark } = useTheme();

  const isCloudReady = Boolean(googleSession?.isConnected && workspaceLinks?.spreadsheetId);
  const isSignedIn = Boolean(googleSession?.isConnected);
  const isExpired = Boolean(googleSession?.expired);

  return (
    <header
      className={`h-14 border-b px-3 sm:px-5 flex items-center justify-between select-none shrink-0 z-30 transition-colors duration-150 ${
        isDark
          ? 'bg-[#000000] border-[#222222] text-white'
          : 'bg-[#FFFFFF] border-[#E4E4E7] text-black'
      }`}
    >
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border md:hidden transition cursor-pointer ${
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
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm font-bold text-xs tracking-wider border overflow-hidden shrink-0"
          style={{
            backgroundColor: 'var(--brand-primary)',
            color: 'var(--brand-primary-text)',
            borderColor: 'var(--brand-primary)',
          }}
        >
          {companySettings?.logoDataUrl ? (
            <img src={companySettings.logoDataUrl} alt="Company Logo" className="w-full h-full object-contain p-0.5 bg-white" />
          ) : (
            <span>EDS</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-tight truncate">Employee Database Studio</span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border hidden sm:inline-block whitespace-nowrap ${
                isDark
                  ? 'bg-[#18181B] text-[#D4D4D8] border-[#27272A]'
                  : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
              }`}
            >
              HR &amp; Payroll
            </span>
          </div>
          <p className={`text-[11px] truncate hidden sm:block ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            {companySettings?.companyName || 'Corporate Edition'}
          </p>
        </div>
      </div>

      {/* Center Status / Batch Period */}
      <div className="hidden lg:flex items-center space-x-4 text-xs">
        <div className="flex items-center space-x-1.5 font-medium whitespace-nowrap">
          <span className="text-zinc-500">Period:</span>
          <span className="font-semibold font-mono text-brand-primary">
            {selectedMonth} {selectedYear}
          </span>
        </div>
        <div className={`h-4 w-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        <div className="flex items-center space-x-1.5 font-medium whitespace-nowrap">
          <span className="text-zinc-500">Batch:</span>
          <span className={`font-semibold font-mono tabular-nums ${isDark ? 'text-white' : 'text-black'}`}>
            {totalEmployees} {totalEmployees === 1 ? 'Employee' : 'Employees'}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2 shrink-0">
        {onOpenGoogleSettings && (
          <button
            type="button"
            onClick={onOpenGoogleSettings}
            title={
              isCloudReady
                ? `Google Sheets & Drive Connected (${googleSession?.profile?.email || ''})`
                : isSignedIn
                  ? 'Google Signed In — Link Spreadsheet in Settings'
                  : isExpired
                    ? 'Google session expired — Click to reconnect'
                    : 'Local Draft Mode — Connect Google Sheets & Drive'
            }
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              isCloudReady
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                : isSignedIn
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15'
                  : isExpired
                    ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/15'
                    : isDark
                      ? 'border-zinc-800 bg-[#111113] text-zinc-300 hover:bg-zinc-800'
                      : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            {isSignedIn ? (
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 shrink-0 text-[#CB1417]" />
            )}
            <span className="hidden sm:inline">
              {isCloudReady
                ? 'Sheets Active'
                : isSignedIn
                  ? 'Link Sheet'
                  : isExpired
                    ? 'Reconnect Google'
                    : 'Local Drafts'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onDownloadTemplate}
          className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
            isDark
              ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-200'
              : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
          }`}
          title="Download Sample Payroll Import Excel Template"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
          <span>Template</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
            isDark
              ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-200'
              : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-600" />}
          <span className="hidden md:inline">{isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </header>
  );
};
