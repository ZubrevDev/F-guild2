import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import {
  checkRateLimit,
  getClientIp,
  AUTH_RATE_LIMIT,
} from "@/lib/rate-limit";

function withRateLimit(
  handler: (req: NextRequest) => Promise<Response> | Response
) {
  return async (req: NextRequest) => {
    const ip = getClientIp(req);
    const result = checkRateLimit(`auth:${ip}`, AUTH_RATE_LIMIT);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(
              Math.ceil((result.retryAfterMs ?? 60000) / 1000)
            ),
            "X-RateLimit-Limit": String(AUTH_RATE_LIMIT.max),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    return handler(req);
  };
}

export const GET = withRateLimit(handlers.GET);
export const POST = withRateLimit(handlers.POST);
