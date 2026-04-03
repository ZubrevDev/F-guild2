/**
 * In-memory sliding window rate limiter.
 * Tracks request timestamps per key (IP) and enforces max requests per window.
 */

type RateLimitEntry = {
  timestamps: number[];
};

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    // Remove entries with no recent timestamps
    if (
      entry.timestamps.length === 0 ||
      entry.timestamps[entry.timestamps.length - 1] < now - 120_000
    ) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

// Prevent the cleanup interval from keeping the process alive
if (typeof globalThis !== "undefined" && store) {
  // unref only works in Node.js
  // The interval is stored in the module scope, so we can't unref directly.
  // This is fine for a server process.
}

export type RateLimitConfig = {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
};

/**
 * Check if a request is allowed under the rate limit.
 * Uses a sliding window approach.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.max) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + config.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.max - entry.timestamps.length,
    retryAfterMs: null,
  };
}

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for, x-real-ip, then falls back to "unknown".
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

/** Rate limit config: 100 requests per minute (auth endpoints) */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  max: 100,
  windowMs: 60_000,
};

/** Rate limit config: 300 requests per minute (general API) */
export const API_RATE_LIMIT: RateLimitConfig = {
  max: 300,
  windowMs: 60_000,
};
