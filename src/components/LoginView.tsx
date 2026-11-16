import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Building2, 
  ShieldCheck, 
  AlertCircle, 
  Server, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Mail,
  KeyRound
} from 'lucide-react';
import { apiClient, AuthUser } from '../utils/apiClient';
import { CompanySettings } from '../types/payroll';
import { useTheme } from '../context/ThemeContext';

interface LoginViewProps {
  companySettings: CompanySettings;
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ companySettings, onLoginSuccess }) => {
  const { isDark } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'credentials' | 'disabled' | 'server' | 'other' | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(apiClient.getServerUrl());
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showResetGuidance, setShowResetGuidance] = useState(false);

  // Create Admin Control Account mode & form state
  const [authMode, setAuthMode] = useState<'login' | 'register-admin'>('login');
  const [adminSetupStatus, setAdminSetupStatus] = useState<{
    hasAdminAccount: boolean;
    requiresAuthorization: boolean;
    setupKeyConfigured: boolean;
  }>({
    hasAdminAccount: true,
    requiresAuthorization: true,
    setupKeyConfigured: false
  });
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [authAdminUsername, setAuthAdminUsername] = useState('');
  const [authAdminPassword, setAuthAdminPassword] = useState('');
  const [adminSetupKey, setAdminSetupKey] = useState('');
  const [useSetupKeyAuth, setUseSetupKeyAuth] = useState(false);

  const loadAdminSetupStatus = async () => {
    try {
      const status = await apiClient.getAdminSetupStatus();
      if (status?.success) {
        setAdminSetupStatus({
          hasAdminAccount: status.hasAdminAccount,
          requiresAuthorization: status.requiresAuthorization,
          setupKeyConfigured: status.setupKeyConfigured
        });
        if (!status.hasAdminAccount && status.setupKeyConfigured) {
          setUseSetupKeyAuth(true);
        }
      }
    } catch {
      // Keep safe default (requiresAuthorization: true) if health/status is temporarily unreachable
    }
  };

  // Load remembered username if saved
  useEffect(() => {
    const saved = localStorage.getItem('peopledesk_remembered_username');
    if (saved) {
      setUsername(saved);
      setRememberUsername(true);
    }
    checkServerHealth();
    loadAdminSetupStatus();
  }, []);

  const checkServerHealth = async () => {
    setServerStatus('checking');
    try {
      const res = await apiClient.getHealth();
      if (res && (res.status === 'healthy' || res.status === 'offline')) {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
  };

  const handleSaveServerUrl = () => {
    apiClient.setServerUrl(serverUrl);
    checkServerHealth();
    setShowServerConfig(false);
  };

  const handleResetServerToDefault = () => {
    const defaultUrl = apiClient.resetServerUrl();
    setServerUrl(defaultUrl);
    setErrorMessage(null);
    setErrorType(null);
    checkServerHealth();
    setShowServerConfig(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorType('credentials');
      setErrorMessage('Please enter both your username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setErrorType(null);

    try {
      const res = await apiClient.login(username.trim(), password);
      if (res.success && res.user) {
        if (rememberUsername) {
          localStorage.setItem('peopledesk_remembered_username', username.trim());
        } else {
          localStorage.removeItem('peopledesk_remembered_username');
        }
        onLoginSuccess(res.user);
      } else {
        setErrorType('credentials');
        setErrorMessage('Invalid username or password.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.isNetworkError) {
        setErrorType('server');
        setErrorMessage(err.message || 'Cannot reach central authentication server.');
      } else if (err.status === 403 || err.message?.includes('deactivated') || err.message?.includes('disabled')) {
        setErrorType('disabled');
        setErrorMessage(err.message || 'Your account has been deactivated. Please contact your system administrator.');
      } else if (err.status === 401 || err.message?.includes('Invalid')) {
        setErrorType('credentials');
        setErrorMessage('Invalid username or password.');
      } else {
        setErrorType('other');
        setErrorMessage(err.message || 'An error occurred during authentication. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (user: string, pass: string) => {
    setAuthMode('login');
    setUsername(user);
    setPassword(pass);
    setErrorMessage(null);
    setErrorType(null);
  };

  const handleSwitchMode = (mode: 'login' | 'register-admin') => {
    setAuthMode(mode);
    setErrorMessage(null);
    setErrorType(null);
    if (mode === 'register-admin') {
      loadAdminSetupStatus();
    }
  };

  const handleCreateAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFullName = regFullName.trim();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanEmail = regEmail.trim();

    if (cleanFullName.length < 2) {
      setErrorType('other');
      setErrorMessage('Please enter the administrator full name (at least 2 characters).');
      return;
    }

    if (!/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
      setErrorType('other');
      setErrorMessage('Admin username must be 3–40 characters (letters, numbers, dots, underscores, or hyphens).');
      return;
    }

    if (regPassword.length < 8) {
      setErrorType('other');
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorType('other');
      setErrorMessage('Password and confirmation password do not match.');
      return;
    }

    if (adminSetupStatus.requiresAuthorization) {
      if (useSetupKeyAuth && adminSetupStatus.setupKeyConfigured) {
        if (!adminSetupKey.trim()) {
          setErrorType('credentials');
          setErrorMessage('Please enter the Admin Setup Key to authorize this account.');
          return;
        }
      } else if (adminSetupStatus.hasAdminAccount) {
        if (!authAdminUsername.trim() || !authAdminPassword) {
          setErrorType('credentials');
          setErrorMessage('Please enter existing Administrator credentials to authorize creating a new Admin Control Account.');
          return;
        }
      } else if (adminSetupStatus.setupKeyConfigured && !adminSetupKey.trim()) {
        setErrorType('credentials');
        setErrorMessage('Please enter the Admin Setup Key to create the initial Admin Control Account.');
        return;
      }
    }

    setIsLoading(true);
    setErrorMessage(null);
    setErrorType(null);

    try {
      const res = await apiClient.registerAdminAccount({
        fullName: cleanFullName,
        username: cleanUsername,
        email: cleanEmail || undefined,
        password: regPassword,
        authorizingUsername: !useSetupKeyAuth ? authAdminUsername.trim() : undefined,
        authorizingPassword: !useSetupKeyAuth ? authAdminPassword : undefined,
        adminSetupKey: (useSetupKeyAuth || !adminSetupStatus.hasAdminAccount) ? adminSetupKey.trim() || undefined : undefined
      });

      if (res.success && res.user) {
        if (rememberUsername) {
          localStorage.setItem('peopledesk_remembered_username', cleanUsername);
        }
        onLoginSuccess(res.user);
      } else {
        setErrorType('other');
        setErrorMessage('Unable to create Admin Control Account.');
      }
    } catch (err: any) {
      console.error('Admin registration error:', err);
      if (err.isNetworkError) {
        setErrorType('server');
        setErrorMessage(err.message || 'Cannot reach central authentication server.');
      } else if (err.status === 403 || err.status === 401) {
        setErrorType('credentials');
        setErrorMessage(err.message || 'Administrator authorization failed.');
      } else {
        setErrorType('other');
        setErrorMessage(err.message || 'Failed to create Admin Control Account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen w-full flex flex-col justify-between p-4 sm:p-8 select-none transition-colors ${
      isDark ? 'bg-[#09090B] text-zinc-100' : 'bg-[#F4F4F6] text-zinc-900'
    }`}>
      {/* Top Header / Server Status Indicator */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between py-2 text-xs">
        <div className="flex items-center space-x-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center font-black text-xs shadow-xs"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-text)' }}
          >
            EDS
          </div>
          <span className="font-bold tracking-tight text-sm">Employee Database Studio</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
            Enterprise Multi-User
          </span>
        </div>

        {/* Server Connection Status */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className={`flex items-center space-x-2 px-2.5 py-1 rounded-md border text-[11px] font-mono transition cursor-pointer ${
              serverStatus === 'online'
                ? isDark ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : isDark ? 'border-amber-900/50 bg-amber-950/20 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>LAN Server: {serverStatus === 'online' ? 'Connected' : 'Checking...'}</span>
            <Sliders className="w-3 h-3 ml-1 opacity-70" />
          </button>
        </div>
      </div>

      {/* Server Config Collapsible Bar */}
      {showServerConfig && (
        <div className={`w-full max-w-md mx-auto mb-4 p-4 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
          isDark ? 'bg-[#121214] border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-blue-500" />
              <span>Central LAN Server Address</span>
            </span>
            <button
              onClick={() => setShowServerConfig(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3">
            Clients on the local network connect to the primary Employee Database Studio server host (e.g., <code>http://192.168.1.100:3000/api</code>).
          </p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000/api"
              className="flex-1 text-xs px-3 py-1.5 rounded border dark:bg-black dark:border-zinc-700 border-zinc-300 font-mono"
            />
            <button
              type="button"
              onClick={handleSaveServerUrl}
              className="px-3 py-1.5 btn-primary text-xs font-semibold rounded cursor-pointer transition shadow-xs"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetServerToDefault}
              className="px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-750 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium rounded cursor-pointer transition flex items-center space-x-1"
              title="Reset to default local server (/api)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Authentication Card */}
      <div className="w-full max-w-md mx-auto my-auto">
        <div className={`rounded-2xl border p-8 shadow-xl backdrop-blur-xs transition-colors ${
          isDark ? 'bg-[#121214] border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          {/* Company Branding / Header */}
          <div className="text-center mb-6">
            {companySettings.logoDataUrl ? (
              <div className="flex justify-center mb-3">
                <img
                  src={companySettings.logoDataUrl}
                  alt={companySettings.companyName}
                  className="max-h-12 max-w-[180px] object-contain rounded"
                />
              </div>
            ) : (
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 border text-brand-primary"
                style={{ backgroundColor: 'var(--button-outline-hover, rgba(30,58,138,0.1))', borderColor: 'var(--brand-primary)' }}
              >
                <Building2 className="w-6 h-6" />
              </div>
            )}

            <h1 className="text-lg font-bold tracking-tight">
              {companySettings.companyName || 'Employee Database Studio'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              {authMode === 'login'
                ? 'Central LAN Multi-User Authentication'
                : 'Provision Admin Control Account'}
            </p>
          </div>

          {/* Authentication Mode Tabs */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className={`grid grid-cols-2 p-1 rounded-xl border mb-5 text-xs font-semibold ${
              isDark ? 'bg-black/40 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'login'}
              onClick={() => handleSwitchMode('login')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                authMode === 'login'
                  ? isDark
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'register-admin'}
              onClick={() => handleSwitchMode('register-admin')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                authMode === 'register-admin'
                  ? isDark
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Admin Account</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className={`mb-5 p-3.5 rounded-xl border text-xs flex items-start space-x-3 transition animate-in fade-in slide-in-from-top-1 ${
              errorType === 'disabled'
                ? isDark ? 'bg-amber-950/30 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-800'
                : errorType === 'server'
                ? isDark ? 'bg-orange-950/30 border-orange-800 text-orange-200' : 'bg-orange-50 border-orange-300 text-orange-800'
                : isDark ? 'bg-rose-950/30 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-current" />
              <div className="flex-1">
                <p className="font-semibold leading-relaxed">{errorMessage}</p>
                {errorType === 'server' && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetServerToDefault}
                      className="px-2.5 py-1 bg-[#1e3a8a] hover:bg-blue-800 text-white rounded text-[11px] font-semibold flex items-center space-x-1 cursor-pointer shadow-xs transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to Local Server ({apiClient.getDefaultServerUrl()})</span>
                    </button>
                    <button
                      type="button"
                      onClick={checkServerHealth}
                      className="px-2.5 py-1 border border-zinc-400/50 hover:bg-white/10 rounded text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {authMode === 'login' ? (
            <>
              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Username Field */}
                <div>
                  <label htmlFor="login-username" className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Username or Employee ID
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="login-username"
                      type="text"
                      required
                      autoFocus
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      className={`w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border outline-hidden transition ${
                        isDark 
                          ? 'bg-black/50 border-zinc-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                          : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]'
                      }`}
                    />
                  </div>
                </div>

                {/* Password Field with Show/Hide */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="login-password" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowResetGuidance(!showResetGuidance)}
                      className="text-[11px] text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Need Help?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`w-full text-xs pl-9 pr-10 py-2.5 rounded-lg border outline-hidden transition ${
                        isDark 
                          ? 'bg-black/50 border-zinc-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                          : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Username Checkbox */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className={`flex items-center space-x-2 cursor-pointer ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    <input
                      type="checkbox"
                      checked={rememberUsername}
                      onChange={(e) => setRememberUsername(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Remember username on this machine</span>
                  </label>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs shadow-md flex items-center justify-center space-x-2 transition cursor-pointer ${
                    isLoading
                      ? 'bg-zinc-600 cursor-not-allowed opacity-80 text-white'
                      : 'btn-primary active:scale-[0.99]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sign In to Employee Database Studio</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </button>
              </form>

              {/* Password Reset Guidance Box */}
              {showResetGuidance && (
                <div className="mt-4 p-3 rounded-xl border text-[11px] space-y-1 bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-300">
                  <div className="font-bold flex items-center space-x-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Password Reset & Recovery Policy</span>
                  </div>
                  <p>
                    For security on company networks, credentials are managed centrally. If you have forgotten your password or your account is locked, please contact your designated <strong>System Administrator</strong> to issue a temporary password or reset your account in User Management.
                  </p>
                </div>
              )}

              {/* Quick-Fill Demonstration Roles (Convenience for Testing) */}
              <div className={`mt-6 pt-5 border-t text-[11px] ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <span className="block text-zinc-400 font-semibold mb-2">
                  Standard Role Accounts (Testing & Evaluation):
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('admin', 'admin123')}
                    className={`text-left p-2 rounded-lg border text-[10px] hover:border-blue-500 transition cursor-pointer ${
                      isDark ? 'border-zinc-800 bg-black/40 hover:bg-black/60' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="font-bold text-blue-500">Administrator</div>
                    <div className="text-zinc-500 font-mono">admin / admin123</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('hr_lead', 'Password@123')}
                    className={`text-left p-2 rounded-lg border text-[10px] hover:border-emerald-500 transition cursor-pointer ${
                      isDark ? 'border-zinc-800 bg-black/40 hover:bg-black/60' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="font-bold text-emerald-500">HR Specialist</div>
                    <div className="text-zinc-500 font-mono">hr_lead / Password@123</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('payroll_mgr', 'Password@123')}
                    className={`text-left p-2 rounded-lg border text-[10px] hover:border-amber-500 transition cursor-pointer ${
                      isDark ? 'border-zinc-800 bg-black/40 hover:bg-black/60' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="font-bold text-amber-500">Payroll Specialist</div>
                    <div className="text-zinc-500 font-mono">payroll_mgr / Password@123</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('auditor', 'Password@123')}
                    className={`text-left p-2 rounded-lg border text-[10px] hover:border-purple-500 transition cursor-pointer ${
                      isDark ? 'border-zinc-800 bg-black/40 hover:bg-black/60' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="font-bold text-purple-500">Read-Only Auditor</div>
                    <div className="text-zinc-500 font-mono">auditor / Password@123</div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Create Admin Control Account Form */
            <form onSubmit={handleCreateAdminAccount} className="space-y-3.5">
              <div className={`p-3 rounded-xl border text-[11px] flex items-start space-x-2.5 ${
                isDark ? 'bg-blue-950/20 border-blue-900/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                <p className="leading-relaxed">
                  Creates an <strong>Administrator Control Account</strong> with full access to User Management, Server Administration, Payroll, and Company Settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-admin-fullname" className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Full Name
                  </label>
                  <input
                    id="reg-admin-fullname"
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g., Priya Nair"
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-hidden transition ${
                      isDark
                        ? 'bg-black/50 border-zinc-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="reg-admin-username" className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Admin Username
                  </label>
                  <input
                    id="reg-admin-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g., admin_control"
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-hidden transition font-mono ${
                      isDark
                        ? 'bg-black/50 border-zinc-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-admin-email" className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Work Email <span className="text-[10px] font-normal text-zinc-400">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="reg-admin-email"
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="admin.control@company.com"
                    className={`w-full text-xs pl-9 pr-3 py-2 rounded-lg border outline-hidden transition ${
                      isDark
                        ? 'bg-black/50 border-zinc-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-admin-password" className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Password <span className="text-[10px] font-normal text-zinc-400">(min 8 chars)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="reg-admin-password"
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create strong password"
                      className={`w-full text-xs pl-3 pr-9 py-2 rounded-lg border outline-hidden transition ${
                        isDark
                          ? 'bg-black/50 border-zinc-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
                      aria-label={showRegPassword ? 'Hide admin password' : 'Show admin password'}
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-admin-confirm-password" className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Confirm Password
                  </label>
                  <input
                    id="reg-admin-confirm-password"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-hidden transition ${
                      isDark
                        ? 'bg-black/50 border-zinc-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]'
                    }`}
                  />
                </div>
              </div>

              {/* Admin Control Authorization Box when an existing admin or setup key is present */}
              {adminSetupStatus.requiresAuthorization && (
                <div className={`p-3 rounded-xl border space-y-2.5 ${
                  isDark ? 'bg-black/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-200">
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      <span>Admin Control Authorization</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      {!import.meta.env.PROD && adminSetupStatus.hasAdminAccount && !useSetupKeyAuth && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthAdminUsername('admin');
                            setAuthAdminPassword('admin123');
                          }}
                          className="text-[10px] font-semibold text-blue-500 hover:underline cursor-pointer"
                        >
                          Use default admin
                        </button>
                      )}
                      {adminSetupStatus.hasAdminAccount && adminSetupStatus.setupKeyConfigured && (
                        <button
                          type="button"
                          onClick={() => setUseSetupKeyAuth(!useSetupKeyAuth)}
                          className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                        >
                          {useSetupKeyAuth ? 'Use Admin Login' : 'Use Setup Key'}
                        </button>
                      )}
                    </div>
                  </div>

                  {useSetupKeyAuth || !adminSetupStatus.hasAdminAccount ? (
                    <div>
                      <label htmlFor="reg-admin-setup-key" className="block text-[11px] font-medium mb-1 text-zinc-500 dark:text-zinc-400">
                        Admin Setup Key
                      </label>
                      <input
                        id="reg-admin-setup-key"
                        type="password"
                        value={adminSetupKey}
                        onChange={(e) => setAdminSetupKey(e.target.value)}
                        placeholder="Enter server ADMIN_SETUP_KEY"
                        className={`w-full text-xs px-3 py-2 rounded-lg border outline-hidden transition font-mono ${
                          isDark
                            ? 'bg-black/60 border-zinc-700 text-white focus:border-blue-500'
                            : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a]'
                        }`}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="reg-auth-username" className="block text-[11px] font-medium mb-1 text-zinc-500 dark:text-zinc-400">
                          Existing Admin Username
                        </label>
                        <input
                          id="reg-auth-username"
                          type="text"
                          value={authAdminUsername}
                          onChange={(e) => setAuthAdminUsername(e.target.value)}
                          placeholder="admin"
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-hidden transition ${
                            isDark
                              ? 'bg-black/60 border-zinc-700 text-white focus:border-blue-500'
                              : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a]'
                          }`}
                        />
                      </div>
                      <div>
                        <label htmlFor="reg-auth-password" className="block text-[11px] font-medium mb-1 text-zinc-500 dark:text-zinc-400">
                          Existing Admin Password
                        </label>
                        <input
                          id="reg-auth-password"
                          type="password"
                          value={authAdminPassword}
                          onChange={(e) => setAuthAdminPassword(e.target.value)}
                          placeholder="Authorizing password"
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-hidden transition ${
                            isDark
                              ? 'bg-black/60 border-zinc-700 text-white focus:border-blue-500'
                              : 'bg-white border-zinc-300 text-black focus:border-[#1e3a8a]'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs shadow-md flex items-center justify-center space-x-2 transition cursor-pointer ${
                  isLoading
                    ? 'bg-zinc-600 cursor-not-allowed opacity-80 text-white'
                    : 'btn-primary active:scale-[0.99]'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Admin Control Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Admin Control Account</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                >
                  Already have an account? Return to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-6xl mx-auto py-2 text-center text-[11px] text-zinc-500 dark:text-zinc-500">
        Employee Database Studio Enterprise Edition • Central Cloud & Local Data Security
      </div>
    </div>
  );
};
