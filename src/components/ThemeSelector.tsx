import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useThemes, Theme } from '@/hooks/useThemes';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, Sun, Moon, Heart, Zap } from 'lucide-react';

const themeIcons: Record<string, React.ElementType> = {
  light: Sun,
  dark: Moon,
  romantic: Heart,
  amoled: Zap,
};

export const ThemeSelector: React.FC = () => {
  const { themes, currentTheme, isAnimating, applyTheme, getThemeAnimation } = useThemes();

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent">
          <Palette className="h-5 w-5 text-primary" />
          <span className="font-medium">Choose Your Vibe</span>
        </div>
        <p className="text-muted-foreground">
          Set the perfect atmosphere for your watch sessions
        </p>
      </motion.div>

      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5 }}
            >
              <Palette className="w-12 h-12 text-primary" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 sm:grid-cols-2">
        {themes.map((theme, index) => {
          const Icon = themeIcons[theme.id] || Palette;
          const isActive = currentTheme.id === theme.id;
          
          return (
            <motion.div
              key={theme.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card 
                className={`cursor-pointer transition-all duration-300 overflow-hidden ${
                  isActive 
                    ? 'ring-2 ring-primary shadow-glow' 
                    : 'hover:shadow-lg'
                }`}
                onClick={() => applyTheme(theme)}
              >
                {/* Preview */}
                <div 
                  className="h-24 relative"
                  style={{ background: theme.preview }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={getThemeAnimation(theme.id)}
                  />
                  
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-1.5"
                    >
                      <Check className="h-4 w-4" />
                    </motion.div>
                  )}
                  
                  <div className="absolute bottom-3 left-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      theme.id === 'light' || theme.id === 'romantic' 
                        ? 'bg-black/10' 
                        : 'bg-white/10'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        theme.id === 'light' || theme.id === 'romantic' 
                          ? 'text-black/70' 
                          : 'text-white/70'
                      }`} />
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{theme.name}</h3>
                      <p className="text-sm text-muted-foreground">{theme.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <Badge variant="secondary" className="inline-flex items-center gap-2 px-4 py-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          Active: {currentTheme.name}
        </Badge>
      </motion.div>
    </div>
  );
};
