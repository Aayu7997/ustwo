
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
    foreground: string;
    muted: string;
    mutedForeground: string;
    card: string;
    cardForeground: string;
    border: string;
    input: string;
    ring: string;
    gradient: string;
  };
  animation: string;
  mood: string;
}

const THEMES: Theme[] = [
  {
    id: 'sunset',
    name: 'Sunset Romance',
    description: 'Warm oranges and pinks for intimate moments',
    mood: 'romantic',
    colors: {
      primary: '24 74% 58%', // Orange
      secondary: '346 83% 67%', // Pink
      accent: '45 93% 58%', // Yellow
      background: '25 24% 9%', // Dark brown
      foreground: '45 93% 95%', // Light cream
      muted: '25 24% 15%', // Muted brown
      mutedForeground: '45 23% 65%', // Muted cream
      card: '25 24% 12%', // Card brown
      cardForeground: '45 93% 92%', // Card text
      border: '25 24% 18%', // Border
      input: '25 24% 15%', // Input background
      ring: '24 74% 58%', // Focus ring
      gradient: 'linear-gradient(135deg, hsl(24 74% 58%) 0%, hsl(346 83% 67%) 100%)'
    },
    animation: 'sunset'
  },
  {
    id: 'rainy',
    name: 'Rainy Day',
    description: 'Cool blues and grays for cozy moments',
    mood: 'cozy',
    colors: {
      primary: '213 94% 68%', // Blue
      secondary: '212 60% 45%', // Darker blue
      accent: '193 100% 80%', // Light blue
      background: '215 28% 17%', // Dark blue-gray
      foreground: '213 94% 95%', // Light blue-white
      muted: '215 28% 22%', // Muted blue-gray
      mutedForeground: '213 44% 70%', // Muted light blue
      card: '215 28% 20%', // Card blue-gray
      cardForeground: '213 94% 92%', // Card text
      border: '215 28% 25%', // Border
      input: '215 28% 22%', // Input background
      ring: '213 94% 68%', // Focus ring
      gradient: 'linear-gradient(135deg, hsl(213 94% 68%) 0%, hsl(212 60% 45%) 100%)'
    },
    animation: 'rain'
  },
  {
    id: 'cozy',
    name: 'Cozy Night',
    description: 'Warm browns and soft yellows for comfort',
    mood: 'comfortable',
    colors: {
      primary: '30 54% 35%', // Brown
      secondary: '45 69% 61%', // Light brown
      accent: '51 100% 50%', // Gold
      background: '20 14% 8%', // Very dark brown
      foreground: '51 100% 95%', // Light golden
      muted: '20 14% 13%', // Muted dark brown
      mutedForeground: '45 29% 65%', // Muted light brown
      card: '20 14% 11%', // Card brown
      cardForeground: '51 100% 92%', // Card text
      border: '20 14% 16%', // Border
      input: '20 14% 13%', // Input background
      ring: '30 54% 35%', // Focus ring
      gradient: 'linear-gradient(135deg, hsl(30 54% 35%) 0%, hsl(45 69% 61%) 100%)'
    },
    animation: 'cozy'
  },
  {
    id: 'neon',
    name: 'Neon Dreams',
    description: 'Electric purples and cyans for energy',
    mood: 'energetic',
    colors: {
      primary: '280 100% 70%', // Purple
      secondary: '300 76% 72%', // Pink-purple
      accent: '180 100% 50%', // Cyan
      background: '240 10% 4%', // Very dark purple
      foreground: '280 100% 95%', // Light purple-white
      muted: '240 10% 9%', // Muted dark purple
      mutedForeground: '280 40% 70%', // Muted light purple
      card: '240 10% 7%', // Card purple
      cardForeground: '280 100% 92%', // Card text
      border: '240 10% 12%', // Border
      input: '240 10% 9%', // Input background
      ring: '280 100% 70%', // Focus ring
      gradient: 'linear-gradient(135deg, hsl(280 100% 70%) 0%, hsl(180 100% 50%) 100%)'
    },
    animation: 'neon'
  },
  {
    id: 'forest',
    name: 'Forest Escape',
    description: 'Natural greens for peaceful vibes',
    mood: 'peaceful',
    colors: {
      primary: '120 60% 50%', // Green
      secondary: '90 50% 40%', // Olive green
      accent: '60 100% 50%', // Lime
      background: '120 25% 8%', // Dark green
      foreground: '120 60% 95%', // Light green-white
      muted: '120 25% 13%', // Muted dark green
      mutedForeground: '120 30% 65%', // Muted light green
      card: '120 25% 11%', // Card green
      cardForeground: '120 60% 92%', // Card text
      border: '120 25% 16%', // Border
      input: '120 25% 13%', // Input background
      ring: '120 60% 50%', // Focus ring
      gradient: 'linear-gradient(135deg, hsl(120 60% 50%) 0%, hsl(90 50% 40%) 100%)'
    },
    animation: 'forest'
  },
  {
    id: 'midnight',
    name: 'Midnight Love',
    description: 'Deep blues and purples for intimate nights',
    mood: 'intimate',
    colors: {
      primary: '250 84% 54%', // Deep blue
      secondary: '280 65% 45%', // Purple
      accent: '320 100% 70%', // Hot pink
      background: '240 15% 5%', // Very dark blue
      foreground: '250 84% 95%', // Light blue-white
      muted: '240 15% 10%', // Muted dark blue
      mutedForeground: '250 34% 70%', // Muted light blue
      card: '240 15% 8%', // Card blue
      cardForeground: '250 84% 92%', // Card text
      border: '240 15% 13%', // Border
      input: '240 15% 10%', // Input background
      ring: '250 84% 54%', // Focus ring
      gradient: 'linear-gradient(135deg, hsl(250 84% 54%) 0%, hsl(320 100% 70%) 100%)'
    },
    animation: 'midnight'
  }
];

