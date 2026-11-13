import React, { useState, useEffect } from 'react';
import { Shield, Users, RefreshCw, CheckCircle2, AlertTriangle, Laptop, Smartphone, Globe, Ban, Building, Key } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';

export const ClientConnectionView: React.FC = () => {
  const { isDark } = useTheme();
  const [sessions, setSessions] = useState<any[]>([]);
  const [workspace, setWorkspace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessRes, wsRes] = await Promise.all([
        apiClient.request('/server/sessions').catch(() => ({ success: true, sessions: [] })),
        apiClient.request('/server/workspace').catch(() => ({ success: true, workspace: null }))
      ]);

      setSessions(sessRes.sessions || []);
      setWorkspace(wsRes.workspace || {
        name: 'Employee Database Studio Workspace',
        address: 'Cloud Operations Center',
        currency: 'INR',
        currencySymbol: '₹'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load client workspace session data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRevokeSession = async (sessionId: number) => {
    if (!confirm(`Are you sure you want to revoke session #${sessionId}? The user will be required to log in again.`)) {
      return;
    }
    setRevokingId(sessionId);
    try {
      await apiClient.request(`/server/sessions/${sessionId}/revoke`, { method: 'POST' });
      setToast(`Session #${sessionId} successfully revoked.`);
      setTimeout(() => setToast(null), 3000);
      fetchData();
    } catch (err: any) {
      alert(`Failed to revoke session: ${err.message}`);
    } finally {
      setRevokingId(null);
    }
  };

  const getDeviceIcon = (deviceInfo: string) => {
    const info = (deviceInfo || '').toLowerCase();
    if (info.includes('mobile') || info.includes('android') || info.includes('iphone')) {
      return <Smartphone className="w-4 h-4 text-purple-500" />;
    }
    return <Laptop className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-brand-primary" />
            <span>Multi-User Cloud Security</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Client & Workspace Access Management
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Manage authorized company workspace sessions, concurrent browser access, active employee devices, and session security.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Active Clients</span>
        </button>
      </div>

      {toast && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#200708] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
        }`}>
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace Information Card */}
      {workspace && (
        <div className={`border rounded-xl p-5 space-y-3 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between border-b pb-2.5">
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Building className="w-4 h-4 text-brand-primary" />
              <span>Company Workspace Details</span>
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold border border-blue-500/20">
              Workspace ID #{workspace.id || 1}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Workspace Name</span>
              <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-black'}`}>{workspace.name}</span>
            </div>
            <div>
              <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Operating Currency</span>
              <span className="font-semibold">{workspace.currency} ({workspace.currencySymbol})</span>
            </div>
            <div>
              <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Authorized Signatory</span>
              <span className="font-semibold">{workspace.signatory || 'Not Configured'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Browser Sessions Table */}
      <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
        <div className="flex items-center justify-between border-b pb-2.5">
          <div>
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Users className="w-4 h-4 text-brand-primary" />
              <span>Authorized Browser Sessions & Active Devices ({sessions.length})</span>
            </h3>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Connected HR executives accessing this company instance simultaneously.
            </p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="py-8 text-center text-zinc-500">
            No external active browser sessions recorded. Current session is authenticated.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b text-[11px] font-semibold uppercase ${isDark ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-600'}`}>
                  <th className="py-2.5 px-3">User & Role</th>
                  <th className="py-2.5 px-3">Device & User-Agent</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3">Login Time</th>
                  <th className="py-2.5 px-3">Last Active</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-zinc-800 divide-zinc-100">
                {sessions.map((sess) => (
                  <tr key={sess.id} className={sess.is_revoked ? 'opacity-50' : ''}>
                    <td className="py-3 px-3">
                      <div className="font-semibold">{sess.full_name || sess.username}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">@{sess.username} • {sess.role}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1.5 truncate max-w-xs">
                        {getDeviceIcon(sess.device_info)}
                        <span className="truncate">{sess.device_info}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">{sess.ip_address}</td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {new Date(sess.login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {new Date(sess.last_active_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {sess.is_revoked ? (
                        <span className="text-[10px] font-bold text-red-500 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                          Revoked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(sess.id)}
                          disabled={revokingId === sess.id}
                          className="px-2.5 py-1 rounded text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 transition cursor-pointer disabled:opacity-50 inline-flex items-center space-x-1"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role-Based Permissions Matrix */}
      <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
        <div className="flex items-center space-x-2 border-b pb-2">
          <Key className="w-4 h-4 text-brand-primary" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
            Multi-User Role & Access Permission Matrix
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className={`border-b font-semibold uppercase ${isDark ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-600'}`}>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Employee Database</th>
                <th className="py-2 px-3">Attendance & Approvals</th>
                <th className="py-2 px-3">Payroll Calculation</th>
                <th className="py-2 px-3">Payslip Generator</th>
                <th className="py-2 px-3">Cloud Administration</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-zinc-800 divide-zinc-100">
              <tr>
                <td className="py-2 px-3 font-bold text-blue-500">Super Admin / Company Admin</td>
                <td className="py-2 px-3 text-emerald-500">Full Access</td>
                <td className="py-2 px-3 text-emerald-500">Full Access</td>
                <td className="py-2 px-3 text-emerald-500">Full Access</td>
                <td className="py-2 px-3 text-emerald-500">Full Access</td>
                <td className="py-2 px-3 text-emerald-500">Full Access</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-emerald-500">HR Manager / HR Executive</td>
                <td className="py-2 px-3 text-emerald-500">Manage Profiles</td>
                <td className="py-2 px-3 text-emerald-500">Approve & Correct</td>
                <td className="py-2 px-3 text-zinc-400">View Structure</td>
                <td className="py-2 px-3 text-zinc-400">View History</td>
                <td className="py-2 px-3 text-red-400">Restricted</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-amber-500">Payroll Manager / Executive</td>
                <td className="py-2 px-3 text-zinc-400">View Only</td>
                <td className="py-2 px-3 text-emerald-500">Sync & LOP View</td>
                <td className="py-2 px-3 text-emerald-500">Full Batch Run</td>
                <td className="py-2 px-3 text-emerald-500">Edit & Generate</td>
                <td className="py-2 px-3 text-red-400">Restricted</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-400">Read Only Auditor</td>
                <td className="py-2 px-3 text-zinc-400">Read Only</td>
                <td className="py-2 px-3 text-zinc-400">Read Only</td>
                <td className="py-2 px-3 text-zinc-400">Read Only</td>
                <td className="py-2 px-3 text-zinc-400">Read Only</td>
                <td className="py-2 px-3 text-red-400">Restricted</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
