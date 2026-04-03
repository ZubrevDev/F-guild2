/**
 * Redis-backed rate limiter using the INCR + EXPIRE pattern.
 * Falls back transparently to the in-memory sliding-window implementation
 * when Redis is unavailable.
 *
 * Exposes the same public interface as src/lib/rate-limit.ts so callers
 * can swap one for the other without any changes.
 */

import { getRedis } from "./redis";
import {
  checkRateLimit as checkRateLimitMemory,
  getClientIp,
  type RateLimitConfig,
  type RateLimitResult,
  AUTH_RATE_LIMIT,
  API_RATE_LIMIT,
} from "./rate-limit";

// Re-export shared types and helpers so callers only need one import.
export type { RateLimitConfig, RateLimitResult };
export { getClientIp, AUTH_RATE_LIMIT, API_RATE_LIMIT };

/**
 * Check whether a request identified by `key` is within the rate limit.
 *
 * When Redis is available the counter is stored there, giving shared state
 * across multiple Node.js processes / serverless instances.
 * When Redis is unavailable the function delegates to the in-memory limiter.
 *
 * The Redis implementation uses a fixed window (INCR + EXPIRE).
 * The window resets once the key expires, so the maximum burst within a
 * single window is `config.max` requests.
 */
export async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedis();

  if (!redis || redis.status !== "ready") {
    // Graceful fallback — synchronous in-memory limiter.
    return checkRateLimitMemory(key, config);
  }

  const windowSeconds = Math.ceil(config.windowMs / 1000);
  const redisKey = `rl:${key}:${Math.floor(Date.now() / config.windowMs)}`;

  try {
    // Atomic increment inside the current window bucket.
    const count = await redis.incr(redisKey);

    // Set expiry only on the first request so it is not reset on every call.
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    if (count > config.max) {
      // Compute how long until the current window bucket expires.
      const ttl = await redis.pttl(redisKey);
      const retryAfterMs = ttl > 0 ? ttl : config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
      };
    }

    return {
      allowed: true,
      remaining: config.max - count,
      retryAfterMs: null,
    };
  } catch (err) {
    // If Redis throws unexpectedly, fail open and fall back to in-memory.
    console.error("[RedisRateLimit] error, falling back to in-memory:", err);
    return checkRateLimitMemory(key, config);
  }
}
