import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'romantic' | 'amoled';

export interface Theme {
  id: ThemeMode;
  name: string;
  description: string;
  preview: string;
  className: string;
}

const THEMES: Theme[] = [
  {
    id: 'light',
    name: 'Light',
    description: 'Clean and bright, perfect for daytime',
    preview: 'linear-gradient(135deg, #fff 0%, #fce7f3 100%)',
    className: '',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Easy on the eyes, Netflix-style',
    preview: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)',
    className: 'dark',
  },
  {
    id: 'romantic',
    name: 'Romantic Pink',
    description: 'Soft pinks for romantic moments',
    preview: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    className: 'theme-romantic',
  },
  {
    id: 'amoled',
    name: 'AMOLED Black',
    description: 'Pure black for OLED screens',
    preview: 'linear-gradient(135deg, #000 0%, #0a0a0a 100%)',
    className: 'dark theme-amoled',
  },
];

export const useThemes = () => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const applyTheme = useCallback((theme: Theme) => {
    setIsAnimating(true);
    
    // Remove all theme classes from document
    document.documentElement.classList.remove('dark', 'theme-romantic', 'theme-amoled');
    
    // Apply new theme classes
    if (theme.className) {
      theme.className.split(' ').forEach(cls => {
        if (cls) document.documentElement.classList.add(cls);
      });
    }
    
    setCurrentTheme(theme);
    
    // Store theme preference
    localStorage.setItem('ustwo-theme', theme.id);
    
    // Animation feedback
    setTimeout(() => setIsAnimating(false), 500);
  }, []);

  const getThemeAnimation = useCallback((themeId: ThemeMode) => {
    switch (themeId) {
      case 'light':
        return {
          background: 'radial-gradient(circle at 50% 50%, hsl(340 82% 52% / 0.1) 0%, transparent 70%)',
        };
      case 'dark':
        return {
          background: 'radial-gradient(circle at 50% 50%, hsl(340 82% 55% / 0.15) 0%, transparent 70%)',
        };
      case 'romantic':
        return {
          background: 'radial-gradient(circle at 50% 50%, hsl(340 82% 52% / 0.2) 0%, transparent 60%)',
        };
      case 'amoled':
        return {
          background: 'radial-gradient(circle at 50% 50%, hsl(340 82% 58% / 0.1) 0%, transparent 80%)',
        };
      default:
        return {};
    }
  }, []);

  const loadSavedTheme = useCallback(() => {
    const savedThemeId = localStorage.getItem('ustwo-theme') as ThemeMode | null;
    if (savedThemeId) {
      const savedTheme = THEMES.find(theme => theme.id === savedThemeId);
      if (savedTheme) {
        applyTheme(savedTheme);
        return;
      }
    }
    
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme(THEMES[1]); // Dark theme
    } else {
      applyTheme(THEMES[0]); // Light theme
    }
  }, [applyTheme]);

  useEffect(() => {
    loadSavedTheme();
    
    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if no saved preference
      if (!localStorage.getItem('ustwo-theme')) {
        applyTheme(e.matches ? THEMES[1] : THEMES[0]);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [loadSavedTheme, applyTheme]);

  return {
    themes: THEMES,
    currentTheme,
    isAnimating,
    applyTheme,
    getThemeAnimation,
    loadSavedTheme
  };
};
