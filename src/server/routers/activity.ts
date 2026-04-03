import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

const ACTION_TYPES = [
  "quest_complete",
  "level_up",
  "purchase",
  "buff_applied",
  "prayer_sent",
  "quest_accepted",
  "quest_rejected",
  "item_acquired",
  "buff_expired",
  "prayer_answered",
] as const;

const LOG_LEVELS = ["info", "important", "warning"] as const;

const PAGE_SIZE = 20;

export const activityRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        actionTypes: z.array(z.enum(ACTION_TYPES)).optional(),
        playerId: z.uuid().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        logLevel: z.enum(LOG_LEVELS).optional(),
        cursor: z.uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const where: Record<string, unknown> = { guildId: input.guildId };

      if (input.actionTypes && input.actionTypes.length > 0) {
        where.action = { in: input.actionTypes };
      }

      if (input.playerId) {
        where.actorId = input.playerId;
      }

      if (input.logLevel) {
        where.logLevel = input.logLevel;
      }

      if (input.dateFrom || input.dateTo) {
        const createdAt: Record<string, Date> = {};
        if (input.dateFrom) createdAt.gte = input.dateFrom;
        if (input.dateTo) createdAt.lte = input.dateTo;
        where.createdAt = createdAt;
      }

      const logs = await ctx.db.activityLog.findMany({
        where,
        take: PAGE_SIZE + 1,
        ...(input.cursor
          ? {
              cursor: { id: input.cursor },
              skip: 1,
            }
          : {}),
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true } },
        },
      });

      let nextCursor: string | undefined;
      if (logs.length > PAGE_SIZE) {
        const next = logs.pop();
        nextCursor = next?.id;
      }

      return {
        items: logs,
        nextCursor,
      };
    }),

  summary: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const logs = await ctx.db.activityLog.groupBy({
        by: ["action"],
        where: {
          guildId: input.guildId,
          createdAt: { gte: todayStart },
        },
        _count: { id: true },
      });

      const totalToday = logs.reduce((sum, entry) => sum + entry._count.id, 0);

      const byAction: Record<string, number> = {};
      for (const entry of logs) {
        byAction[entry.action] = entry._count.id;
      }

      return {
        totalToday,
        byAction,
      };
    }),
});

async function assertGuildMaster(
  ctx: { db: typeof import("../db").db; session: { userId: string; role: string } },
  guildId: string
) {
  const membership = await ctx.db.guildMaster.findUnique({
    where: { guildId_userId: { guildId, userId: ctx.session.userId } },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a master of this guild" });
  }
  return membership;
}
