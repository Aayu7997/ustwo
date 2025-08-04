import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Star, Sparkles, Zap, Music } from 'lucide-react';

interface ParticleEffect {
  id: string;
  x: number;
  y: number;
  type: 'heart' | 'star' | 'sparkle' | 'confetti';
  color: string;
  delay: number;
  duration: number;
}

interface WatchPartyEffectsProps {
  isPlaying: boolean;
  currentTime: number;
  partnerJoined: boolean;
  onSyncEvent?: (event: string) => void;
}

export const WatchPartyEffects: React.FC<WatchPartyEffectsProps> = ({
  isPlaying,
  currentTime,
  partnerJoined,
  onSyncEvent
}) => {
  const [particles, setParticles] = useState<ParticleEffect[]>([]);
  const [showSyncBurst, setShowSyncBurst] = useState(false);
  const [showWelcomeBurst, setShowWelcomeBurst] = useState(false);
  const lastTimeRef = useRef(currentTime);
  const effectCounterRef = useRef(0);

  // Welcome effect when partner joins
  useEffect(() => {
    if (partnerJoined) {
      setShowWelcomeBurst(true);
      generateParticles('celebration', 15);
      setTimeout(() => setShowWelcomeBurst(false), 3000);
    }
  }, [partnerJoined]);

  // Sync burst effect
  useEffect(() => {
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);
    if (timeDiff > 5 && isPlaying) {
      setShowSyncBurst(true);
      generateParticles('sync', 8);
      setTimeout(() => setShowSyncBurst(false), 2000);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime, isPlaying]);

  // Ambient effects during playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // Random ambient particles
      if (Math.random() < 0.3) {
        generateParticles('ambient', 2);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const generateParticles = (type: 'celebration' | 'sync' | 'ambient', count: number) => {
    const newParticles: ParticleEffect[] = [];
    
    for (let i = 0; i < count; i++) {
      const particleType = getRandomParticleType(type);
      newParticles.push({
        id: `particle_${Date.now()}_${i}_${effectCounterRef.current++}`,
        x: Math.random() * 100,
        y: Math.random() * 80 + 10,
        type: particleType,
        color: getRandomColor(type),
        delay: i * 0.1,
        duration: type === 'celebration' ? 3 : type === 'sync' ? 2 : 4
      });
    }

    setParticles(prev => [...prev, ...newParticles]);

    // Clean up particles after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, Math.max(...newParticles.map(p => p.duration)) * 1000 + 500);
  };

  const getRandomParticleType = (effectType: string): ParticleEffect['type'] => {
    switch (effectType) {
      case 'celebration':
        return ['heart', 'star', 'sparkle', 'confetti'][Math.floor(Math.random() * 4)] as ParticleEffect['type'];
      case 'sync':
        return ['sparkle', 'star'][Math.floor(Math.random() * 2)] as ParticleEffect['type'];
      default:
        return ['heart', 'sparkle'][Math.floor(Math.random() * 2)] as ParticleEffect['type'];
    }
  };

  const getRandomColor = (effectType: string): string => {
    const colors = {
      celebration: ['#FF6B9D', '#9B59B6', '#3498DB', '#F39C12', '#E74C3C', '#2ECC71'],
      sync: ['#3498DB', '#9B59B6', '#00D4AA'],
      ambient: ['#FF6B9D', '#9B59B6', '#FFB6C1', '#DDA0DD']
    };
    
    const colorSet = colors[effectType as keyof typeof colors] || colors.ambient;
    return colorSet[Math.floor(Math.random() * colorSet.length)];
  };

  const getParticleIcon = (type: ParticleEffect['type']) => {
    switch (type) {
      case 'heart':
        return <Heart className="w-full h-full fill-current" />;
      case 'star':
        return <Star className="w-full h-full fill-current" />;
      case 'sparkle':
        return <Sparkles className="w-full h-full fill-current" />;
      case 'confetti':
        return <div className="w-full h-full bg-current rounded-sm" />;
      default:
        return <Heart className="w-full h-full fill-current" />;
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {/* Welcome Burst Effect */}
      <AnimatePresence>
        {showWelcomeBurst && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.2, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 2 }}
              className="text-center"
            >
              <div className="text-4xl font-bold text-primary mb-2">
                🎉 Partner Joined! 🎉
              </div>
              <div className="text-xl text-muted-foreground">
                Let's watch together!
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync Burst Effect */}
      <AnimatePresence>
        {showSyncBurst && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2"
          >
            <motion.div
              initial={{ scale: 0.8, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: -10, opacity: 0 }}
              className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">Synced!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particle Effects */}
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}vw`,
              y: `${particle.y}vh`,
              scale: 0,
              opacity: 0,
              rotate: 0
            }}
            animate={{
              y: `${particle.y - 30}vh`,
              scale: [0, 1.2, 1, 0.8, 0],
              opacity: [0, 1, 1, 0.5, 0],
              rotate: [0, 180, 360],
              x: particle.type === 'confetti' 
                ? [`${particle.x}vw`, `${particle.x + (Math.random() - 0.5) * 20}vw`]
                : `${particle.x}vw`
            }}
            exit={{
              scale: 0,
              opacity: 0
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: "easeOut"
            }}
            className="absolute"
            style={{ color: particle.color }}
          >
            <div className="w-6 h-6 drop-shadow-lg">
              {getParticleIcon(particle.type)}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Playing Indicator */}
      <AnimatePresence>
        {isPlaying && partnerJoined && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-4 left-4"
          >
            <div className="bg-green-500/20 border border-green-500/50 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Watching Together</span>
              <Music className="w-3 h-3" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner Hearts */}
      {isPlaying && partnerJoined && (
        <div className="absolute bottom-4 left-4">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.6, 0.8, 0.6]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Heart className="w-8 h-8 text-pink-500 fill-pink-500/50" />
          </motion.div>
        </div>
      )}
    </div>
  );
};