import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

interface FloatingHeart {
  id: string;
  x: number;
  y: number;
  delay: number;
}

interface FloatingHeartsProps {
  trigger: boolean;
  count?: number;
}

export const FloatingHearts: React.FC<FloatingHeartsProps> = ({ 
  trigger, 
  count = 5 
}) => {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  useEffect(() => {
    if (trigger) {
      const newHearts = Array.from({ length: count }, (_, i) => ({
        id: `heart-${Date.now()}-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 20 + 40,
        delay: i * 0.1
      }));
      
      setHearts(newHearts);
      
      // Clean up after animation
      const timer = setTimeout(() => {
        setHearts([]);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [trigger, count]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            initial={{ 
              x: `${heart.x}vw`,
              y: `${heart.y}vh`,
              scale: 0,
              opacity: 0,
              rotate: 0
            }}
            animate={{ 
              y: `${heart.y - 30}vh`,
              scale: [0, 1.2, 1],
              opacity: [0, 1, 0],
              rotate: 360
            }}
            exit={{ 
              scale: 0,
              opacity: 0
            }}
            transition={{
              duration: 2.5,
              delay: heart.delay,
              ease: "easeOut"
            }}
            className="absolute"
          >
            <Heart className="w-8 h-8 text-pink-500 fill-pink-500 drop-shadow-lg" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};