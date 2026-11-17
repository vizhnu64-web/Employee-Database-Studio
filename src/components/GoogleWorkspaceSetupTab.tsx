import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Database,
  Mail,
  FileSpreadsheet,
  Info,
  Eye as EyeIcon,
  Unlink,
  Link2,
  RotateCw,
  CloudOff,
  Lock,
  Check,
} from 'lucide-react';

export interface RequestedScopeInfo {
  scope: string;
  key: 'identity' | 'drive' | 'sheets' | 'gmail';
  label: string;
  reason: string;
  verificationNote: string;
  optional: boolean;
  granted: boolean;
}

export interface GoogleConnectionStatusState {
  oauthConfigured: boolean;
  clientIdConfigured: boolean;
  clientId: string | null;
  authModel: 'client_gis_in_memory';
  isConnected: boolean;
  expired: boolean;
  accountEmail: string | null;
  profileName?: string | null;
  profilePicture?: string | null;
  scopes: string[];
  requestedScopesMetadata?: RequestedScopeInfo[];
  permissionSummary?: {
    identity: boolean;
    drive: boolean;
    sheets: boolean;
    gmail: boolean;
  };
  spreadsheetUrl?: string | null;
  driveFolderUrl?: string | null;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastSyncedAt?: string | null;
}

export interface SpreadsheetVerificationInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  canWrite: boolean;
  existingWorksheets: string[];
  missingWorksheets: string[];
  requiresWorksheetApproval: boolean;
}

export interface GoogleWorkspaceSetupTabProps {
  isDark: boolean;
  googleStatus: GoogleConnectionStatusState;
  isGoogleLoading: boolean;
  isGoogleConnecting: boolean;
  isGoogleTesting: boolean;
  googleFeedback: { success: boolean; message: string } | null;
  onRefreshStatus: () => void;
  onConnectGoogle: (options?: { includeGmail?: boolean; mode?: 'core' | 'gmail' }) => void;
  onReconnectGoogle: (includeGmail?: boolean) => void;
  onTestGoogleApi: (apiType: 'drive' | 'sheets' | 'gmail' | 'all') => void;
  onRequestDisconnect: () => void;
  driveStatus: {
    isConnected: boolean;
    rootFolderId: string | null;
    folderUrl?: string | null;
    folderName?: string | null;
    accountEmail: string | null;
  };
  isDriveSettingUp: boolean;
  isDriveBackingUp: boolean;
  isDriveLinkingUrl?: boolean;
  driveFeedback: { success: boolean; message: string } | null;
  onSetupDriveHierarchy: () => void;
  onConnectDriveFolderUrl?: (folderUrl: string) => void;
  onBackupToDrive: () => void;
  sheetsStatus: {
    isConfigured: boolean;
    spreadsheetId: string | null;
    spreadsheetUrl?: string | null;
    spreadsheetTitle?: string | null;
    accountEmail: string | null;
    existingWorksheets: string[];
    missingWorksheets?: string[];
  };
  isSheetsSettingUp: boolean;
  isVerifyingSpreadsheetUrl?: boolean;
  isApprovingWorksheets?: boolean;
  spreadsheetVerification?: SpreadsheetVerificationInfo | null;
  isPreviewingMigration: boolean;
  isMigrating: boolean;
  migrationPreview: Record<string, { total: number; newCount: number; skipCount: number }> | null;
  sheetsFeedback: { success: boolean; message: string } | null;
  onSetupMasterSpreadsheet: () => void;
  onVerifySpreadsheetUrl?: (spreadsheetUrl: string) => void;
  onConnectSpreadsheetUrl?: (spreadsheetUrl: string, approveCreateWorksheets: boolean) => void;
  onApproveMissingWorksheets?: () => void;
  onPreviewDataMigration: () => void;
  onRunDataMigration: () => void;
}

