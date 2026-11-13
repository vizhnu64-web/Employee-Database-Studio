/**
 * Centralized Brand & Design Token System for Employee Database Studio
 * Provides pure logic for color calculations, contrast determination,
 * shade variations, token generation, and DOM CSS variable injection.
 */

export interface ButtonColorCustomization {
  // Primary Button
  primaryBg?: string;
  primaryText?: string;
  primaryHover?: string;
  primaryBorder?: string;

  // Secondary Button
  secondaryBg?: string;
  secondaryText?: string;
  secondaryHover?: string;
  secondaryBorder?: string;

  // Danger Button
  dangerBg?: string;
  dangerText?: string;
  dangerHover?: string;

  // Success Button
  successBg?: string;
  successText?: string;

  // Outline Button
  outlineBg?: string;
  outlineText?: string;
  outlineBorder?: string;
  outlineHover?: string;

  // Custom Override Toggle
  customButtonsEnabled?: boolean;
}

export interface ApplicationSurfaces {
  appBackground?: string;
  sidebarBackground?: string;
  headerBackground?: string;
  cardBackground?: string;
  panelBackground?: string;
  inputBackground?: string;
  modalBackground?: string;
  borderColor?: string;
  textPrimary?: string;
  textSecondary?: string;
  customSurfacesEnabled?: boolean;
}

export interface BrandColors {
  primary: string;           // Primary Brand Colour
  primaryHover?: string;
  primaryText?: string;
  secondary: string;         // Secondary Brand Colour
  secondaryHover?: string;
  secondaryText?: string;
  accent: string;            // Accent Highlight Colour
  accentText?: string;
  buttons?: ButtonColorCustomization;
  surfaces?: ApplicationSurfaces;
}

export interface BrandThemeTokens {
  brandPrimary: string;
  brandPrimaryHover: string;
  brandPrimaryText: string;

  brandSecondary: string;
  brandSecondaryHover: string;
  brandSecondaryText: string;

  brandAccent: string;
  brandAccentText: string;

  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonPrimaryHover: string;
  buttonPrimaryBorder: string;

  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonSecondaryHover: string;
  buttonSecondaryBorder: string;

  buttonDangerBg: string;
  buttonDangerText: string;
  buttonDangerHover: string;

  buttonSuccessBg: string;
  buttonSuccessText: string;

  buttonOutlineBg: string;
  buttonOutlineText: string;
  buttonOutlineBorder: string;
  buttonOutlineHover: string;

  appBackground: string;
  sidebarBackground: string;
  headerBackground: string;
  cardBackground: string;
  panelBackground: string;
  inputBackground: string;
  modalBackground: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

export const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#1e3a8a',    // Enterprise Navy
  secondary: '#475569',  // Slate
  accent: '#d97706',     // Amber
  buttons: {
    customButtonsEnabled: false,
    primaryBg: '#1e3a8a',
    primaryText: '#FFFFFF',
    primaryHover: '#172554',
    primaryBorder: '#1e3a8a',
    secondaryBg: '#475569',
    secondaryText: '#FFFFFF',
    secondaryHover: '#334155',
    secondaryBorder: '#475569',
    dangerBg: '#dc2626',
    dangerText: '#FFFFFF',
    dangerHover: '#b91c1c',
    successBg: '#16a34a',
    successText: '#FFFFFF',
    outlineBg: 'transparent',
    outlineText: '#1e3a8a',
    outlineBorder: '#1e3a8a',
    outlineHover: '#1e3a8a15'
  },
  surfaces: {
    customSurfacesEnabled: false
  }
};

export interface PresetPalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const PRESET_BRAND_PALETTES: PresetPalette[] = [
  { name: 'Enterprise Blue', primary: '#1e3a8a', secondary: '#334155', accent: '#0284c7' },
  { name: 'Royal Indigo', primary: '#312e81', secondary: '#4338ca', accent: '#6366f1' },
  { name: 'Modern Teal', primary: '#115e59', secondary: '#334155', accent: '#0d9488' },
  { name: 'Emerald Forest', primary: '#065f46', secondary: '#374151', accent: '#059669' },
  { name: 'Slate Executive', primary: '#0f172a', secondary: '#64748b', accent: '#3b82f6' },
  { name: 'Crimson Corporate', primary: '#881337', secondary: '#475569', accent: '#e11d48' },
  { name: 'Aubergine Luxury', primary: '#4c1d95', secondary: '#581c87', accent: '#8b5cf6' },
  { name: 'Warm Amber', primary: '#78350f', secondary: '#52525b', accent: '#f59e0b' }
];

