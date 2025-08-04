import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  Users, 
  Clock, 
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface SyncMetrics {
  latency: number;
  jitter: number;
  bufferingEvents: number;
  syncDrift: number;
}

interface PresenceUser {
  user_id: string;
  email: string;
  online_at: string;
  status: 'watching' | 'buffering' | 'paused' | 'idle';
}

interface SyncStatusIndicatorProps {
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  syncStatus: 'synced' | 'syncing' | 'drift';
  presenceUsers: PresenceUser[];
  currentPartner?: PresenceUser;
  metrics: SyncMetrics;
  isAutoSyncing: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  connectionStatus,
  syncStatus,
  presenceUsers,
  currentPartner,
  metrics,
  isAutoSyncing
}) => {
  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <Wifi className="w-4 h-4 text-yellow-500" />
        </motion.div>;
      default:
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'syncing':
        return <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <Zap className="w-4 h-4 text-blue-500" />
        </motion.div>;
      case 'drift':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConnectionQuality = () => {
    if (metrics.latency < 100 && metrics.jitter < 20) return 'excellent';
    if (metrics.latency < 200 && metrics.jitter < 50) return 'good';
    if (metrics.latency < 500 && metrics.jitter < 100) return 'fair';
    return 'poor';
  };

  const quality = getConnectionQuality();
  const qualityColors = {
    excellent: 'bg-green-500',
    good: 'bg-blue-500',
    fair: 'bg-yellow-500',
    poor: 'bg-red-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-3 bg-background/95 backdrop-blur-sm border rounded-lg shadow-sm"
    >
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        {getConnectionIcon()}
        <span className="text-sm font-medium capitalize">{connectionStatus}</span>
      </div>

      {/* User Count */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4" />
        <span className="text-sm">{presenceUsers.length}</span>
      </div>

      {/* Sync Status */}
      <div className="flex items-center gap-2">
        {getSyncIcon()}
        <Badge variant={syncStatus === 'synced' ? 'default' : 'secondary'}>
          {isAutoSyncing && syncStatus === 'syncing' ? 'Auto-sync' : syncStatus}
        </Badge>
      </div>

      {/* Partner Status */}
      {currentPartner && (
        <Badge variant="outline" className="capitalize">
          Partner: {currentPartner.status}
        </Badge>
      )}

      {/* Connection Quality */}
      {metrics.latency > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-muted"></div>
            <div className={`w-2 h-2 rounded-full ${quality !== 'poor' ? qualityColors[quality] : 'bg-muted'}`}></div>
            <div className={`w-2 h-2 rounded-full ${quality === 'excellent' || quality === 'good' ? qualityColors[quality] : 'bg-muted'}`}></div>
            <div className={`w-2 h-2 rounded-full ${quality === 'excellent' ? qualityColors[quality] : 'bg-muted'}`}></div>
          </div>
          <span className="text-xs text-muted-foreground capitalize">{quality}</span>
        </div>
      )}

      {/* Detailed Metrics (when expanded) */}
      {metrics.latency > 0 && (
        <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground border-l pl-4">
          <div>Ping: {metrics.latency}ms</div>
          <div>Jitter: {metrics.jitter.toFixed(1)}ms</div>
          {metrics.syncDrift > 1 && (
            <div className="text-orange-600">Drift: {metrics.syncDrift.toFixed(2)}s</div>
          )}
          {metrics.bufferingEvents > 3 && (
            <div className="text-red-600">Buffer: {metrics.bufferingEvents}</div>
          )}
        </div>
      )}
    </motion.div>
  );
};