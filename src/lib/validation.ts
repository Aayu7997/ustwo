// Input validation utilities for security
import DOMPurify from 'isomorphic-dompurify';

// Email validation with stronger regex
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Enhanced password validation
export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  
  if (password.length > 128) {
    return { valid: false, message: "Password must be less than 128 characters" };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  
  return { valid: true };
};

// Room name validation with sanitization
export const validateRoomName = (name: string): { valid: boolean; sanitized: string; message?: string } => {
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, sanitized: '', message: "Room name cannot be empty" };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, sanitized: trimmed, message: "Room name must be less than 50 characters" };
  }
  
  // Remove potential XSS vectors and sanitize
  const sanitized = DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [] });
  
  // Check for malicious patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      return { valid: false, sanitized, message: "Room name contains invalid characters" };
    }
  }
  
  return { valid: true, sanitized };
};

// Room code validation
export const validateRoomCode = (code: string): { valid: boolean; sanitized: string; message?: string } => {
  const trimmed = code.trim().toUpperCase();
  
  if (trimmed.length === 0) {
    return { valid: false, sanitized: '', message: "Room code cannot be empty" };
  }
  
  if (!/^[A-Z0-9]{6}$/.test(trimmed)) {
    return { valid: false, sanitized: trimmed, message: "Room code must be exactly 6 characters (letters and numbers only)" };
  }
  
  return { valid: true, sanitized: trimmed };
};

// Rate limiting helper
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];
    
    // Remove old attempts outside the time window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Add current attempt
    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);
    
    return true;
  }
  
  getRemainingTime(identifier: string): number {
    const attempts = this.attempts.get(identifier) || [];
    if (attempts.length === 0) return 0;
    
    const oldestAttempt = Math.min(...attempts);
    const timeLeft = this.windowMs - (Date.now() - oldestAttempt);
    
    return Math.max(0, timeLeft);
  }
}

// Create rate limiters for different actions
export const authRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes
export const roomRateLimiter = new RateLimiter(10, 5 * 60 * 1000); // 10 attempts per 5 minutes