import type { PrismaClient, QuestRecurrence } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = { [K in keyof PrismaClient]: any } & Record<string, any>;

/**
 * Calculate the start of the current period for a given recurrence type.
 * All dates are in UTC.
 */
export function getPeriodStart(
  recurrence: QuestRecurrence,
  now: Date = new Date()
): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  switch (recurrence) {
    case "daily":
      return new Date(Date.UTC(year, month, date));

    case "weekly": {
      // Week starts on Monday (ISO)
      const day = now.getUTCDay(); // 0=Sun, 1=Mon...
      const mondayOffset = day === 0 ? -6 : 1 - day;
      return new Date(Date.UTC(year, month, date + mondayOffset));
    }

    case "monthly":
      return new Date(Date.UTC(year, month, 1));

    default:
      return new Date(Date.UTC(year, month, date));
  }
}

/**
 * Get the end of the current period (exclusive) for progress calculations.
 */
export function getPeriodEnd(
  recurrence: QuestRecurrence,
  periodStart: Date
): Date {
  const year = periodStart.getUTCFullYear();
  const month = periodStart.getUTCMonth();
  const date = periodStart.getUTCDate();

  switch (recurrence) {
    case "daily":
      return new Date(Date.UTC(year, month, date + 1));

    case "weekly":
      return new Date(Date.UTC(year, month, date + 7));

    case "monthly":
      return new Date(Date.UTC(year, month + 1, 1));

    default:
      return new Date(Date.UTC(year, month, date + 1));
  }
}

/**
 * Get the total number of expected completions in the current tracking window.
 * For daily quests: 7 (this week, Mon-Sun).
 * For weekly quests: 4 or 5 (this month).
 * For monthly quests: 12 (this year).
 */
export function getTotalForPeriod(
  recurrence: QuestRecurrence,
  now: Date = new Date()
): { total: number; label: string } {
  switch (recurrence) {
    case "daily":
      return { total: 7, label: "this week" };

    case "weekly": {
      // Number of weeks in current month
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
      const weeks = Math.ceil((lastDay + (firstDow === 0 ? 6 : firstDow - 1)) / 7);
      return { total: weeks, label: "this month" };
    }

    case "monthly":
      return { total: 12, label: "this year" };

    default:
      return { total: 1, label: "" };
  }
}

/**
 * Get the start of the tracking window for progress counting.
 * Daily -> start of this week (Monday).
 * Weekly -> start of this month.
 * Monthly -> start of this year.
 */
function getTrackingWindowStart(
  recurrence: QuestRecurrence,
  now: Date = new Date()
): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  switch (recurrence) {
    case "daily": {
      const day = now.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      return new Date(Date.UTC(year, month, date + mondayOffset));
    }
    case "weekly":
      return new Date(Date.UTC(year, month, 1));
    case "monthly":
      return new Date(Date.UTC(year, 0, 1));
    default:
      return new Date(Date.UTC(year, month, date));
  }
}

/**
 * Generate recurring quest instances for all active recurring quests
 * in a given guild (or all guilds if guildId is omitted).
 *
 * For each recurring quest and each assigned player, creates a QuestInstance
 * for the current period if one does not already exist.
 *
 * Returns the number of instances created.
 */
export async function generateRecurringInstances(
  db: DbClient,
  guildId?: string
): Promise<number> {
  const now = new Date();

  // Find all active recurring quests
  const quests = await db.quest.findMany({
    where: {
      isActive: true,
      recurrence: { notIn: ["once", "custom"] },
      ...(guildId ? { guildId } : {}),
    },
    include: {
      guild: {
        include: {
          players: { select: { id: true } },
        },
      },
    },
  });

  let createdCount = 0;

  for (const quest of quests) {
    const periodStart = getPeriodStart(quest.recurrence, now);

    // Determine target players: assignedTo list, or all guild players if empty
    const targetPlayerIds =
      quest.assignedTo.length > 0
        ? quest.assignedTo
        : quest.guild.players.map((p: { id: string }) => p.id);

    for (const playerId of targetPlayerIds) {
      // Check if instance already exists for this quest+player+period
      const existing = await db.questInstance.findFirst({
        where: {
          questId: quest.id,
          playerId,
          periodStart,
        },
      });

      if (!existing) {
        await db.questInstance.create({
          data: {
            questId: quest.id,
            playerId,
            status: "available",
            periodStart,
          },
        });
        createdCount++;
      }
    }
  }

  return createdCount;
}

/**
 * Get recurring progress for a specific quest and player.
 * Returns completed count within the current tracking window.
 */
export async function getRecurringProgress(
  db: DbClient,
  questId: string,
  playerId: string
): Promise<{
  completed: number;
  total: number;
  label: string;
  recurrence: QuestRecurrence;
}> {
  const quest = await db.quest.findUnique({
    where: { id: questId },
  });

  if (!quest || quest.recurrence === "once" || quest.recurrence === "custom") {
    return { completed: 0, total: 1, label: "", recurrence: quest?.recurrence ?? "once" };
  }

  const now = new Date();
  const windowStart = getTrackingWindowStart(quest.recurrence, now);
  const { total, label } = getTotalForPeriod(quest.recurrence, now);

  const completedCount = await db.questInstance.count({
    where: {
      questId,
      playerId,
      status: "completed",
      periodStart: { gte: windowStart },
    },
  });

  return {
    completed: completedCount,
    total,
    label,
    recurrence: quest.recurrence,
  };
}
