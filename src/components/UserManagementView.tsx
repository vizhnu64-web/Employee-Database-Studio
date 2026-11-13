import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  UserPlus, 
  Lock, 
  CheckCircle2, 
  Edit, 
  Trash2, 
  X, 
  AlertTriangle, 
  KeyRound, 
  RefreshCw, 
  History, 
  Eye, 
  EyeOff,
  UserCheck,
  UserX,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiClient, ManagedUser } from '../utils/apiClient';

interface AuditLogItem {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

export const UserManagementView: React.FC = () => {
  const { isDark } = useTheme();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'audit'>('users');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<ManagedUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<ManagedUser | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form states for Add User
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<'admin' | 'hr' | 'payroll' | 'readonly'>('hr');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form states for Reset Password
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = async () => {
    if (!apiClient.getToken()) {
      setIsLoading(false);
      setErrorBanner('Authentication required. Please sign in to load user accounts.');
      return;
    }
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      const msg = err.message || 'Error loading users from central server.';
      setErrorBanner(msg);
      showToastMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (!apiClient.getToken()) {
      return;
    }
    try {
      const logs = await apiClient.getAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
      setErrorBanner(prev => prev || err.message || 'Error loading security audit logs.');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
  }, []);

  const handleOpenAdd = () => {
    setUsername('');
    setFullName('');
    setEmail('');
    setEmployeeId('');
    setRole('hr');
    setPassword('');
    setModalError(null);
    setShowAddModal(true);
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
    setShowPassword(true);
  };

  const handleGenerateResetPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(res);
    setShowResetPassword(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!username.trim() || !fullName.trim() || !password) {
      setModalError('Username, Full Name, and Password are required.');
      return;
    }

    if (password.length < 8) {
      setModalError('Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await apiClient.createUser({
        username: username.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        password,
        employeeId: employeeId.trim() || undefined
      });

      if (res.success) {
        showToastMsg(`User ${username} created successfully.`);
        setShowAddModal(false);
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to create user.');
    }
  };

  const handleOpenEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setEmail(user.email || '');
    setRole(user.role);
    setEmployeeId(user.employeeId || '');
    setModalError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setModalError(null);

    try {
      const res = await apiClient.updateUser(editingUser.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        employeeId: employeeId.trim() || undefined
      });

