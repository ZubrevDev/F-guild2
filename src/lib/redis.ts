/**
 * Redis client singleton backed by ioredis.
 * When REDIS_URL is not set, all helpers return null / no-op
 * so the application continues to work without Redis.
 */

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

let redis: Redis | null = null;

/**
 * Return the shared Redis instance (lazy-connect).
 * Returns null when REDIS_URL is not configured.
 */
export function getRedis(): Redis | null {
  if (!REDIS_URL) return null;

  if (redis) return redis;

  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    lazyConnect: true,
  });

  redis.on("error", (err: Error) => {
    console.error("[Redis] connection error:", err.message);
  });

  return redis;
}

/**
 * Returns true only when the client is connected and ready.
 */
export function isRedisAvailable(): boolean {
  return redis?.status === "ready";
}