const GoogleGLogo: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const GoogleWorkspaceSetupTab: React.FC<GoogleWorkspaceSetupTabProps> = ({
  isDark,
  googleStatus,
  isGoogleLoading,
  isGoogleConnecting,
  isGoogleTesting,
  googleFeedback,
  onRefreshStatus,
  onConnectGoogle,
  onReconnectGoogle,
  onTestGoogleApi,
  onRequestDisconnect,
  driveStatus,
  isDriveSettingUp,
  isDriveBackingUp,
  isDriveLinkingUrl,
  driveFeedback,
  onSetupDriveHierarchy,
  onConnectDriveFolderUrl,
  onBackupToDrive,
  sheetsStatus,
  isSheetsSettingUp,
  isVerifyingSpreadsheetUrl,
  isApprovingWorksheets,
  spreadsheetVerification,
  isPreviewingMigration,
  isMigrating,
  migrationPreview,
  sheetsFeedback,
  onSetupMasterSpreadsheet,
  onVerifySpreadsheetUrl,
  onConnectSpreadsheetUrl,
  onApproveMissingWorksheets,
  onPreviewDataMigration,
  onRunDataMigration,
}) => {
  const [includeGmailOnSignIn, setIncludeGmailOnSignIn] = useState(false);
  const [spreadsheetUrlInput, setSpreadsheetUrlInput] = useState(
    googleStatus.spreadsheetUrl || sheetsStatus.spreadsheetUrl || ''
  );
  const [driveFolderUrlInput, setDriveFolderUrlInput] = useState(
    googleStatus.driveFolderUrl || driveStatus.folderUrl || ''
  );

  useEffect(() => {
    if (sheetsStatus.spreadsheetUrl && !spreadsheetUrlInput) {
      setSpreadsheetUrlInput(sheetsStatus.spreadsheetUrl);
    }
  }, [sheetsStatus.spreadsheetUrl]);

  useEffect(() => {
    if (driveStatus.folderUrl && !driveFolderUrlInput) {
      setDriveFolderUrlInput(driveStatus.folderUrl);
    }
  }, [driveStatus.folderUrl]);

  const hasScope = (keyword: string) =>
    googleStatus.scopes.some((s) => s.toLowerCase().includes(keyword.toLowerCase()));

  const sheetsConnected =
    googleStatus.isConnected && (googleStatus.permissionSummary?.sheets ?? hasScope('spreadsheets'));
  const driveConnected =
    googleStatus.isConnected && (googleStatus.permissionSummary?.drive ?? hasScope('drive'));
  const gmailConnected =
    googleStatus.isConnected && (googleStatus.permissionSummary?.gmail ?? hasScope('gmail.send'));

  const overallLabel = !googleStatus.oauthConfigured
    ? 'Client ID Unconfigured'
    : googleStatus.isConnected
      ? 'Connected'
      : googleStatus.expired
        ? 'Session Expired'
        : 'Not Connected';

  const overallBadgeClass = !googleStatus.oauthConfigured
    ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
    : googleStatus.isConnected
      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
      : googleStatus.expired
        ? 'bg-red-500/10 text-red-500 border-red-500/30'
        : 'bg-amber-500/10 text-amber-500 border-amber-500/30';

  const cardSurface = isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200';
  const innerCard = isDark ? 'bg-[#0D0D0E] border-zinc-800' : 'bg-white border-zinc-200';
  const btnSecondary = isDark
    ? 'border-zinc-800 hover:bg-zinc-800 text-white'
    : 'border-zinc-300 hover:bg-zinc-100 text-black';
  const inputClass = isDark
    ? 'bg-[#0D0D0E] border-zinc-800 text-white placeholder:text-zinc-600'
    : 'bg-white border-zinc-300 text-black placeholder:text-zinc-400';

  const scopeMetadata: RequestedScopeInfo[] =
    googleStatus.requestedScopesMetadata && googleStatus.requestedScopesMetadata.length > 0
      ? googleStatus.requestedScopesMetadata
      : [
          {
            scope: 'openid email profile',
            key: 'identity',
            label: 'Google Profile & Email Identity',
            reason:
              'Displays your connected HR Google account name, email address, and profile avatar inside Company Settings.',
            verificationNote: 'Standard OpenID Connect identity scopes via Google Identity Services.',
            optional: false,
            granted: googleStatus.isConnected,
          },
          {
            scope: 'https://www.googleapis.com/auth/drive.file',
            key: 'drive',
            label: 'Private App & Selected Drive Folders (drive.file)',
            reason:
              'Stores employee documents, payslip PDFs, company logos, and backups strictly in the HR-linked private Drive folder.',
            verificationNote: 'Least-privilege per-file Drive scope; never reads unrelated personal Drive files.',
            optional: false,
            granted: driveConnected,
          },
          {
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            key: 'sheets',
            label: 'Google Sheets Structured HR Database (spreadsheets)',
            reason:
              'Reads and updates the 10 structured HR worksheets inside your connected Employee Database Studio spreadsheet.',
            verificationNote:
              'Sensitive Google Sheets scope; consented explicitly via Google Identity Services in-memory OAuth.',
            optional: false,
            granted: sheetsConnected,
          },
          {
            scope: 'https://www.googleapis.com/auth/gmail.send',
            key: 'gmail',
            label: 'HR Gmail Dispatch (gmail.send — Incremental Opt-in)',
            reason:
              'Enables HR to send individual employee payslips from their own Gmail mailbox alongside or instead of Company SMTP.',
            verificationNote: 'Optional incremental scope requested only when HR enables Gmail payslip delivery.',
            optional: true,
            granted: gmailConnected,
          },
        ];

  const profileInitials = (googleStatus.profileName || googleStatus.accountEmail || 'HR')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`border rounded-xl p-5 space-y-5 text-xs ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'
      }`}
    >
      {/* Header */}
      <div className="border-b pb-3.5 dark:border-zinc-800 border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
            <ShieldCheck className="w-4 h-4 text-[#CB1417]" />
            <span>Google Account Connection</span>
          </h3>
          <p className="text-zinc-500 text-[11px] mt-0.5">
            Authorize your HR Google account via official Google Identity Services (client-side OAuth) to connect Google Sheets (10-worksheet primary database), private Google Drive folders, and optional Gmail delivery. Short-lived OAuth tokens stay strictly in memory and are never written to browser storage or database tables.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={onRefreshStatus}
            disabled={isGoogleLoading}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap ${btnSecondary}`}
            title="Refresh Google Account & Workspace readiness"
          >
            <RefreshCw className={`w-3 h-3 ${isGoogleLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border whitespace-nowrap ${overallBadgeClass}`}>
            {overallLabel}
          </span>
        </div>
      </div>

      {/* Clear Non-Blocking Notice when GIS Client ID is Absent */}
      {!googleStatus.oauthConfigured && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
            isDark
              ? 'bg-amber-950/25 border-amber-700/40 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Google Identity Services Client ID Required</div>
            <p className="text-[11px] opacity-90">
              Sign in with Google stays disabled until <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> (or public <code className="font-mono">GOOGLE_CLIENT_ID</code>) is configured. Temporary Local Drafts (IndexedDB), Excel Import, Payroll Processing, Manual Payslip, Layout Customizer, client-side PDF/ZIP export, and Company SMTP remain 100% operational without Google connected.
            </p>
          </div>
        </div>
      )}

      {/* Independent Status Cards: Account, Sheets, Drive, Gmail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`p-3 rounded-xl border space-y-1 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Google Account</span>
            <ShieldCheck className={`w-3.5 h-3.5 ${googleStatus.isConnected ? 'text-emerald-500' : 'text-zinc-400'}`} />
          </div>
          <div className={`font-bold text-xs ${googleStatus.isConnected ? 'text-emerald-500' : isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            {googleStatus.isConnected ? 'Authorized' : googleStatus.expired ? 'Expired' : 'Not Connected'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 truncate" title={googleStatus.accountEmail || 'No account connected'}>
            {googleStatus.accountEmail || 'No account linked'}
          </div>
        </div>

        <div className={`p-3 rounded-xl border space-y-1 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Google Sheets</span>
            <FileSpreadsheet className={`w-3.5 h-3.5 ${sheetsStatus.isConfigured ? 'text-emerald-500' : sheetsConnected ? 'text-blue-500' : 'text-zinc-400'}`} />
          </div>
          <div className={`font-bold text-xs ${sheetsStatus.isConfigured ? 'text-emerald-500' : sheetsConnected ? 'text-blue-500' : 'text-zinc-500'}`}>
            {sheetsStatus.isConfigured ? '10 Sheets Ready' : sheetsConnected ? 'Scope Granted' : 'Not Connected'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 truncate" title={sheetsStatus.spreadsheetId || ''}>
            {sheetsStatus.spreadsheetId ? `ID: ${sheetsStatus.spreadsheetId}` : 'Link URL or Init'}
          </div>
        </div>

        <div className={`p-3 rounded-xl border space-y-1 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Google Drive</span>
            <HardDrive className={`w-3.5 h-3.5 ${driveStatus.rootFolderId ? 'text-emerald-500' : driveConnected ? 'text-blue-500' : 'text-zinc-400'}`} />
          </div>
          <div className={`font-bold text-xs ${driveStatus.rootFolderId ? 'text-emerald-500' : driveConnected ? 'text-blue-500' : 'text-zinc-500'}`}>
            {driveStatus.rootFolderId ? 'Private Folder Ready' : driveConnected ? 'Scope Granted' : 'Not Connected'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 truncate" title={driveStatus.rootFolderId || ''}>
            {driveStatus.rootFolderId ? `Folder: ${driveStatus.rootFolderId}` : 'Link Folder or Setup'}
          </div>
        </div>

        <div className={`p-3 rounded-xl border space-y-1 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Gmail Delivery API</span>
            <Mail className={`w-3.5 h-3.5 ${gmailConnected ? 'text-emerald-500' : 'text-zinc-400'}`} />
          </div>
          <div className={`font-bold text-xs ${gmailConnected ? 'text-emerald-500' : 'text-zinc-500'}`}>
            {gmailConnected ? 'Gmail Send Active' : googleStatus.isConnected ? 'Incremental Opt-in' : 'Not Connected'}
          </div>
          <div className="text-[11px] text-zinc-500">
            {gmailConnected ? 'gmail.send authorized' : 'SMTP independent'}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {googleFeedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
            googleFeedback.success
              ? isDark
                ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]'
                : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
              : isDark
                ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}
        >
          {googleFeedback.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          )}
          <span>{googleFeedback.message}</span>
        </div>
      )}

      {/* User Google Profile Card & Sign in / Reconnect / Verify / Disconnect Actions */}
      <div className={`p-4 rounded-xl border space-y-4 ${cardSurface}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0 flex-1">
            {googleStatus.isConnected && googleStatus.profilePicture ? (
              <img
                src={googleStatus.profilePicture}
                alt={googleStatus.profileName || 'Google Profile'}
                className="w-12 h-12 rounded-full border border-zinc-700 object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 ${
                  googleStatus.isConnected
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                    : isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      : 'bg-zinc-100 border-zinc-300 text-zinc-600'
                }`}
              >
                {googleStatus.isConnected ? profileInitials : <GoogleGLogo />}
              </div>
            )}

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center space-x-2">
                <span className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-black'}`}>
                  {googleStatus.isConnected
                    ? googleStatus.profileName || googleStatus.accountEmail || 'Connected HR Account'
                    : googleStatus.expired
                      ? `Session Expired (${googleStatus.accountEmail || 'Previous Account'})`
                      : 'No Google Account Connected'}
                </span>
                {googleStatus.isConnected && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-zinc-500 truncate">
                {googleStatus.isConnected || googleStatus.expired
                  ? googleStatus.accountEmail
                  : 'Sign in directly with your HR Google account via Google Identity Services.'}
              </div>
              <div className="text-[11px] text-zinc-500 flex flex-wrap gap-x-4 gap-y-0.5 pt-0.5">
                <span>
                  Last successful connection:{' '}
                  <strong className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                    {googleStatus.connectedAt ? new Date(googleStatus.connectedAt).toLocaleString() : 'Never'}
                  </strong>
                </span>
                <span>
                  Last verified:{' '}
                  <strong className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                    {googleStatus.lastCheckedAt ? new Date(googleStatus.lastCheckedAt).toLocaleString() : 'Not verified'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {!googleStatus.isConnected && (
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <button
                type="button"
                disabled={!googleStatus.oauthConfigured || isGoogleConnecting}
                onClick={() => onConnectGoogle({ includeGmail: includeGmailOnSignIn, mode: 'core' })}
                className="px-4 py-2.5 rounded-lg border text-xs font-bold transition flex items-center space-x-2.5 cursor-pointer shadow-sm disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-50"
              >
                {isGoogleConnecting ? <RefreshCw className="w-4 h-4 animate-spin text-[#CB1417]" /> : <GoogleGLogo />}
                <span>{isGoogleConnecting ? 'Authorizing...' : googleStatus.expired ? 'Reconnect with Google' : 'Sign in with Google'}</span>
              </button>
              <label className="inline-flex items-center space-x-1.5 text-[11px] text-zinc-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGmailOnSignIn}
                  onChange={(e) => setIncludeGmailOnSignIn(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
                />
                <span>Also include optional Gmail send permission</span>
              </label>
            </div>
          )}
        </div>

        {/* Connected Controls: Verify, Enable Gmail (incremental), Reconnect, Disconnect */}
        {googleStatus.isConnected && (
          <div className="pt-3 border-t dark:border-zinc-800 border-zinc-200 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isGoogleTesting}
              onClick={() => onTestGoogleApi('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs border transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${btnSecondary}`}
            >
              {isGoogleTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CB1417]" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              <span>Verify Connection</span>
            </button>

            <button
              type="button"
              disabled={isGoogleConnecting}
              onClick={() => onReconnectGoogle(gmailConnected)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs border transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${btnSecondary}`}
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-500" />
              <span>Reconnect</span>
            </button>

            {!gmailConnected && (
              <button
                type="button"
                disabled={isGoogleConnecting}
                onClick={() => onConnectGoogle({ includeGmail: true, mode: 'gmail' })}
                className="px-3 py-1.5 rounded-lg font-semibold text-xs border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Enable Gmail Delivery Permission</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRequestDisconnect}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm ml-auto flex items-center space-x-1.5 whitespace-nowrap"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {/* Requested Permissions & Security Boundary */}
      <div className={`p-4 rounded-xl border space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 dark:border-zinc-800 border-zinc-200">
          <h4 className="font-bold flex items-center space-x-2">
            <Lock className="w-4 h-4 text-[#CB1417]" />
            <span>Permissions &amp; Least-Privilege Google API Scopes</span>
          </h4>
          <span className="text-[10px] font-mono text-zinc-500">Short-lived in-memory GIS tokens only</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {scopeMetadata.map((item) => (
            <div key={item.key} className={`p-3 rounded-lg border space-y-1 ${innerCard}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`font-bold text-[11px] ${isDark ? 'text-white' : 'text-black'}`}>{item.label}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    item.granted
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : item.optional
                        ? 'bg-zinc-500/10 text-zinc-400'
                        : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {item.granted ? 'Granted' : item.optional ? 'Optional' : 'Pending'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">{item.reason}</p>
              <p className="text-[10px] font-mono text-zinc-400">{item.verificationNote}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Google Spreadsheet URL Connection & 10-Worksheet Database */}
      <div className={`p-4 rounded-xl border space-y-4 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 dark:border-zinc-800 border-zinc-200">
          <h4 className="font-bold flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Google Spreadsheet URL &amp; 10-Worksheet HR Database</span>
          </h4>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              sheetsStatus.isConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
            }`}
          >
            {sheetsStatus.isConfigured
              ? `Ready (${sheetsStatus.existingWorksheets.length}/10 Worksheets)`
              : sheetsStatus.spreadsheetId
                ? `${sheetsStatus.existingWorksheets.length}/10 Worksheets`
                : 'Not Linked'}
          </span>
        </div>

        {/* Paste Existing Spreadsheet URL */}
        <div className={`p-3 rounded-lg border space-y-2.5 ${innerCard}`}>
          <label className="font-semibold block text-[11px]">
            Connect Existing Google Spreadsheet URL (or Spreadsheet ID)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={spreadsheetUrlInput}
              onChange={(e) => setSpreadsheetUrlInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/1AbC.../edit"
              className={`flex-1 rounded-lg px-3 py-2 border text-xs font-mono ${inputClass}`}
            />
            <button
              type="button"
              disabled={!googleStatus.isConnected || !spreadsheetUrlInput.trim() || isVerifyingSpreadsheetUrl}
              onClick={() => onVerifySpreadsheetUrl?.(spreadsheetUrlInput)}
              className={`px-3.5 py-2 rounded-lg font-semibold text-xs border transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${btnSecondary}`}
            >
              {isVerifyingSpreadsheetUrl ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5 text-emerald-500" />}
              <span>Verify URL Access</span>
            </button>
            <button
              type="button"
              disabled={!googleStatus.isConnected || !spreadsheetUrlInput.trim() || isVerifyingSpreadsheetUrl}
              onClick={() => onConnectSpreadsheetUrl?.(spreadsheetUrlInput, false)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span>Connect URL</span>
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">
            Validates spreadsheet existence, connected account write capability, and missing tabs without overwriting existing data.
          </p>
        </div>

        {/* Spreadsheet Verification & Explicit Worksheet Approval Prompt */}
        {spreadsheetVerification && (
          <div className={`p-3 rounded-lg border space-y-2 ${innerCard}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-xs">{spreadsheetVerification.title}</span>
                <span className="block font-mono text-[10px] text-zinc-500">
                  ID: {spreadsheetVerification.spreadsheetId} · Write Access: {spreadsheetVerification.canWrite ? 'Verified' : 'Read-Only'}
                </span>
              </div>
              {spreadsheetVerification.requiresWorksheetApproval && (
                <button
                  type="button"
                  disabled={isApprovingWorksheets}
                  onClick={() => onApproveMissingWorksheets?.()}
                  className="px-3 py-1.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isApprovingWorksheets ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  <span>Approve &amp; Create {spreadsheetVerification.missingWorksheets.length} Missing Worksheet(s)</span>
                </button>
              )}
            </div>
            {spreadsheetVerification.missingWorksheets.length > 0 && (
              <div className="text-[11px] text-amber-500">
                Missing required worksheets (existing sheets will NOT be overwritten):{' '}
                <span className="font-mono">{spreadsheetVerification.missingWorksheets.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-zinc-500 block mb-1">Active Spreadsheet:</span>
            <span className="font-mono font-bold break-all">
              {sheetsStatus.spreadsheetTitle
                ? `${sheetsStatus.spreadsheetTitle} (${sheetsStatus.spreadsheetId})`
                : sheetsStatus.spreadsheetId || 'Not Linked Yet'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-1">Verified Worksheets ({sheetsStatus.existingWorksheets.length}/10):</span>
            <span className="font-mono text-[10px] text-zinc-400">
              {sheetsStatus.existingWorksheets.length > 0 ? sheetsStatus.existingWorksheets.join(', ') : 'None'}
            </span>
          </div>
        </div>

        {sheetsFeedback && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
              sheetsFeedback.success
                ? isDark
                  ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]'
                  : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                : isDark
                  ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
            }`}
          >
            {sheetsFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span>{sheetsFeedback.message}</span>
          </div>
        )}

        {migrationPreview && (
          <div className={`rounded-lg border overflow-hidden ${innerCard}`}>
            <div className={`px-3 py-2 text-[11px] font-bold border-b ${isDark ? 'border-zinc-800 bg-[#141416]' : 'border-zinc-200 bg-zinc-100'}`}>
              Duplicate-Safe Migration Preview (10 Worksheets)
            </div>
            <div className="divide-y dark:divide-zinc-800 divide-zinc-100">
              {Object.entries(migrationPreview).map(([sheetName, counts]) => (
                <div key={sheetName} className="px-3 py-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-medium">{sheetName}</span>
                  <span className="font-mono tabular-nums text-zinc-400">
                    Total: {counts.total} · <span className="text-emerald-500 font-bold">New: {counts.newCount}</span> · Skipped: {counts.skipCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={!googleStatus.isConnected || isSheetsSettingUp}
            onClick={onSetupMasterSpreadsheet}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-sm disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSheetsSettingUp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Create / Initialize 10-Sheet Database</span>
          </button>

          <button
            type="button"
            disabled={!sheetsStatus.isConfigured || isPreviewingMigration}
            onClick={onPreviewDataMigration}
            className={`px-3.5 py-2 rounded-lg font-semibold text-xs border transition flex items-center space-x-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${btnSecondary}`}
          >
            {isPreviewingMigration ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <EyeIcon className="w-3.5 h-3.5 text-[#CB1417]" />
            )}
            <span>Preview Migration</span>
          </button>

          <button
            type="button"
            disabled={!sheetsStatus.isConfigured || isMigrating}
            onClick={onRunDataMigration}
            className="px-3.5 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-sm disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isMigrating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Migrate Local Drafts to Google Sheets</span>
          </button>
        </div>
      </div>

      {/* Google Drive Folder URL Connection & Private Workspace */}
      <div className={`p-4 rounded-xl border space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 dark:border-zinc-800 border-zinc-200">
          <h4 className="font-bold flex items-center space-x-2">
            <HardDrive className="w-4 h-4 text-[#CB1417]" />
            <span>Google Drive Folder URL &amp; Private Archival Storage</span>
          </h4>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              driveStatus.rootFolderId ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'
            }`}
          >
            {driveStatus.rootFolderId ? 'Private Folder Linked' : 'Not Linked'}
          </span>
        </div>
        <p className="text-[11px] text-zinc-500">
          Link an existing private Google Drive folder URL or initialize the default <code className="font-mono">Employee Database Studio/</code> workspace. All employee documents, generated/manual payslips, logos, and backups remain strictly private to your connected HR Google account.
        </p>

        <div className={`p-3 rounded-lg border space-y-2 ${innerCard}`}>
          <label className="font-semibold block text-[11px]">Connect Private Google Drive Folder URL (or Folder ID)</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={driveFolderUrlInput}
              onChange={(e) => setDriveFolderUrlInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/1XyZ..."
              className={`flex-1 rounded-lg px-3 py-2 border text-xs font-mono ${inputClass}`}
            />
            <button
              type="button"
              disabled={!googleStatus.isConnected || !driveFolderUrlInput.trim() || isDriveLinkingUrl}
              onClick={() => onConnectDriveFolderUrl?.(driveFolderUrlInput)}
              className="px-3.5 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isDriveLinkingUrl ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>Verify &amp; Link Folder</span>
            </button>
          </div>
        </div>

        {driveStatus.rootFolderId && (
          <div className="text-[11px] font-mono text-zinc-400 break-all">
            Linked Private Folder: <strong className={isDark ? 'text-white' : 'text-black'}>{driveStatus.folderName ? `${driveStatus.folderName} (${driveStatus.rootFolderId})` : driveStatus.rootFolderId}</strong>
          </div>
        )}

        {driveFeedback && (
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center space-x-2 ${
              driveFeedback.success
                ? isDark
                  ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]'
                  : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                : isDark
                  ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
            }`}
          >
            {driveFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span>{driveFeedback.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!googleStatus.isConnected || isDriveSettingUp}
            onClick={onSetupDriveHierarchy}
            className="px-3.5 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isDriveSettingUp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Initialize Private Subfolders</span>
          </button>
          <button
            type="button"
            disabled={!googleStatus.isConnected || isDriveBackingUp}
            onClick={onBackupToDrive}
            className={`px-3.5 py-2 rounded-lg font-semibold text-xs border transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${btnSecondary}`}
          >
            {isDriveBackingUp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Upload Workspace Backup to Drive</span>
          </button>
        </div>
      </div>

      {/* Persistence Mode: Google Sheets Primary vs Temporary Local Browser Drafts */}
      <div className={`p-4 rounded-xl border space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 dark:border-zinc-800 border-zinc-200">
          <h4 className="font-bold flex items-center space-x-2">
            {sheetsConnected && sheetsStatus.isConfigured ? (
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            ) : (
              <CloudOff className="w-4 h-4 text-amber-500" />
            )}
            <span>Persistence Mode: Google Sheets vs Temporary Local Drafts</span>
          </h4>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              sheetsConnected && sheetsStatus.isConfigured
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-amber-500/10 text-amber-500'
            }`}
          >
            {sheetsConnected && sheetsStatus.isConfigured ? 'Google Sheets Primary Active' : 'Temporary Local Browser Drafts'}
          </span>
        </div>

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {sheetsConnected && sheetsStatus.isConfigured
            ? 'All company settings, layout presets, employee directory saves, payroll logs, and email delivery audits write directly to your connected Google Sheets 10-worksheet database. Browser IndexedDB acts strictly as an offline local draft cache.'
            : 'While Google Sheets is disconnected, edits are saved strictly as temporary local browser drafts in IndexedDB and are never falsely reported as permanent cloud saves. Sign in with Google and link your spreadsheet above, then click Migrate Local Drafts to Google Sheets to push drafts safely.'}
        </p>
      </div>

      {/* GIS Client Setup Checklist */}
      <div className={`p-4 rounded-xl border space-y-2.5 ${cardSurface}`}>
        <div className="flex items-center space-x-2 border-b pb-2 dark:border-zinc-800 border-zinc-200">
          <Info className="w-4 h-4 text-[#CB1417]" />
          <h4 className="font-bold">Google Identity Services (Client OAuth) Configuration</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <div className={`px-3 py-2 rounded-lg border flex items-center justify-between ${innerCard}`}>
            <span className="font-mono">VITE_GOOGLE_CLIENT_ID</span>
            <span className={`font-bold ${googleStatus.clientIdConfigured ? 'text-emerald-500' : 'text-amber-500'}`}>
              {googleStatus.clientIdConfigured ? 'Configured' : 'Missing'}
            </span>
          </div>
          <div className={`px-3 py-2 rounded-lg border flex items-center justify-between ${innerCard}`}>
            <span className="font-mono">Token Storage</span>
            <span className="font-bold text-emerald-500">In-Memory Only</span>
          </div>
          <div className={`px-3 py-2 rounded-lg border flex items-center justify-between ${innerCard}`}>
            <span className="font-mono">Server Client Secret</span>
            <span className="font-bold text-emerald-500">Not Required</span>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Authorized JavaScript Origin (add to Google Cloud OAuth 2.0 Web Client):{' '}
          <code className="font-mono">
            {typeof window !== 'undefined' ? window.location.origin : 'https://your-deployment-domain.vercel.app'}
          </code>
        </p>
      </div>
    </div>
  );
};
