/**
 * GET /api/health
 *
 * Returns a JSON health-check payload that includes:
 *  - overall status
 *  - Redis connectivity
 *  - current UTC timestamp
 */

import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const redis = getRedis();

  let redisStatus: "connected" | "unavailable" = "unavailable";

  if (redis) {
    try {
      const pong = await redis.ping();
      if (pong === "PONG") {
        redisStatus = "connected";
      }
    } catch {
      // Redis ping failed — status remains "unavailable"
    }
  }

  return NextResponse.json({
    status: "ok",
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  });
}
