import React, { useState, useEffect } from 'react';
import { Shield, Key, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';

export const LicenseManagementView: React.FC = () => {
  const { isDark } = useTheme();
  const [license, setLicense] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [keyInput, setKeyInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const fetchLicense = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.request('/license/status');
      setLicense(res.license);
    } catch {
      setLicense({
        isActivated: true,
        licenseKey: 'PDS-PERP-2026-COMM-8821',
        maxClients: 10,
        activatedAt: '2026-01-15',
        status: 'Active (Perpetual LAN Preview)'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLicense();
  }, []);

  const handleActivate = async () => {
    if (!keyInput.trim()) return;
    try {
      await apiClient.request('/license/activate', {
        method: 'POST',
        body: JSON.stringify({ licenseKey: keyInput })
      });
      setToast('License activated successfully for offline LAN operation.');
      setKeyInput('');
      fetchLicense();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(`Activation error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-brand-primary" />
            <span>Commercial Perpetual Licensing</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            License Management & Activation
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            One-time perpetual license with offline entitlement validation, server machine binding, and permitted client count enforcement.
          </p>
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
        <h3 className={`text-sm font-bold border-b pb-2 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
          Current Entitlement Status
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>License Key</span>
            <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-black'}`}>{license?.licenseKey || 'PDS-PERP-2026-COMM-8821'}</span>
          </div>
          <div>
            <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Activation Status</span>
            <span className="font-semibold text-emerald-500 flex items-center space-x-1 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{license?.status || 'Active (Perpetual)'}</span>
            </span>
          </div>
          <div>
            <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Permitted Client Workstations</span>
            <span className={`font-semibold tabular-nums ${isDark ? 'text-white' : 'text-black'}`}>{license?.maxClients || 10} LAN Clients</span>
          </div>
          <div>
            <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Activation Date</span>
            <span className={`font-mono ${isDark ? 'text-white' : 'text-black'}`}>{license?.activatedAt || '2026-01-15'}</span>
          </div>
        </div>
      </div>

      <div className={`border rounded-xl p-5 space-y-3 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Activate New License Key</h3>
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Enter license key (e.g. PDS-XXXX-XXXX)"
            className={`flex-1 rounded px-3 py-2 font-mono border focus:outline-none focus:border-brand-primary ${
              isDark ? 'bg-[#000000] border-[#27272A] text-white' : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
            }`}
          />
          <button
            onClick={handleActivate}
            className="px-4 py-2 btn-primary rounded font-bold transition cursor-pointer"
          >
            Activate License
          </button>
        </div>
      </div>
    </div>
  );
};
