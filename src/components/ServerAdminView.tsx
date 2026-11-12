import React, { useState, useEffect } from 'react';
import { Server, Activity, Database, Users, HardDrive, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Clock, FileText } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';

interface ServerAdminViewProps {
  settings: any;
}

export const ServerAdminView: React.FC<ServerAdminViewProps> = ({ settings }) => {
  const { isDark } = useTheme();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.request('/server/stats');
      setStats(res);
    } catch (err: any) {
      setError(err.message || 'Unable to fetch real-time cloud server statistics.');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <Server className="w-4 h-4 text-brand-primary" />
            <span>Enterprise Cloud Architecture</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Cloud Server Management & Health
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Live diagnostic telemetry for PostgreSQL database pool, REST API cluster, active browser sessions, and cloud document storage.
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Health Status</span>
        </button>
      </div>

      {error && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#200708] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
        }`}>
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <span className="font-semibold">Backend Connection Issue</span>
            <p className="opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Backend API Health */}
        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Cloud Backend API</p>
            <p className={`text-lg font-bold mt-1 ${stats?.server?.status === 'online' ? 'text-emerald-500' : 'text-amber-500'}`}>
              {stats?.server?.status === 'online' ? 'Online & Healthy' : 'Degraded / Offline'}
            </p>
            <p className={`text-[11px] mt-0.5 font-mono ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              v{stats?.server?.version || '1.0.0'} • Node.js
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* PostgreSQL Database Health */}
        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>PostgreSQL Database</p>
            <p className={`text-lg font-bold mt-1 ${stats?.database?.status === 'healthy' ? 'text-emerald-500' : 'text-amber-500'}`}>
              {stats?.database?.isPgConnected ? 'PostgreSQL Active' : 'Resilient Pool Ready'}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              Latency: {stats?.database?.latencyMs ?? 0} ms
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>

        {/* Active Browser Sessions */}
        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Active HR Sessions</p>
            <p className={`text-lg font-bold mt-1 ${isDark ? 'text-white' : 'text-black'}`}>
              {stats?.sessions?.activeCount ?? 1} Connected
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              Encrypted Bearer Auth
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Persistent Cloud Storage */}
        <div className={`border rounded-xl p-4 flex items-center justify-between ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div>
            <p className={`text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>Cloud Storage</p>
            <p className={`text-lg font-bold mt-1 ${stats?.storage?.status === 'connected' ? 'text-emerald-500' : 'text-amber-500'}`}>
              {stats?.storage?.status === 'connected' ? 'Connected' : 'Degraded'}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              {stats?.storage?.fileCount ?? 0} files ({formatBytes(stats?.storage?.totalSizeBytes ?? 0)})
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Database Detailed Table Records & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between border-b pb-2.5">
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Database className="w-4 h-4 text-brand-primary" />
              <span>Database Architecture & Table Counts</span>
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
              Verified Real-Time
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Database Engine</span>
              <span className="font-semibold">{stats?.database?.engine || 'Hosted PostgreSQL'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Connection Latency</span>
              <span className="font-mono font-semibold">{stats?.database?.latencyMs ?? 0} ms</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Last Successful Query</span>
              <span className="font-mono">{stats?.database?.lastSuccessfulConnection ? new Date(stats.database.lastSuccessfulConnection).toLocaleTimeString() : 'Just now'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Master Employees</span>
              <span className="font-bold">{stats?.database?.tableCounts?.employees ?? 0} records</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Attendance Logs</span>
              <span className="font-bold">{stats?.database?.tableCounts?.attendance ?? 0} records</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Authorized System Users</span>
              <span className="font-bold">{stats?.database?.tableCounts?.users ?? 1} accounts</span>
            </div>
          </div>
        </div>

        {/* Cloud Security & Runtime Specs */}
        <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="flex items-center justify-between border-b pb-2.5">
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <ShieldCheck className="w-4 h-4 text-brand-primary" />
              <span>Security & Hosting Environment</span>
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold border border-blue-500/20">
              Vercel / Node.js
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Application Suite</span>
              <span className="font-semibold">{stats?.server?.app || 'PeopleDesk Studio Enterprise'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Target Deployment</span>
              <span className="font-semibold">Cloud Web (Vercel + GitHub CI/CD)</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Storage Provider</span>
              <span className="font-semibold">{stats?.storage?.provider || 'Persistent Cloud Object Store'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-100">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>File Assets Stored</span>
              <span className="font-semibold">{stats?.storage?.fileCount ?? 0} files ({formatBytes(stats?.storage?.totalSizeBytes ?? 0)})</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Server Uptime</span>
              <span className="font-mono">{stats?.server?.uptimeSeconds ? `${Math.floor(stats.server.uptimeSeconds / 60)} minutes` : 'Active'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent System Audit Logs */}
      {stats?.recentLogs && stats.recentLogs.length > 0 && (
        <div className={`border rounded-xl p-5 space-y-3 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="flex items-center space-x-2 border-b pb-2">
            <Clock className="w-4 h-4 text-brand-primary" />
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              Recent Cloud Server Activity & Audit Log
            </h3>
          </div>
          <div className="divide-y dark:divide-zinc-800 divide-zinc-100">
            {stats.recentLogs.map((log: any, idx: number) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold">{log.action || 'System Event'}</span>
                  <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{log.details || 'Operational checkpoint'}</p>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
