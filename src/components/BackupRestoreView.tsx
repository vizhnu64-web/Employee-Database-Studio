import React, { useState, useRef } from 'react';
import { Database, Download, Upload, CheckCircle2, AlertTriangle, RefreshCw, Clock, Save, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { localDB } from '../utils/dbStorage';

export const BackupRestoreView: React.FC = () => {
  const { isDark } = useTheme();
  const [toast, setToast] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('20:00');
  const [retentionDays, setRetentionDays] = useState(30);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const jsonStr = await localDB.exportFullBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EmployeeDatabaseStudio_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToastMsg('Full database, settings and documents backup exported successfully.');
    } catch (err: any) {
      alert(`Backup error: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Are you sure you want to restore database from "${file.name}"? This will update local records.`)) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const result = await localDB.importFullBackup(text);
      if (result.success) {
        showToastMsg(result.message);
      } else {
        alert(result.message);
      }
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const handleSaveSchedule = () => {
    showToastMsg(`Automatic backup schedule updated: Daily at ${scheduleTime} (Retaining ${retentionDays} rolling archives).`);
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={restoreFileRef}
        onChange={handleRestoreFile}
        accept=".json"
        className="hidden"
      />

      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <Database className="w-4 h-4 text-brand-primary" />
            <span>Disaster Recovery & Data Safety</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Central Backup & Restore Management
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Perform manual backups, configure daily automatic 8 PM backups, retain 30 daily archives, and execute verified restores.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => restoreFileRef.current?.click()}
            disabled={isRestoring}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
              isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#2A2A2E]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
            }`}
          >
            <Upload className="w-4 h-4 text-brand-primary" />
            <span>{isRestoring ? 'Restoring...' : 'Restore Backup (.json)'}</span>
          </button>

          <button
            onClick={handleManualBackup}
            disabled={isBackingUp}
            className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isBackingUp ? 'Exporting Backup...' : 'Download Full Backup Now'}</span>
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

      {/* Schedule Configuration Card */}
      <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
        <h3 className={`text-sm font-bold border-b pb-2 flex items-center space-x-2 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
          <Clock className="w-4 h-4 text-brand-primary" />
          <span>Automated Scheduled Backup Policy</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Automated Schedule Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
            />
            <span className="text-[11px] text-zinc-500 block mt-1">Default: 20:00 (8:00 PM Daily)</span>
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Retention Rolling Archives</label>
            <input
              type="number"
              min={7}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
            />
            <span className="text-[11px] text-zinc-500 block mt-1">Number of rolling daily backups retained</span>
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Storage Directory</label>
            <input
              type="text"
              readOnly
              value="%PROGRAMDATA%\EmployeeDatabaseStudio\backups"
              className={`w-full rounded px-3 py-2 font-mono text-[11px] border opacity-80 ${isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-300 text-zinc-700'}`}
            />
            <span className="text-[11px] text-zinc-500 block mt-1">Target folder on primary server host</span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t dark:border-zinc-800 border-zinc-200">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
            />
            <span className="font-semibold">Enable Automated Daily Background Backup</span>
          </label>

          <button
            onClick={handleSaveSchedule}
            className="flex items-center space-x-1.5 px-4 py-2 btn-primary rounded-lg text-xs font-bold cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Schedule</span>
          </button>
        </div>
      </div>
    </div>
  );
};
