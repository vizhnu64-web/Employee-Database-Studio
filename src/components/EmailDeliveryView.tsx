import React, { useState } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Server,
  Key,
  ShieldCheck,
  RefreshCw,
  Users,
  FileText,
  Clock
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, EmailSettings, PayslipLayoutSettings } from '../types/payroll';
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
  selectedYear
}) => {
  const { isDark } = useTheme();
  const [formData, setFormData] = useState<EmailSettings>({ ...emailSettings });
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<SendStatus[]>([]);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleFieldChange = (field: keyof EmailSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = () => {
    onSaveEmailSettings(formData);
    setToastMessage('SMTP email configuration saved securely.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleVerifySmtp = async () => {
    setIsVerifying(true);
    setVerifyMessage(null);

    try {
      const res = await apiClient.request('/email/verify', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (res.success) {
        setVerifyMessage({ success: true, text: res.message || 'SMTP server connection verified successfully.' });
      } else {
        setVerifyMessage({ success: false, text: res.error || 'SMTP verification failed.' });
      }
    } catch (err: any) {
      setVerifyMessage({ success: false, text: err.message || 'SMTP verification error. Please verify host, port, and credentials.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePrepareBulkSend = () => {
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
        // Generate PDF buffer
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

        const res = await apiClient.request('/email/send', {
          method: 'POST',
          body: JSON.stringify({
            smtpConfig: formData,
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
            smtpConfig: formData,
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
            <span>Secure SMTP & Individual Email Dispatch</span>
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
            onClick={handleSaveConfig}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isDark
                ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]'
                : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-[#CB1417]" />
            <span>Save SMTP Config</span>
          </button>
          <button
            onClick={handlePrepareBulkSend}
            disabled={employees.length === 0 || isBulkSending}
            className="flex items-center space-x-2 px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send Payslips ({employees.length})</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Grid: SMTP Config vs Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: SMTP Configuration */}
        <div
          className={`border rounded-xl p-6 space-y-4 text-xs transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Server className="w-4 h-4 text-[#CB1417]" />
              <span>Company SMTP Server Settings</span>
            </h3>
            <span className="text-[11px] text-emerald-500 font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Encrypted Local Store</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>SMTP Host</label>
              <input
                type="text"
                value={formData.smtpHost}
                onChange={e => handleFieldChange('smtpHost', e.target.value)}
                placeholder="smtp.gmail.com or smtp.office365.com"
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition ${
                  isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                }`}
              />
            </div>
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Port</label>
              <input
                type="number"
                value={formData.smtpPort}
                onChange={e => handleFieldChange('smtpPort', Number(e.target.value))}
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition ${
                  isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>SMTP Username / Email</label>
              <input
                type="text"
                value={formData.smtpUser}
                onChange={e => handleFieldChange('smtpUser', e.target.value)}
                placeholder="hr@company.com"
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition ${
                  isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                }`}
              />
            </div>
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>App Password / Token</label>
              <input
                type="password"
                value={formData.smtpPass}
                onChange={e => handleFieldChange('smtpPass', e.target.value)}
                placeholder="••••••••••••••••"
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition ${
                  isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Sender Display Name</label>
              <input
                type="text"
                value={formData.senderName}
                onChange={e => handleFieldChange('senderName', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition ${
                  isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                }`}
              />
            </div>
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Sender Email Address</label>
              <input
                type="email"
                value={formData.senderEmail}
                onChange={e => handleFieldChange('senderEmail', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition ${
                  isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                }`}
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <button
              onClick={handleVerifySmtp}
              disabled={isVerifying}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center space-x-1.5 ${
                isDark ? 'bg-[#141416] hover:bg-[#222226] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CB1417]" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              <span>Test SMTP Connection</span>
            </button>
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
          <h3 className={`text-sm font-bold border-b pb-3 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
            Email Template & Placeholders
          </h3>

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
              <p>Each recipient will receive only their own encrypted PDF attachment.</p>
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
