import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Upload,
  Save,
  CheckCircle2,
  Database,
  Download,
  RotateCcw,
  Sun,
  Moon,
  Palette,
  FileText,
  Mail,
  Shield,
  CreditCard,
  Eye,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Check,
  Server,
  Lock,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import { CompanySettings } from '../types/payroll';
import { DEFAULT_COMPANY_SETTINGS, localDB } from '../utils/dbStorage';
import { useTheme } from '../context/ThemeContext';
import { BrandColorCustomizer } from './BrandColorCustomizer';
import {
  GoogleWorkspaceSetupTab,
  GoogleConnectionStatusState,
  SpreadsheetVerificationInfo,
} from './GoogleWorkspaceSetupTab';
import { apiClient } from '../utils/apiClient';
import {
  fetchGoogleClientConfig,
  getGoogleSession,
  getWorkspaceLinks,
  setWorkspaceLinks,
  signInWithGoogle,
  requestGmailConsent,
  signOutGoogle,
  subscribeGoogleSession,
  subscribeWorkspaceLinks,
  GoogleClientConfig,
  GoogleSessionState,
  WorkspaceLinks,
} from '../utils/googleAuthClient';

interface SettingsViewProps {
  settings: CompanySettings;
  initialSection?: 'info' | 'branding' | 'payslip' | 'email' | 'google' | 'signatory' | 'database';
  onSaveSettings: (settings: CompanySettings) => Promise<{ cloudSaved: boolean } | void> | void;
  onDatabaseRestored: () => void;
  currentUser?: any;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  initialSection,
  onSaveSettings,
  onDatabaseRestored,
  currentUser
}) => {
  const { theme, setTheme, isDark } = useTheme();
  const [formData, setFormData] = useState<CompanySettings>({ ...settings });
  const [activeSection, setActiveSection] = useState<'info' | 'branding' | 'payslip' | 'email' | 'google' | 'signatory' | 'database'>(
    initialSection || 'branding'
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showDisconnectGoogleModal, setShowDisconnectGoogleModal] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Server-Side SMTP Settings State (Encrypted & Kept Server-Side)
  const [smtpConfig, setSmtpConfig] = useState<{
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    senderEmail: string;
    senderName: string;
    isConfigured: boolean;
    isVerified: boolean;
    hasPassword: boolean;
    lastVerifiedAt: string | null;
    lastError: string | null;
  }>({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    senderEmail: '',
    senderName: '',
    isConfigured: false,
    isVerified: false,
    hasPassword: false,
    lastVerifiedAt: null,
    lastError: null
  });
  const [isSmtpLoading, setIsSmtpLoading] = useState(false);
  const [isSmtpTesting, setIsSmtpTesting] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSmtpSaving, setIsSmtpSaving] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const isAdmin = !currentUser || currentUser.role === 'admin' || currentUser.role === 'super_admin';

  const loadServerSmtp = async () => {
    setIsSmtpLoading(true);
    try {
      const res = await apiClient.request('/email/settings');
      if (res.success && res.settings) {
        setSmtpConfig(prev => ({
          ...prev,
          smtpHost: res.settings.smtpHost || '',
          smtpPort: res.settings.smtpPort || 587,
          smtpUser: res.settings.smtpUser || '',
          smtpPass: '',
          senderEmail: res.settings.senderEmail || '',
          senderName: res.settings.senderName || '',
          isConfigured: res.isConfigured,
          isVerified: res.isVerified,
          hasPassword: Boolean(res.settings.hasPassword),
          lastVerifiedAt: res.settings.lastVerifiedAt || null,
          lastError: res.settings.lastError || null
        }));
      }
    } catch (err: any) {
      console.warn('[SettingsView] Error loading SMTP configuration:', err.message);
    } finally {
      setIsSmtpLoading(false);
    }
  };

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const [googleClientConfig, setGoogleClientConfig] = useState<GoogleClientConfig>({
    configured: false,
    clientId: null,
    authModel: 'client_gis_in_memory',
    defaultScopes: [],
    optionalGmailScope: 'https://www.googleapis.com/auth/gmail.send',
    requestedScopesMetadata: [],
  });

  const buildGoogleStatus = (
    cfg: GoogleClientConfig,
    session: GoogleSessionState,
    links: WorkspaceLinks
  ): GoogleConnectionStatusState => {
    const scopes = session.scopes || [];
    const hasScope = (kw: string) => scopes.some((s) => s.toLowerCase().includes(kw.toLowerCase()));
    const baseMeta = cfg.requestedScopesMetadata || [];
    const hydratedMeta = baseMeta.map((item) => {
      let granted = false;
      if (session.isConnected) {
        if (item.key === 'identity') granted = true;
        else if (item.key === 'drive') granted = hasScope('drive');
        else if (item.key === 'sheets') granted = hasScope('spreadsheets');
        else if (item.key === 'gmail') granted = hasScope('gmail.send') || hasScope('mail.google');
      }
      return { ...item, granted };
    });

    return {
      oauthConfigured: Boolean(cfg.configured && cfg.clientId),
      clientIdConfigured: Boolean(cfg.configured && cfg.clientId),
      clientId: cfg.clientId || null,
      authModel: 'client_gis_in_memory',
      isConnected: session.isConnected,
      expired: session.expired,
      accountEmail: session.profile?.email || null,
      profileName: session.profile?.name || null,
      profilePicture: session.profile?.picture || null,
      scopes,
      requestedScopesMetadata: hydratedMeta,
      permissionSummary: {
        identity: session.isConnected,
        drive: session.isConnected && hasScope('drive'),
        sheets: session.isConnected && hasScope('spreadsheets'),
        gmail: session.isConnected && (hasScope('gmail.send') || hasScope('mail.google')),
      },
      spreadsheetUrl: links.spreadsheetUrl || null,
      driveFolderUrl: links.driveFolderUrl || null,
      connectedAt: session.connectedAt,
      lastCheckedAt: session.lastVerifiedAt,
    };
  };

  // Google Account Connection State (GIS client-side in-memory OAuth)
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatusState>(() =>
    buildGoogleStatus(googleClientConfig, getGoogleSession(), getWorkspaceLinks())
  );
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isGoogleTesting, setIsGoogleTesting] = useState(false);
  const [googleFeedback, setGoogleFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Google Drive Workspace State
  const [driveStatus, setDriveStatus] = useState<{
    isConnected: boolean;
    rootFolderId: string | null;
    folderUrl?: string | null;
    folderName?: string | null;
    accountEmail: string | null;
  }>(() => {
    const links = getWorkspaceLinks();
    return {
      isConnected: false,
      rootFolderId: links.driveRootFolderId,
      folderUrl: links.driveFolderUrl,
      folderName: links.folderName,
      accountEmail: null,
    };
  });
  const [isDriveSettingUp, setIsDriveSettingUp] = useState(false);
  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);
  const [isDriveLinkingUrl, setIsDriveLinkingUrl] = useState(false);
  const [driveFeedback, setDriveFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Google Sheets Database State
  const [sheetsStatus, setSheetsStatus] = useState<{
    isConfigured: boolean;
    spreadsheetId: string | null;
    spreadsheetUrl?: string | null;
    spreadsheetTitle?: string | null;
    accountEmail: string | null;
    existingWorksheets: string[];
    missingWorksheets?: string[];
  }>(() => {
    const links = getWorkspaceLinks();
    return {
      isConfigured: false,
      spreadsheetId: links.spreadsheetId,
      spreadsheetUrl: links.spreadsheetUrl,
      spreadsheetTitle: links.spreadsheetTitle,
      accountEmail: null,
      existingWorksheets: [],
      missingWorksheets: [],
    };
  });
  const [isSheetsSettingUp, setIsSheetsSettingUp] = useState(false);
  const [isVerifyingSpreadsheetUrl, setIsVerifyingSpreadsheetUrl] = useState(false);
  const [isApprovingWorksheets, setIsApprovingWorksheets] = useState(false);
  const [spreadsheetVerification, setSpreadsheetVerification] = useState<SpreadsheetVerificationInfo | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isPreviewingMigration, setIsPreviewingMigration] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState<Record<string, { total: number; newCount: number; skipCount: number }> | null>(null);
  const [sheetsFeedback, setSheetsFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const loadDriveStatus = async () => {
    const session = getGoogleSession();
    const links = getWorkspaceLinks();
    if (!session.isConnected) {
      setDriveStatus({
        isConnected: false,
        rootFolderId: links.driveRootFolderId,
        folderUrl: links.driveFolderUrl,
        folderName: links.folderName,
        accountEmail: null,
      });
      return;
    }
    try {
      const res = await apiClient.request('/drive/status');
      if (res.success) {
        setDriveStatus({
          isConnected: Boolean(res.isConnected),
          rootFolderId: res.rootFolderId || links.driveRootFolderId || null,
          folderUrl: res.folderUrl || links.driveFolderUrl || null,
          folderName: res.folderName || links.folderName || null,
          accountEmail: session.profile?.email || null,
        });
      }
    } catch {
      // Optional when Google Drive permissions/folder are not linked yet
    }
  };

  const loadSheetsStatus = async () => {
    const session = getGoogleSession();
    const links = getWorkspaceLinks();
    if (!session.isConnected) {
      setSheetsStatus({
        isConfigured: false,
        spreadsheetId: links.spreadsheetId,
        spreadsheetUrl: links.spreadsheetUrl,
        spreadsheetTitle: links.spreadsheetTitle,
        accountEmail: null,
        existingWorksheets: [],
        missingWorksheets: [],
      });
      return;
    }
    try {
      const res = await apiClient.request('/sheets/status');
      if (res.success) {
        setSheetsStatus({
          isConfigured: Boolean(res.isConfigured),
          spreadsheetId: res.spreadsheetId || links.spreadsheetId || null,
          spreadsheetUrl: res.spreadsheetUrl || links.spreadsheetUrl || null,
          spreadsheetTitle: res.spreadsheetTitle || links.spreadsheetTitle || null,
          accountEmail: session.profile?.email || null,
          existingWorksheets: res.existingWorksheets || [],
          missingWorksheets: res.missingWorksheets || [],
        });
      }
    } catch (err: any) {
      console.warn('[SettingsView] Failed to load Google Sheets status:', err.message);
    }
  };

  const loadGoogleStatus = async () => {
    setIsGoogleLoading(true);
    try {
      const cfg = await fetchGoogleClientConfig(apiClient.getServerUrl());
      setGoogleClientConfig(cfg);
      setGoogleStatus(buildGoogleStatus(cfg, getGoogleSession(), getWorkspaceLinks()));
    } catch (err: any) {
      console.warn('[SettingsView] Failed to load Google configuration:', err.message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    loadServerSmtp();
    loadGoogleStatus();
    loadSheetsStatus();
    loadDriveStatus();
  }, []);

  useEffect(() => {
    const unsubSession = subscribeGoogleSession((session) => {
      setGoogleStatus(buildGoogleStatus(googleClientConfig, session, getWorkspaceLinks()));
      loadSheetsStatus();
      loadDriveStatus();
    });
    const unsubLinks = subscribeWorkspaceLinks((links) => {
      setGoogleStatus(buildGoogleStatus(googleClientConfig, getGoogleSession(), links));
    });
    return () => {
      unsubSession();
      unsubLinks();
    };
  }, [googleClientConfig]);

  const handleConnectGoogle = async (options?: { includeGmail?: boolean; mode?: 'core' | 'gmail' }) => {
    setIsGoogleConnecting(true);
    setGoogleFeedback(null);
    try {
      const session =
        options?.mode === 'gmail'
          ? await requestGmailConsent(apiClient.getServerUrl())
          : await signInWithGoogle({
              includeGmail: options?.includeGmail,
              apiBaseUrl: apiClient.getServerUrl(),
            });
      setGoogleFeedback({
        success: true,
        message: `Connected HR Google account: ${session.profile?.email || 'Verified Session'}.`,
      });
      showToast('Google account connected (in-memory OAuth session active).');
      await Promise.all([loadGoogleStatus(), loadDriveStatus(), loadSheetsStatus()]);
    } catch (err: any) {
      setGoogleFeedback({ success: false, message: err.message || 'Google authorization failed.' });
    } finally {
      setIsGoogleConnecting(false);
    }
  };

  const handleReconnectGoogle = async (includeGmail?: boolean) => {
    setIsGoogleConnecting(true);
    setGoogleFeedback(null);
    try {
      const session = await signInWithGoogle({
        includeGmail,
        prompt: 'consent',
        apiBaseUrl: apiClient.getServerUrl(),
      });
      setGoogleFeedback({
        success: true,
        message: `Reconnected HR Google account: ${session.profile?.email || 'Verified Session'}.`,
      });
      showToast('Google permissions refreshed.');
      await Promise.all([loadGoogleStatus(), loadDriveStatus(), loadSheetsStatus()]);
    } catch (err: any) {
      setGoogleFeedback({ success: false, message: err.message || 'Reconnect initialization error.' });
    } finally {
      setIsGoogleConnecting(false);
    }
  };

  const handleTestGoogleApi = async (apiType: 'drive' | 'sheets' | 'gmail' | 'all') => {
    setIsGoogleTesting(true);
    setGoogleFeedback(null);
    try {
      const res = await apiClient.request('/google/test', {
        method: 'POST',
        body: JSON.stringify({ scopeCheck: apiType })
      });
      if (res.success) {
        setGoogleFeedback({
          success: true,
          message: res.message || `Google API connection verified for ${res.email || 'connected HR account'}!`
        });
        showToast('Google connection verified.');
        await loadGoogleStatus();
      } else {
        setGoogleFeedback({ success: false, message: res.error || 'Google API verification failed.' });
      }
    } catch (err: any) {
      setGoogleFeedback({ success: false, message: err.message || 'Error verifying Google API.' });
    } finally {
      setIsGoogleTesting(false);
    }
  };

  const executeDisconnectGoogle = async () => {
    setShowDisconnectGoogleModal(false);
    try {
      await signOutGoogle(apiClient.getServerUrl());
      setGoogleFeedback({
        success: true,
        message: 'Google account disconnected and in-memory OAuth token revoked.',
      });
      showToast('Google account disconnected.');
      await Promise.all([loadGoogleStatus(), loadSheetsStatus(), loadDriveStatus()]);
    } catch (err: any) {
      setGoogleFeedback({ success: false, message: `Disconnect failed: ${err.message}` });
    }
  };

  const handleSetupDriveHierarchy = async () => {
    setIsDriveSettingUp(true);
    setDriveFeedback(null);
    try {
      const res = await apiClient.request('/drive/setup', { method: 'POST' });
      if (res.success) {
        if (res.rootFolderId) {
          setWorkspaceLinks({
            driveRootFolderId: res.rootFolderId,
            driveFolderUrl: res.folderUrl || null,
            folderName: 'Employee Database Studio',
          });
        }
        setDriveFeedback({ success: true, message: res.message || 'Google Drive workspace hierarchy initialized.' });
        showToast('Google Drive folders ready.');
        await loadDriveStatus();
      } else {
        setDriveFeedback({ success: false, message: res.error || 'Failed to setup Google Drive workspace.' });
      }
    } catch (err: any) {
      setDriveFeedback({ success: false, message: err.message || 'Error setting up Google Drive.' });
    } finally {
      setIsDriveSettingUp(false);
    }
  };

  const handleBackupToDrive = async () => {
    setIsDriveBackingUp(true);
    setDriveFeedback(null);
    try {
      const backupJson = await localDB.exportFullBackup();
      const safeCo = (formData.companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `EmployeeDatabaseStudio_${safeCo}_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      const res = await apiClient.request('/drive/backup', {
        method: 'POST',
        body: JSON.stringify({ backupJson, fileName })
      });
      if (res.success) {
        setDriveFeedback({ success: true, message: res.message || 'Workspace backup archived to Google Drive.' });
        showToast('Backup snapshot uploaded to Google Drive.');
      } else {
        setDriveFeedback({ success: false, message: res.error || 'Google Drive backup failed.' });
      }
    } catch (err: any) {
      setDriveFeedback({ success: false, message: err.message || 'Error uploading backup to Google Drive.' });
    } finally {
      setIsDriveBackingUp(false);
    }
  };

  const handleConnectDriveFolderUrl = async (folderUrl: string) => {
    setIsDriveLinkingUrl(true);
    setDriveFeedback(null);
    try {
      const res = await apiClient.request('/drive/connect-url', {
        method: 'POST',
        body: JSON.stringify({ folderUrl }),
      });
      if (res.success) {
        if (res.folderId) {
          setWorkspaceLinks({
            driveRootFolderId: res.folderId,
            driveFolderUrl: res.folderUrl || null,
            folderName: res.folderName || null,
          });
        }
        setDriveFeedback({ success: true, message: res.message || 'Private Google Drive folder linked!' });
        showToast('Google Drive folder linked.');
        await Promise.all([loadDriveStatus(), loadGoogleStatus()]);
      } else {
        setDriveFeedback({ success: false, message: res.error || 'Failed to verify/link Drive folder.' });
      }
    } catch (err: any) {
      setDriveFeedback({ success: false, message: err.message || 'Drive folder URL verification failed.' });
    } finally {
      setIsDriveLinkingUrl(false);
    }
  };

  const handleVerifySpreadsheetUrl = async (spreadsheetUrl: string) => {
    setIsVerifyingSpreadsheetUrl(true);
    setSheetsFeedback(null);
    try {
      const res = await apiClient.request('/sheets/verify-url', {
        method: 'POST',
        body: JSON.stringify({ spreadsheetUrl }),
      });
      if (res.success) {
        setSpreadsheetVerification({
          spreadsheetId: res.spreadsheetId,
          spreadsheetUrl: res.spreadsheetUrl,
          title: res.title,
          canWrite: res.canWrite,
          existingWorksheets: res.existingWorksheets || [],
          missingWorksheets: res.missingWorksheets || [],
          requiresWorksheetApproval: Boolean(res.requiresWorksheetApproval),
        });
        setSheetsFeedback({ success: true, message: res.message || 'Spreadsheet URL verified.' });
      } else {
        setSheetsFeedback({ success: false, message: res.error || 'Spreadsheet verification failed.' });
      }
    } catch (err: any) {
      setSpreadsheetVerification(null);
      setSheetsFeedback({ success: false, message: err.message || 'Spreadsheet URL verification failed.' });
    } finally {
      setIsVerifyingSpreadsheetUrl(false);
    }
  };

  const handleConnectSpreadsheetUrl = async (spreadsheetUrl: string, approveCreateWorksheets: boolean) => {
    setIsVerifyingSpreadsheetUrl(true);
    setSheetsFeedback(null);
    try {
      const res = await apiClient.request('/sheets/connect-url', {
        method: 'POST',
        body: JSON.stringify({ spreadsheetUrl, approveCreateWorksheets }),
      });
      if (res.success) {
        setWorkspaceLinks({
          spreadsheetId: res.spreadsheetId,
          spreadsheetUrl: res.spreadsheetUrl || null,
          spreadsheetTitle: res.title || null,
        });
        setSpreadsheetVerification({
          spreadsheetId: res.spreadsheetId,
          spreadsheetUrl: res.spreadsheetUrl,
          title: res.title,
          canWrite: res.canWrite,
          existingWorksheets: res.existingWorksheets || [],
          missingWorksheets: res.missingWorksheets || [],
          requiresWorksheetApproval: Boolean(res.requiresWorksheetApproval),
        });
        setSheetsFeedback({ success: true, message: res.message || 'Spreadsheet linked.' });
        showToast('Google Spreadsheet linked.');
        await Promise.all([loadSheetsStatus(), loadGoogleStatus()]);
      } else {
        setSheetsFeedback({ success: false, message: res.error || 'Failed to connect spreadsheet URL.' });
      }
    } catch (err: any) {
      setSheetsFeedback({ success: false, message: err.message || 'Error connecting spreadsheet URL.' });
    } finally {
      setIsVerifyingSpreadsheetUrl(false);
    }
  };

  const handleApproveMissingWorksheets = async () => {
    setIsApprovingWorksheets(true);
    setSheetsFeedback(null);
    try {
      const res = await apiClient.request('/sheets/approve-worksheets', { method: 'POST' });
      if (res.success) {
        setSpreadsheetVerification(null);
        setSheetsFeedback({ success: true, message: res.message || 'Missing worksheets created safely.' });
        showToast('All 10 Google Sheets worksheets verified.');
        await loadSheetsStatus();
      } else {
        setSheetsFeedback({ success: false, message: res.error || 'Worksheet creation failed.' });
      }
    } catch (err: any) {
      setSheetsFeedback({ success: false, message: err.message || 'Error approving worksheets.' });
    } finally {
      setIsApprovingWorksheets(false);
    }
  };

  const handleSetupMasterSpreadsheet = async () => {
    setIsSheetsSettingUp(true);
    setSheetsFeedback(null);
    try {
      const res = await apiClient.request('/sheets/setup', { method: 'POST' });
      if (res.success) {
        if (res.spreadsheetId) {
          setWorkspaceLinks({
            spreadsheetId: res.spreadsheetId,
            spreadsheetUrl: res.spreadsheetUrl || null,
            spreadsheetTitle: 'Employee Database Studio Master',
          });
        }
        setSpreadsheetVerification(null);
        setSheetsFeedback({ success: true, message: res.message || 'Master spreadsheet initialized successfully!' });
        showToast('Google Sheets Master Database provisioned.');
        await loadSheetsStatus();
      } else {
        setSheetsFeedback({ success: false, message: res.error || 'Failed to initialize spreadsheet.' });
      }
    } catch (err: any) {
      setSheetsFeedback({ success: false, message: err.message || 'Error initializing spreadsheet.' });
    } finally {
      setIsSheetsSettingUp(false);
    }
  };

  const buildMigrationPayload = async () => {
    const [directoryEmployees, batchEmployees, history, layout] = await Promise.all([
      localDB.getDirectoryEmployees(),
      localDB.getEmployees(),
      localDB.getHistory(),
      localDB.getLayoutSettings()
    ]);
    const payloadEmployees = directoryEmployees.length > 0 ? directoryEmployees : batchEmployees;
    return {
      employees: payloadEmployees,
      salaryStructures: payloadEmployees,
      payrollDetails: batchEmployees,
      history,
      companySettings: formData,
      layoutSettings: layout
    };
  };

  const handlePreviewDataMigration = async () => {
    setIsPreviewingMigration(true);
    setSheetsFeedback(null);
    try {
      const payload = await buildMigrationPayload();
      const res = await apiClient.request('/sheets/migrate-preview', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success && res.preview) {
        setMigrationPreview(res.preview);
        setSheetsFeedback({ success: true, message: 'Migration dry-run ready. Review new vs already-synced rows below before syncing.' });
      } else {
        setSheetsFeedback({ success: false, message: res.error || 'Migration preview failed.' });
      }
    } catch (err: any) {
      setSheetsFeedback({ success: false, message: err.message || 'Error previewing migration.' });
    } finally {
      setIsPreviewingMigration(false);
    }
  };

  const handleRunDataMigration = async () => {
    setIsMigrating(true);
    setSheetsFeedback(null);
    try {
      const payload = await buildMigrationPayload();
      const res = await apiClient.request('/sheets/migrate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        const empCount = res.migratedEmployeesCount ?? 0;
        const salCount = res.migratedSalaryCount ?? 0;
        const detCount = res.migratedDetailsCount ?? 0;
        const histCount = res.migratedHistoryCount ?? 0;
        const emailCount = res.migratedEmailLogsCount ?? 0;
        setMigrationPreview(null);
        setSheetsFeedback({
          success: true,
          message: res.message || `Synced ${empCount} employees, ${salCount} salary structures, ${detCount} payroll rows, ${histCount} history items, and ${emailCount} email logs to Google Sheets.`
        });
        showToast('Data migration to Google Sheets complete.');
        loadSheetsStatus();
      } else {
        setSheetsFeedback({ success: false, message: res.error || 'Data migration failed.' });
      }
    } catch (err: any) {
      setSheetsFeedback({ success: false, message: err.message || 'Error executing data migration.' });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSaveSmtpSettings = async () => {
    if (!isAdmin) {
      setSmtpFeedback({ success: false, message: 'Only authorized administrators can modify server-side SMTP credentials.' });
      return;
    }
    if (!smtpConfig.smtpHost || !smtpConfig.senderEmail) {
      setSmtpFeedback({
        success: false,
        message: 'SMTP Host and Sender Email are required to configure email service.'
      });
      return;
    }

    setIsSmtpSaving(true);
    setSmtpFeedback(null);
    try {
      const res = await apiClient.request('/email/settings', {
        method: 'PUT',
        body: JSON.stringify({
          smtpHost: smtpConfig.smtpHost,
          smtpPort: Number(smtpConfig.smtpPort) || 587,
          smtpUser: smtpConfig.smtpUser,
          smtpPass: smtpConfig.smtpPass || undefined,
          senderEmail: smtpConfig.senderEmail,
          senderName: smtpConfig.senderName
        })
      });

      if (res.success) {
        setSmtpFeedback({
          success: true,
          message: res.message || 'SMTP settings saved securely on the server. Please test connection.'
        });
        showToast('Server-side SMTP configuration updated.');
        loadServerSmtp();
      } else {
        setSmtpFeedback({
          success: false,
          message: res.error || 'Failed to save SMTP settings.'
        });
      }
    } catch (err: any) {
      setSmtpFeedback({
        success: false,
        message: err.message || 'Error communicating with server.'
      });
    } finally {
      setIsSmtpSaving(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    if (!isAdmin) {
      setSmtpFeedback({ success: false, message: 'Only authorized administrators can test SMTP connections.' });
      return;
    }
    setIsSmtpTesting(true);
    setSmtpFeedback(null);

    try {
      const res = await apiClient.request('/email/verify', {
        method: 'POST',
        body: JSON.stringify({
          smtpHost: smtpConfig.smtpHost,
          smtpPort: Number(smtpConfig.smtpPort) || 587,
          smtpUser: smtpConfig.smtpUser,
          smtpPass: smtpConfig.smtpPass || undefined,
          senderEmail: smtpConfig.senderEmail,
          senderName: smtpConfig.senderName
        })
      });

      if (res.success) {
        setSmtpFeedback({
          success: true,
          message: res.message || 'SMTP connection tested and verified successfully! Email dispatch is active.'
        });
        showToast('SMTP connection verified successfully.');
        loadServerSmtp();
      } else {
        setSmtpFeedback({
          success: false,
          message: res.error || 'SMTP server connection verification failed.'
        });
      }
    } catch (err: any) {
      setSmtpFeedback({
        success: false,
        message: err.message || 'Connection error. Check host, port, credentials, and network firewall.'
      });
    } finally {
      setIsSmtpTesting(false);
    }
  };

  const handleSendSmtpTestEmail = async () => {
    if (!isAdmin) return;
    if (!testEmailRecipient.trim()) {
      setSmtpFeedback({ success: false, message: 'Enter a recipient email address to send a Company SMTP test email.' });
      return;
    }
    setIsSendingTestEmail(true);
    setSmtpFeedback(null);
    try {
      const res = await apiClient.request('/email/test', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: testEmailRecipient.trim(),
          smtpHost: smtpConfig.smtpHost,
          smtpPort: Number(smtpConfig.smtpPort) || 587,
          smtpUser: smtpConfig.smtpUser,
          smtpPass: smtpConfig.smtpPass || undefined,
          senderEmail: smtpConfig.senderEmail,
          senderName: smtpConfig.senderName,
        }),
      });
      if (res.success) {
        setSmtpFeedback({ success: true, message: res.message || `SMTP test email sent to ${testEmailRecipient.trim()}.` });
        showToast('SMTP test email dispatched.');
        loadServerSmtp();
      } else {
        setSmtpFeedback({ success: false, message: res.error || 'Failed to send SMTP test email.' });
      }
    } catch (err: any) {
      setSmtpFeedback({ success: false, message: err.message || 'Failed to send SMTP test email.' });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // File Inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const darkLogoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleFieldChange = (field: keyof CompanySettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Safe image file reader with validation (max 5MB, format check)
  const readFileAsDataUrl = (file: File, callback: (dataUrl: string) => void) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorBanner('Invalid file format. Please upload a PNG, JPG, JPEG, SVG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorBanner('File size exceeds 5 MB. Please upload a compressed image.');
      return;
    }
    setErrorBanner(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        callback(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) => {
        handleFieldChange('logoDataUrl', dataUrl);
        showToast('Company primary logo uploaded successfully.');
      });
    }
    e.target.value = '';
  };

  const handleDarkLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) => {
        handleFieldChange('logoDarkDataUrl', dataUrl);
        showToast('Dark background logo uploaded successfully.');
      });
    }
    e.target.value = '';
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) => {
        handleFieldChange('companyIconDataUrl', dataUrl);
        showToast('Company icon / favicon uploaded.');
      });
    }
    e.target.value = '';
  };

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) => {
        handleFieldChange('signatureDataUrl', dataUrl);
        showToast('Authorized signature graphic uploaded.');
      });
    }
    e.target.value = '';
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorBanner(null);
    try {
      const res = await onSaveSettings(formData);
      if (res && typeof res === 'object' && 'cloudSaved' in res && res.cloudSaved) {
        showToast('Company settings saved to Google Sheets & temporary local drafts.');
      } else {
        showToast('Saved to temporary local drafts only. Connect Google Sheets to save permanently to cloud.');
      }
    } catch (err: any) {
      setErrorBanner(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = async () => {
    const jsonStr = await localDB.exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EmployeeDatabaseStudio_${formData.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Full database backup exported to JSON file.');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingRestoreFile(file);
    e.target.value = '';
  };

  const executeImportBackup = async () => {
    if (!pendingRestoreFile) return;
    const file = pendingRestoreFile;
    setPendingRestoreFile(null);
    setErrorBanner(null);
    const text = await file.text();
    const result = await localDB.importFullBackup(text);
    if (result.success) {
      onDatabaseRestored();
      showToast(result.message);
    } else {
      setErrorBanner(result.message);
    }
  };

  const executeResetDefaults = () => {
    setFormData({ ...DEFAULT_COMPANY_SETTINGS });
    onSaveSettings(DEFAULT_COMPANY_SETTINGS);
    setShowResetConfirmModal(false);
    showToast('Reset all company branding and configuration to defaults.');
  };

  const presetColors = [
    { name: 'Enterprise Crimson', hex: '#CB1417' },
    { name: 'Corporate Navy', hex: '#1E3A8A' },
    { name: 'Emerald Forest', hex: '#059669' },
    { name: 'Royal Purple', hex: '#7C3AED' },
    { name: 'Amber Copper', hex: '#D97706' },
    { name: 'Slate Steel', hex: '#475569' }
  ];

  return (
    <div className="space-y-6">
      <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" />
      <input type="file" ref={darkLogoInputRef} onChange={handleDarkLogoUpload} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" />
      <input type="file" ref={iconInputRef} onChange={handleIconUpload} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" />
      <input type="file" ref={sigInputRef} onChange={handleSigUpload} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" />
      <input type="file" ref={backupInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />

      {/* Top Banner */}
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div className="flex items-center space-x-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md shrink-0 overflow-hidden"
            style={{ backgroundColor: formData.themeColor || 'var(--brand-primary)' }}
          >
            {formData.logoDataUrl ? (
              <img src={formData.logoDataUrl} alt="Logo" className="w-full h-full object-contain p-1 bg-white" />
            ) : (
              <span>{formData.companyName ? formData.companyName.slice(0, 2).toUpperCase() : 'CO'}</span>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: formData.themeColor || 'var(--brand-primary)' }}>
              <Building2 className="w-4 h-4" />
              <span>Commercial White-Label & Corporate Identity</span>
            </div>
            <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
              Company Settings & Brand Customization
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Customize company logos, brand palettes, payslip templates, email signatures, and currency rules.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowResetConfirmModal(true)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center space-x-1.5 ${
              isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-600'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border animate-in fade-in ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorBanner && (
        <div className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs border ${
          isDark ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#ED1F24] shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-[11px] font-semibold underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-sections */}
      <div className={`flex flex-wrap items-center gap-1.5 border-b pb-2.5 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {[
          { id: 'branding', label: 'Brand & Logo Assets', icon: Palette },
          { id: 'info', label: 'Company Information', icon: Building2 },
          { id: 'payslip', label: 'Payslip Layout & Header', icon: FileText },
          { id: 'email', label: 'SMTP & Email Service', icon: Mail },
          { id: 'google', label: 'Google Account Connection', icon: ShieldCheck },
          { id: 'signatory', label: 'Currency & Signatory', icon: CreditCard },
          { id: 'database', label: 'Database Backup & Storage', icon: Database }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'text-white shadow-sm font-bold'
                  : isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-[#141416]'
                  : 'text-zinc-600 hover:text-black hover:bg-[#F4F4F6]'
              }`}
              style={isActive ? { backgroundColor: formData.themeColor || 'var(--brand-primary)' } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid: Main Form Controls & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col(s): Active Section Form */}
        <div
          className={
            activeSection === 'branding' || activeSection === 'info' || activeSection === 'payslip' || activeSection === 'signatory'
              ? 'lg:col-span-2 min-w-0 space-y-6'
              : 'lg:col-span-3 min-w-0 space-y-6'
          }
        >

          {/* SECTION B: BRAND & LOGO ASSETS */}
          {activeSection === 'branding' && (
            <div className={`border rounded-xl p-5 space-y-5 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Corporate Palette & Logo Assets</h3>
                <p className="text-zinc-500">Define your company's primary, secondary, and accent colors, plus logo assets.</p>
              </div>

              {/* Theme Mode Toggle */}
              <div>
                <label className="font-semibold block mb-2">Desktop Application Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center space-x-2.5 p-3 rounded-xl border-2 transition cursor-pointer ${
                      theme === 'light' ? 'border-brand-primary bg-brand-primary/10 text-black font-bold' : isDark ? 'border-zinc-800 bg-zinc-950 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Light Mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center space-x-2.5 p-3 rounded-xl border-2 transition cursor-pointer ${
                      theme === 'dark' ? 'border-brand-primary bg-brand-primary/20 text-white font-bold' : isDark ? 'border-zinc-800 bg-zinc-950 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-blue-400" />
                    <span>Dark Mode</span>
                  </button>
                </div>
              </div>

              {/* Complete Global Brand Color System */}
              <div className="pt-2">
                <BrandColorCustomizer
                  settings={formData}
                  isSaving={isSaving}
                  onSave={async (updatedColors) => {
                    const merged = { ...formData, ...updatedColors };
                    setFormData(merged);
                    setIsSaving(true);
                    try {
                      await onSaveSettings(merged);
                      showToast('Brand color customizations saved successfully.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                />
              </div>

              {/* Logo Management Section */}
              <div className="border-t pt-4 dark:border-zinc-800 border-zinc-200 space-y-4">
                <h4 className="font-bold">Official Company Logos</h4>

                {/* Primary Logo */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl border flex items-center justify-center p-1 bg-white overflow-hidden shadow-xs">
                      {formData.logoDataUrl ? (
                        <img src={formData.logoDataUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Building2 className="w-8 h-8 text-zinc-400" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-xs">Primary Company Logo</h5>
                      <p className="text-[11px] text-zinc-500">Used for Payslip PDF header, dashboard, and reports (PNG/JPG/SVG).</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {formData.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('logoDataUrl', undefined)}
                        className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className={`px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center space-x-1 cursor-pointer ${
                        isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{formData.logoDataUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                    </button>
                  </div>
                </div>

                {/* Optional Alternate Dark Logo */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl border flex items-center justify-center p-1 bg-zinc-900 border-zinc-800 overflow-hidden shadow-xs">
                      {formData.logoDarkDataUrl ? (
                        <img src={formData.logoDarkDataUrl} alt="Dark Logo Preview" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Building2 className="w-8 h-8 text-zinc-600" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-xs">Alternate Logo for Dark Backgrounds</h5>
                      <p className="text-[11px] text-zinc-500">Optional white or light emblem for dark UI theme and banners.</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {formData.logoDarkDataUrl && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('logoDarkDataUrl', undefined)}
                        className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => darkLogoInputRef.current?.click()}
                      className={`px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center space-x-1 cursor-pointer ${
                        isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{formData.logoDarkDataUrl ? 'Replace Dark Logo' : 'Upload Dark Logo'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION A: COMPANY INFORMATION */}
          {activeSection === 'info' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Corporate Information & Legal Address</h3>
                <p className="text-zinc-500">Official legal entity details displayed on payslips and company reports.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="font-semibold block mb-1">Company / Organization Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => handleFieldChange('companyName', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={formData.addressLine1}
                      onChange={(e) => handleFieldChange('addressLine1', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={formData.addressLine2}
                      onChange={(e) => handleFieldChange('addressLine2', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">City, State, Zip / Postal Code</label>
                    <input
                      type="text"
                      value={formData.cityStateZip}
                      onChange={(e) => handleFieldChange('cityStateZip', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Tax / Registration ID (EIN / GSTIN / CIN)</label>
                    <input
                      type="text"
                      value={formData.taxRegistrationNumber}
                      onChange={(e) => handleFieldChange('taxRegistrationNumber', e.target.value)}
                      className={`w-full rounded px-3 py-2 font-mono border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Official Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Telephone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Website URL</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => handleFieldChange('website', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION C: PAYSLIP BRANDING */}
          {activeSection === 'payslip' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Payslip Header & Visibility Branding</h3>
                <p className="text-zinc-500">Configure how company branding elements are laid out on generated PDF payslips.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer dark:border-zinc-800 border-zinc-200">
                  <input
                    type="checkbox"
                    checked={formData.showLogoOnPayslip ?? true}
                    onChange={(e) => handleFieldChange('showLogoOnPayslip', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">Show Logo on Payslip Header</span>
                    <span className="text-[11px] text-zinc-500">Display primary logo in the top-left/center</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer dark:border-zinc-800 border-zinc-200">
                  <input
                    type="checkbox"
                    checked={formData.showCompanyNameOnPayslip ?? true}
                    onChange={(e) => handleFieldChange('showCompanyNameOnPayslip', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">Show Company Name</span>
                    <span className="text-[11px] text-zinc-500">Display full legal company title</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer dark:border-zinc-800 border-zinc-200">
                  <input
                    type="checkbox"
                    checked={formData.showAddressOnPayslip ?? true}
                    onChange={(e) => handleFieldChange('showAddressOnPayslip', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">Show Official Address</span>
                    <span className="text-[11px] text-zinc-500">Include street and city in header</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer dark:border-zinc-800 border-zinc-200">
                  <input
                    type="checkbox"
                    checked={formData.showContactOnPayslip ?? true}
                    onChange={(e) => handleFieldChange('showContactOnPayslip', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">Show Contact Details</span>
                    <span className="text-[11px] text-zinc-500">Email, phone, and website</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="font-semibold block mb-1.5">Header Layout Alignment</label>
                <div className="grid grid-cols-3 gap-3">
                  {['left', 'center', 'right'].map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => handleFieldChange('payslipHeaderAlignment', align)}
                      className={`p-2.5 rounded-lg border font-bold capitalize transition cursor-pointer ${
                        (formData.payslipHeaderAlignment || 'left') === align
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-black'
                          : isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      {align} Alignment
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Payslip Footer Disclaimer / Confidentiality Notice</label>
                <textarea
                  rows={2}
                  value={formData.payslipFooterInfo || formData.payslipNote}
                  onChange={(e) => {
                    handleFieldChange('payslipFooterInfo', e.target.value);
                    handleFieldChange('payslipNote', e.target.value);
                  }}
                  className={`w-full rounded p-2.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>
          )}

          {/* SECTION D: SECURE SMTP & EMAIL CONFIGURATION */}
          {activeSection === 'email' && (
            <div className="space-y-6">
              {/* Card 1: Server-Side Outgoing SMTP Server Configuration */}
              <div className={`border rounded-xl p-5 space-y-5 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
                <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                      <Server className="w-4 h-4 text-[#CB1417]" />
                      <span>Outgoing SMTP Server (Authorized Administrator Access)</span>
                    </h3>
                    <p className="text-zinc-500 text-[11px] mt-0.5">
                      Configure company SMTP mail server for payslip dispatch. Credentials live strictly in server env vars or sealed server runtime memory.
                    </p>
                  </div>
                  <span className="text-[11px] text-emerald-500 font-semibold flex items-center space-x-1 shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Sealed Server Memory</span>
                  </span>
                </div>

                {/* Status Banners */}
                {!isSmtpLoading && !smtpConfig.isConfigured && (
                  <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start space-x-3 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Email service not configured (Initial Deployment Mode)</span>
                      <span className="text-[11px] opacity-90 block mt-0.5">
                        SMTP credentials are completely optional during initial deployment. Email sending is currently disabled. Enter your company's SMTP host, port, credentials, and sender email below to activate email delivery.
                      </span>
                    </div>
                  </div>
                )}

                {!isSmtpLoading && smtpConfig.isConfigured && !smtpConfig.isVerified && (
                  <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-start space-x-3 text-xs text-blue-700 dark:text-blue-300">
                    <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">SMTP Configured — Pending Connection Verification</span>
                      <span className="text-[11px] opacity-90 block mt-0.5">
                        Server settings are saved, but connection has not been verified yet. Click <strong>Test & Verify Connection</strong> below to validate outgoing mail access.
                      </span>
                    </div>
                  </div>
                )}

                {!isSmtpLoading && smtpConfig.isConfigured && smtpConfig.isVerified && (
                  <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start space-x-3 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Email Service Verified & Active</span>
                      <span className="text-[11px] opacity-90 block mt-0.5">
                        Connected to <code>{smtpConfig.smtpHost}:{smtpConfig.smtpPort}</code> via sender <code>{smtpConfig.senderEmail}</code>. Payslip email delivery is operational.
                      </span>
                    </div>
                  </div>
                )}

                {/* Role Warning if not Administrator */}
                {!isAdmin && (
                  <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-xs flex items-center space-x-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Administrator privilege required: You have read-only access to SMTP configuration settings.</span>
                  </div>
                )}

                {/* Form Controls */}
                <div className="space-y-3.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-semibold block mb-1">SMTP Outgoing Host *</label>
                      <input
                        type="text"
                        disabled={!isAdmin || isSmtpSaving || isSmtpTesting}
                        placeholder="e.g. smtp.gmail.com, smtp.office365.com, smtp.sendgrid.net"
                        value={smtpConfig.smtpHost}
                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtpHost: e.target.value }))}
                        className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'} disabled:opacity-60`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Port *</label>
                      <input
                        type="number"
                        disabled={!isAdmin || isSmtpSaving || isSmtpTesting}
                        placeholder="587"
                        value={smtpConfig.smtpPort}
                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtpPort: Number(e.target.value) || 587 }))}
                        className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'} disabled:opacity-60`}
                      />
                      <span className="text-[10px] text-zinc-500 block mt-1">
                        {smtpConfig.smtpPort === 465 ? 'SSL Security' : 'STARTTLS (Default)'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">SMTP Username / Account Email</label>
                      <input
                        type="text"
                        disabled={!isAdmin || isSmtpSaving || isSmtpTesting}
                        placeholder="e.g. payroll@company.com or apikey"
                        value={smtpConfig.smtpUser}
                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtpUser: e.target.value }))}
                        className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'} disabled:opacity-60`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1 flex items-center justify-between">
                        <span>SMTP Password / App Token</span>
                        {smtpConfig.hasPassword && (
                          <span className="text-[10px] text-emerald-500 font-normal">Password stored on server</span>
                        )}
                      </label>
                      <input
                        type="password"
                        disabled={!isAdmin || isSmtpSaving || isSmtpTesting}
                        placeholder={smtpConfig.hasPassword ? '•••••••••••• (Leave blank to keep existing password)' : 'Enter SMTP password or API token'}
                        value={smtpConfig.smtpPass}
                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtpPass: e.target.value }))}
                        className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'} disabled:opacity-60`}
                      />
                      <span className="text-[10px] text-zinc-500 block mt-1">
                        Never exposed in browser storage or API GET responses.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">Sender Email Address *</label>
                      <input
                        type="email"
                        disabled={!isAdmin || isSmtpSaving || isSmtpTesting}
                        placeholder="e.g. payroll@company.com"
                        value={smtpConfig.senderEmail}
                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, senderEmail: e.target.value }))}
                        className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'} disabled:opacity-60`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Sender Display Name</label>
                      <input
                        type="text"
                        disabled={!isAdmin || isSmtpSaving || isSmtpTesting}
                        placeholder="e.g. Apex Enterprise HR & Payroll"
                        value={smtpConfig.senderName}
                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, senderName: e.target.value }))}
                        className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'} disabled:opacity-60`}
                      />
                    </div>
                  </div>
                </div>

                {/* Feedback Notification */}
                {smtpFeedback && (
                  <div className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
                    smtpFeedback.success
                      ? isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                      : isDark ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                  }`}>
                    {smtpFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-[#ED1F24] shrink-0" />}
                    <span>{smtpFeedback.message}</span>
                  </div>
                )}

                {/* Action Buttons & Send Test Email */}
                {isAdmin && (
                  <div className="pt-3 border-t dark:border-zinc-800 border-zinc-200 space-y-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleTestSmtpConnection}
                        disabled={isSmtpTesting || isSmtpSaving || !smtpConfig.smtpHost}
                        className={`px-3.5 py-2 rounded-lg font-semibold text-xs border transition cursor-pointer flex items-center space-x-1.5 w-full sm:w-auto justify-center disabled:opacity-50 ${
                          isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                        }`}
                      >
                        {isSmtpTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CB1417]" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        <span>{isSmtpTesting ? 'Testing Connection...' : 'Test & Verify Connection'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSmtpSettings}
                        disabled={isSmtpSaving || isSmtpTesting}
                        className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-md disabled:opacity-50 w-full sm:w-auto justify-center"
                      >
                        {isSmtpSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>{isSmtpSaving ? 'Saving to Server...' : 'Save SMTP Server Settings'}</span>
                      </button>
                    </div>

                    <div className={`p-3 rounded-lg border flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                      <input
                        type="email"
                        value={testEmailRecipient}
                        onChange={(e) => setTestEmailRecipient(e.target.value)}
                        placeholder="Recipient email for SMTP Test Email (e.g. hr@company.com)"
                        className={`flex-1 rounded px-3 py-1.5 border text-xs ${isDark ? 'bg-[#0D0D0E] border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                      />
                      <button
                        type="button"
                        onClick={handleSendSmtpTestEmail}
                        disabled={isSendingTestEmail || !smtpConfig.smtpHost || !smtpConfig.senderEmail || !testEmailRecipient.trim()}
                        className={`px-3.5 py-1.5 rounded-lg font-semibold text-xs border transition cursor-pointer flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-45 ${
                          isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                        }`}
                      >
                        {isSendingTestEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CB1417]" /> : <Mail className="w-3.5 h-3.5 text-[#CB1417]" />}
                        <span>{isSendingTestEmail ? 'Sending Test...' : 'Send Test Email'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Email Delivery Branding & Signatures */}
              <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
                <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Payslip Email Template Branding</h3>
                  <p className="text-zinc-500">Sender display name, authorized team signatures, and legal copyright notices.</p>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Email Sender Display Name</label>
                  <input
                    type="text"
                    value={formData.emailDisplayName || `${formData.companyName} Payroll`}
                    onChange={(e) => handleFieldChange('emailDisplayName', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Email Custom Signature</label>
                  <textarea
                    rows={3}
                    value={formData.emailSignature || 'Human Resources & Payroll Operations Team'}
                    onChange={(e) => handleFieldChange('emailSignature', e.target.value)}
                    className={`w-full rounded p-2.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Email Footer Copyright Text</label>
                  <input
                    type="text"
                    value={formData.emailFooterText || `© ${formData.companyName}. All rights reserved.`}
                    onChange={(e) => handleFieldChange('emailFooterText', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION GOOGLE ACCOUNT CONNECTION */}
          {activeSection === 'google' && (
            <GoogleWorkspaceSetupTab
              isDark={isDark}
              googleStatus={googleStatus}
              isGoogleLoading={isGoogleLoading}
              isGoogleConnecting={isGoogleConnecting}
              isGoogleTesting={isGoogleTesting}
              googleFeedback={googleFeedback}
              onRefreshStatus={loadGoogleStatus}
              onConnectGoogle={handleConnectGoogle}
              onReconnectGoogle={handleReconnectGoogle}
              onTestGoogleApi={handleTestGoogleApi}
              onRequestDisconnect={() => setShowDisconnectGoogleModal(true)}
              driveStatus={driveStatus}
              isDriveSettingUp={isDriveSettingUp}
              isDriveBackingUp={isDriveBackingUp}
              isDriveLinkingUrl={isDriveLinkingUrl}
              driveFeedback={driveFeedback}
              onSetupDriveHierarchy={handleSetupDriveHierarchy}
              onConnectDriveFolderUrl={handleConnectDriveFolderUrl}
              onBackupToDrive={handleBackupToDrive}
              sheetsStatus={sheetsStatus}
              isSheetsSettingUp={isSheetsSettingUp}
              isVerifyingSpreadsheetUrl={isVerifyingSpreadsheetUrl}
              isApprovingWorksheets={isApprovingWorksheets}
              spreadsheetVerification={spreadsheetVerification}
              isPreviewingMigration={isPreviewingMigration}
              isMigrating={isMigrating}
              migrationPreview={migrationPreview}
              sheetsFeedback={sheetsFeedback}
              onSetupMasterSpreadsheet={handleSetupMasterSpreadsheet}
              onVerifySpreadsheetUrl={handleVerifySpreadsheetUrl}
              onConnectSpreadsheetUrl={handleConnectSpreadsheetUrl}
              onApproveMissingWorksheets={handleApproveMissingWorksheets}
              onPreviewDataMigration={handlePreviewDataMigration}
              onRunDataMigration={handleRunDataMigration}
            />
          )}

          {/* SECTION E: CURRENCY & SIGNATORY */}
          {activeSection === 'signatory' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Currency Configuration & Authorized Signatory</h3>
                <p className="text-zinc-500">Select currency formats and upload authorized digital signature graphics.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-1">Currency Symbol</label>
                  <select
                    value={formData.currencySymbol}
                    onChange={(e) => {
                      const sym = e.target.value;
                      let name = 'USD';
                      if (sym === '₹') name = 'INR';
                      else if (sym === '€') name = 'EUR';
                      else if (sym === '£') name = 'GBP';
                      else if (sym === 'AED') name = 'AED';
                      else if (sym === 'CAD$') name = 'CAD';
                      else if (sym === 'A$') name = 'AUD';
                      setFormData(prev => ({ ...prev, currencySymbol: sym, currencyName: name }));
                    }}
                    className={`w-full rounded px-3 py-2 font-mono border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  >
                    <option value="$">USD ($) - US Dollars</option>
                    <option value="₹">INR (₹) - Indian Rupees</option>
                    <option value="€">EUR (€) - Euros</option>
                    <option value="£">GBP (£) - British Pounds</option>
                    <option value="CAD$">CAD ($) - Canadian Dollars</option>
                    <option value="A$">AUD ($) - Australian Dollars</option>
                    <option value="AED">AED (AED) - UAE Dirhams</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Currency Name (Used for In Words)</label>
                  <input
                    type="text"
                    value={formData.currencyName}
                    onChange={(e) => handleFieldChange('currencyName', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div className="sm:col-span-2 flex items-center space-x-2.5">
                  <input
                    type="checkbox"
                    id="showCurrencySymbolSetting"
                    checked={formData.showCurrencySymbol ?? true}
                    onChange={(e) => handleFieldChange('showCurrencySymbol', e.target.checked)}
                    className="w-4 h-4 rounded text-[#CB1417] focus:ring-[#CB1417] cursor-pointer"
                  />
                  <label htmlFor="showCurrencySymbolSetting" className="font-semibold cursor-pointer">
                    Show currency symbol on payslips (e.g. ₹ 25,000.00 vs 25,000.00)
                  </label>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Authorized Signatory Name</label>
                  <input
                    type="text"
                    value={formData.authorizedSignatoryName}
                    onChange={(e) => handleFieldChange('authorizedSignatoryName', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Signatory Title / Designation</label>
                  <input
                    type="text"
                    value={formData.authorizedSignatoryTitle}
                    onChange={(e) => handleFieldChange('authorizedSignatoryTitle', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              {/* Signature Graphic Card */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="flex items-center space-x-4">
                  <div className="w-24 h-12 rounded border flex items-center justify-center p-1 bg-white overflow-hidden shadow-xs">
                    {formData.signatureDataUrl ? (
                      <img src={formData.signatureDataUrl} alt="Signature Preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-zinc-400">No Signature</span>
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs">Official Digital Signature Graphic</h5>
                    <p className="text-[11px] text-zinc-500">Transparent PNG recommended. Rendered on payslip footer.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {formData.signatureDataUrl && (
                    <button
                      type="button"
                      onClick={() => handleFieldChange('signatureDataUrl', undefined)}
                      className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => sigInputRef.current?.click()}
                    className={`px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center space-x-1 cursor-pointer ${
                      isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Upload Signature</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION F: DATABASE & BACKUP */}
          {activeSection === 'database' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Local Database & Disaster Recovery</h3>
                <p className="text-zinc-500">Export or restore full database JSON archives.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <Download className="w-6 h-6 text-[#CB1417]" />
                  <h4 className="font-bold text-xs">Export Complete Backup</h4>
                  <p className="text-[11px] text-zinc-500">Exports all employee master records, documents, payroll batch, and company settings.</p>
                  <button
                    onClick={handleExportBackup}
                    className="w-full py-2 bg-[#CB1417] text-white rounded font-bold cursor-pointer hover:bg-[#ED1F24]"
                  >
                    Download Backup JSON
                  </button>
                </div>

                <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <Upload className="w-6 h-6 text-emerald-500" />
                  <h4 className="font-bold text-xs">Restore from Backup Archive</h4>
                  <p className="text-[11px] text-zinc-500">Imports previous backup JSON file into current workspace.</p>
                  <button
                    onClick={() => backupInputRef.current?.click()}
                    className={`w-full py-2 rounded font-bold border cursor-pointer ${
                      isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                    }`}
                  >
                    Select Backup File
                  </button>
                </div>

                <div className={`p-4 rounded-xl border space-y-3 sm:col-span-2 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="w-5 h-5 text-[#CB1417]" />
                      <h4 className="font-bold text-xs">Cloud Backup Snapshot to Google Drive</h4>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${googleStatus.isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {googleStatus.isConnected ? 'Google Drive Connected' : 'Connect Google First'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Saves a complete encrypted-transport JSON snapshot of your Employee Database Studio workspace directly inside your connected Google Drive workspace folder.
                  </p>
                  {driveFeedback && (
                    <div className={`p-2.5 rounded-lg border text-xs ${
                      driveFeedback.success ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-red-500/30 bg-red-500/10 text-red-500'
                    }`}>
                      {driveFeedback.message}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!googleStatus.isConnected || isDriveBackingUp}
                    onClick={handleBackupToDrive}
                    className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded font-bold cursor-pointer disabled:opacity-50 inline-flex items-center space-x-2"
                  >
                    {isDriveBackingUp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save JSON Backup Snapshot to Google Drive</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Live Real-Time Brand Preview (on Branding/Identity/Payslip/Signatory tabs) */}
        {(activeSection === 'branding' || activeSection === 'info' || activeSection === 'payslip' || activeSection === 'signatory') && (
        <div className="min-w-0 space-y-6">
          <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex items-center justify-between border-b pb-2 dark:border-zinc-800 border-zinc-200">
              <h4 className="font-bold flex items-center space-x-1.5">
                <Eye className="w-4 h-4 text-[#CB1417]" />
                <span>Live Brand Card Preview</span>
              </h4>
              <span className="text-[10px] font-mono text-emerald-500 font-bold">Real-Time</span>
            </div>

            {/* Mini Brand Banner */}
            <div
              className="p-4 rounded-xl text-white shadow-md transition-colors"
              style={{ backgroundColor: formData.themeColor || '#CB1417' }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                  {formData.logoDataUrl ? (
                    <img src={formData.logoDataUrl} alt="Preview Logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="font-bold text-black text-xs">{formData.companyName.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="truncate">
                  <h5 className="font-bold text-sm truncate">{formData.companyName || 'Your Company Name'}</h5>
                  <p className="text-[11px] opacity-90 truncate">{formData.cityStateZip || 'City, State, Zip'}</p>
                </div>
              </div>
            </div>

            {/* Mini Payslip Header Preview */}
            <div className="p-3 rounded-lg border border-zinc-300 bg-white text-black font-sans text-[11px] space-y-2">
              <div className={`flex items-center justify-between border-b pb-2 ${formData.payslipHeaderAlignment === 'center' ? 'flex-col text-center' : formData.payslipHeaderAlignment === 'right' ? 'flex-col items-end text-right' : ''}`}>
                <div className="flex items-center space-x-2">
                  {(formData.showLogoOnPayslip ?? true) && (
                    <div className="w-7 h-7 rounded border bg-zinc-100 flex items-center justify-center overflow-hidden">
                      {formData.logoDataUrl ? (
                        <img src={formData.logoDataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="font-bold text-[10px] text-zinc-500">{formData.companyName.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                  )}
                  <div>
                    {(formData.showCompanyNameOnPayslip ?? true) && (
                      <h6 className="font-bold text-xs">{formData.companyName}</h6>
                    )}
                    {(formData.showAddressOnPayslip ?? true) && (
                      <p className="text-[9px] text-zinc-500">{formData.cityStateZip}</p>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="py-1 px-2 rounded text-white font-bold text-[9px] text-center"
                style={{ backgroundColor: formData.themeColor || '#CB1417' }}
              >
                PAYSLIP HEADER BRAND COLOR
              </div>

              <div className="text-[10px] text-zinc-600 space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Currency Display:</span>
                  <span className="font-bold font-mono">
                    {formData.showCurrencySymbol ? `${formData.currencySymbol} 50,000.00` : '50,000.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Signatory:</span>
                  <span className="font-semibold">{formData.authorizedSignatoryName || 'HR Director'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Confirmation Modal for Resetting Defaults */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center space-x-3 text-red-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">Reset Company Settings?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Are you sure you want to reset all company information, branding palette, and payslip settings to default configuration?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetDefaults}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Disconnecting Google Workspace */}
      {showDisconnectGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center space-x-3 text-red-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">Disconnect Google Workspace?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Are you sure you want to disconnect the HR Google account ({googleStatus.accountEmail || 'connected account'}) and revoke the in-memory OAuth access token? Temporary local drafts and remote Google Sheets/Drive files are preserved.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <button
                type="button"
                onClick={() => setShowDisconnectGoogleModal(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDisconnectGoogle}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Disconnect Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Restoring Backup Archive */}
      {pendingRestoreFile && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center space-x-3 text-[#CB1417]">
              <Database className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">Restore Workspace Backup?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Restore all company settings, employee records, and payroll history from <strong className={isDark ? 'text-white' : 'text-black'}>{pendingRestoreFile.name}</strong>?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <button
                type="button"
                onClick={() => setPendingRestoreFile(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeImportBackup}
                className="px-3 py-1.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