      if (res.success) {
        showToastMsg(`Updated permissions for ${fullName}.`);
        setEditingUser(null);
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to update user.');
    }
  };

  const handleToggleStatus = async (user: ManagedUser) => {
    if (user.username === 'admin') {
      showToastMsg('Cannot deactivate the default system administrator.');
      return;
    }

    const nextState = !user.isActive;
    try {
      const res = await apiClient.updateUser(user.id, { isActive: nextState });
      if (res.success) {
        showToastMsg(`User ${user.username} is now ${nextState ? 'Active' : 'Deactivated'}.`);
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err: any) {
      showToastMsg(err.message || 'Failed to change user status.');
    }
  };

  const handleOpenResetPassword = (user: ManagedUser) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setShowResetPassword(false);
    setModalError(null);
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    setModalError(null);

    if (newPassword.length < 8) {
      setModalError('Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await apiClient.adminResetPassword(resetPasswordUser.id, newPassword);
      if (res.success) {
        showToastMsg(res.message || `Password for ${resetPasswordUser.username} was reset.`);
        setResetPasswordUser(null);
        fetchAuditLogs();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to reset password.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      const res = await apiClient.deleteUser(deleteConfirmUser.id);
      if (res.success) {
        showToastMsg(`Deleted user ${deleteConfirmUser.username}.`);
        setDeleteConfirmUser(null);
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err: any) {
      showToastMsg(err.message || 'Failed to delete user.');
      setDeleteConfirmUser(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">
            <Users className="w-4 h-4 text-brand-primary" />
            <span>Central Multi-User Access Control</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            User Accounts, RBAC Permissions & Audit Log
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Central PostgreSQL authentication: Administrator, HR, Payroll, and Read-Only roles with session revocation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => { fetchUsers(); fetchAuditLogs(); }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-bold shadow-md transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Users vs Audit Log */}
      <div className="flex space-x-2 border-b dark:border-zinc-800 border-zinc-200">
        <button
          onClick={() => setActiveSubTab('users')}
          style={activeSubTab === 'users' ? { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' } : undefined}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'users'
              ? ''
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Active Users ({users.length})</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('audit'); fetchAuditLogs(); }}
          style={activeSubTab === 'audit' ? { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' } : undefined}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'audit'
              ? ''
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Security Audit Trail</span>
        </button>
      </div>

      {errorBanner && (
        <div className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs border transition ${
          isDark ? 'bg-rose-950/30 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-800'
        }`}>
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-medium">{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => { fetchUsers(); fetchAuditLogs(); }}
            className="px-2.5 py-1 rounded-md border border-rose-500/40 hover:bg-rose-500/10 font-semibold text-[11px] cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {toast && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border transition animate-in fade-in ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Tab Content: Users Table */}
      {activeSubTab === 'users' && (
        <div className={`border rounded-xl overflow-hidden shadow-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#222222]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'}`}>
              <tr>
                <th className="p-3">Username</th>
                <th className="p-3">Full Legal Name</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Linked Employee ID</th>
                <th className="p-3 text-center">Account Status</th>
                <th className="p-3">Last Active Login</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E1E22]' : 'divide-[#F4F4F6]'}`}>
              {users.map(u => (
                <tr key={u.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-[#F8F9FA]'}>
                  <td className={`p-3 font-mono font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                    {u.username}
                  </td>
                  <td className={`p-3 font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                    <div>{u.fullName}</div>
                    {u.email && <div className="text-[10px] text-zinc-500 font-normal">{u.email}</div>}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      u.role === 'admin'
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                        : u.role === 'hr'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                        : u.role === 'payroll'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        : 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                    }`}>
                      {u.role === 'admin' ? 'Administrator' : u.role === 'hr' ? 'HR Specialist' : u.role === 'payroll' ? 'Payroll Officer' : 'Read-Only'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[11px] text-zinc-500">
                    {u.employeeId || '—'}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggleStatus(u)}
                      disabled={u.username === 'admin'}
                      title={u.username === 'admin' ? 'Primary admin cannot be deactivated' : 'Click to toggle status'}
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                        u.isActive
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                      } ${u.username === 'admin' ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                      {u.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      <span>{u.isActive ? 'Active' : 'Disabled'}</span>
                    </button>
                  </td>
                  <td className={`p-3 font-mono text-[11px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                    {u.lastLogin}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => handleOpenResetPassword(u)}
                      className="text-[11px] font-semibold text-amber-500 hover:underline inline-flex items-center space-x-1 cursor-pointer"
                      title="Reset user password"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="text-[11px] font-semibold text-blue-500 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    {u.username !== 'admin' && (
                      <button
                        onClick={() => setDeleteConfirmUser(u)}
                        className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: Audit Log Table */}
      {activeSubTab === 'audit' && (
        <div className={`border rounded-xl overflow-hidden shadow-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-b dark:border-zinc-800 border-zinc-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">
              Immutable Central Security & Access Audit Trail (Last 100 Events)
            </span>
            <button
              onClick={fetchAuditLogs}
              className="text-blue-500 hover:underline font-medium text-[11px] cursor-pointer"
            >
              Refresh Logs
            </button>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead className={`text-[11px] font-semibold border-b ${isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#222222]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'}`}>
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target Entity</th>
                <th className="p-3">Details</th>
                <th className="p-3">Client IP</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E1E22]' : 'divide-[#F4F4F6]'}`}>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-500">
                    No security events recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map(log => (
                  <tr key={log.id} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-[#F8F9FA]'}>
                    <td className="p-3 font-mono text-[11px] text-zinc-400">
                      {log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19) : '—'}
                    </td>
                    <td className="p-3 font-semibold">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                        log.action.includes('LOGIN')
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : log.action.includes('CREATE')
                          ? 'bg-blue-500/10 text-blue-500'
                          : log.action.includes('DELETE') || log.action.includes('DEACTIVATE')
                          ? 'bg-rose-500/10 text-rose-500'
                          : 'bg-zinc-500/10 text-zinc-400'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-zinc-400">{log.entity_id || '—'}</td>
                    <td className={`p-3 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{log.details}</td>
                    <td className="p-3 font-mono text-zinc-500">{log.ip_address}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[#1e3a8a]" />
                <span>Create Central User Account</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Username (Login ID) *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. jsmith"
                  className={`w-full rounded px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Work Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="j.smith@apex.corp"
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Linked Employee ID</label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="EMP-1005"
                    className={`w-full rounded px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Access Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                >
                  <option value="admin">Administrator (Full Central Access)</option>
                  <option value="hr">HR Specialist (Employee Directory, Attendance, Leaves)</option>
                  <option value="payroll">Payroll Specialist (Batch, Math, Payslips, Export)</option>
                  <option value="readonly">Read-Only Auditor (View-Only Records)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold">Initial Password * (Min 8 characters)</label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-[11px] text-blue-500 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full rounded px-3 pr-10 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t dark:border-zinc-800 border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2 rounded-lg border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 btn-primary font-bold rounded-lg cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Edit className="w-4 h-4 text-[#1e3a8a]" />
                <span>Edit User: {editingUser.username}</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Linked Employee ID</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className={`w-full rounded px-3 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Access Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  disabled={editingUser.username === 'admin'}
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'} ${
                    editingUser.username === 'admin' ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="admin">Administrator (Full Central Access)</option>
                  <option value="hr">HR Specialist (Employee & Attendance)</option>
                  <option value="payroll">Payroll Specialist (Batch & Payslips)</option>
                  <option value="readonly">Read-Only (Viewer)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t dark:border-zinc-800 border-zinc-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className={`px-4 py-2 rounded-lg border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 btn-primary font-bold rounded-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Administrator Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <h3 className="text-sm font-bold flex items-center space-x-2 text-amber-500">
                <KeyRound className="w-4 h-4" />
                <span>Reset Password for "{resetPasswordUser.username}"</span>
              </h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              As an Administrator, you can assign a new or temporary password. The password will be hashed securely with bcrypt.
            </p>

            {modalError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveResetPassword} className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold">New Password (Min 8 characters) *</label>
                  <button
                    type="button"
                    onClick={handleGenerateResetPassword}
                    className="text-[11px] text-amber-500 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Random</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full rounded px-3 pr-10 py-2 border font-mono ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t dark:border-zinc-800 border-zinc-200">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className={`px-4 py-2 rounded-lg border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center space-x-3 text-red-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">Delete User Account?</h3>
            </div>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Are you sure you want to delete user <strong className={isDark ? 'text-white' : 'text-black'}>{deleteConfirmUser.username}</strong>? This user will be permanently revoked from the central database.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
