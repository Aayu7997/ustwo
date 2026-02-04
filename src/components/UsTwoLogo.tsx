import React from 'react';
import ustwoLogo from '@/assets/ustwo-logo.png';
import { cn } from '@/lib/utils';

interface UsTwoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
};

export const UsTwoLogo: React.FC<UsTwoLogoProps> = ({ 
  size = 'md', 
  className,
  showText = false 
}) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img 
        src={ustwoLogo} 
        alt="UsTwo Logo" 
        className={cn(sizeClasses[size], "object-contain")}
      />
      {showText && (
        <span className="text-xl font-bold text-gradient">UsTwo</span>
      )}
    </div>
  );
};
