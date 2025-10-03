import { useState, useEffect } from 'react';
import { VideoQuality, DEFAULT_QUALITY } from '@/utils/videoQuality';

const STORAGE_KEY = 'ustuo_video_quality_preference';

export const useVideoQuality = () => {
  const [quality, setQuality] = useState<VideoQuality>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as VideoQuality) || DEFAULT_QUALITY;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, quality);
    console.log('[Quality] Preference saved:', quality);
  }, [quality]);

  return {
    quality,
    setQuality
  };
};
