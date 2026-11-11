import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Upload,
  Save,
  CheckCircle2,
  Database,
  Download,
  RotateCcw,
  Sun,
  Moon,
  Palette,
  FileText,
  Mail,
  Shield,
  CreditCard,
  Eye,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import { CompanySettings } from '../types/payroll';
import { DEFAULT_COMPANY_SETTINGS, localDB } from '../utils/dbStorage';
import { useTheme } from '../context/ThemeContext';
import { BrandColorCustomizer } from './BrandColorCustomizer';

interface SettingsViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
  onDatabaseRestored: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onDatabaseRestored
}) => {
  const { theme, setTheme, isDark } = useTheme();
  const [formData, setFormData] = useState<CompanySettings>({ ...settings });
  const [activeSection, setActiveSection] = useState<'info' | 'branding' | 'payslip' | 'email' | 'signatory' | 'database'>('branding');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // File Inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const darkLogoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleFieldChange = (field: keyof CompanySettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Safe image file reader with validation (max 5MB, format check)
  const readFileAsDataUrl = (file: File, callback: (dataUrl: string) => void) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Invalid file format. Please upload a PNG, JPG, JPEG, SVG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5 MB. Please upload a compressed image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        callback(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) => {
        handleFieldChange('logoDataUrl', dataUrl);
        showToast('Company primary logo uploaded successfully.');
      });
    }
    e.target.value = '';
  };

  const handleDarkLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) => {
        handleFieldChange('logoDarkDataUrl', dataUrl);
        showToast('Dark background logo uploaded successfully.');
      });
    }
    e.target.value = '';
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) => {
        handleFieldChange('companyIconDataUrl', dataUrl);
        showToast('Company icon / favicon uploaded.');
      });
    }
    e.target.value = '';
  };

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) => {
        handleFieldChange('signatureDataUrl', dataUrl);
        showToast('Authorized signature graphic uploaded.');
      });
    }
    e.target.value = '';
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      showToast('Company settings & branding persisted successfully across the application.');
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = async () => {
    const jsonStr = await localDB.exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PeopleDeskStudio_${formData.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Full database backup exported to JSON file.');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Restore all settings and records from "${file.name}"?`)) {
      e.target.value = '';
      return;
    }

    const text = await file.text();
    const result = await localDB.importFullBackup(text);
    if (result.success) {
      onDatabaseRestored();
      showToast(result.message);
    } else {
      alert(result.message);
    }
    e.target.value = '';
  };

  const executeResetDefaults = () => {
    setFormData({ ...DEFAULT_COMPANY_SETTINGS });
    onSaveSettings(DEFAULT_COMPANY_SETTINGS);
    setShowResetConfirmModal(false);
    showToast('Reset all company branding and configuration to defaults.');
  };

  const presetColors = [
    { name: 'PeopleDesk Crimson', hex: '#CB1417' },
    { name: 'Corporate Navy', hex: '#1E3A8A' },
    { name: 'Emerald Forest', hex: '#059669' },
    { name: 'Royal Purple', hex: '#7C3AED' },
    { name: 'Amber Copper', hex: '#D97706' },
    { name: 'Slate Steel', hex: '#475569' }
  ];

  return (
    <div className="space-y-6">
      <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" />
      <input type="file" ref={darkLogoInputRef} onChange={handleDarkLogoUpload} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" />
      <input type="file" ref={iconInputRef} onChange={handleIconUpload} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" />
      <input type="file" ref={sigInputRef} onChange={handleSigUpload} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" />
      <input type="file" ref={backupInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />

      {/* Top Banner */}
      <div className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
        isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
      }`}>
        <div className="flex items-center space-x-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md shrink-0 overflow-hidden"
            style={{ backgroundColor: formData.themeColor || 'var(--brand-primary)' }}
          >
            {formData.logoDataUrl ? (
              <img src={formData.logoDataUrl} alt="Logo" className="w-full h-full object-contain p-1 bg-white" />
            ) : (
              <span>{formData.companyName ? formData.companyName.slice(0, 2).toUpperCase() : 'CO'}</span>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: formData.themeColor || 'var(--brand-primary)' }}>
              <Building2 className="w-4 h-4" />
              <span>Commercial White-Label & Corporate Identity</span>
            </div>
            <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
              Company Settings & Brand Customization
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Customize company logos, brand palettes, payslip templates, email signatures, and currency rules.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowResetConfirmModal(true)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center space-x-1.5 ${
              isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-600'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-2 px-4 py-2 btn-primary rounded-lg text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border animate-in fade-in ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Sub-sections */}
      <div className={`flex items-center space-x-1 border-b pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {[
          { id: 'branding', label: 'Brand & Logo Assets', icon: Palette },
          { id: 'info', label: 'Company Information', icon: Building2 },
          { id: 'payslip', label: 'Payslip Layout & Header', icon: FileText },
          { id: 'email', label: 'Email Templates', icon: Mail },
          { id: 'signatory', label: 'Currency & Signatory', icon: CreditCard },
          { id: 'database', label: 'Database Backup & Storage', icon: Database }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'text-white shadow-sm font-bold'
                  : isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-[#141416]'
                  : 'text-zinc-600 hover:text-black hover:bg-[#F4F4F6]'
              }`}
              style={isActive ? { backgroundColor: formData.themeColor || 'var(--brand-primary)' } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid: Main Form Controls & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Section Form */}
        <div className="lg:col-span-2 space-y-6">

          {/* SECTION B: BRAND & LOGO ASSETS */}
          {activeSection === 'branding' && (
            <div className={`border rounded-xl p-5 space-y-5 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Corporate Palette & Logo Assets</h3>
                <p className="text-zinc-500">Define your company's primary, secondary, and accent colors, plus logo assets.</p>
              </div>

              {/* Theme Mode Toggle */}
              <div>
                <label className="font-semibold block mb-2">Desktop Application Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center space-x-2.5 p-3 rounded-xl border-2 transition cursor-pointer ${
                      theme === 'light' ? 'border-brand-primary bg-brand-primary/10 text-black font-bold' : isDark ? 'border-zinc-800 bg-zinc-950 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Light Mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center space-x-2.5 p-3 rounded-xl border-2 transition cursor-pointer ${
                      theme === 'dark' ? 'border-brand-primary bg-brand-primary/20 text-white font-bold' : isDark ? 'border-zinc-800 bg-zinc-950 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-blue-400" />
                    <span>Dark Mode</span>
                  </button>
                </div>
              </div>

              {/* Complete Global Brand Color System */}
              <div className="pt-2">
                <BrandColorCustomizer
                  settings={formData}
                  isSaving={isSaving}
                  onSave={async (updatedColors) => {
                    const merged = { ...formData, ...updatedColors };
                    setFormData(merged);
                    setIsSaving(true);
                    try {
                      await onSaveSettings(merged);
                      showToast('Brand color customizations saved successfully.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                />
              </div>

              {/* Logo Management Section */}
              <div className="border-t pt-4 dark:border-zinc-800 border-zinc-200 space-y-4">
                <h4 className="font-bold">Official Company Logos</h4>

                {/* Primary Logo */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl border flex items-center justify-center p-1 bg-white overflow-hidden shadow-xs">
                      {formData.logoDataUrl ? (
                        <img src={formData.logoDataUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Building2 className="w-8 h-8 text-zinc-400" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-xs">Primary Company Logo</h5>
                      <p className="text-[11px] text-zinc-500">Used for Payslip PDF header, dashboard, and reports (PNG/JPG/SVG).</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {formData.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('logoDataUrl', undefined)}
                        className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className={`px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center space-x-1 cursor-pointer ${
                        isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{formData.logoDataUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                    </button>
                  </div>
                </div>

                {/* Optional Alternate Dark Logo */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl border flex items-center justify-center p-1 bg-zinc-900 border-zinc-800 overflow-hidden shadow-xs">
                      {formData.logoDarkDataUrl ? (
                        <img src={formData.logoDarkDataUrl} alt="Dark Logo Preview" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Building2 className="w-8 h-8 text-zinc-600" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-xs">Alternate Logo for Dark Backgrounds</h5>
                      <p className="text-[11px] text-zinc-500">Optional white or light emblem for dark UI theme and banners.</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {formData.logoDarkDataUrl && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('logoDarkDataUrl', undefined)}
                        className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => darkLogoInputRef.current?.click()}
                      className={`px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center space-x-1 cursor-pointer ${
                        isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{formData.logoDarkDataUrl ? 'Replace Dark Logo' : 'Upload Dark Logo'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION A: COMPANY INFORMATION */}
          {activeSection === 'info' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Corporate Information & Legal Address</h3>
                <p className="text-zinc-500">Official legal entity details displayed on payslips and company reports.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="font-semibold block mb-1">Company / Organization Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => handleFieldChange('companyName', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={formData.addressLine1}
                      onChange={(e) => handleFieldChange('addressLine1', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={formData.addressLine2}
                      onChange={(e) => handleFieldChange('addressLine2', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">City, State, Zip / Postal Code</label>
                    <input
                      type="text"
                      value={formData.cityStateZip}
                      onChange={(e) => handleFieldChange('cityStateZip', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Tax / Registration ID (EIN / GSTIN / CIN)</label>
                    <input
                      type="text"
                      value={formData.taxRegistrationNumber}
                      onChange={(e) => handleFieldChange('taxRegistrationNumber', e.target.value)}
                      className={`w-full rounded px-3 py-2 font-mono border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Official Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Telephone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Website URL</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => handleFieldChange('website', e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION C: PAYSLIP BRANDING */}
          {activeSection === 'payslip' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Payslip Header & Visibility Branding</h3>
                <p className="text-zinc-500">Configure how company branding elements are laid out on generated PDF payslips.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer dark:border-zinc-800 border-zinc-200">
                  <input
                    type="checkbox"
                    checked={formData.showLogoOnPayslip ?? true}
                    onChange={(e) => handleFieldChange('showLogoOnPayslip', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">Show Logo on Payslip Header</span>
                    <span className="text-[11px] text-zinc-500">Display primary logo in the top-left/center</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer dark:border-zinc-800 border-zinc-200">
                  <input
                    type="checkbox"
                    checked={formData.showCompanyNameOnPayslip ?? true}
                    onChange={(e) => handleFieldChange('showCompanyNameOnPayslip', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">Show Company Name</span>
                    <span className="text-[11px] text-zinc-500">Display full legal company title</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer dark:border-zinc-800 border-zinc-200">
                  <input
                    type="checkbox"
                    checked={formData.showAddressOnPayslip ?? true}
                    onChange={(e) => handleFieldChange('showAddressOnPayslip', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">Show Official Address</span>
                    <span className="text-[11px] text-zinc-500">Include street and city in header</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-lg border cursor-pointer dark:border-zinc-800 border-zinc-200">
                  <input
                    type="checkbox"
                    checked={formData.showContactOnPayslip ?? true}
                    onChange={(e) => handleFieldChange('showContactOnPayslip', e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">Show Contact Details</span>
                    <span className="text-[11px] text-zinc-500">Email, phone, and website</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="font-semibold block mb-1.5">Header Layout Alignment</label>
                <div className="grid grid-cols-3 gap-3">
                  {['left', 'center', 'right'].map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => handleFieldChange('payslipHeaderAlignment', align)}
                      className={`p-2.5 rounded-lg border font-bold capitalize transition cursor-pointer ${
                        (formData.payslipHeaderAlignment || 'left') === align
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-black'
                          : isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      {align} Alignment
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Payslip Footer Disclaimer / Confidentiality Notice</label>
                <textarea
                  rows={2}
                  value={formData.payslipFooterInfo || formData.payslipNote}
                  onChange={(e) => {
                    handleFieldChange('payslipFooterInfo', e.target.value);
                    handleFieldChange('payslipNote', e.target.value);
                  }}
                  className={`w-full rounded p-2.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>
          )}

          {/* SECTION D: EMAIL BRANDING */}
          {activeSection === 'email' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Email Delivery Branding</h3>
                <p className="text-zinc-500">Branded header, sender display name, and footer notes for payslip emails.</p>
              </div>

              <div>
                <label className="font-semibold block mb-1">Email Sender Display Name</label>
                <input
                  type="text"
                  value={formData.emailDisplayName || `${formData.companyName} Payroll`}
                  onChange={(e) => handleFieldChange('emailDisplayName', e.target.value)}
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Email Custom Signature</label>
                <textarea
                  rows={3}
                  value={formData.emailSignature || 'Human Resources & Payroll Operations Team'}
                  onChange={(e) => handleFieldChange('emailSignature', e.target.value)}
                  className={`w-full rounded p-2.5 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Email Footer Copyright Text</label>
                <input
                  type="text"
                  value={formData.emailFooterText || `© ${formData.companyName}. All rights reserved.`}
                  onChange={(e) => handleFieldChange('emailFooterText', e.target.value)}
                  className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                />
              </div>
            </div>
          )}

          {/* SECTION E: CURRENCY & SIGNATORY */}
          {activeSection === 'signatory' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Currency Configuration & Authorized Signatory</h3>
                <p className="text-zinc-500">Select currency formats and upload authorized digital signature graphics.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-1">Currency Symbol</label>
                  <select
                    value={formData.currencySymbol}
                    onChange={(e) => {
                      const sym = e.target.value;
                      let name = 'USD';
                      if (sym === '₹') name = 'INR';
                      else if (sym === '€') name = 'EUR';
                      else if (sym === '£') name = 'GBP';
                      else if (sym === 'AED') name = 'AED';
                      else if (sym === 'CAD$') name = 'CAD';
                      else if (sym === 'A$') name = 'AUD';
                      setFormData(prev => ({ ...prev, currencySymbol: sym, currencyName: name }));
                    }}
                    className={`w-full rounded px-3 py-2 font-mono border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  >
                    <option value="$">USD ($) - US Dollars</option>
                    <option value="₹">INR (₹) - Indian Rupees</option>
                    <option value="€">EUR (€) - Euros</option>
                    <option value="£">GBP (£) - British Pounds</option>
                    <option value="CAD$">CAD ($) - Canadian Dollars</option>
                    <option value="A$">AUD ($) - Australian Dollars</option>
                    <option value="AED">AED (AED) - UAE Dirhams</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Currency Name (Used for In Words)</label>
                  <input
                    type="text"
                    value={formData.currencyName}
                    onChange={(e) => handleFieldChange('currencyName', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div className="sm:col-span-2 flex items-center space-x-2.5">
                  <input
                    type="checkbox"
                    id="showCurrencySymbolSetting"
                    checked={formData.showCurrencySymbol ?? true}
                    onChange={(e) => handleFieldChange('showCurrencySymbol', e.target.checked)}
                    className="w-4 h-4 rounded text-[#CB1417] focus:ring-[#CB1417] cursor-pointer"
                  />
                  <label htmlFor="showCurrencySymbolSetting" className="font-semibold cursor-pointer">
                    Show currency symbol on payslips (e.g. ₹ 25,000.00 vs 25,000.00)
                  </label>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Authorized Signatory Name</label>
                  <input
                    type="text"
                    value={formData.authorizedSignatoryName}
                    onChange={(e) => handleFieldChange('authorizedSignatoryName', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Signatory Title / Designation</label>
                  <input
                    type="text"
                    value={formData.authorizedSignatoryTitle}
                    onChange={(e) => handleFieldChange('authorizedSignatoryTitle', e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'}`}
                  />
                </div>
              </div>

              {/* Signature Graphic Card */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="flex items-center space-x-4">
                  <div className="w-24 h-12 rounded border flex items-center justify-center p-1 bg-white overflow-hidden shadow-xs">
                    {formData.signatureDataUrl ? (
                      <img src={formData.signatureDataUrl} alt="Signature Preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-zinc-400">No Signature</span>
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs">Official Digital Signature Graphic</h5>
                    <p className="text-[11px] text-zinc-500">Transparent PNG recommended. Rendered on payslip footer.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {formData.signatureDataUrl && (
                    <button
                      type="button"
                      onClick={() => handleFieldChange('signatureDataUrl', undefined)}
                      className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => sigInputRef.current?.click()}
                    className={`px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center space-x-1 cursor-pointer ${
                      isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Upload Signature</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION F: DATABASE & BACKUP */}
          {activeSection === 'database' && (
            <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="border-b pb-3 dark:border-zinc-800 border-zinc-200">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Local Database & Disaster Recovery</h3>
                <p className="text-zinc-500">Export or restore full database JSON archives.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <Download className="w-6 h-6 text-[#CB1417]" />
                  <h4 className="font-bold text-xs">Export Complete Backup</h4>
                  <p className="text-[11px] text-zinc-500">Exports all employee master records, documents, payroll batch, and company settings.</p>
                  <button
                    onClick={handleExportBackup}
                    className="w-full py-2 bg-[#CB1417] text-white rounded font-bold cursor-pointer hover:bg-[#ED1F24]"
                  >
                    Download Backup JSON
                  </button>
                </div>

                <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <Upload className="w-6 h-6 text-emerald-500" />
                  <h4 className="font-bold text-xs">Restore from Backup Archive</h4>
                  <p className="text-[11px] text-zinc-500">Imports previous backup JSON file into current workspace.</p>
                  <button
                    onClick={() => backupInputRef.current?.click()}
                    className={`w-full py-2 rounded font-bold border cursor-pointer ${
                      isDark ? 'border-zinc-800 hover:bg-zinc-800 text-white' : 'border-zinc-300 hover:bg-zinc-100 text-black'
                    }`}
                  >
                    Select Backup File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Live Real-Time Brand Preview */}
        <div className="space-y-6">
          <div className={`border rounded-xl p-5 space-y-4 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex items-center justify-between border-b pb-2 dark:border-zinc-800 border-zinc-200">
              <h4 className="font-bold flex items-center space-x-1.5">
                <Eye className="w-4 h-4 text-[#CB1417]" />
                <span>Live Brand Card Preview</span>
              </h4>
              <span className="text-[10px] font-mono text-emerald-500 font-bold">Real-Time</span>
            </div>

            {/* Mini Brand Banner */}
            <div
              className="p-4 rounded-xl text-white shadow-md transition-colors"
              style={{ backgroundColor: formData.themeColor || '#CB1417' }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                  {formData.logoDataUrl ? (
                    <img src={formData.logoDataUrl} alt="Preview Logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="font-bold text-black text-xs">{formData.companyName.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="truncate">
                  <h5 className="font-bold text-sm truncate">{formData.companyName || 'Your Company Name'}</h5>
                  <p className="text-[11px] opacity-90 truncate">{formData.cityStateZip || 'City, State, Zip'}</p>
                </div>
              </div>
            </div>

            {/* Mini Payslip Header Preview */}
            <div className="p-3 rounded-lg border border-zinc-300 bg-white text-black font-sans text-[11px] space-y-2">
              <div className={`flex items-center justify-between border-b pb-2 ${formData.payslipHeaderAlignment === 'center' ? 'flex-col text-center' : formData.payslipHeaderAlignment === 'right' ? 'flex-col items-end text-right' : ''}`}>
                <div className="flex items-center space-x-2">
                  {(formData.showLogoOnPayslip ?? true) && (
                    <div className="w-7 h-7 rounded border bg-zinc-100 flex items-center justify-center overflow-hidden">
                      {formData.logoDataUrl ? (
                        <img src={formData.logoDataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="font-bold text-[10px] text-zinc-500">{formData.companyName.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                  )}
                  <div>
                    {(formData.showCompanyNameOnPayslip ?? true) && (
                      <h6 className="font-bold text-xs">{formData.companyName}</h6>
                    )}
                    {(formData.showAddressOnPayslip ?? true) && (
                      <p className="text-[9px] text-zinc-500">{formData.cityStateZip}</p>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="py-1 px-2 rounded text-white font-bold text-[9px] text-center"
                style={{ backgroundColor: formData.themeColor || '#CB1417' }}
              >
                PAYSLIP HEADER BRAND COLOR
              </div>

              <div className="text-[10px] text-zinc-600 space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Currency Display:</span>
                  <span className="font-bold font-mono">
                    {formData.showCurrencySymbol ? `${formData.currencySymbol} 50,000.00` : '50,000.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Signatory:</span>
                  <span className="font-semibold">{formData.authorizedSignatoryName || 'HR Director'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Resetting Defaults */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center space-x-3 text-red-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">Reset Company Settings?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Are you sure you want to reset all company information, branding palette, and payslip settings to default configuration?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-300 hover:bg-zinc-100'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetDefaults}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
