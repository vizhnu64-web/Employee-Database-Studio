import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  BrandColors,
  BrandThemeTokens,
  DEFAULT_BRAND_COLORS,
  resolveBrandTokens,
  applyBrandCssVariables
} from '../utils/brandColors';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  brandColors: BrandColors;
  tokens: BrandThemeTokens;
  setBrandColors: (colors: BrandColors) => void;
  previewBrandColors: (colors: Partial<BrandColors>) => void;
  resetBrandColors: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('payslip_studio_theme');
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    }
    return 'dark'; // Default to dark mode
  });

  const [brandColors, setBrandColorsState] = useState<BrandColors>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('peopledesk_brand_colors');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...DEFAULT_BRAND_COLORS,
            ...parsed,
            buttons: {
              ...DEFAULT_BRAND_COLORS.buttons,
              ...(parsed.buttons || {})
            },
            surfaces: {
              ...DEFAULT_BRAND_COLORS.surfaces,
              ...(parsed.surfaces || {})
            }
          };
        }
      } catch {
        // Fallback to default
      }
    }
    return DEFAULT_BRAND_COLORS;
  });

  const isDark = theme === 'dark';

  const tokens = useMemo(() => {
    return resolveBrandTokens(brandColors, isDark);
  }, [brandColors, isDark]);

  // Synchronize CSS variables and root attributes whenever theme or brand colors change
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    applyBrandCssVariables(brandColors, isDark);
    root.style.backgroundColor = tokens.appBackground;

    localStorage.setItem('payslip_studio_theme', theme);
  }, [theme, brandColors, isDark, tokens.appBackground]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const setBrandColors = useCallback((colors: BrandColors) => {
    setBrandColorsState(colors);
    try {
      localStorage.setItem('peopledesk_brand_colors', JSON.stringify(colors));
    } catch {
      // Storage error ignored
    }
    applyBrandCssVariables(colors, theme === 'dark');
  }, [theme]);

  const previewBrandColors = useCallback((partial: Partial<BrandColors>) => {
    const merged: BrandColors = {
      ...brandColors,
      ...partial,
      buttons: {
        ...brandColors.buttons,
        ...(partial.buttons || {})
      },
      surfaces: {
        ...brandColors.surfaces,
        ...(partial.surfaces || {})
      }
    };
    applyBrandCssVariables(merged, theme === 'dark');
  }, [brandColors, theme]);

  const resetBrandColors = useCallback(() => {
    setBrandColorsState(DEFAULT_BRAND_COLORS);
    try {
      localStorage.removeItem('peopledesk_brand_colors');
    } catch {
      // Storage error ignored
    }
    applyBrandCssVariables(DEFAULT_BRAND_COLORS, theme === 'dark');
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        isDark,
        brandColors,
        tokens,
        setBrandColors,
        previewBrandColors,
        resetBrandColors
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
