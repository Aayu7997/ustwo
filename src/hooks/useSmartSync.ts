import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/ui/use-toast';

interface SyncMetrics {
  latency: number;
  jitter: number;
  bufferingEvents: number;
  syncDrift: number;
}

interface UseSmartSyncProps {
  onResync: () => void;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
}

export const useSmartSync = ({
  onResync,
  getCurrentTime,
  isPlaying
}: UseSmartSyncProps) => {
  const [metrics, setMetrics] = useState<SyncMetrics>({
    latency: 0,
    jitter: 0,
    bufferingEvents: 0,
    syncDrift: 0
  });
  
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const metricsRef = useRef<number[]>([]);
  const lastSyncTimeRef = useRef<number>(0);
  const bufferingCountRef = useRef(0);

  // Monitor sync drift and auto-correct
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const currentTime = getCurrentTime();
      const expectedTime = lastSyncTimeRef.current + (Date.now() - lastSyncTimeRef.current) / 1000;
      const drift = Math.abs(currentTime - expectedTime);

      setMetrics(prev => ({ ...prev, syncDrift: drift }));

      // Auto-resync if drift is too high (>2 seconds)
      if (drift > 2 && !isAutoSyncing) {
        setIsAutoSyncing(true);
        toast({
          title: "Auto-Sync Active",
          description: "Correcting playback drift...",
        });
        
        onResync();
        
        setTimeout(() => setIsAutoSyncing(false), 2000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, onResync, isAutoSyncing]);

  // Measure network latency
  const measureLatency = async () => {
    const start = performance.now();
    try {
      await fetch('/ping', { method: 'HEAD' });
      const latency = performance.now() - start;
      
      metricsRef.current.push(latency);
      if (metricsRef.current.length > 10) {
        metricsRef.current.shift();
      }
      
      const avgLatency = metricsRef.current.reduce((a, b) => a + b, 0) / metricsRef.current.length;
      const jitter = Math.max(...metricsRef.current) - Math.min(...metricsRef.current);
      
      setMetrics(prev => ({
        ...prev,
        latency: avgLatency,
        jitter
      }));
    } catch (error) {
      console.error('Latency measurement failed:', error);
    }
  };

  // Track buffering events
  const onBuffering = () => {
    bufferingCountRef.current++;
    setMetrics(prev => ({
      ...prev,
      bufferingEvents: bufferingCountRef.current
    }));

    // Predict if reconnection is needed
    if (bufferingCountRef.current > 3) {
      toast({
        title: "Connection Issues Detected",
        description: "Smart sync will handle reconnection automatically",
        variant: "destructive"
      });
    }
  };

  // Update sync reference time
  const updateSyncTime = (time: number) => {
    lastSyncTimeRef.current = Date.now();
  };

  // Reset metrics
  const resetMetrics = () => {
    bufferingCountRef.current = 0;
    metricsRef.current = [];
    setMetrics({
      latency: 0,
      jitter: 0,
      bufferingEvents: 0,
      syncDrift: 0
    });
  };

  useEffect(() => {
    const interval = setInterval(measureLatency, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    isAutoSyncing,
    onBuffering,
    updateSyncTime,
    resetMetrics
  };
};