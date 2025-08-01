import { useState, useEffect } from 'react';

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    gradient: string;
  };
  animation: string;
}

const THEMES: Theme[] = [
  {
    id: 'sunset',
    name: 'Sunset Romance',
    description: 'Warm oranges and pinks for intimate moments',
    colors: {
      primary: '24 74% 58%', // Orange
      secondary: '346 83% 67%', // Pink
      accent: '45 93% 58%', // Yellow
      background: '25 24% 9%', // Dark brown
      gradient: 'linear-gradient(135deg, hsl(24 74% 58%) 0%, hsl(346 83% 67%) 100%)'
    },
    animation: 'sunset'
  },
  {
    id: 'rainy',
    name: 'Rainy Day',
    description: 'Cool blues and grays for cozy moments',
    colors: {
      primary: '213 94% 68%', // Blue
      secondary: '212 60% 45%', // Darker blue
      accent: '193 100% 80%', // Light blue
      background: '215 28% 17%', // Dark blue-gray
      gradient: 'linear-gradient(135deg, hsl(213 94% 68%) 0%, hsl(212 60% 45%) 100%)'
    },
    animation: 'rain'
  },
  {
    id: 'cozy',
    name: 'Cozy Night',
    description: 'Warm browns and soft yellows',
    colors: {
      primary: '30 54% 35%', // Brown
      secondary: '45 69% 61%', // Light brown
      accent: '51 100% 50%', // Gold
      background: '20 14% 8%', // Very dark brown
      gradient: 'linear-gradient(135deg, hsl(30 54% 35%) 0%, hsl(45 69% 61%) 100%)'
    },
    animation: 'cozy'
  },
  {
    id: 'neon',
    name: 'Neon Dreams',
    description: 'Electric purples and cyans for energy',
    colors: {
      primary: '280 100% 70%', // Purple
      secondary: '300 76% 72%', // Pink-purple
      accent: '180 100% 50%', // Cyan
      background: '240 10% 4%', // Very dark purple
      gradient: 'linear-gradient(135deg, hsl(280 100% 70%) 0%, hsl(180 100% 50%) 100%)'
    },
    animation: 'neon'
  },
  {
    id: 'forest',
    name: 'Forest Escape',
    description: 'Natural greens for peaceful vibes',
    colors: {
      primary: '120 60% 50%', // Green
      secondary: '90 50% 40%', // Olive green
      accent: '60 100% 50%', // Lime
      background: '120 25% 8%', // Dark green
      gradient: 'linear-gradient(135deg, hsl(120 60% 50%) 0%, hsl(90 50% 40%) 100%)'
    },
    animation: 'forest'
  }
];

export const useThemes = () => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const applyTheme = (theme: Theme) => {
    setIsAnimating(true);
    
    // Apply CSS custom properties
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (key !== 'gradient') {
        root.style.setProperty(`--${key}`, value);
      }
    });

    // Apply gradient
    root.style.setProperty('--gradient-primary', theme.colors.gradient);
    
    setCurrentTheme(theme);
    
    // Animation feedback
    setTimeout(() => setIsAnimating(false), 1000);
  };

  const getThemeAnimation = (themeId: string) => {
    switch (themeId) {
      case 'sunset':
        return {
          background: 'radial-gradient(circle at 50% 80%, rgba(255, 126, 95, 0.3) 0%, transparent 50%)',
          animation: 'pulse 4s ease-in-out infinite'
        };
      case 'rainy':
        return {
          background: 'linear-gradient(transparent 30%, rgba(59, 130, 246, 0.1) 70%)',
          animation: 'fadeInOut 3s ease-in-out infinite alternate'
        };
      case 'cozy':
        return {
          background: 'radial-gradient(ellipse at center, rgba(217, 119, 6, 0.2) 0%, transparent 70%)',
          animation: 'glow 5s ease-in-out infinite'
        };
      case 'neon':
        return {
          background: 'conic-gradient(from 0deg, rgba(147, 51, 234, 0.3), rgba(6, 182, 212, 0.3), rgba(147, 51, 234, 0.3))',
          animation: 'spin 8s linear infinite'
        };
      case 'forest':
        return {
          background: 'radial-gradient(ellipse at top, rgba(34, 197, 94, 0.2) 0%, transparent 50%)',
          animation: 'breathe 6s ease-in-out infinite'
        };
      default:
        return {};
    }
  };

  useEffect(() => {
    // Apply default theme on mount
    applyTheme(THEMES[0]);
  }, []);

  return {
    themes: THEMES,
    currentTheme,
    isAnimating,
    applyTheme,
    getThemeAnimation
  };
};