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
  Lock
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, EmailSettings, PayslipLayoutSettings, ServerSmtpStatus } from '../types/payroll';
import { useTheme } from '../context/ThemeContext';
import { generatePayslipPdf } from '../utils/pdfGenerator';
import { apiClient } from '../utils/apiClient';

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
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<SendStatus[]>([]);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch server-side SMTP configuration status on load
  const loadSmtpStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await apiClient.request('/email/settings');
      if (res.success && res.settings) {
        setSmtpStatus({
          isConfigured: res.isConfigured,
          isVerified: res.isVerified,
          ...res.settings
        });
      } else {
        setSmtpStatus({ isConfigured: false, isVerified: false });
      }
    } catch (err: any) {
      console.warn('[EmailDeliveryView] Failed to load server SMTP settings:', err.message);
      setSmtpStatus({ isConfigured: false, isVerified: false });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadSmtpStatus();
  }, []);

  const handleFieldChange = (field: keyof EmailSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        text: 'Email service not configured. Please configure valid SMTP settings in Company Settings first.'
      });
      return;
    }

    setIsVerifying(true);
    setVerifyMessage(null);

    try {
      const res = await apiClient.request('/email/verify', {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (res.success) {
        setVerifyMessage({ success: true, text: res.message || 'SMTP server connection verified successfully.' });
        loadSmtpStatus();
      } else {
        setVerifyMessage({ success: false, text: res.error || 'SMTP verification failed.' });
      }
    } catch (err: any) {
      setVerifyMessage({ success: false, text: err.message || 'SMTP verification error. Check server credentials.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const isEmailSendingDisabled = !smtpStatus?.isConfigured || !smtpStatus?.isVerified;

  const handlePrepareBulkSend = () => {
    if (isEmailSendingDisabled) {
      setVerifyMessage({
        success: false,
        text: 'Email service not configured. Actual email sending is disabled until valid SMTP settings are configured and verified in Company Settings.'
      });
      return;
    }

    if (employees.length === 0) {
      setVerifyMessage({ success: false, text: 'No employee records available to send payslips.' });
      return;
    }

    const initialStatuses: SendStatus[] = employees.map(emp => ({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email || '',
      status: 'pending'
    }));
    setStatuses(initialStatuses);
    setShowConfirmModal(true);
  };

  const handleExecuteBulkSend = async () => {
    if (isEmailSendingDisabled) {
      alert('Email service not configured. Configure and verify SMTP settings in Company Settings first.');
      return;
    }

    setShowConfirmModal(false);
    setIsBulkSending(true);

    const updated = [...statuses];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      const emp = employees.find(e => e.employeeId === item.employeeId);
      if (!emp || !emp.email) {
        updated[i] = { ...item, status: 'failed', error: 'Missing recipient email address.' };
        setStatuses([...updated]);
        continue;
      }

      updated[i] = { ...item, status: 'sending' };
      setStatuses([...updated]);

      try {
        // Generate PDF buffer client-side
        const doc = generatePayslipPdf(emp, settings, selectedMonth, selectedYear, layoutSettings);
        const pdfBase64 = doc.output('datauristring');
        const fileName = `Payslip_${emp.employeeId}_${emp.name.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedMonth}_${selectedYear}.pdf`;

        // Render template variables
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

        // Dispatch via server-side credentials (no secrets passed in request body)
        const res = await apiClient.request('/email/send', {
          method: 'POST',
          body: JSON.stringify({
            recipientEmail: emp.email,
            recipientName: emp.name,
            employeeId: emp.employeeId,
            subject,
            bodyText: body,
            attachmentName: fileName,
            pdfBase64
          })
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
  };

  const handleRetryFailed = async () => {
    if (isEmailSendingDisabled) return;

    const failedIndices = statuses
      .map((s, idx) => (s.status === 'failed' ? idx : -1))
      .filter(idx => idx !== -1);

    if (failedIndices.length === 0) return;

    setIsBulkSending(true);
    const updated = [...statuses];

    for (const i of failedIndices) {
      const item = updated[i];
      const emp = employees.find(e => e.employeeId === item.employeeId);
      if (!emp || !emp.email) continue;

      updated[i] = { ...item, status: 'sending', error: undefined };
      setStatuses([...updated]);

      try {
        const doc = generatePayslipPdf(emp, settings, selectedMonth, selectedYear, layoutSettings);
        const pdfBase64 = doc.output('datauristring');
        const fileName = `Payslip_${emp.employeeId}_${selectedMonth}_${selectedYear}.pdf`;

        const subject = formData.emailSubjectTemplate
          .replace(/{{month}}/g, selectedMonth)
          .replace(/{{year}}/g, String(selectedYear))
          .replace(/{{employeeName}}/g, emp.name);

        const body = formData.emailBodyTemplate
          .replace(/{{month}}/g, selectedMonth)
          .replace(/{{year}}/g, String(selectedYear))
          .replace(/{{employeeName}}/g, emp.name)
          .replace(/{{companyName}}/g, settings.companyName);

        const res = await apiClient.request('/email/send', {
          method: 'POST',
          body: JSON.stringify({
            recipientEmail: emp.email,
            recipientName: emp.name,
            employeeId: emp.employeeId,
            subject,
            bodyText: body,
            attachmentName: fileName,
            pdfBase64
          })
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
  };

  const sentCount = statuses.filter(s => s.status === 'sent').length;
  const failedCount = statuses.filter(s => s.status === 'failed').length;
  const missingEmailCount = employees.filter(e => !e.email).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider mb-1">
            <Mail className="w-4 h-4 text-[#CB1417]" />
            <span>Secure Server-Side Payslip Dispatch</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Bulk Individual Email Delivery
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Send separate personalized emails with encrypted PDF attachments to each employee for {selectedMonth} {selectedYear}.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
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
            onClick={handlePrepareBulkSend}
            disabled={isEmailSendingDisabled || employees.length === 0 || isBulkSending}
            title={isEmailSendingDisabled ? 'Email service not configured. Configure SMTP in Company Settings to enable.' : 'Send payslips to all employees'}
            className="flex items-center space-x-2 px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send Payslips ({employees.length})</span>
          </button>
        </div>
      </div>

      {/* Prominent Banner when Email Service is NOT Configured or NOT Verified */}
      {!isLoadingStatus && !smtpStatus?.isConfigured && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
                  Email service not configured
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Deployment Mode
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
                SMTP outgoing email server settings have not been configured for this company. To prevent failures, <strong>actual email sending is disabled</strong> until an authorized administrator configures and verifies SMTP credentials in <strong>Company Settings</strong>.
              </p>
            </div>
          </div>
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configure in Company Settings</span>
            </button>
          )}
        </div>
      )}

      {/* Warning when Configured but NOT Verified */}
      {!isLoadingStatus && smtpStatus?.isConfigured && !smtpStatus?.isVerified && (
        <div className="border border-blue-500/40 bg-blue-500/10 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                  SMTP Configured — Verification Required
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-700 dark:text-blue-300">
                  Pending Verification
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
                SMTP server parameters are stored, but the connection has not yet been verified. Run a test connection to ensure credentials and firewall ports are open before sending bulk payslips.
              </p>
            </div>
          </div>
          <button
            onClick={handleVerifySmtp}
            disabled={isVerifying}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Test & Activate Connection</span>
          </button>
        </div>
      )}

      {/* Active Service Badge when Verified */}
      {!isLoadingStatus && smtpStatus?.isConfigured && smtpStatus?.isVerified && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              <strong>Email Service Active:</strong> Connected to <code>{smtpStatus.smtpHost}:{smtpStatus.smtpPort}</code> with sender <code>{smtpStatus.senderEmail}</code>. Actual email sending is fully enabled.
            </span>
          </div>
          <button
            onClick={loadSmtpStatus}
            className="text-[11px] font-semibold underline hover:opacity-80 cursor-pointer"
          >
            Refresh Status
          </button>
        </div>
      )}

      {toastMessage && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Grid: Server-Side SMTP Status Overview vs Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Server-Side SMTP Status Card */}
        <div
          className={`border rounded-xl p-6 space-y-4 text-xs transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Server className="w-4 h-4 text-[#CB1417]" />
              <span>Server-Side SMTP Configuration</span>
            </h3>
            <span className="text-[11px] text-emerald-500 font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Encrypted Server Store</span>
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">Configuration Status</span>
                <span className={`font-bold ${smtpStatus?.isConfigured ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {smtpStatus?.isConfigured ? 'Configured' : 'Not Configured (Optional at Deploy)'}
                </span>
              </div>
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">Verification Status</span>
                <span className={`font-bold ${smtpStatus?.isVerified ? 'text-emerald-500' : 'text-zinc-400'}`}>
                  {smtpStatus?.isVerified ? 'Verified & Ready' : 'Unverified'}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
                <span className="text-zinc-500">SMTP Host:</span>
                <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                  {smtpStatus?.smtpHost || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
                <span className="text-zinc-500">SMTP Port:</span>
                <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                  {smtpStatus?.smtpPort ? `${smtpStatus.smtpPort} (${smtpStatus.smtpPort === 465 ? 'SSL' : 'STARTTLS'})` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
                <span className="text-zinc-500">SMTP Username:</span>
                <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                  {smtpStatus?.smtpUser || 'None'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
                <span className="text-zinc-500">Sender Email:</span>
                <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                  {smtpStatus?.senderEmail || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
                <span className="text-zinc-500">Sender Display Name:</span>
                <span className={`font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                  {smtpStatus?.senderName || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 flex items-center space-x-1">
                  <Lock className="w-3 h-3" />
                  <span>SMTP Password:</span>
                </span>
                <span className="font-mono text-zinc-400">
                  {smtpStatus?.hasPassword ? '•••••••••••• (Server-side Encrypted)' : 'Not Set'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
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
                onClick={onNavigateToSettings}
                className="text-xs text-[#CB1417] hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
              >
                <span>Edit SMTP in Company Settings</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {verifyMessage && (
            <div className={`p-3 rounded-lg text-xs border flex items-center space-x-2 ${
              verifyMessage.success
                ? isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                : isDark ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
            }`}>
              {verifyMessage.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-[#ED1F24] shrink-0" />}
              <span>{verifyMessage.text}</span>
            </div>
          )}
        </div>

        {/* Right: Email Subject & Body Template */}
        <div
          className={`border rounded-xl p-6 space-y-4 text-xs transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="border-b pb-3 flex items-center justify-between">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              Email Template & Placeholders
            </h3>
            <span className="text-[11px] text-zinc-500">Customizable per batch</span>
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Email Subject</label>
            <input
              type="text"
              value={formData.emailSubjectTemplate}
              onChange={e => handleFieldChange('emailSubjectTemplate', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition ${
                isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
              }`}
            />
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Email Body Template</label>
            <textarea
              rows={6}
              value={formData.emailBodyTemplate}
              onChange={e => handleFieldChange('emailBodyTemplate', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition resize-none ${
                isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
              }`}
            />
          </div>

          <div className={`p-3 rounded-lg border text-[11px] ${isDark ? 'bg-[#141416] border-[#222226] text-[#A1A1AA]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-[#52525B]'}`}>
            <span className="font-semibold block mb-1">Supported Placeholders:</span>
            <code>{`{{employeeName}}, {{employeeId}}, {{month}}, {{year}}, {{companyName}}`}</code>
          </div>
        </div>
      </div>

      {/* Live Dispatch Status Table if statuses exist */}
      {statuses.length > 0 && (
        <div
          className={`border rounded-xl p-6 space-y-4 transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3">
            <div>
              <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                <FileText className="w-4 h-4 text-[#CB1417]" />
                <span>Bulk Dispatch Progress & Audit Trail</span>
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                Sent: {sentCount} | Failed: {failedCount} | Total: {statuses.length}
              </p>
            </div>

            {failedCount > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={isBulkSending}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#CB1417] text-white hover:bg-[#ED1F24] transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Failed ({failedCount})</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className={`sticky top-0 ${isDark ? 'bg-[#141416] text-[#A1A1AA]' : 'bg-[#F4F4F6] text-[#71717A]'}`}>
                <tr>
                  <th className="p-3 font-semibold">Employee ID</th>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Recipient Email</th>
                  <th className="p-3 font-semibold">Delivery Status</th>
                  <th className="p-3 font-semibold">Timestamp / Error</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#222222]' : 'divide-[#E4E4E7]'}`}>
                {statuses.map(item => (
                  <tr key={item.employeeId} className={isDark ? 'hover:bg-[#121215]' : 'hover:bg-[#FAFAFC]'}>
                    <td className={`p-3 font-mono ${isDark ? 'text-white' : 'text-black'}`}>{item.employeeId}</td>
                    <td className={`p-3 font-medium ${isDark ? 'text-white' : 'text-black'}`}>{item.name}</td>
                    <td className={`p-3 ${item.email ? (isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]') : 'text-amber-500 font-semibold'}`}>
                      {item.email || 'Missing Email'}
                    </td>
                    <td className="p-3">
                      {item.status === 'sent' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Sent Successfully
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ED1F24]/10 text-[#ED1F24] border border-[#ED1F24]/20">
                          Failed
                        </span>
                      )}
                      {item.status === 'sending' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center space-x-1 w-fit">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Sending...</span>
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className={`p-3 font-mono text-[11px] ${item.error ? 'text-red-500' : isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                      {item.timestamp || item.error || 'Waiting in queue'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal before Bulk Send */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`max-w-md w-full border rounded-2xl p-6 space-y-4 shadow-2xl ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}>
            <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Users className="w-5 h-5 text-[#CB1417]" />
              <span>Confirm Bulk Individual Email Dispatch</span>
            </h3>

            <div className={`text-xs space-y-2 ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
              <p>You are about to dispatch <strong>{employees.length} separate individual emails</strong> with secure PDF payslip attachments for <strong>{selectedMonth} {selectedYear}</strong>.</p>
              {missingEmailCount > 0 && (
                <p className="text-amber-500 font-medium">Warning: {missingEmailCount} employee(s) do not have a configured email address and will be skipped.</p>
              )}
              <p>Each recipient will receive only their own encrypted PDF attachment via your verified SMTP server.</p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#27272A]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
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
