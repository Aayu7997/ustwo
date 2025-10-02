export type OTTPlatform = 'netflix' | 'prime' | 'hotstar' | 'disney' | 'hbo' | 'hulu' | 'youtube' | 'vimeo' | 'unknown';

export interface OTTInfo {
  platform: OTTPlatform;
  name: string;
  extensionRequired: boolean;
  embedSupported: boolean;
  color: string;
  instructions?: string;
}

export const detectOTTPlatform = (url: string): OTTInfo => {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('netflix.com')) {
    return {
      platform: 'netflix',
      name: 'Netflix',
      extensionRequired: true,
      embedSupported: false,
      color: 'hsl(0, 100%, 50%)',
      instructions: 'Install UsTwo Extension to sync Netflix. Extension controls playback automatically.'
    };
  }

  if (urlLower.includes('primevideo.com') || urlLower.includes('amazon.') && urlLower.includes('video')) {
    return {
      platform: 'prime',
      name: 'Amazon Prime Video',
      extensionRequired: true,
      embedSupported: false,
      color: 'hsl(200, 100%, 40%)',
      instructions: 'Install UsTwo Extension to sync Prime Video. Extension controls playback automatically.'
    };
  }

  if (urlLower.includes('hotstar.com') || urlLower.includes('disneyplus.com/hotstar')) {
    return {
      platform: 'hotstar',
      name: 'Disney+ Hotstar',
      extensionRequired: true,
      embedSupported: false,
      color: 'hsl(210, 100%, 30%)',
      instructions: 'Install UsTwo Extension to sync Hotstar. Extension controls playback automatically.'
    };
  }

  if (urlLower.includes('disneyplus.com')) {
    return {
      platform: 'disney',
      name: 'Disney+',
      extensionRequired: true,
      embedSupported: false,
      color: 'hsl(220, 100%, 50%)',
      instructions: 'Install UsTwo Extension to sync Disney+. Extension controls playback automatically.'
    };
  }

  if (urlLower.includes('hbomax.com') || urlLower.includes('play.hbo') || urlLower.includes('max.com')) {
    return {
      platform: 'hbo',
      name: 'HBO Max / Max',
      extensionRequired: true,
      embedSupported: false,
      color: 'hsl(270, 60%, 50%)',
      instructions: 'Install UsTwo Extension to sync HBO Max. Extension controls playback automatically.'
    };
  }

  if (urlLower.includes('hulu.com')) {
    return {
      platform: 'hulu',
      name: 'Hulu',
      extensionRequired: true,
      embedSupported: false,
      color: 'hsl(140, 70%, 50%)',
      instructions: 'Install UsTwo Extension to sync Hulu. Extension controls playback automatically.'
    };
  }

  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return {
      platform: 'youtube',
      name: 'YouTube',
      extensionRequired: false,
      embedSupported: true,
      color: 'hsl(0, 100%, 50%)'
    };
  }

  if (urlLower.includes('vimeo.com')) {
    return {
      platform: 'vimeo',
      name: 'Vimeo',
      extensionRequired: false,
      embedSupported: true,
      color: 'hsl(200, 100%, 50%)'
    };
  }

  return {
    platform: 'unknown',
    name: 'Unknown Platform',
    extensionRequired: false,
    embedSupported: false,
    color: 'hsl(0, 0%, 50%)',
    instructions: 'This video source is not supported. Please use YouTube, Vimeo, or upload a file.'
  };
};

export const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/shorts\/([^&\?\/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

export const extractVimeoVideoId = (url: string): string | null => {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

export const isDirectVideoURL = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.m3u8', '.mpd'];
  const urlLower = url.toLowerCase();
  return videoExtensions.some(ext => urlLower.includes(ext));
};
