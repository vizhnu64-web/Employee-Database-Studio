import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Server,
  Key,
  ShieldCheck,
  RefreshCw,
  Users,
  FileText,
  Settings,
  ExternalLink,
  Lock,
  History
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, EmailSettings, PayslipLayoutSettings, ServerSmtpStatus } from '../types/payroll';
import { useTheme } from '../context/ThemeContext';
import { generatePayslipPdf, getSafeFileName } from '../utils/pdfGenerator';
import { apiClient } from '../utils/apiClient';
import { requestGmailConsent, subscribeGoogleSession } from '../utils/googleAuthClient';

interface EmailDeliveryViewProps {
  emailSettings: EmailSettings;
  onSaveEmailSettings: (settings: EmailSettings) => void;
  employees: EmployeeRecord[];
  settings: CompanySettings;
  layoutSettings: PayslipLayoutSettings;
  selectedMonth: string;
  selectedYear: number;
  onNavigateToSettings?: () => void;
}

interface SendStatus {
  employeeId: string;
  name: string;
  email: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
  timestamp?: string;
}

interface EmailLogEntry {
  id: string;
  payslipId?: string;
  employeeId?: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  provider: string;
  deliveryStatus: string;
  errorMessage?: string | null;
  retryCount: number;
  messageId?: string | null;
  sentAt: string;
}

