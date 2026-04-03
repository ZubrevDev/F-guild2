/**
 * Generic Redis cache helpers with graceful no-op fallback.
 * All functions silently return null / void when Redis is unavailable.
 */

import { getRedis } from "./redis";

/** Default TTL: 5 minutes */
const DEFAULT_TTL_SECONDS = 300;

/**
 * Retrieve a cached value by key.
 * Returns null when the key does not exist or Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[Cache] cacheGet error:", err);
    return null;
  }
}

/**
 * Store a value in Redis with an optional TTL (seconds).
 * No-op when Redis is unavailable.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error("[Cache] cacheSet error:", err);
  }
}

/**
 * Delete a single cache key.
 * No-op when Redis is unavailable.
 */
export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (err) {
    console.error("[Cache] cacheDelete error:", err);
  }
}

/**
 * Delete all cache keys matching a glob pattern (e.g. "character:*").
 * Uses SCAN to avoid blocking the server with KEYS.
 * No-op when Redis is unavailable.
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error("[Cache] cacheDeletePattern error:", err);
  }
}
