import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Users, Star, Zap } from 'lucide-react';

interface FloatingHeart {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
}

interface AnimationProps {
  isActive?: boolean;
  intensity?: 'low' | 'medium' | 'high';
  type?: 'hearts' | 'confetti' | 'sparkles' | 'sync';
  children?: React.ReactNode;
}

export const FloatingHearts: React.FC<{ isActive: boolean; intensity?: 'low' | 'medium' | 'high' }> = ({ 
  isActive, 
  intensity = 'medium' 
}) => {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  useEffect(() => {
    if (!isActive) {
      setHearts([]);
      return;
    }

    const heartCounts = { low: 2, medium: 4, high: 8 };
    const interval = setInterval(() => {
      const newHearts: FloatingHeart[] = [];
      
      for (let i = 0; i < heartCounts[intensity]; i++) {
        newHearts.push({
          id: Math.random().toString(36),
          x: Math.random() * window.innerWidth,
          y: window.innerHeight + 50,
          size: Math.random() * 20 + 15,
          color: ['#ff69b4', '#ff1493', '#ff6b6b', '#ff4757'][Math.floor(Math.random() * 4)],
          duration: Math.random() * 3 + 2
        });
      }
      
      setHearts(prev => [...prev, ...newHearts]);
      
      setTimeout(() => {
        setHearts(prev => prev.filter(heart => !newHearts.find(h => h.id === heart.id)));
      }, 6000);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, intensity]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {hearts.map(heart => (
          <motion.div
            key={heart.id}
            initial={{ 
              x: heart.x, 
              y: heart.y, 
              scale: 0, 
              rotate: 0,
              opacity: 0 
            }}
            animate={{ 
              x: heart.x + (Math.random() - 0.5) * 200,
              y: -100, 
              scale: 1, 
              rotate: 360,
              opacity: [0, 1, 1, 0] 
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ 
              duration: heart.duration,
              ease: "easeOut",
              times: [0, 0.2, 0.8, 1]
            }}
            className="absolute"
            style={{ 
              fontSize: heart.size,
              color: heart.color,
              filter: 'drop-shadow(0 0 8px rgba(255, 105, 180, 0.6))'
            }}
          >
            ❤️
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export const ConfettiEffect: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [confetti, setConfetti] = useState<any[]>([]);

  useEffect(() => {
    if (!isActive) {
      setConfetti([]);
      return;
    }

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffc107', '#e74c3c'];
    const shapes = ['🎉', '🎊', '⭐', '💫', '✨'];
    
    const newConfetti = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: -50,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      size: Math.random() * 15 + 10,
      rotation: Math.random() * 360,
      velocity: Math.random() * 5 + 3
    }));

    setConfetti(newConfetti);

    setTimeout(() => setConfetti([]), 3000);
  }, [isActive]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {confetti.map(piece => (
          <motion.div
            key={piece.id}
            initial={{ 
              x: piece.x, 
              y: piece.y, 
              rotate: piece.rotation,
              scale: 0
            }}
            animate={{ 
              x: piece.x + (Math.random() - 0.5) * 300,
              y: window.innerHeight + 100,
              rotate: piece.rotation + 720,
              scale: 1
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ 
              duration: 3,
              ease: "easeOut"
            }}
            className="absolute"
            style={{ 
              fontSize: piece.size,
              color: piece.color
            }}
          >
            {piece.shape}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export const PulseEffect: React.FC<{ children: React.ReactNode; isActive: boolean }> = ({ 
  children, 
  isActive 
}) => {
  return (
    <motion.div
      animate={isActive ? {
        scale: [1, 1.05, 1],
        boxShadow: [
          '0 0 0 0 rgba(255, 105, 180, 0)',
          '0 0 0 20px rgba(255, 105, 180, 0.3)',
          '0 0 0 0 rgba(255, 105, 180, 0)'
        ]
      } : {}}
      transition={{
        duration: 2,
        repeat: isActive ? Infinity : 0,
        ease: "easeInOut"
      }}
      className="relative"
    >
      {children}
    </motion.div>
  );
};

export const SyncIndicator: React.FC<{ isActive: boolean; type: 'sync' | 'buffering' | 'connected' }> = ({ 
  isActive, 
  type 
}) => {
  const icons = {
    sync: <Zap className="w-4 h-4" />,
    buffering: <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />,
    connected: <Users className="w-4 h-4" />
  };

  const colors = {
    sync: 'text-blue-500',
    buffering: 'text-yellow-500', 
    connected: 'text-green-500'
  };

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`fixed top-4 right-4 z-50 bg-background/90 backdrop-blur-sm border rounded-full p-3 ${colors[type]}`}
    >
      <motion.div
        animate={{ rotate: type === 'sync' ? [0, 360] : 0 }}
        transition={{ duration: 1, repeat: type === 'sync' ? Infinity : 0 }}
      >
        {icons[type]}
      </motion.div>
    </motion.div>
  );
};

export const ConnectionStatus: React.FC<{ 
  isConnected: boolean; 
  partnerName?: string;
  isWatching?: boolean;
}> = ({ 
  isConnected, 
  partnerName,
  isWatching = false 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 left-4 z-50"
    >
      <div className={`
        bg-background/90 backdrop-blur-sm border rounded-full px-4 py-2 
        flex items-center gap-2 text-sm font-medium
        ${isConnected ? 'border-green-500/50 text-green-600' : 'border-yellow-500/50 text-yellow-600'}
      `}>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-yellow-500'
          }`}
        />
        {isConnected ? (
          <span>
            {isWatching && <Heart className="w-3 h-3 inline mr-1 text-pink-500" />}
            {partnerName ? `Connected with ${partnerName}` : 'Partner Connected'}
          </span>
        ) : (
          <span>Waiting for partner...</span>
        )}
      </div>
    </motion.div>
  );
};

export const WatchingIndicator: React.FC<{ isWatching: boolean }> = ({ isWatching }) => {
  if (!isWatching) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50"
    >
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full px-6 py-3 flex items-center gap-2 shadow-lg">
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Heart className="w-4 h-4 fill-current" />
        </motion.div>
        <span className="text-sm font-medium">Watching Together</span>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-4 h-4" />
        </motion.div>
      </div>
    </motion.div>
  );
};