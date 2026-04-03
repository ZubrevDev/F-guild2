/**
 * GET /api/cron/guild-cleanup
 *
 * Cron job for inactive guild lifecycle management:
 *   - Guilds inactive > 11 months  → warn the guild master via email
 *   - Guilds inactive > 12 months  → soft delete (set deletedAt)
 *   - Guilds soft-deleted > 30 days → hard delete (permanent removal)
 *
 * Secured by the CRON_SECRET environment variable.
 * Call with header: Authorization: Bearer <CRON_SECRET>
 */

// This route must not be statically rendered — it reads env vars and DB at runtime.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sendEmail } from "@/lib/email";

export async function GET(req: Request) {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // -------------------------------------------------------------------------
  // Date thresholds
  // -------------------------------------------------------------------------
  const now = new Date();

  const elevenMonthsAgo = new Date(now);
  elevenMonthsAgo.setMonth(now.getMonth() - 11);

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(now.getMonth() - 12);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // -------------------------------------------------------------------------
  // Deletion date shown in warning emails (lastActivityAt + 12 months)
  // We compute it per guild below, but keep a locale formatter ready.
  // -------------------------------------------------------------------------
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  try {
    // -----------------------------------------------------------------------
    // 1. Hard delete guilds that were soft-deleted more than 30 days ago
    // -----------------------------------------------------------------------
    const hardDeleteResult = await db.guild.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lte: thirtyDaysAgo,
        },
      },
    });
    const hardDeleted = hardDeleteResult.count;

    // -----------------------------------------------------------------------
    // 2. Soft delete guilds inactive for more than 12 months (not yet deleted)
    // -----------------------------------------------------------------------
    const softDeleteResult = await db.guild.updateMany({
      where: {
        deletedAt: null,
        lastActivityAt: {
          lte: twelveMonthsAgo,
        },
      },
      data: {
        deletedAt: now,
        isActive: false,
      },
    });
    const softDeleted = softDeleteResult.count;

    // -----------------------------------------------------------------------
    // 3. Warn guilds inactive for 11–12 months (not yet soft-deleted)
    //    Fetch with masters so we can email the owner.
    // -----------------------------------------------------------------------
    const guildsToWarn = await db.guild.findMany({
      where: {
        deletedAt: null,
        lastActivityAt: {
          lte: elevenMonthsAgo,
          gt: twelveMonthsAgo,
        },
      },
      include: {
        masters: {
          where: { role: "owner" },
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    let warned = 0;

    for (const guild of guildsToWarn) {
      const owner = guild.masters[0]?.user;
      if (!owner) continue;

      // Deletion date = lastActivityAt + 12 months
      const deletionDate = new Date(guild.lastActivityAt);
      deletionDate.setMonth(deletionDate.getMonth() + 12);

      const result = await sendEmail(
        owner.email,
        "guild_warning",
        {
          masterName: owner.name,
          guildName: guild.name,
          lastActivityAt: formatDate(guild.lastActivityAt),
          deletionDate: formatDate(deletionDate),
        },
        owner.id
      );

      if (result.success) {
        warned++;
      } else {
        console.error(
          `guild-cleanup: failed to warn master ${owner.id} for guild ${guild.id}: ${result.error}`
        );
      }
    }

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      warned,
      softDeleted,
      hardDeleted,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("guild-cleanup cron failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
