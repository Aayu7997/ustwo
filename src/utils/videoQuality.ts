export type VideoQuality = '360p' | '480p' | '720p' | '1080p' | 'auto';

export const VIDEO_QUALITY_PRESETS = {
  '360p': {
    label: '360p (Low)',
    width: 640,
    height: 360,
    bandwidth: 500, // Kbps
    description: 'Lowest quality, best for slow connections'
  },
  '480p': {
    label: '480p (Standard)',
    width: 854,
    height: 480,
    bandwidth: 1000,
    description: 'Standard quality, good for mobile'
  },
  '720p': {
    label: '720p (HD)',
    width: 1280,
    height: 720,
    bandwidth: 2500,
    description: 'High definition, balanced quality'
  },
  '1080p': {
    label: '1080p (Full HD)',
    width: 1920,
    height: 1080,
    bandwidth: 5000,
    description: 'Highest quality, best for fast connections'
  },
  'auto': {
    label: 'Auto (Adaptive)',
    width: 1920,
    height: 1080,
    bandwidth: 5000,
    description: 'Automatically adjust based on connection'
  }
} as const;

export const DEFAULT_QUALITY: VideoQuality = '1080p';

export const getVideoConstraints = (quality: VideoQuality) => {
  const preset = VIDEO_QUALITY_PRESETS[quality];
  
  return {
    width: { ideal: preset.width, max: 1920 },
    height: { ideal: preset.height, max: 1080 },
    facingMode: 'user',
    frameRate: { ideal: 30, max: 60 }
  };
};
