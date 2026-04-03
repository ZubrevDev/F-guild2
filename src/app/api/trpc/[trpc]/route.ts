import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc";
import { auth } from "@/auth";
import {
  checkRateLimit,
  getClientIp,
  API_RATE_LIMIT,
} from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/sanitize";

/**
 * Sanitize the JSON body of POST requests (tRPC mutations).
 * Returns a new Request with sanitized body, or the original for non-POST.
 */
async function sanitizeRequest(req: Request): Promise<Request> {
  if (req.method !== "POST") {
    return req;
  }

  try {
    const body = await req.json();
    const sanitizedBody = sanitizeInput(body);
    return new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(sanitizedBody),
    });
  } catch {
    // If body parsing fails, let tRPC handle the error
    return req;
  }
}

async function handler(req: Request) {
  // Rate limiting: 300 req/min for general API
  const ip = getClientIp(req);
  const rateLimitResult = checkRateLimit(`trpc:${ip}`, API_RATE_LIMIT);

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(
            Math.ceil((rateLimitResult.retryAfterMs ?? 60000) / 1000)
          ),
          "X-RateLimit-Limit": String(API_RATE_LIMIT.max),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // Sanitize input for mutation requests
  const sanitizedReq = await sanitizeRequest(req);

  const session = await auth();

  let sessionCtx: { userId: string; role: "master" | "player" | "platform_admin" } | undefined;

  if (session?.user?.id) {
    // Check isPlatformAdmin flag from DB for the authenticated user
    const { db } = await import("@/server/db");
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isPlatformAdmin: true },
    });

    sessionCtx = {
      userId: session.user.id,
      role: dbUser?.isPlatformAdmin ? "platform_admin" : "master",
    };
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: sanitizedReq,
    router: appRouter,
    createContext: () => createContext({ session: sessionCtx }),
  });
}

export { handler as GET, handler as POST };
