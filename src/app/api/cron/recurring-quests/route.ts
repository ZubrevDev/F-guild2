import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { generateRecurringInstances } from "@/lib/recurring-quests";

/**
 * GET /api/cron/recurring-quests
 *
 * Generates recurring quest instances for all guilds.
 * Secured by CRON_SECRET environment variable.
 *
 * Call this endpoint from a cron service (e.g., Vercel Cron, external scheduler)
 * with the header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const createdCount = await generateRecurringInstances(db);

    return NextResponse.json({
      success: true,
      instancesCreated: createdCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to generate recurring quest instances:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
