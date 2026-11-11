import React, { useState, useEffect } from 'react';
import { Server, Activity, Database, Users, Shield, HardDrive, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';

interface ServerAdminViewProps {
  settings: any;
}

export const ServerAdminView: React.FC<ServerAdminViewProps> = ({ settings }) => {
  const { isDark } = useTheme();
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.request('/health');
      setHealth(res);
    } catch (err: any) {
      setError(err.message || 'Server is offline or unreachable.');
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <Server className="w-4 h-4 text-brand-primary" />
            <span>LAN Enterprise Server Administration</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Server Management & Health Dashboard
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Monitor central Node.js backend status, PostgreSQL database health, and active LAN client connections.
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Test Server Health</span>
        </button>
      </div>

      {error && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#200708] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
        }`}>
          <AlertTriangle className="w-5 h-5 text-brand-accent shrink-0" />
          <div>
            <span className="font-semibold">Backend Server Offline (Preview / Demo Mode Active)</span>
            <p className="opacity-90 mt-0.5">{error}. In Google AI Studio preview without a running Windows Server service, client features run in safe local mode.</p>
          </div>
        </div>
      )}

      {/* Status KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Server Status</p>
            <p className={`text-lg font-bold mt-1 ${health ? 'text-emerald-500' : 'text-amber-500'}`}>
              {health ? 'Online & Active' : 'Offline / Preview'}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Port 4000 LAN API</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${health ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Database Engine</p>
            <p className={`text-lg font-bold mt-1 ${isDark ? 'text-white' : 'text-black'}`}>PostgreSQL 16</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Central Local Instance</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Connected Clients</p>
            <p className={`text-lg font-bold mt-1 ${isDark ? 'text-white' : 'text-black'}`}>1 (This Host)</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Office LAN Subnet</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Storage Security</p>
            <p className={`text-lg font-bold mt-1 ${isDark ? 'text-white' : 'text-black'}`}>Encrypted</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>Central Documents Dir</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Detailed Server Info Card */}
      <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
        <h3 className={`text-sm font-bold border-b pb-2 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
          Windows Background Service & Network Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Service Name</span>
            <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-black'}`}>PeopleDeskServerService</span>
          </div>
          <div>
            <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Startup Mode</span>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Automatic (Windows Service)</span>
          </div>
          <div>
            <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Server IP Address</span>
            <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-black'}`}>192.168.1.50 (Static LAN)</span>
          </div>
          <div>
            <span className={`block font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>API Endpoint</span>
            <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-black'}`}>http://192.168.1.50:4000/api</span>
          </div>
        </div>
      </div>
    </div>
  );
};
