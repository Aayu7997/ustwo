import React from 'react';
import { motion } from 'framer-motion';
import { ThemeSelector } from '@/components/ThemeSelector';

export const ThemesTab: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Themes</h2>
        <p className="text-muted-foreground">
          Customize your experience with beautiful themes
        </p>
      </div>
      
      <ThemeSelector />
    </motion.div>
  );
};
