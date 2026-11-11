import React, { useState } from 'react';
import { Wifi, Save, CheckCircle2, AlertTriangle, RefreshCw, Server, RotateCcw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';

export const ClientConnectionView: React.FC = () => {
  const { isDark } = useTheme();
  const defaultHost = typeof window !== 'undefined' && window.location ? window.location.hostname || 'localhost' : 'localhost';
  const defaultPort = typeof window !== 'undefined' && window.location ? window.location.port || '3000' : '3000';
  const defaultProto = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:' ? 'https' : 'http';

  const [protocol, setProtocol] = useState<'http' | 'https'>(
    (localStorage.getItem('peopledesk_server_proto') as 'http' | 'https') || defaultProto
  );
  const [serverIp, setServerIp] = useState(localStorage.getItem('peopledesk_server_ip') || defaultHost);
  const [serverPort, setServerPort] = useState(localStorage.getItem('peopledesk_server_port') || defaultPort);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = () => {
    const portPart = serverPort ? `:${serverPort}` : '';
    const fullUrl = `${protocol}://${serverIp}${portPart}/api`;
    apiClient.setServerUrl(fullUrl);
    localStorage.setItem('peopledesk_server_proto', protocol);
    localStorage.setItem('peopledesk_server_ip', serverIp);
    localStorage.setItem('peopledesk_server_port', serverPort);
    setToast('Server connection configuration saved successfully.');
    setTimeout(() => setToast(null), 3000);
  };

  const handleResetToDefault = () => {
    apiClient.resetServerUrl();
    localStorage.removeItem('peopledesk_server_proto');
    setProtocol(defaultProto);
    setServerIp(defaultHost);
    setServerPort(defaultPort);
    setTestStatus('idle');
    setTestError(null);
    setToast('Reset to default same-origin server configuration.');
    setTimeout(() => setToast(null), 3000);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestError(null);
    const portPart = serverPort ? `:${serverPort}` : '';
    const testUrl = `${protocol}://${serverIp}${portPart}/api/health`;
    try {
      const res = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestError(err.message || 'Network unreachable');
    }
  };

  return (
    <div className="space-y-6">
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <Wifi className="w-4 h-4 text-brand-primary" />
            <span>LAN Client Configuration</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Central Server Connection Settings
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Configure the LAN IP address and API port of the primary HR server computer. Clients never store local fallback databases.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetToDefault}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              isDark ? 'border-[#333333] hover:bg-[#1E1E22] text-[#D4D4D8]' : 'border-[#D4D4D8] hover:bg-[#F4F4F6] text-[#27272A]'
            }`}
            title="Reset to same-origin host and port"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-bold shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Connection</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
            Server Address Parameters
          </h3>
          <span className="font-mono text-[11px] opacity-75">
            Target: <code>{protocol}://{serverIp}{serverPort ? `:${serverPort}` : ''}/api</code>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Protocol *</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}
              className={`w-full rounded px-3 py-2 font-mono border focus:outline-none focus:border-brand-primary ${
                isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
              }`}
            >
              <option value="http">http://</option>
              <option value="https">https://</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Server IP / Hostname *</label>
            <input
              type="text"
              value={serverIp}
              onChange={(e) => setServerIp(e.target.value)}
              placeholder="e.g. localhost or 192.168.1.100"
              className={`w-full rounded px-3 py-2 font-mono border focus:outline-none focus:border-brand-primary ${
                isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
              }`}
            />
          </div>

          <div>
            <label className={`font-medium block mb-1 ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>API Port</label>
            <input
              type="text"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              placeholder="3000"
              className={`w-full rounded px-3 py-2 font-mono border focus:outline-none focus:border-brand-primary ${
                isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
              }`}
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className={`px-4 py-2 rounded-lg font-medium border flex items-center space-x-2 transition cursor-pointer ${
              isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2A2A2E]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
            }`}
          >
            {testStatus === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Test Connection Now</span>
          </button>

          {testStatus === 'success' && (
            <span className="text-emerald-500 font-semibold flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Connection Successful</span>
            </span>
          )}

          {testStatus === 'error' && (
            <span className="text-red-500 font-semibold flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Server Unreachable {testError ? `(${testError})` : '(Offline Mode)'}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
