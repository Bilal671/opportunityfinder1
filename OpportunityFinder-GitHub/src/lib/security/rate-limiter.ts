interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth_signup: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
  auth_signin: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per minute
  auth_reset: { maxRequests: 3, windowMs: 60 * 1000 }, // 3 per minute
  search: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
  audit: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
  export_csv: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per minute
  ai_analysis: { maxRequests: 15, windowMs: 60 * 1000 }, // 15 per minute
};

/**
 * Checks and increments rate limit for a specific key and operation.
 */
export function checkRateLimit(
  identifier: string,
  operation: keyof typeof RATE_LIMITS
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const config = RATE_LIMITS[operation] || { maxRequests: 60, windowMs: 60 * 1000 };
  const key = `${operation}:${identifier}`;
  const now = Date.now();

  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    memoryStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      retryAfterSec: 0,
    };
  }

  if (record.count >= config.maxRequests) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    retryAfterSec: 0,
  };
}
