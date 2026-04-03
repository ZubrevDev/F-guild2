import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";

/**
 * GET /api/dice-log/export?guildId=...&playerId=...&dateFrom=...&dateTo=...&context=...
 *
 * Returns dice log as CSV file. Master-only endpoint.
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const guildId = searchParams.get("guildId");

  if (!guildId) {
    return NextResponse.json({ error: "guildId is required" }, { status: 400 });
  }

  // Verify the caller is a master of this guild
  const membership = await db.guildMaster.findUnique({
    where: { guildId_userId: { guildId, userId: session.user.id } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build where clause
  const playerId = searchParams.get("playerId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const context = searchParams.get("context");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    character: {
      player: {
        guildId,
        ...(playerId ? { id: playerId } : {}),
      },
    },
  };

  if (dateFrom || dateTo) {
    where.rolledAt = {};
    if (dateFrom) where.rolledAt.gte = new Date(dateFrom);
    if (dateTo) where.rolledAt.lte = new Date(dateTo);
  }

  if (context) {
    where.context = { contains: context, mode: "insensitive" };
  }

  const logs = await db.diceLog.findMany({
    where,
    orderBy: { rolledAt: "desc" },
    include: {
      character: {
        include: {
          player: { select: { name: true } },
        },
      },
    },
  });

  // Build CSV
  const header = "Date,Player,Context,Roll,Modifiers,Total,DC,Success";
  const rows = logs.map((log) => {
    const date = log.rolledAt.toISOString();
    const player = escapeCsvField(log.character.player.name);
    const ctx = escapeCsvField(log.context);
    const modifiers = escapeCsvField(JSON.stringify(log.modifiers));
    return `${date},${player},${ctx},${log.rollValue},${modifiers},${log.total},${log.difficultyClass},${log.success}`;
  });

  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dice-log-${guildId}.csv"`,
    },
  });
}

/** Escape a value for CSV: wrap in quotes if it contains comma, quote, or newline */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
