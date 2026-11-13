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
  ChevronUp
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

  // Load remembered username if saved
  useEffect(() => {
    const saved = localStorage.getItem('peopledesk_remembered_username');
    if (saved) {
      setUsername(saved);
      setRememberUsername(true);
    }
    checkServerHealth();
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
    setUsername(user);
    setPassword(pass);
    setErrorMessage(null);
    setErrorType(null);
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
              Central LAN Multi-User Authentication
            </p>
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

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Field */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                Username or Employee ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <User className="w-4 h-4" />
                </div>
                <input
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
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-6xl mx-auto py-2 text-center text-[11px] text-zinc-500 dark:text-zinc-500">
        Employee Database Studio Enterprise Edition • Central Cloud & Local Data Security
      </div>
    </div>
  );
};
