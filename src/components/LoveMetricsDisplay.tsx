import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useLoveMetrics } from '@/hooks/useLoveMetrics';
import { Heart, Clock, Calendar, Trophy, Flame, Star } from 'lucide-react';

interface LoveMetricsDisplayProps {
  roomId: string;
  partnerId?: string;
}

export const LoveMetricsDisplay: React.FC<LoveMetricsDisplayProps> = ({
  roomId,
  partnerId
}) => {
  const { metrics, achievements, loading } = useLoveMetrics(roomId, partnerId);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Couple Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-br from-love-pink/20 to-love-purple/20 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-love-pink" />
              Couple Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-4xl font-bold bg-gradient-to-r from-love-pink to-love-purple bg-clip-text text-transparent">
                  {metrics.coupleScore}
                </span>
                <Badge variant="secondary" className="text-lg">
                  Level {Math.floor(metrics.coupleScore / 10)}
                </Badge>
              </div>
              <Progress value={metrics.coupleScore} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Watch Time</span>
              </div>
              <p className="text-2xl font-bold">
                {Math.floor(metrics.watchTimeMinutes / 60)}h {metrics.watchTimeMinutes % 60}m
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Sessions</span>
              </div>
              <p className="text-2xl font-bold">{metrics.sessionsCount}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Streak</span>
              </div>
              <p className="text-2xl font-bold">{metrics.daysStreak} days</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Hearts</span>
              </div>
              <p className="text-2xl font-bold">
                {metrics.heartsSent} / {metrics.heartsReceived}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  achievement.unlocked
                    ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50'
                    : 'bg-muted/50 border-muted-foreground/20 grayscale opacity-50'
                }`}
              >
                <div className="text-center space-y-1">
                  <div className="text-3xl">{achievement.icon}</div>
                  <p className="text-xs font-medium">{achievement.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {achievement.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};