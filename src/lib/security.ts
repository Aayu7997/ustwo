// Security utilities for headers and CSP
export const addSecurityHeaders = () => {
  // Set security headers via meta tags for static hosting
  const setMetaTag = (property: string, content: string) => {
    let meta = document.querySelector(`meta[http-equiv="${property}"]`) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.httpEquiv = property;
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  // Content Security Policy
  setMetaTag('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "media-src 'self' blob: https:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; " +
    "object-src 'none';"
  );

  // X-Frame-Options
  setMetaTag('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  setMetaTag('X-Content-Type-Options', 'nosniff');

  // Referrer Policy
  setMetaTag('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  setMetaTag('Permissions-Policy', 
    'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()'
  );
};

// URL validation for media sources
export const validateMediaUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    
    // Allow common video hosting domains
    const allowedDomains = [
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'dailymotion.com',
      'twitch.tv',
      'netflix.com',
      'hulu.com',
      'disney.com',
      'primevideo.com',
      'hbo.com',
      'crunchyroll.com'
    ];
    
    const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    return allowedDomains.some(allowed => domain.includes(allowed));
  } catch {
    return false;
  }
};

// Initialize security measures
export const initializeSecurity = () => {
  // Add security headers
  addSecurityHeaders();
  
  // Disable right-click context menu on production
  if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
  
  // Disable F12 and other dev tools shortcuts in production
  if (import.meta.env.PROD) {
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    });
  }
};