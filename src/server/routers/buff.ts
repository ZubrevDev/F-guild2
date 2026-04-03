import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";

const EFFECT_TYPES = [
  "xp_bonus",
  "xp_penalty",
  "gold_bonus",
  "gold_penalty",
  "gold_drain",
  "dice_bonus",
  "dice_penalty",
  "shop_discount",
  "shop_markup",
  "faith_bonus",
  "custom",
] as const;

const effectSchema = z.object({
  type: z.enum(EFFECT_TYPES),
  value: z.number(),
  description: z.string().optional(),
});

export const buffRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        name: z.string().min(1).max(200),
        type: z.enum(["buff", "debuff"]),
        effect: effectSchema,
        durationType: z.enum(["permanent", "timed", "manual_cancel"]),
        defaultDurationMinutes: z.number().int().min(1).optional(),
        description: z.string().min(1).max(2000),
        icon: z.string().max(100).default("shield"),
      }).refine(
        (data) => {
          if (data.durationType === "timed") {
            return typeof data.defaultDurationMinutes === "number" && data.defaultDurationMinutes > 0;
          }
          return true;
        },
        { message: "defaultDurationMinutes is required when durationType is timed" }
      )
    )
    .mutation(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      return ctx.db.buff.create({
        data: {
          guildId: input.guildId,
          name: input.name,
          type: input.type,
          effect: input.effect,
          durationType: input.durationType,
          defaultDurationMinutes: input.defaultDurationMinutes ?? null,
          description: input.description,
          icon: input.icon,
        },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        type: z.enum(["buff", "debuff"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const where: Record<string, unknown> = { guildId: input.guildId };
      if (input.type) where.type = input.type;

      return ctx.db.buff.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          activeBuffs: {
            where: { isActive: true },
            select: { id: true, characterId: true },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        buffId: z.uuid(),
        name: z.string().min(1).max(200).optional(),
        type: z.enum(["buff", "debuff"]).optional(),
        effect: effectSchema.optional(),
        durationType: z.enum(["permanent", "timed", "manual_cancel"]).optional(),
        defaultDurationMinutes: z.number().int().min(1).nullable().optional(),
        description: z.string().min(1).max(2000).optional(),
        icon: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buff = await ctx.db.buff.findUnique({
        where: { id: input.buffId },
      });
      if (!buff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Buff template not found" });
      }
      await assertGuildMaster(ctx, buff.guildId);

      const { buffId, ...data } = input;
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      return ctx.db.buff.update({
        where: { id: buffId },
        data: updateData,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ buffId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const buff = await ctx.db.buff.findUnique({
        where: { id: input.buffId },
      });
      if (!buff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Buff template not found" });
      }
      await assertGuildMaster(ctx, buff.guildId);

      // Deactivate all active buffs using this template
      await ctx.db.activeBuff.updateMany({
        where: { buffId: input.buffId, isActive: true },
        data: { isActive: false },
      });

      // Hard delete the template (cascade will handle activeBuffs in DB,
      // but we already deactivated them above for clarity)
      await ctx.db.buff.delete({
        where: { id: input.buffId },
      });

      return { success: true };
    }),

  applyBuff: protectedProcedure
    .input(
      z.object({
        buffId: z.uuid(),
        playerId: z.uuid(),
        durationMinutes: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buff = await ctx.db.buff.findUnique({
        where: { id: input.buffId },
      });
      if (!buff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Buff template not found" });
      }
      await assertGuildMaster(ctx, buff.guildId);

      // Verify player belongs to the same guild and has a character
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player || player.guildId !== buff.guildId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Player not found in this guild" });
      }
      if (!player.character) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Player has no character" });
      }

      // Calculate expiration
      let expiresAt: Date | null = null;
      if (buff.durationType === "timed") {
        const minutes = input.durationMinutes ?? buff.defaultDurationMinutes;
        if (!minutes) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Duration is required for timed buffs",
          });
        }
        expiresAt = new Date(Date.now() + minutes * 60 * 1000);
      }

      const effect = buff.effect as { type: string; value: number };

      // Handle gold_drain: immediately deduct gold
      if (effect.type === "gold_drain") {
        if (player.character.gold < effect.value) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Player does not have enough gold. Has ${player.character.gold}, needs ${effect.value}`,
          });
        }

        const [activeBuff] = await ctx.db.$transaction([
          ctx.db.activeBuff.create({
            data: {
              buffId: buff.id,
              characterId: player.character.id,
              appliedById: ctx.session.userId,
              expiresAt,
            },
            include: { buff: true },
          }),
          ctx.db.character.update({
            where: { id: player.character.id },
            data: { gold: { decrement: effect.value } },
          }),
        ]);

        return activeBuff;
      }

      return ctx.db.activeBuff.create({
        data: {
          buffId: buff.id,
          characterId: player.character.id,
          appliedById: ctx.session.userId,
          expiresAt,
        },
        include: { buff: true },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ activeBuffId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const activeBuff = await ctx.db.activeBuff.findUnique({
        where: { id: input.activeBuffId },
        include: { buff: true },
      });
      if (!activeBuff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Active buff not found" });
      }
      if (!activeBuff.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Buff is already inactive" });
      }
      await assertGuildMaster(ctx, activeBuff.buff.guildId);

      return ctx.db.activeBuff.update({
        where: { id: input.activeBuffId },
        data: { isActive: false },
      });
    }),

  activeForPlayer: publicProcedure
    .input(z.object({ playerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      }
      if (!player.character) {
        return [];
      }

      const now = new Date();

      const activeBuffs = await ctx.db.activeBuff.findMany({
        where: {
          characterId: player.character.id,
          isActive: true,
        },
        include: {
          buff: {
            select: {
              name: true,
              type: true,
              effect: true,
              durationType: true,
              description: true,
              icon: true,
            },
          },
        },
        orderBy: { appliedAt: "desc" },
      });

      // Filter out expired buffs and mark them inactive
      const expiredIds: string[] = [];
      const result = activeBuffs.filter((ab) => {
        if (ab.expiresAt && ab.expiresAt <= now) {
          expiredIds.push(ab.id);
          return false;
        }
        return true;
      });

      // Batch-deactivate expired buffs
      if (expiredIds.length > 0) {
        await ctx.db.activeBuff.updateMany({
          where: { id: { in: expiredIds } },
          data: { isActive: false },
        });
      }

      return result.map((ab) => ({
        id: ab.id,
        buff: ab.buff,
        appliedAt: ab.appliedAt,
        expiresAt: ab.expiresAt,
        remainingSeconds: ab.expiresAt
          ? Math.max(0, Math.floor((ab.expiresAt.getTime() - now.getTime()) / 1000))
          : null,
      }));
    }),

  expireBuffs: publicProcedure
    .mutation(async ({ ctx }) => {
      const now = new Date();

      const result = await ctx.db.activeBuff.updateMany({
        where: {
          isActive: true,
          expiresAt: { lte: now },
        },
        data: { isActive: false },
      });

      return { expiredCount: result.count };
    }),

  activeForGuild: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const now = new Date();

      // Expire stale buffs first
      await ctx.db.activeBuff.updateMany({
        where: {
          isActive: true,
          expiresAt: { lte: now },
          buff: { guildId: input.guildId },
        },
        data: { isActive: false },
      });

      return ctx.db.activeBuff.findMany({
        where: {
          isActive: true,
          buff: { guildId: input.guildId },
        },
        include: {
          buff: {
            select: {
              name: true,
              type: true,
              effect: true,
              durationType: true,
              icon: true,
            },
          },
          character: {
            select: {
              id: true,
              player: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { appliedAt: "desc" },
      });
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