export const EmailDeliveryView: React.FC<EmailDeliveryViewProps> = ({
  emailSettings,
  onSaveEmailSettings,
  employees,
  settings,
  layoutSettings,
  selectedMonth,
  selectedYear,
  onNavigateToSettings
}) => {
  const { isDark } = useTheme();
  const [formData, setFormData] = useState<EmailSettings>({ ...emailSettings });
  const [smtpStatus, setSmtpStatus] = useState<ServerSmtpStatus | null>(null);
  const [providerStatus, setProviderStatus] = useState<{
    smtpConfigured: boolean;
    smtpVerified: boolean;
    smtpSenderEmail: string | null;
    googleConnected: boolean;
    gmailConnected: boolean;
    gmailScopeMissing: boolean;
    gmailEmail: string | null;
  }>({
    smtpConfigured: false,
    smtpVerified: false,
    smtpSenderEmail: null,
    googleConnected: false,
    gmailConnected: false,
    gmailScopeMissing: false,
    gmailEmail: null,
  });
  const [selectedProvider, setSelectedProvider] = useState<'smtp' | 'gmail'>('smtp');
  const [isAuthorizingGmail, setIsAuthorizingGmail] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<SendStatus[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);

  const loadDeliveryStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const [settingsRes, statusRes, logsRes] = await Promise.all([
        apiClient.request('/email/settings').catch(() => null),
        apiClient.request('/email/status').catch(() => null),
        apiClient.request('/email/logs').catch(() => null),
      ]);

      if (settingsRes?.success && settingsRes.settings) {
        setSmtpStatus({
          isConfigured: settingsRes.isConfigured,
          isVerified: settingsRes.isVerified,
          ...settingsRes.settings,
        });
      } else {
        setSmtpStatus({ isConfigured: false, isVerified: false });
      }

      if (statusRes?.success) {
        const nextProv = {
          smtpConfigured: Boolean(statusRes.smtpConfigured),
          smtpVerified: Boolean(statusRes.smtpVerified),
          smtpSenderEmail: statusRes.smtpSenderEmail || null,
          googleConnected: Boolean(statusRes.googleConnected),
          gmailConnected: Boolean(statusRes.gmailConnected),
          gmailScopeMissing: Boolean(statusRes.gmailScopeMissing),
          gmailEmail: statusRes.gmailEmail || null,
        };
        setProviderStatus(nextProv);
        if (!nextProv.smtpVerified && nextProv.gmailConnected) {
          setSelectedProvider('gmail');
        }
      }

      if (logsRes?.success && Array.isArray(logsRes.logs)) {
        setEmailLogs(logsRes.logs);
      }
    } catch (err: any) {
      console.warn('[EmailDeliveryView] Failed to load email status:', err.message);
      setSmtpStatus({ isConfigured: false, isVerified: false });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadDeliveryStatus();
    const unsub = subscribeGoogleSession(() => {
      loadDeliveryStatus();
    });
    return () => unsub();
  }, []);

  const handleFieldChange = (field: keyof EmailSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveTemplates = () => {
    onSaveEmailSettings(formData);
    setToastMessage('Email template settings saved successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleVerifySmtp = async () => {
    if (!smtpStatus?.isConfigured) {
      setVerifyMessage({
        success: false,
        text: 'Email service not configured. Configure valid SMTP settings in Company Settings first.',
      });
      return;
    }

    setIsVerifying(true);
    setVerifyMessage(null);

    try {
      const res = await apiClient.request('/email/verify', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.success) {
        setVerifyMessage({ success: true, text: res.message || 'SMTP server connection verified successfully.' });
        loadDeliveryStatus();
      } else {
        setVerifyMessage({ success: false, text: res.error || 'SMTP verification failed.' });
      }
    } catch (err: any) {
      setVerifyMessage({ success: false, text: err.message || 'SMTP verification error. Check server credentials.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAuthorizeGmailIncremental = async () => {
    setIsAuthorizingGmail(true);
    setVerifyMessage(null);
    try {
      await requestGmailConsent(apiClient.getServerUrl());
      setToastMessage('Gmail send permission authorized in active Google session.');
      await loadDeliveryStatus();
    } catch (err: any) {
      setVerifyMessage({ success: false, text: err.message || 'Failed to authorize Gmail permission.' });
    } finally {
      setIsAuthorizingGmail(false);
    }
  };

  const isSelectedProviderReady =
    selectedProvider === 'gmail'
      ? providerStatus.gmailConnected
      : Boolean(smtpStatus?.isConfigured && smtpStatus?.isVerified);

  const renderTemplate = (emp: EmployeeRecord) => {
    const subject = formData.emailSubjectTemplate
      .replace(/{{month}}/g, selectedMonth)
      .replace(/{{year}}/g, String(selectedYear))
      .replace(/{{employeeName}}/g, emp.name)
      .replace(/{{employeeId}}/g, emp.employeeId);

    const body = formData.emailBodyTemplate
      .replace(/{{month}}/g, selectedMonth)
      .replace(/{{year}}/g, String(selectedYear))
      .replace(/{{employeeName}}/g, emp.name)
      .replace(/{{employeeId}}/g, emp.employeeId)
      .replace(/{{companyName}}/g, settings.companyName);

    return { subject, body };
  };

  const alreadySentForPeriod = (empId: string) => {
    const expectedPayslipId = `${empId}_${selectedMonth}_${selectedYear}`.toLowerCase();
    return emailLogs.some(
      (l) =>
        l.deliveryStatus === 'Sent' &&
        (l.payslipId?.toLowerCase() === expectedPayslipId ||
          (l.employeeId === empId && l.subject.includes(selectedMonth) && l.subject.includes(String(selectedYear))))
    );
  };

  const handlePrepareBulkSend = () => {
    if (!isSelectedProviderReady) {
      setVerifyMessage({
        success: false,
        text:
          selectedProvider === 'gmail'
            ? 'HR Gmail API is not connected. Connect Google Workspace with Gmail scope in Company Settings or switch to verified Company SMTP.'
            : 'Company SMTP is not configured and verified. Configure SMTP in Company Settings or switch to HR Gmail API.',
      });
      return;
    }

    if (employees.length === 0) {
      setVerifyMessage({ success: false, text: 'No employee records available to send payslips.' });
      return;
    }

    const initialStatuses: SendStatus[] = employees.map((emp) => ({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email || '',
      status: 'pending',
    }));
    setStatuses(initialStatuses);
    setShowConfirmModal(true);
  };

  const handleExecuteBulkSend = async () => {
    if (!isSelectedProviderReady) {
      setShowConfirmModal(false);
      setVerifyMessage({
        success: false,
        text: 'Selected delivery provider is not ready. Configure it in Company Settings first.',
      });
      return;
    }

    setShowConfirmModal(false);
    setIsBulkSending(true);

    const updated = [...statuses];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      const emp = employees.find((e) => e.employeeId === item.employeeId);
      if (!emp || !emp.email) {
        updated[i] = { ...item, status: 'failed', error: 'Missing recipient email address.' };
        setStatuses([...updated]);
        continue;
      }

      if (skipAlreadySent && alreadySentForPeriod(emp.employeeId)) {
        updated[i] = { ...item, status: 'sent', timestamp: 'Already Sent (Skipped Duplicate)' };
        setStatuses([...updated]);
        continue;
      }

      updated[i] = { ...item, status: 'sending' };
      setStatuses([...updated]);

      try {
        const doc = generatePayslipPdf(emp, settings, selectedMonth, selectedYear, layoutSettings);
        const pdfBase64 = doc.output('datauristring');
        const fileName = getSafeFileName(emp, selectedMonth, selectedYear);
        const { subject, body } = renderTemplate(emp);
        const payslipId = `${emp.employeeId}_${selectedMonth}_${selectedYear}`.toLowerCase();

        const res = await apiClient.request('/email/send', {
          method: 'POST',
          body: JSON.stringify({
            provider: selectedProvider,
            payslipId,
            recipientEmail: emp.email,
            recipientName: emp.name,
            employeeId: emp.employeeId,
            subject,
            bodyText: body,
            attachmentName: fileName,
            pdfBase64,
          }),
        });

        if (res.success) {
          updated[i] = { ...item, status: 'sent', timestamp: new Date().toLocaleTimeString() };
        } else {
          updated[i] = { ...item, status: 'failed', error: res.error || 'Send failed' };
        }
      } catch (err: any) {
        updated[i] = { ...item, status: 'failed', error: err.message || 'Exception during send' };
      }

      setStatuses([...updated]);
    }

    setIsBulkSending(false);
    loadDeliveryStatus();
  };

  const handleRetryFailed = async () => {
    if (!isSelectedProviderReady) return;

    const failedIndices = statuses
      .map((s, idx) => (s.status === 'failed' ? idx : -1))
      .filter((idx) => idx !== -1);

    if (failedIndices.length === 0) return;

    setIsBulkSending(true);
    const updated = [...statuses];

    for (const i of failedIndices) {
      const item = updated[i];
      const emp = employees.find((e) => e.employeeId === item.employeeId);
      if (!emp || !emp.email) continue;

      updated[i] = { ...item, status: 'sending', error: undefined };
      setStatuses([...updated]);

      try {
        const doc = generatePayslipPdf(emp, settings, selectedMonth, selectedYear, layoutSettings);
        const pdfBase64 = doc.output('datauristring');
        const fileName = getSafeFileName(emp, selectedMonth, selectedYear);
        const { subject, body } = renderTemplate(emp);
        const payslipId = `${emp.employeeId}_${selectedMonth}_${selectedYear}`.toLowerCase();

        const res = await apiClient.request('/email/send', {
          method: 'POST',
          body: JSON.stringify({
            provider: selectedProvider,
            payslipId,
            recipientEmail: emp.email,
            recipientName: emp.name,
            employeeId: emp.employeeId,
            subject,
            bodyText: body,
            attachmentName: fileName,
            pdfBase64,
            retryCount: 1,
          }),
        });

        if (res.success) {
          updated[i] = { ...item, status: 'sent', timestamp: new Date().toLocaleTimeString() };
        } else {
          updated[i] = { ...item, status: 'failed', error: res.error || 'Retry failed' };
        }
      } catch (err: any) {
        updated[i] = { ...item, status: 'failed', error: err.message };
      }
      setStatuses([...updated]);
    }

    setIsBulkSending(false);
    loadDeliveryStatus();
  };

  const handleRetryLogEntry = async (log: EmailLogEntry) => {
    const emp = employees.find((e) => e.employeeId === log.employeeId);
    if (!emp) {
      setVerifyMessage({
        success: false,
        text: `Employee ${log.employeeId} is not in the current payroll batch. Re-load batch to re-attach PDF.`,
      });
      return;
    }

    try {
      const doc = generatePayslipPdf(emp, settings, selectedMonth, selectedYear, layoutSettings);
      const pdfBase64 = doc.output('datauristring');
      const fileName = getSafeFileName(emp, selectedMonth, selectedYear);
      const { subject, body } = renderTemplate(emp);

      const res = await apiClient.request('/email/send', {
        method: 'POST',
        body: JSON.stringify({
          provider: selectedProvider,
          payslipId: log.payslipId || `${emp.employeeId}_${selectedMonth}_${selectedYear}`.toLowerCase(),
          recipientEmail: log.recipientEmail,
          recipientName: log.recipientName || emp.name,
          employeeId: emp.employeeId,
          subject,
          bodyText: body,
          attachmentName: fileName,
          pdfBase64,
          retryCount: (log.retryCount || 0) + 1,
        }),
      });

      if (res.success) {
        setToastMessage(`Retried email to ${log.recipientEmail} successfully.`);
        loadDeliveryStatus();
      } else {
        setVerifyMessage({ success: false, text: res.error || 'Retry failed.' });
      }
    } catch (err: any) {
      setVerifyMessage({ success: false, text: err.message || 'Retry error.' });
    }
  };

  const sentCount = statuses.filter((s) => s.status === 'sent').length;
  const failedCount = statuses.filter((s) => s.status === 'failed').length;
  const missingEmailCount = employees.filter((e) => !e.email).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`border rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider mb-1">
            <Mail className="w-4 h-4 text-[#CB1417]" />
            <span>Dual-Channel Individual Payslip Dispatch</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Email Delivery (SMTP & HR Gmail API)
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Send individual personalized payslips with single-recipient privacy and persistent audit logs for {selectedMonth} {selectedYear}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSaveTemplates}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isDark
                ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]'
                : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-[#CB1417]" />
            <span>Save Templates</span>
          </button>
          <button
            type="button"
            onClick={handlePrepareBulkSend}
            disabled={!isSelectedProviderReady || employees.length === 0 || isBulkSending}
            title={!isSelectedProviderReady ? 'Selected email delivery channel requires setup.' : 'Send individual payslips'}
            className="flex items-center space-x-2 px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send Payslips ({employees.length})</span>
          </button>
        </div>
      </div>

      {/* Provider Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setSelectedProvider('smtp')}
          className={`text-left p-4 rounded-xl border transition cursor-pointer ${
            selectedProvider === 'smtp'
              ? 'border-[#CB1417] bg-[#CB1417]/5'
              : isDark
                ? 'bg-[#0D0D0E] border-[#222222] hover:border-[#3A3A40]'
                : 'bg-white border-[#E4E4E7] hover:border-zinc-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Server className="w-4 h-4 text-[#CB1417]" />
              <span>Channel 1: Company SMTP Server</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                smtpStatus?.isConfigured && smtpStatus?.isVerified
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              }`}
            >
              {smtpStatus?.isConfigured && smtpStatus?.isVerified ? 'Verified Ready' : smtpStatus?.isConfigured ? 'Needs Verification' : 'Not Configured'}
            </span>
          </div>
          <p className={`text-[11px] mt-1.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            {smtpStatus?.smtpHost ? `${smtpStatus.smtpHost}:${smtpStatus.smtpPort} (${smtpStatus.senderEmail})` : 'Send via company SMTP credentials (independent of Google).'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedProvider('gmail')}
          className={`text-left p-4 rounded-xl border transition cursor-pointer ${
            selectedProvider === 'gmail'
              ? 'border-[#CB1417] bg-[#CB1417]/5'
              : isDark
                ? 'bg-[#0D0D0E] border-[#222222] hover:border-[#3A3A40]'
                : 'bg-white border-[#E4E4E7] hover:border-zinc-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Mail className="w-4 h-4 text-[#CB1417]" />
              <span>Channel 2: HR Gmail API (OAuth)</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                providerStatus.gmailConnected
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
              }`}
            >
              {providerStatus.gmailConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <p className={`text-[11px] mt-1.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            {providerStatus.gmailConnected
              ? `Sending via authorized Google account: ${providerStatus.gmailEmail || 'Connected HR Mailbox'}`
              : 'Connect your HR Google account with Gmail send permission in Company Settings.'}
          </p>
        </button>
      </div>

      {/* Warning banner if active provider needs configuration */}
      {!isLoadingStatus && !isSelectedProviderReady && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-xs text-amber-600 dark:text-amber-400 block">
                {selectedProvider === 'gmail'
                  ? providerStatus.gmailScopeMissing
                    ? 'Gmail Send Permission Not Yet Granted'
                    : 'HR Gmail API Not Connected'
                  : 'Company SMTP Not Ready'}
              </span>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                {selectedProvider === 'gmail'
                  ? providerStatus.gmailScopeMissing
                    ? `Google account (${providerStatus.gmailEmail}) is connected for Sheets & Drive, but gmail.send incremental permission is not granted yet.`
                    : 'Connect your Google account in Company Settings -> Google Account Connection, or switch to Company SMTP.'
                  : smtpStatus?.isConfigured
                    ? 'Company SMTP settings are saved but pending verification. Click "Test SMTP Connection" below.'
                    : 'Configure and verify SMTP settings in Company Settings, or switch to HR Gmail API.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedProvider === 'gmail' && providerStatus.gmailScopeMissing && (
              <button
                type="button"
                disabled={isAuthorizingGmail}
                onClick={handleAuthorizeGmailIncremental}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isAuthorizingGmail ? 'Authorizing...' : 'Authorize Gmail Permission'}</span>
              </button>
            )}
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Open Company Settings</span>
              </button>
            )}
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
            isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Configuration & Template Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: SMTP Overview + Verification */}
        <div
          className={`border rounded-xl p-6 space-y-4 text-xs transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="flex items-center justify-between border-b dark:border-[#222222] border-[#E4E4E7] pb-3">
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Server className="w-4 h-4 text-[#CB1417]" />
              <span>Provider Diagnostics</span>
            </h3>
            <span className="text-[11px] text-emerald-500 font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TLS &amp; Sealed Server Runtime</span>
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className="text-zinc-500">Selected Channel:</span>
              <span className="font-bold text-[#CB1417]">
                {selectedProvider === 'gmail' ? 'HR Gmail API' : 'Company SMTP'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className="text-zinc-500">SMTP Host:</span>
              <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                {smtpStatus?.smtpHost ? `${smtpStatus.smtpHost}:${smtpStatus.smtpPort}` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className="text-zinc-500">SMTP Sender:</span>
              <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                {smtpStatus?.senderEmail || '—'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className="text-zinc-500">HR Gmail Account:</span>
              <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                {providerStatus.gmailEmail || 'Not Connected'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500 flex items-center space-x-1">
                <Lock className="w-3 h-3" />
                <span>SMTP Secret:</span>
              </span>
              <span className="font-mono text-zinc-400">
                {smtpStatus?.hasPassword ? '•••••••••••• (Server Memory)' : 'Not Set'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleVerifySmtp}
              disabled={isVerifying || !smtpStatus?.isConfigured}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center space-x-1.5 w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-[#141416] hover:bg-[#222226] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CB1417]" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              <span>Test SMTP Connection</span>
            </button>

            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="text-xs text-[#CB1417] hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
              >
                <span>Configure in Company Settings</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {verifyMessage && (
            <div
              className={`p-3 rounded-lg text-xs border flex items-center space-x-2 ${
                verifyMessage.success
                  ? isDark
                    ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]'
                    : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                  : isDark
                    ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]'
                    : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              }`}
            >
              {verifyMessage.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-[#ED1F24] shrink-0" />}
              <span>{verifyMessage.text}</span>
            </div>
          )}
        </div>

        {/* Right: Subject & Body Template */}
        <div
          className={`border rounded-xl p-6 space-y-4 text-xs transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="border-b dark:border-[#222222] border-[#E4E4E7] pb-3 flex items-center justify-between">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              Email Template & Duplicate Protection
            </h3>
            <label className="inline-flex items-center space-x-1.5 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                checked={skipAlreadySent}
                onChange={(e) => setSkipAlreadySent(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
              />
              <span>Skip already sent</span>
            </label>
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Email Subject</label>
            <input
              type="text"
              value={formData.emailSubjectTemplate}
              onChange={(e) => handleFieldChange('emailSubjectTemplate', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition ${
                isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
              }`}
            />
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Email Body Template</label>
            <textarea
              rows={8}
              value={formData.emailBodyTemplate}
              onChange={(e) => handleFieldChange('emailBodyTemplate', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition resize-none ${
                isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
              }`}
            />
          </div>

          <div className={`p-3 rounded-lg border text-[11px] ${isDark ? 'bg-[#141416] border-[#222226] text-[#A1A1AA]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-[#52525B]'}`}>
            <span className="font-semibold block mb-1">Placeholders:</span>
            <code>{`{{employeeName}}, {{employeeId}}, {{month}}, {{year}}, {{companyName}}`}</code>
          </div>
        </div>
      </div>

      {/* Active Batch Dispatch Status Table */}
      {statuses.length > 0 && (
        <div
          className={`border rounded-xl p-6 space-y-4 transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b dark:border-[#222222] border-[#E4E4E7] gap-3">
            <div>
              <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                <FileText className="w-4 h-4 text-[#CB1417]" />
                <span>Current Batch Dispatch Progress</span>
              </h3>
              <p className={`text-xs mt-0.5 tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                Sent: {sentCount} | Failed: {failedCount} | Total: {statuses.length}
              </p>
            </div>

            {failedCount > 0 && (
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={isBulkSending}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#CB1417] text-white hover:bg-[#ED1F24] transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Failed ({failedCount})</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-72 overflow-y-auto border dark:border-[#222222] border-[#E4E4E7] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className={`sticky top-0 ${isDark ? 'bg-[#141416] text-[#A1A1AA]' : 'bg-[#F4F4F6] text-[#71717A]'}`}>
                <tr>
                  <th className="p-3 font-semibold">Employee ID</th>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Recipient Email</th>
                  <th className="p-3 font-semibold">Delivery Status</th>
                  <th className="p-3 font-semibold">Result / Error</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#222222]' : 'divide-[#E4E4E7]'}`}>
                {statuses.map((item) => (
                  <tr key={item.employeeId} className={isDark ? 'hover:bg-[#121215]' : 'hover:bg-[#FAFAFC]'}>
                    <td className={`p-3 font-mono ${isDark ? 'text-white' : 'text-black'}`}>{item.employeeId}</td>
                    <td className={`p-3 font-medium ${isDark ? 'text-white' : 'text-black'}`}>{item.name}</td>
                    <td className={`p-3 ${item.email ? (isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]') : 'text-amber-500 font-semibold'}`}>
                      {item.email || 'Missing Email'}
                    </td>
                    <td className="p-3">
                      {item.status === 'sent' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Sent
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ED1F24]/10 text-[#ED1F24] border border-[#ED1F24]/20">
                          Failed
                        </span>
                      )}
                      {item.status === 'sending' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 inline-flex items-center space-x-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Sending</span>
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className={`p-3 font-mono text-[11px] ${item.error ? 'text-red-500' : isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                      {item.timestamp || item.error || 'Queued'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Persistent Email Delivery Logs History */}
      <div
        className={`border rounded-xl p-6 space-y-4 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b dark:border-[#222222] border-[#E4E4E7]">
          <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
            <History className="w-4 h-4 text-[#CB1417]" />
            <span>Email Delivery Audit Logs ({emailLogs.length})</span>
          </h3>
          <button
            type="button"
            onClick={loadDeliveryStatus}
            className="text-xs font-semibold text-[#CB1417] hover:underline flex items-center space-x-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Logs</span>
          </button>
        </div>

        {emailLogs.length === 0 ? (
          <p className={`text-xs py-6 text-center ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
            No payslip emails dispatched yet. Sent and failed dispatches appear here automatically.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto border dark:border-[#222222] border-[#E4E4E7] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className={`sticky top-0 ${isDark ? 'bg-[#141416] text-[#A1A1AA]' : 'bg-[#F4F4F6] text-[#71717A]'}`}>
                <tr>
                  <th className="p-3 font-semibold">Timestamp</th>
                  <th className="p-3 font-semibold">Recipient</th>
                  <th className="p-3 font-semibold">Provider</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Details / Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#222222]' : 'divide-[#E4E4E7]'}`}>
                {emailLogs.map((log) => (
                  <tr key={log.id} className={isDark ? 'hover:bg-[#121215]' : 'hover:bg-[#FAFAFC]'}>
                    <td className="p-3 font-mono text-[11px] text-zinc-500">
                      {log.sentAt ? new Date(log.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-3">
                      <span className={`font-semibold block ${isDark ? 'text-white' : 'text-black'}`}>{log.recipientEmail}</span>
                      <span className="text-[11px] text-zinc-500">{log.employeeId || log.recipientName || ''}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px] uppercase">{log.provider}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          log.deliveryStatus === 'Sent'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-[#ED1F24]/10 text-[#ED1F24] border-[#ED1F24]/20'
                        }`}
                      >
                        {log.deliveryStatus}
                      </span>
                    </td>
                    <td className="p-3">
                      {log.deliveryStatus === 'Failed' ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-red-500 truncate max-w-xs" title={log.errorMessage || ''}>
                            {log.errorMessage || 'Delivery failed'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRetryLogEntry(log)}
                            className="px-2 py-1 rounded bg-[#CB1417] hover:bg-[#ED1F24] text-white text-[10px] font-bold cursor-pointer shrink-0"
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-500 font-mono truncate block max-w-xs">
                          {log.subject}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full border rounded-2xl p-6 space-y-4 shadow-2xl ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Users className="w-5 h-5 text-[#CB1417]" />
              <span>Confirm Individual Email Dispatch</span>
            </h3>

            <div className={`text-xs space-y-2 ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
              <p>
                Channel: <strong>{selectedProvider === 'gmail' ? 'HR Gmail API' : 'Company SMTP'}</strong>
              </p>
              <p>
                You are about to dispatch up to <strong>{employees.length} separate individual emails</strong> for <strong>{selectedMonth} {selectedYear}</strong>.
              </p>
              {missingEmailCount > 0 && (
                <p className="text-amber-500 font-medium">
                  Note: {missingEmailCount} employee(s) without email addresses will be flagged and skipped.
                </p>
              )}
              <p>Each employee receives only their own payslip PDF attachment.</p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#27272A]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkSend}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#CB1417] text-white hover:bg-[#ED1F24] transition cursor-pointer"
              >
                Proceed & Send All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