/**
 * Validates whether a given string is a valid CSS Hex color (3, 6 or 8 digits)
 */
export function isValidHex(color: string): boolean {
  if (!color || typeof color !== 'string') return false;
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(color.trim());
}

/**
 * Parses hex into RGB numeric values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidHex(hex)) return null;
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean.substring(0, 6), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Calculates optimal readable text color (white or black) based on W3C luminance
 */
export function getContrastTextColor(hex: string): '#FFFFFF' | '#000000' {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  // Standard perceived luminance calculation
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 140 ? '#000000' : '#FFFFFF';
}

/**
 * Darkens or lightens a hex color by a given percentage (-100 to +100)
 */
export function shadeColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const calculate = (c: number) => {
    const val = percent < 0
      ? Math.round(c * (1 + percent / 100))
      : Math.round(c + (255 - c) * (percent / 100));
    return Math.min(255, Math.max(0, val));
  };

  const r = calculate(rgb.r).toString(16).padStart(2, '0');
  const g = calculate(rgb.g).toString(16).padStart(2, '0');
  const b = calculate(rgb.b).toString(16).padStart(2, '0');

  return `#${r}${g}${b}`;
}

/**
 * Resolves full design tokens given partial brand colors and active theme (dark/light).
 * Handles default inheritance for button and surface colors.
 */