export const useThemes = () => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const applyTheme = (theme: Theme) => {
    setIsAnimating(true);
    
    // Apply CSS custom properties to document root
    const root = document.documentElement;
    
    // Apply all color properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (key !== 'gradient') {
        root.style.setProperty(`--${key}`, value);
      }
    });

    // Apply gradient
    root.style.setProperty('--gradient-primary', theme.colors.gradient);
    
    // Apply theme-specific custom properties
    root.style.setProperty('--theme-mood', theme.mood);
    root.style.setProperty('--theme-animation', theme.animation);
    
    // Update body classes for theme-specific styling
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${theme.id}`);
    
    setCurrentTheme(theme);
    
    // Store theme preference
    localStorage.setItem('lovesync-theme', theme.id);
    
    // Animation feedback
    setTimeout(() => setIsAnimating(false), 1200);
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
      case 'midnight':
        return {
          background: 'radial-gradient(circle at 30% 20%, rgba(139, 69, 19, 0.3) 0%, rgba(75, 0, 130, 0.2) 50%, transparent 100%)',
          animation: 'shimmer 7s ease-in-out infinite alternate'
        };
      default:
        return {};
    }
  };

  const loadSavedTheme = () => {
    const savedThemeId = localStorage.getItem('lovesync-theme');
    if (savedThemeId) {
      const savedTheme = THEMES.find(theme => theme.id === savedThemeId);
      if (savedTheme) {
        applyTheme(savedTheme);
        return;
      }
    }
    // Apply default theme if no saved theme
    applyTheme(THEMES[0]);
  };

  useEffect(() => {
    // Load saved theme on mount
    loadSavedTheme();
    
    // Add CSS animations to document
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0%, 100% { opacity: 0.1; }
        50% { opacity: 0.3; }
      }
      
      @keyframes glow {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 0.4; }
      }
      
      @keyframes breathe {
        0%, 100% { transform: scale(1); opacity: 0.2; }
        50% { transform: scale(1.05); opacity: 0.3; }
      }
      
      @keyframes shimmer {
        0% { opacity: 0.2; transform: translateX(-10px); }
        50% { opacity: 0.4; transform: translateX(10px); }
        100% { opacity: 0.2; transform: translateX(-10px); }
      }
      
      .theme-transition {
        transition: all 0.3s ease-in-out;
      }
      
      /* Theme-specific body styles */
      body.theme-sunset {
        background: linear-gradient(135deg, hsl(25 24% 9%) 0%, hsl(24 34% 12%) 100%);
      }
      
      body.theme-rainy {
        background: linear-gradient(135deg, hsl(215 28% 17%) 0%, hsl(213 28% 20%) 100%);
      }
      
      body.theme-cozy {
        background: linear-gradient(135deg, hsl(20 14% 8%) 0%, hsl(30 14% 11%) 100%);
      }
      
      body.theme-neon {
        background: linear-gradient(135deg, hsl(240 10% 4%) 0%, hsl(280 10% 7%) 100%);
      }
      
      body.theme-forest {
        background: linear-gradient(135deg, hsl(120 25% 8%) 0%, hsl(90 25% 11%) 100%);
      }
      
      body.theme-midnight {
        background: linear-gradient(135deg, hsl(240 15% 5%) 0%, hsl(250 15% 8%) 100%);
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return {
    themes: THEMES,
    currentTheme,
    isAnimating,
    applyTheme,
    getThemeAnimation,
    loadSavedTheme
  };
};
