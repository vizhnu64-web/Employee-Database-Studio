import React, { useState, useEffect } from 'react';
import {
  Palette,
  Check,
  RotateCcw,
  Save,
  CheckCircle2,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  MousePointerClick,
  Monitor,
  Layout,
  Tag,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  BrandColors,
  DEFAULT_BRAND_COLORS,
  PRESET_BRAND_PALETTES,
  isValidHex,
  getContrastTextColor,
  shadeColor,
  resolveBrandTokens
} from '../utils/brandColors';
import { CompanySettings } from '../types/payroll';

interface BrandColorCustomizerProps {
  settings: CompanySettings;
  onSave: (updated: Partial<CompanySettings>) => Promise<void> | void;
  isSaving?: boolean;
}

export const BrandColorCustomizer: React.FC<BrandColorCustomizerProps> = ({
  settings,
  onSave,
  isSaving = false
}) => {
  const { isDark, previewBrandColors, resetBrandColors } = useTheme();

  // Initial brand colors state from settings or defaults
  const getInitialColors = (): BrandColors => {
    return {
      primary: settings.themeColor || DEFAULT_BRAND_COLORS.primary,
      secondary: settings.secondaryColor || DEFAULT_BRAND_COLORS.secondary,
      accent: settings.accentColor || DEFAULT_BRAND_COLORS.accent,
      buttons: {
        ...DEFAULT_BRAND_COLORS.buttons,
        ...(settings.buttonColors || settings.brandColors?.buttons || {})
      },
      surfaces: {
        ...DEFAULT_BRAND_COLORS.surfaces,
        ...(settings.surfaceColors || settings.brandColors?.surfaces || {})
      }
    };
  };

  const [colors, setColors] = useState<BrandColors>(getInitialColors);
  const [lastSavedColors, setLastSavedColors] = useState<BrandColors>(getInitialColors);
  const [showSurfaces, setShowSurfaces] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync when parent settings change
  useEffect(() => {
    const initial = getInitialColors();
    setColors(initial);
    setLastSavedColors(initial);
  }, [settings]);

  // Compute live tokens for the preview card
  const previewTokens = resolveBrandTokens(colors, isDark);

  // Handle immediate preview on any color change
  const handleColorChange = (updater: (prev: BrandColors) => BrandColors) => {
    setColors(prev => {
      const next = updater(prev);
      previewBrandColors(next);
      return next;
    });
    setValidationError(null);
  };

  const setPrimary = (hex: string) => {
    handleColorChange(prev => ({
      ...prev,
      primary: hex,
      buttons: {
        ...prev.buttons,
        primaryBg: prev.buttons?.customButtonsEnabled ? prev.buttons.primaryBg : hex,
        primaryBorder: prev.buttons?.customButtonsEnabled ? prev.buttons.primaryBorder : hex,
        primaryHover: prev.buttons?.customButtonsEnabled ? prev.buttons.primaryHover : shadeColor(hex, -15),
        primaryText: prev.buttons?.customButtonsEnabled ? prev.buttons.primaryText : getContrastTextColor(hex),
        outlineText: prev.buttons?.customButtonsEnabled ? prev.buttons.outlineText : hex,
        outlineBorder: prev.buttons?.customButtonsEnabled ? prev.buttons.outlineBorder : hex
      }
    }));
  };

  const setSecondary = (hex: string) => {
    handleColorChange(prev => ({
      ...prev,
      secondary: hex,
      buttons: {
        ...prev.buttons,
        secondaryBg: prev.buttons?.customButtonsEnabled ? prev.buttons.secondaryBg : hex,
        secondaryBorder: prev.buttons?.customButtonsEnabled ? prev.buttons.secondaryBorder : hex,
        secondaryHover: prev.buttons?.customButtonsEnabled ? prev.buttons.secondaryHover : shadeColor(hex, -15),
        secondaryText: prev.buttons?.customButtonsEnabled ? prev.buttons.secondaryText : getContrastTextColor(hex)
      }
    }));
  };

  const setAccent = (hex: string) => {
    handleColorChange(prev => ({
      ...prev,
      accent: hex
    }));
  };

  const handleApplyPreset = (preset: typeof PRESET_BRAND_PALETTES[0]) => {
    handleColorChange(prev => ({
      ...prev,
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      buttons: {
        ...prev.buttons,
        primaryBg: preset.primary,
        primaryBorder: preset.primary,
        primaryHover: shadeColor(preset.primary, -15),
        primaryText: getContrastTextColor(preset.primary),
        secondaryBg: preset.secondary,
        secondaryBorder: preset.secondary,
        secondaryHover: shadeColor(preset.secondary, -15),
        secondaryText: getContrastTextColor(preset.secondary),
        outlineText: preset.primary,
        outlineBorder: preset.primary
      }
    }));
    showToast(`Applied preset: ${preset.name}`);
  };

  const handleSave = async () => {
    // Validate main colors
    if (!isValidHex(colors.primary)) {
      setValidationError('Primary brand color must be a valid hex code (e.g. #1e3a8a).');
      return;
    }
    if (!isValidHex(colors.secondary)) {
      setValidationError('Secondary brand color must be a valid hex code (e.g. #475569).');
      return;
    }
    if (!isValidHex(colors.accent)) {
      setValidationError('Accent color must be a valid hex code (e.g. #d97706).');
      return;
    }

    setValidationError(null);
    try {
      await onSave({
        themeColor: colors.primary,
        secondaryColor: colors.secondary,
        accentColor: colors.accent,
        brandColors: colors,
        buttonColors: colors.buttons,
        surfaceColors: colors.surfaces
      });
      setLastSavedColors(colors);
      showToast('Brand color customizations saved successfully to company database.');
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save brand settings.');
    }
  };

  const handleRevert = () => {
    setColors(lastSavedColors);
    previewBrandColors(lastSavedColors);
    showToast('Reverted to last saved color configuration.');
  };

  const handleResetDefaults = () => {
    setColors(DEFAULT_BRAND_COLORS);
    resetBrandColors();
    showToast('Reset to enterprise default brand colors.');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border animate-in fade-in slide-in-from-top-1 ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Validation Error Banner */}
      {validationError && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-rose-950/40 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Main Grid: Controls (Left) vs Live Interactive Preview (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Color Controls (7 cols) */}
        <div className="xl:col-span-7 space-y-6">
          {/* Quick Palette Presets */}
          <div className={`p-4 rounded-xl border text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand-accent" />
              <h4 className="font-bold text-xs">Curated Enterprise Palettes</h4>
              <span className="text-[10px] text-zinc-500 font-mono">(1-Click Apply)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_BRAND_PALETTES.map((preset) => {
                const isSelected = colors.primary.toLowerCase() === preset.primary.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-brand-primary ring-1 ring-brand-primary bg-brand-primary/10'
                        : isDark
                        ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60'
                        : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                    }`}
                  >
                    <span className="font-semibold text-[11px] truncate mb-1.5">{preset.name}</span>
                    <div className="flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full border border-black/20 shadow-2xs" style={{ backgroundColor: preset.primary }} />
                      <span className="w-4 h-4 rounded-full border border-black/20 shadow-2xs" style={{ backgroundColor: preset.secondary }} />
                      <span className="w-4 h-4 rounded-full border border-black/20 shadow-2xs" style={{ backgroundColor: preset.accent }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core Brand Colors Card */}
          <div className={`p-5 rounded-xl border space-y-5 text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <div className="flex items-center space-x-2 border-b pb-3 dark:border-zinc-800 border-zinc-200">
              <Palette className="w-4 h-4 text-brand-primary" />
              <div>
                <h3 className="font-bold text-sm">Core Brand Color Architecture</h3>
                <p className="text-[11px] text-zinc-500">Global tokens governing actions, navigation, highlights, and status.</p>
              </div>
            </div>

            {/* A. PRIMARY BRAND COLOUR */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold block text-xs flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
                    <span>A. Primary Brand Colour</span>
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Controls primary buttons, save actions, active sidebar tabs, highlights, and focus indicators.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold" style={{
                  backgroundColor: colors.primary,
                  color: getContrastTextColor(colors.primary)
                }}>
                  {getContrastTextColor(colors.primary) === '#FFFFFF' ? 'Dark Fill' : 'Light Fill'}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={colors.primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={colors.primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  placeholder="#1e3a8a"
                  className={`px-3 py-2 font-mono uppercase font-bold rounded border w-36 ${
                    isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'
                  }`}
                />
                <div className="flex-1 h-9 rounded-lg border flex items-center px-3 font-semibold text-xs shadow-xs" style={{
                  backgroundColor: colors.primary,
                  color: getContrastTextColor(colors.primary),
                  borderColor: shadeColor(colors.primary, -15)
                }}>
                  Sample Primary State
                </div>
              </div>
            </div>

            {/* B. SECONDARY BRAND COLOUR */}
            <div className="space-y-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold block text-xs flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.secondary }} />
                    <span>B. Secondary Brand Colour</span>
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Controls secondary buttons, supporting navigation accents, badges, and secondary borders.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold" style={{
                  backgroundColor: colors.secondary,
                  color: getContrastTextColor(colors.secondary)
                }}>
                  {getContrastTextColor(colors.secondary) === '#FFFFFF' ? 'Dark Fill' : 'Light Fill'}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={colors.secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={colors.secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  placeholder="#475569"
                  className={`px-3 py-2 font-mono uppercase font-bold rounded border w-36 ${
                    isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'
                  }`}
                />
                <div className="flex-1 h-9 rounded-lg border flex items-center px-3 font-semibold text-xs shadow-xs" style={{
                  backgroundColor: colors.secondary,
                  color: getContrastTextColor(colors.secondary),
                  borderColor: shadeColor(colors.secondary, -15)
                }}>
                  Sample Secondary State
                </div>
              </div>
            </div>

            {/* C. ACCENT COLOUR */}
            <div className="space-y-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold block text-xs flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.accent }} />
                    <span>C. Accent Highlight Colour</span>
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Controls highlighted icons, decorative accents, important labels, metrics, and special status.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold" style={{
                  backgroundColor: colors.accent,
                  color: getContrastTextColor(colors.accent)
                }}>
                  {getContrastTextColor(colors.accent) === '#FFFFFF' ? 'Dark Fill' : 'Light Fill'}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={colors.accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={colors.accent}
                  onChange={(e) => setAccent(e.target.value)}
                  placeholder="#d97706"
                  className={`px-3 py-2 font-mono uppercase font-bold rounded border w-36 ${
                    isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-300 text-black'
                  }`}
                />
                <div className="flex-1 h-9 rounded-lg border flex items-center px-3 font-semibold text-xs shadow-xs" style={{
                  backgroundColor: colors.accent,
                  color: getContrastTextColor(colors.accent),
                  borderColor: shadeColor(colors.accent, -15)
                }}>
                  Sample Accent State
                </div>
              </div>
            </div>
          </div>

          {/* D. APPLICATION BACKGROUND & SURFACE COLOURS (Collapsible) */}
          <div className={`rounded-xl border overflow-hidden transition-all text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <button
              type="button"
              onClick={() => setShowSurfaces(!showSurfaces)}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-500/5 transition cursor-pointer text-left"
            >
              <div className="flex items-center space-x-2.5">
                <Layers className="w-4 h-4 text-brand-secondary" />
                <div>
                  <h4 className="font-bold text-xs">D. Application Surfaces & Background Colours</h4>
                  <p className="text-[11px] text-zinc-500">
                    {colors.surfaces?.customSurfacesEnabled
                      ? 'Custom surface overrides active.'
                      : 'Inheriting clean theme surfaces (click to customize).'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  colors.surfaces?.customSurfacesEnabled ? 'bg-brand-primary/20 text-brand-primary' : 'bg-zinc-500/10 text-zinc-400'
                }`}>
                  {colors.surfaces?.customSurfacesEnabled ? 'Custom Overrides' : 'Theme Default'}
                </span>
                {showSurfaces ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </div>
            </button>

            {showSurfaces && (
              <div className="p-4 border-t dark:border-zinc-800 border-zinc-200 space-y-4 bg-zinc-50/50 dark:bg-black/20">
                <div className="flex items-center justify-between p-2.5 rounded-lg border dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black">
                  <div>
                    <span className="font-bold text-xs block">Enable Custom Surface Overrides</span>
                    <span className="text-[11px] text-zinc-500">Override default app backgrounds and text colors.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!colors.surfaces?.customSurfacesEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      handleColorChange(prev => ({
                        ...prev,
                        surfaces: {
                          ...prev.surfaces,
                          customSurfacesEnabled: enabled
                        }
                      }));
                    }}
                    className="w-4 h-4 accent-brand-primary rounded cursor-pointer"
                  />
                </div>

                {colors.surfaces?.customSurfacesEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      { key: 'appBackground', label: 'Main App Background', def: isDark ? '#000000' : '#F4F4F6' },
                      { key: 'sidebarBackground', label: 'Sidebar Background', def: isDark ? '#09090B' : '#FFFFFF' },
                      { key: 'headerBackground', label: 'Header Background', def: isDark ? '#0D0D0E' : '#FFFFFF' },
                      { key: 'cardBackground', label: 'Card Surface', def: isDark ? '#0D0D0E' : '#FFFFFF' },
                      { key: 'panelBackground', label: 'Panel Surface', def: isDark ? '#141416' : '#FAFAFC' },
                      { key: 'inputBackground', label: 'Input Background', def: isDark ? '#000000' : '#FFFFFF' },
                      { key: 'modalBackground', label: 'Modal Background', def: isDark ? '#121214' : '#FFFFFF' },
                      { key: 'borderColor', label: 'Border Colour', def: isDark ? '#27272A' : '#E4E4E7' },
                      { key: 'textPrimary', label: 'Primary Text', def: isDark ? '#FFFFFF' : '#09090B' },
                      { key: 'textSecondary', label: 'Secondary Text', def: isDark ? '#A1A1AA' : '#71717A' }
                    ].map(item => {
                      const val = (colors.surfaces as any)?.[item.key] || item.def;
                      return (
                        <div key={item.key} className="p-2.5 rounded-lg border dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black">
                          <label className="font-semibold block text-[11px] mb-1">{item.label}</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={val}
                              onChange={(e) => {
                                const newHex = e.target.value;
                                handleColorChange(prev => ({
                                  ...prev,
                                  surfaces: {
                                    ...prev.surfaces,
                                    [item.key]: newHex
                                  }
                                }));
                              }}
                              className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => {
                                const newHex = e.target.value;
                                handleColorChange(prev => ({
                                  ...prev,
                                  surfaces: {
                                    ...prev.surfaces,
                                    [item.key]: newHex
                                  }
                                }));
                              }}
                              className={`flex-1 px-2 py-1 font-mono text-[11px] rounded border ${
                                isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-black'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* E. BUTTON COLOUR CUSTOMIZATION (Collapsible) */}
          <div className={`rounded-xl border overflow-hidden transition-all text-xs ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'}`}>
            <button
              type="button"
              onClick={() => setShowButtons(!showButtons)}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-500/5 transition cursor-pointer text-left"
            >
              <div className="flex items-center space-x-2.5">
                <MousePointerClick className="w-4 h-4 text-brand-primary" />
                <div>
                  <h4 className="font-bold text-xs">E. Button Colour Customization</h4>
                  <p className="text-[11px] text-zinc-500">
                    {colors.buttons?.customButtonsEnabled
                      ? 'Custom button overrides active.'
                      : 'Inheriting brand primary and secondary by default.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  colors.buttons?.customButtonsEnabled ? 'bg-brand-primary/20 text-brand-primary' : 'bg-zinc-500/10 text-zinc-400'
                }`}>
                  {colors.buttons?.customButtonsEnabled ? 'Custom Overrides' : 'Inherited'}
                </span>
                {showButtons ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </div>
            </button>

            {showButtons && (
              <div className="p-4 border-t dark:border-zinc-800 border-zinc-200 space-y-4 bg-zinc-50/50 dark:bg-black/20">
                <div className="flex items-center justify-between p-2.5 rounded-lg border dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black">
                  <div>
                    <span className="font-bold text-xs block">Override Default Button Inheritance</span>
                    <span className="text-[11px] text-zinc-500">Customize distinct background, text, hover and border colours.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!colors.buttons?.customButtonsEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      handleColorChange(prev => ({
                        ...prev,
                        buttons: {
                          ...prev.buttons,
                          customButtonsEnabled: enabled
                        }
                      }));
                    }}
                    className="w-4 h-4 accent-brand-primary rounded cursor-pointer"
                  />
                </div>

                {colors.buttons?.customButtonsEnabled && (
                  <div className="space-y-4 pt-1">
                    {/* Primary Button Customization */}
                    <div className="p-3 rounded-lg border dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black space-y-3">
                      <span className="font-bold text-xs flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.buttons?.primaryBg || colors.primary }} />
                        <span>Primary Action Button</span>
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-0.5">Background</label>
                          <input
                            type="color"
                            value={colors.buttons?.primaryBg || colors.primary}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, primaryBg: val }
                              }));
                            }}
                            className="w-full h-7 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-0.5">Text Colour</label>
                          <input
                            type="color"
                            value={colors.buttons?.primaryText || '#FFFFFF'}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, primaryText: val }
                              }));
                            }}
                            className="w-full h-7 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-0.5">Hover Shade</label>
                          <input
                            type="color"
                            value={colors.buttons?.primaryHover || shadeColor(colors.primary, -15)}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, primaryHover: val }
                              }));
                            }}
                            className="w-full h-7 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-0.5">Border Colour</label>
                          <input
                            type="color"
                            value={colors.buttons?.primaryBorder || colors.primary}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, primaryBorder: val }
                              }));
                            }}
                            className="w-full h-7 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Secondary Button Customization */}
                    <div className="p-3 rounded-lg border dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black space-y-3">
                      <span className="font-bold text-xs flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.buttons?.secondaryBg || colors.secondary }} />
                        <span>Secondary Action Button</span>
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-0.5">Background</label>
                          <input
                            type="color"
                            value={colors.buttons?.secondaryBg || colors.secondary}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, secondaryBg: val }
                              }));
                            }}
                            className="w-full h-7 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-0.5">Text Colour</label>
                          <input
                            type="color"
                            value={colors.buttons?.secondaryText || '#FFFFFF'}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, secondaryText: val }
                              }));
                            }}
                            className="w-full h-7 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-0.5">Hover Shade</label>
                          <input
                            type="color"
                            value={colors.buttons?.secondaryHover || shadeColor(colors.secondary, -15)}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, secondaryHover: val }
                              }));
                            }}
                            className="w-full h-7 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-0.5">Border Colour</label>
                          <input
                            type="color"
                            value={colors.buttons?.secondaryBorder || colors.secondary}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, secondaryBorder: val }
                              }));
                            }}
                            className="w-full h-7 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Semantic Buttons (Danger, Success, Outline) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-2.5 rounded-lg border dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black">
                        <span className="font-bold text-[11px] block mb-1">Danger Button</span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={colors.buttons?.dangerBg || '#dc2626'}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, dangerBg: val, dangerHover: shadeColor(val, -15) }
                              }));
                            }}
                            className="w-7 h-7 rounded cursor-pointer"
                          />
                          <span className="font-mono text-[10px]">{colors.buttons?.dangerBg || '#dc2626'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg border dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black">
                        <span className="font-bold text-[11px] block mb-1">Success Button</span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={colors.buttons?.successBg || '#16a34a'}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, successBg: val }
                              }));
                            }}
                            className="w-7 h-7 rounded cursor-pointer"
                          />
                          <span className="font-mono text-[10px]">{colors.buttons?.successBg || '#16a34a'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg border dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black">
                        <span className="font-bold text-[11px] block mb-1">Outline Border</span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={colors.buttons?.outlineBorder || colors.primary}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, outlineBorder: val, outlineText: val }
                              }));
                            }}
                            className="w-7 h-7 rounded cursor-pointer"
                          />
                          <span className="font-mono text-[10px]">{colors.buttons?.outlineBorder || colors.primary}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleRevert}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                <span>Revert Changes</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50 btn-primary"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Branding...' : 'Save Branding'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Application Preview (5 cols, sticky) */}
        <div className="xl:col-span-5 sticky top-6 space-y-4">
          <div className={`p-5 rounded-xl border space-y-4 text-xs shadow-lg transition-all ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'
          }`}>
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-zinc-800 border-zinc-200">
              <div className="flex items-center space-x-2">
                <Monitor className="w-4 h-4 text-brand-primary" />
                <h4 className="font-bold text-xs">Live Brand Preview</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Real-Time Updates
              </span>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Every colour change updates this preview card and the entire Employee Database Studio interface instantly.
            </p>

            {/* Preview Section 1: Buttons Showcase */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Interactive Buttons
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1.5 btn-primary"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Primary Action</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer btn-secondary"
                >
                  <span>Secondary Action</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer btn-outline"
                >
                  <span>Outline Button</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer btn-danger"
                >
                  <span>Danger Action</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer btn-success"
                >
                  <span>Success Action</span>
                </button>
              </div>
            </div>

            {/* Preview Section 2: Sidebar Navigation Sample */}
            <div className="space-y-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Sidebar Navigation States
              </span>
              <div className="p-3 rounded-lg border space-y-1.5 dark:bg-black/40 bg-zinc-100/50 dark:border-zinc-800 border-zinc-200">
                {/* Active Tab */}
                <div
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold shadow-sm"
                  style={{
                    backgroundColor: previewTokens.brandPrimary,
                    color: previewTokens.brandPrimaryText
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <Layout className="w-4 h-4" />
                    <span>Active Navigation Tab</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: previewTokens.brandSecondary,
                      color: previewTokens.brandSecondaryText
                    }}
                  >
                    Active
                  </span>
                </div>

                {/* Inactive Tab */}
                <div className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                  isDark ? 'text-zinc-400 bg-zinc-900/40' : 'text-zinc-600 bg-white'
                }`}>
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-zinc-400" />
                    <span>Inactive Navigation Item</span>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${previewTokens.brandSecondary}25`,
                      color: previewTokens.brandSecondary
                    }}
                  >
                    12 items
                  </span>
                </div>
              </div>
            </div>

            {/* Preview Section 3: Metric Dashboard Card */}
            <div className="space-y-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Metric Card & Status Accents
              </span>
              <div
                className="p-3.5 rounded-xl border space-y-2"
                style={{
                  backgroundColor: previewTokens.cardBackground,
                  borderColor: previewTokens.borderColor
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: previewTokens.textSecondary }}
                  >
                    Active Payroll Disbursal
                  </span>
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs"
                    style={{
                      backgroundColor: `${previewTokens.brandAccent}20`,
                      color: previewTokens.brandAccent
                    }}
                  >
                    ★
                  </span>
                </div>
                <div
                  className="text-lg font-black font-mono tracking-tight"
                  style={{ color: previewTokens.brandPrimary }}
                >
                  $148,920.00
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${previewTokens.brandPrimary}18`,
                      color: previewTokens.brandPrimary
                    }}
                  >
                    Primary Badge
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${previewTokens.brandSecondary}20`,
                      color: previewTokens.brandSecondary
                    }}
                  >
                    Secondary Badge
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${previewTokens.brandAccent}20`,
                      color: previewTokens.brandAccent
                    }}
                  >
                    Accent Badge
                  </span>
                </div>
              </div>
            </div>

            {/* Preview Section 4: Form Input Field */}
            <div className="space-y-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Focused Input Field & Accents
              </span>
              <div className="space-y-1">
                <label
                  className="font-medium text-[11px] block"
                  style={{ color: previewTokens.textPrimary }}
                >
                  Employee Department Name
                </label>
                <input
                  type="text"
                  readOnly
                  value="Human Resources & Talent Acquisition"
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium border outline-none"
                  style={{
                    backgroundColor: previewTokens.inputBackground,
                    borderColor: previewTokens.brandPrimary,
                    color: previewTokens.textPrimary,
                    boxShadow: `0 0 0 1px ${previewTokens.brandPrimary}`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