export function resolveBrandTokens(colors?: Partial<BrandColors>, isDark = true): BrandThemeTokens {
  const primary = isValidHex(colors?.primary || '') ? colors!.primary! : DEFAULT_BRAND_COLORS.primary;
  const secondary = isValidHex(colors?.secondary || '') ? colors!.secondary! : DEFAULT_BRAND_COLORS.secondary;
  const accent = isValidHex(colors?.accent || '') ? colors!.accent! : DEFAULT_BRAND_COLORS.accent;

  const primaryHover = colors?.primaryHover && isValidHex(colors.primaryHover)
    ? colors.primaryHover
    : shadeColor(primary, -15);

  const primaryText = colors?.primaryText && isValidHex(colors.primaryText)
    ? colors.primaryText
    : getContrastTextColor(primary);

  const secondaryHover = colors?.secondaryHover && isValidHex(colors.secondaryHover)
    ? colors.secondaryHover
    : shadeColor(secondary, -15);

  const secondaryText = colors?.secondaryText && isValidHex(colors.secondaryText)
    ? colors.secondaryText
    : getContrastTextColor(secondary);

  const accentText = colors?.accentText && isValidHex(colors.accentText)
    ? colors.accentText
    : getContrastTextColor(accent);

  const btns = colors?.buttons || {};
  const hasCustomButtons = !!btns.customButtonsEnabled;

  // Primary Button Tokens
  const buttonPrimaryBg = hasCustomButtons && btns.primaryBg && isValidHex(btns.primaryBg)
    ? btns.primaryBg
    : primary;
  const buttonPrimaryText = hasCustomButtons && btns.primaryText && isValidHex(btns.primaryText)
    ? btns.primaryText
    : getContrastTextColor(buttonPrimaryBg);
  const buttonPrimaryHover = hasCustomButtons && btns.primaryHover && isValidHex(btns.primaryHover)
    ? btns.primaryHover
    : shadeColor(buttonPrimaryBg, -15);
  const buttonPrimaryBorder = hasCustomButtons && btns.primaryBorder && isValidHex(btns.primaryBorder)
    ? btns.primaryBorder
    : buttonPrimaryBg;

  // Secondary Button Tokens
  const buttonSecondaryBg = hasCustomButtons && btns.secondaryBg && isValidHex(btns.secondaryBg)
    ? btns.secondaryBg
    : secondary;
  const buttonSecondaryText = hasCustomButtons && btns.secondaryText && isValidHex(btns.secondaryText)
    ? btns.secondaryText
    : getContrastTextColor(buttonSecondaryBg);
  const buttonSecondaryHover = hasCustomButtons && btns.secondaryHover && isValidHex(btns.secondaryHover)
    ? btns.secondaryHover
    : shadeColor(buttonSecondaryBg, -15);
  const buttonSecondaryBorder = hasCustomButtons && btns.secondaryBorder && isValidHex(btns.secondaryBorder)
    ? btns.secondaryBorder
    : buttonSecondaryBg;

  // Danger Button Tokens
  const buttonDangerBg = hasCustomButtons && btns.dangerBg && isValidHex(btns.dangerBg)
    ? btns.dangerBg
    : '#dc2626';
  const buttonDangerText = hasCustomButtons && btns.dangerText && isValidHex(btns.dangerText)
    ? btns.dangerText
    : getContrastTextColor(buttonDangerBg);
  const buttonDangerHover = hasCustomButtons && btns.dangerHover && isValidHex(btns.dangerHover)
    ? btns.dangerHover
    : shadeColor(buttonDangerBg, -15);

  // Success Button Tokens
  const buttonSuccessBg = hasCustomButtons && btns.successBg && isValidHex(btns.successBg)
    ? btns.successBg
    : '#16a34a';
  const buttonSuccessText = hasCustomButtons && btns.successText && isValidHex(btns.successText)
    ? btns.successText
    : getContrastTextColor(buttonSuccessBg);

  // Outline Button Tokens
  const buttonOutlineBg = hasCustomButtons && btns.outlineBg
    ? btns.outlineBg
    : 'transparent';
  const buttonOutlineText = hasCustomButtons && btns.outlineText && isValidHex(btns.outlineText)
    ? btns.outlineText
    : primary;
  const buttonOutlineBorder = hasCustomButtons && btns.outlineBorder && isValidHex(btns.outlineBorder)
    ? btns.outlineBorder
    : primary;
  const buttonOutlineHover = hasCustomButtons && btns.outlineHover
    ? btns.outlineHover
    : isDark ? `${primary}20` : `${primary}10`;

  // Application Surfaces Tokens
  const surfs = colors?.surfaces || {};
  const hasCustomSurfs = !!surfs.customSurfacesEnabled;

  const appBackground = hasCustomSurfs && surfs.appBackground && isValidHex(surfs.appBackground)
    ? surfs.appBackground
    : isDark ? '#000000' : '#F4F4F6';

  const sidebarBackground = hasCustomSurfs && surfs.sidebarBackground && isValidHex(surfs.sidebarBackground)
    ? surfs.sidebarBackground
    : isDark ? '#09090B' : '#FFFFFF';

  const headerBackground = hasCustomSurfs && surfs.headerBackground && isValidHex(surfs.headerBackground)
    ? surfs.headerBackground
    : isDark ? '#0D0D0E' : '#FFFFFF';

  const cardBackground = hasCustomSurfs && surfs.cardBackground && isValidHex(surfs.cardBackground)
    ? surfs.cardBackground
    : isDark ? '#0D0D0E' : '#FFFFFF';

  const panelBackground = hasCustomSurfs && surfs.panelBackground && isValidHex(surfs.panelBackground)
    ? surfs.panelBackground
    : isDark ? '#141416' : '#FAFAFC';

  const inputBackground = hasCustomSurfs && surfs.inputBackground && isValidHex(surfs.inputBackground)
    ? surfs.inputBackground
    : isDark ? '#000000' : '#FFFFFF';

  const modalBackground = hasCustomSurfs && surfs.modalBackground && isValidHex(surfs.modalBackground)
    ? surfs.modalBackground
    : isDark ? '#121214' : '#FFFFFF';

  const borderColor = hasCustomSurfs && surfs.borderColor && isValidHex(surfs.borderColor)
    ? surfs.borderColor
    : isDark ? '#27272A' : '#E4E4E7';

  const textPrimary = hasCustomSurfs && surfs.textPrimary && isValidHex(surfs.textPrimary)
    ? surfs.textPrimary
    : isDark ? '#FFFFFF' : '#09090B';

  const textSecondary = hasCustomSurfs && surfs.textSecondary && isValidHex(surfs.textSecondary)
    ? surfs.textSecondary
    : isDark ? '#A1A1AA' : '#71717A';

  return {
    brandPrimary: primary,
    brandPrimaryHover: primaryHover,
    brandPrimaryText: primaryText,

    brandSecondary: secondary,
    brandSecondaryHover: secondaryHover,
    brandSecondaryText: secondaryText,

    brandAccent: accent,
    brandAccentText: accentText,

    buttonPrimaryBg,
    buttonPrimaryText,
    buttonPrimaryHover,
    buttonPrimaryBorder,

    buttonSecondaryBg,
    buttonSecondaryText,
    buttonSecondaryHover,
    buttonSecondaryBorder,

    buttonDangerBg,
    buttonDangerText,
    buttonDangerHover,

    buttonSuccessBg,
    buttonSuccessText,

    buttonOutlineBg,
    buttonOutlineText,
    buttonOutlineBorder,
    buttonOutlineHover,

    appBackground,
    sidebarBackground,
    headerBackground,
    cardBackground,
    panelBackground,
    inputBackground,
    modalBackground,
    borderColor,
    textPrimary,
    textSecondary
  };
}

