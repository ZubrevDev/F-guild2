import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { canUseAbility } from "@/lib/class-mechanics";

const DEFAULT_FAITH_COST = 1;

/**
 * Calculate the next daily reset time (midnight UTC).
 */
function getNextDailyReset(): Date {
  const now = new Date();
  const reset = new Date(now);
  reset.setUTCDate(reset.getUTCDate() + 1);
  reset.setUTCHours(0, 0, 0, 0);
  return reset;
}

export const prayerRouter = router({
  send: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        guildId: z.uuid(),
        message: z.string().min(1).max(1000),
        useDivinePrayer: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPlayerInGuild(ctx, input.playerId, input.guildId);

      const character = await ctx.db.character.findUnique({
        where: { playerId: input.playerId },
      });
      if (!character) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Player has no character",
        });
      }

      // Cleric "Divine Prayer": once per day, prayer costs 0 faith points
      let freePrayer = false;
      if (input.useDivinePrayer && character.class === "cleric") {
        const check = await canUseAbility(ctx.db, character.id, "divine_prayer");
        if (!check.canUse) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: check.reason,
          });
        }
        freePrayer = true;
      }

      const faithCost = freePrayer ? 0 : DEFAULT_FAITH_COST;

      if (!freePrayer && character.faithPoints < DEFAULT_FAITH_COST) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient faith points",
        });
      }

      const prayer = await ctx.db.$transaction(async (tx) => {
        if (freePrayer) {
          // Record Divine Prayer class ability usage
          await tx.classAbilityUsage.create({
            data: {
              characterId: character.id,
              abilityName: "divine_prayer",
              resetsAt: getNextDailyReset(),
            },
          });
        } else {
          await tx.character.update({
            where: { id: character.id },
            data: { faithPoints: { decrement: DEFAULT_FAITH_COST } },
          });
        }

        return tx.prayer.create({
          data: {
            playerId: input.playerId,
            guildId: input.guildId,
            message: input.message,
            faithCost,
          },
        });
      });

      return { ...prayer, divinePrayerUsed: freePrayer };
    }),

  reply: protectedProcedure
    .input(
      z.object({
        prayerId: z.uuid(),
        message: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prayer = await ctx.db.prayer.findUnique({
        where: { id: input.prayerId },
      });
      if (!prayer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prayer not found" });
      }

      await assertGuildMaster(ctx, prayer.guildId);

      const reply = await ctx.db.$transaction(async (tx) => {
        const created = await tx.prayerReply.create({
          data: {
            prayerId: input.prayerId,
            authorId: ctx.session.userId,
            message: input.message,
          },
        });

        await tx.prayer.update({
          where: { id: input.prayerId },
          data: { status: "answered" },
        });

        return created;
      });

      return reply;
    }),

  listForMaster: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        status: z.enum(["sent", "read", "answered"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const where: Record<string, unknown> = { guildId: input.guildId };
      if (input.status) where.status = input.status;

      return ctx.db.prayer.findMany({
        where,
        include: {
          player: { select: { id: true, name: true } },
          replies: {
            include: {
              author: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  listForPlayer: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        guildId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertPlayerInGuild(ctx, input.playerId, input.guildId);

      return ctx.db.prayer.findMany({
        where: {
          playerId: input.playerId,
          guildId: input.guildId,
        },
        include: {
          replies: {
            include: {
              author: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getThread: publicProcedure
    .input(
      z.object({
        prayerId: z.uuid(),
        playerId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const prayer = await ctx.db.prayer.findUnique({
        where: { id: input.prayerId },
        include: {
          player: { select: { id: true, name: true } },
          replies: {
            include: {
              author: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!prayer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prayer not found" });
      }

      // Privacy: only the prayer's author can view via this endpoint
      if (prayer.playerId !== input.playerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only view your own prayers",
        });
      }

      return prayer;
    }),

  getThreadForMaster: protectedProcedure
    .input(z.object({ prayerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const prayer = await ctx.db.prayer.findUnique({
        where: { id: input.prayerId },
        include: {
          player: { select: { id: true, name: true } },
          replies: {
            include: {
              author: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!prayer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prayer not found" });
      }

      await assertGuildMaster(ctx, prayer.guildId);

      // Mark as read if still sent
      if (prayer.status === "sent") {
        await ctx.db.prayer.update({
          where: { id: input.prayerId },
          data: { status: "read" },
        });
        prayer.status = "read";
      }

      return prayer;
    }),

  unreadCount: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const count = await ctx.db.prayer.count({
        where: {
          guildId: input.guildId,
          status: "sent",
        },
      });

      return { count };
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

async function assertPlayerInGuild(
  ctx: { db: typeof import("../db").db },
  playerId: string,
  guildId: string
) {
  const player = await ctx.db.player.findUnique({
    where: { id: playerId },
  });
  if (!player || player.guildId !== guildId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Player does not belong to this guild" });
  }
  return player;
}
