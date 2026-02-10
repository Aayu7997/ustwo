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
  xl: 'w-24 h-24',
};

const textSizeClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export const UsTwoLogo: React.FC<UsTwoLogoProps> = ({ 
  size = 'md', 
  className,
  showText = false 
}) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn(
        sizeClasses[size],
        "relative rounded-xl overflow-hidden shadow-md ring-1 ring-primary/20 flex-shrink-0"
      )}>
        <img 
          src={ustwoLogo} 
          alt="UsTwo Logo" 
          className="w-full h-full object-cover"
        />
      </div>
      {showText && (
        <span className={cn(
          textSizeClasses[size],
          "font-bold text-gradient tracking-tight"
        )}>
          UsTwo
        </span>
      )}
    </div>
  );
};