/**
 * Converts resolved tokens into CSS Variable key-value pairs
 */
export function tokensToCssVars(tokens: BrandThemeTokens): Record<string, string> {
  return {
    '--brand-primary': tokens.brandPrimary,
    '--brand-primary-hover': tokens.brandPrimaryHover,
    '--brand-primary-text': tokens.brandPrimaryText,

    '--brand-secondary': tokens.brandSecondary,
    '--brand-secondary-hover': tokens.brandSecondaryHover,
    '--brand-secondary-text': tokens.brandSecondaryText,

    '--brand-accent': tokens.brandAccent,
    '--brand-accent-text': tokens.brandAccentText,

    '--button-primary-bg': tokens.buttonPrimaryBg,
    '--button-primary-text': tokens.buttonPrimaryText,
    '--button-primary-hover': tokens.buttonPrimaryHover,
    '--button-primary-border': tokens.buttonPrimaryBorder,

    '--button-secondary-bg': tokens.buttonSecondaryBg,
    '--button-secondary-text': tokens.buttonSecondaryText,
    '--button-secondary-hover': tokens.buttonSecondaryHover,
    '--button-secondary-border': tokens.buttonSecondaryBorder,

    '--button-danger-bg': tokens.buttonDangerBg,
    '--button-danger-text': tokens.buttonDangerText,
    '--button-danger-hover': tokens.buttonDangerHover,

    '--button-success-bg': tokens.buttonSuccessBg,
    '--button-success-text': tokens.buttonSuccessText,

    '--button-outline-bg': tokens.buttonOutlineBg,
    '--button-outline-text': tokens.buttonOutlineText,
    '--button-outline-border': tokens.buttonOutlineBorder,
    '--button-outline-hover': tokens.buttonOutlineHover,

    '--app-background': tokens.appBackground,
    '--sidebar-background': tokens.sidebarBackground,
    '--header-background': tokens.headerBackground,
    '--card-background': tokens.cardBackground,
    '--panel-background': tokens.panelBackground,
    '--input-background': tokens.inputBackground,
    '--modal-background': tokens.modalBackground,
    '--border-color': tokens.borderColor,
    '--text-primary': tokens.textPrimary,
    '--text-secondary': tokens.textSecondary
  };
}

/**
 * Injects CSS variables directly onto document root for instant live preview & application-wide styling
 */
export function applyBrandCssVariables(colors?: Partial<BrandColors>, isDark = true): void {
  if (typeof document === 'undefined') return;
  const tokens = resolveBrandTokens(colors, isDark);
  const vars = tokensToCssVars(tokens);
  const root = document.documentElement;

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
