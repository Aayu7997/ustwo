import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLoveStats } from '@/hooks/useLoveStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Heart, Clock, Play, TrendingUp, Calendar, Star } from 'lucide-react';

interface LoveMeterProps {
  partnerId?: string;
}

export const LoveMeter: React.FC<LoveMeterProps> = ({ partnerId }) => {
  const { stats, loading, getTotalStats, getWeeklyStats } = useLoveStats(partnerId);
  const [animatedValues, setAnimatedValues] = useState({ watchTime: 0, sessions: 0, hearts: 0 });
  
  const totalStats = getTotalStats();
  const weeklyStats = getWeeklyStats();

  // Animate counters
  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      setAnimatedValues({
        watchTime: Math.floor(totalStats.totalWatchTime * easeProgress),
        sessions: Math.floor(totalStats.totalSessions * easeProgress),
        hearts: Math.floor(totalStats.totalHeartsSent * easeProgress)
      });

      if (currentStep >= steps) {
        clearInterval(interval);
        setAnimatedValues({
          watchTime: totalStats.totalWatchTime,
          sessions: totalStats.totalSessions,
          hearts: totalStats.totalHeartsSent
        });
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [totalStats]);

  const formatWatchTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) return `${remainingMinutes}m`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getLoveLevel = () => {
    const totalMinutes = totalStats.totalWatchTime;
    if (totalMinutes < 60) return { level: 'New Love', progress: (totalMinutes / 60) * 100, color: 'bg-pink-400' };
    if (totalMinutes < 300) return { level: 'Growing Strong', progress: ((totalMinutes - 60) / 240) * 100, color: 'bg-purple-400' };
    if (totalMinutes < 1000) return { level: 'Deep Connection', progress: ((totalMinutes - 300) / 700) * 100, color: 'bg-red-400' };
    return { level: 'Soulmates', progress: 100, color: 'bg-gradient-to-r from-pink-500 to-red-500' };
  };

  const loveLevel = getLoveLevel();

  if (loading) {
    return (
      <Card className="border-pink-200 dark:border-pink-800">
        <CardContent className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-pink-200 dark:border-pink-800 overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart className="w-5 h-5 text-pink-500 fill-current" />
          </motion.div>
          Love Meter
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Love Level Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Love Level</span>
            <span className="text-sm text-muted-foreground">{loveLevel.level}</span>
          </div>
          
          <div className="relative">
            <Progress value={loveLevel.progress} className="h-3" />
            <motion.div
              className="absolute top-0 left-0 h-3 rounded-full opacity-50"
              style={{ background: loveLevel.color }}
              animate={{ width: `${loveLevel.progress}%` }}
              transition={{ duration: 2, ease: "easeOut" }}
            />
          </div>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="w-3 h-3 fill-current text-yellow-500" />
            <span>Keep watching together to level up!</span>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            className="text-center p-4 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-lg"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-2"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            >
              <Clock className="w-6 h-6 text-white" />
            </motion.div>
            <div className="text-2xl font-bold text-pink-600">
              {formatWatchTime(animatedValues.watchTime)}
            </div>
            <div className="text-xs text-muted-foreground">Total Time</div>
          </motion.div>

          <motion.div
            className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
            >
              <Play className="w-6 h-6 text-white" />
            </motion.div>
            <div className="text-2xl font-bold text-purple-600">
              {animatedValues.sessions}
            </div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </motion.div>

          <motion.div
            className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <motion.div
              className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 1.5 }}
            >
              <Heart className="w-6 h-6 text-white fill-current" />
            </motion.div>
            <div className="text-2xl font-bold text-red-600">
              {animatedValues.hearts}
            </div>
            <div className="text-xs text-muted-foreground">Hearts Sent</div>
          </motion.div>
        </div>

        {/* Weekly Stats */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-sm">This Week</span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-blue-600">
                {formatWatchTime(weeklyStats.watchTime)}
              </div>
              <div className="text-xs text-muted-foreground">Watched</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-600">
                {weeklyStats.sessions}
              </div>
              <div className="text-xs text-muted-foreground">Sessions</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-600">
                {weeklyStats.hearts}
              </div>
              <div className="text-xs text-muted-foreground">Hearts</div>
            </div>
          </div>
        </div>

        {/* Heartbeat Animation */}
        <div className="flex justify-center">
          <motion.div
            className="flex items-center gap-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-pink-500 rounded-full"
                animate={{ scale: [0.8, 1.2, 0.8] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity,
                  delay: i * 0.1
                }}
              />
            ))}
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
};