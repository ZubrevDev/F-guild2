import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { checkLevelUp } from "@/lib/leveling";

export const questRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(2000),
        type: z.enum(["mandatory", "optional"]),
        recurrence: z.enum(["once", "daily", "weekly", "monthly", "custom"]).default("once"),
        deadline: z.string().datetime().optional(),
        xpReward: z.number().int().min(0),
        goldReward: z.number().int().min(0),
        faithReward: z.number().int().min(0).default(0),
        difficultyClass: z.number().int().min(1).max(30),
        confirmationType: z.enum(["photo", "text", "timer", "master_confirm"]),
        assignedTo: z.array(z.uuid()).default([]),
        imageUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const quest = await ctx.db.quest.create({
        data: {
          guildId: input.guildId,
          createdById: ctx.session.userId,
          title: input.title,
          description: input.description,
          type: input.type,
          recurrence: input.recurrence,
          deadline: input.deadline ? new Date(input.deadline) : null,
          xpReward: input.xpReward,
          goldReward: input.goldReward,
          faithReward: input.faithReward,
          difficultyClass: input.difficultyClass,
          confirmationType: input.confirmationType,
          assignedTo: input.assignedTo,
          imageUrl: input.imageUrl,
        },
      });

      return quest;
    }),

  update: protectedProcedure
    .input(
      z.object({
        questId: z.uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(2000).optional(),
        type: z.enum(["mandatory", "optional"]).optional(),
        recurrence: z.enum(["once", "daily", "weekly", "monthly", "custom"]).optional(),
        deadline: z.string().datetime().nullable().optional(),
        xpReward: z.number().int().min(0).optional(),
        goldReward: z.number().int().min(0).optional(),
        faithReward: z.number().int().min(0).optional(),
        difficultyClass: z.number().int().min(1).max(30).optional(),
        confirmationType: z.enum(["photo", "text", "timer", "master_confirm"]).optional(),
        assignedTo: z.array(z.uuid()).optional(),
        imageUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const quest = await ctx.db.quest.findUnique({
        where: { id: input.questId },
      });
      if (!quest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      }
      await assertGuildMaster(ctx, quest.guildId);

      const { questId, ...data } = input;
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          if (key === "deadline" && value !== null) {
            updateData[key] = new Date(value as string);
          } else {
            updateData[key] = value;
          }
        }
      }

      return ctx.db.quest.update({
        where: { id: questId },
        data: updateData,
      });
    }),

  deactivate: protectedProcedure
    .input(z.object({ questId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const quest = await ctx.db.quest.findUnique({
        where: { id: input.questId },
      });
      if (!quest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      }
      await assertGuildMaster(ctx, quest.guildId);

      return ctx.db.quest.update({
        where: { id: input.questId },
        data: { isActive: false },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        type: z.enum(["mandatory", "optional"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const where: Record<string, unknown> = { guildId: input.guildId };
      if (input.type) where.type = input.type;
      if (input.isActive !== undefined) where.isActive = input.isActive;

      return ctx.db.quest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          instances: {
            select: { id: true, status: true, playerId: true },
          },
        },
      });
    }),

  get: protectedProcedure
    .input(z.object({ questId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const quest = await ctx.db.quest.findUnique({
        where: { id: input.questId },
        include: {
          instances: {
            include: { player: { select: { id: true, name: true } } },
          },
        },
      });
      if (!quest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      }
      return quest;
    }),

  // Player-facing endpoints
  forPlayer: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        guildId: z.uuid(),
        status: z.enum(["active", "completed"]).default("active"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Mandatory quests assigned to this player (or to all)
      const mandatoryQuests = await ctx.db.quest.findMany({
        where: {
          guildId: input.guildId,
          isActive: true,
          type: "mandatory",
          OR: [
            { assignedTo: { has: input.playerId } },
            { assignedTo: { isEmpty: true } },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      // Optional quests (guild board)
      const optionalQuests = await ctx.db.quest.findMany({
        where: {
          guildId: input.guildId,
          isActive: true,
          type: "optional",
        },
        orderBy: { createdAt: "desc" },
      });

      // Player's quest instances
      const instances = await ctx.db.questInstance.findMany({
        where: {
          playerId: input.playerId,
          ...(input.status === "completed"
            ? { status: "completed" }
            : { status: { in: ["available", "accepted", "pending_review"] } }),
        },
        include: { quest: true },
        orderBy: { createdAt: "desc" },
      });

      return { mandatoryQuests, optionalQuests, instances };
    }),

  accept: publicProcedure
    .input(z.object({ questId: z.uuid(), playerId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const quest = await ctx.db.quest.findUnique({
        where: { id: input.questId },
      });
      if (!quest || !quest.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found or inactive" });
      }

      const existing = await ctx.db.questInstance.findFirst({
        where: {
          questId: input.questId,
          playerId: input.playerId,
          status: { in: ["accepted", "pending_review"] },
        },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Quest already accepted" });
      }

      return ctx.db.questInstance.create({
        data: {
          questId: input.questId,
          playerId: input.playerId,
          status: "accepted",
        },
      });
    }),
  submit: publicProcedure
    .input(
      z.object({
        instanceId: z.uuid(),
        confirmationData: z.object({
          type: z.enum(["text", "master_confirm"]),
          text: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.db.questInstance.findUnique({
        where: { id: input.instanceId },
      });
      if (!instance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest instance not found" });
      }
      if (instance.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quest must be in accepted status to submit",
        });
      }

      return ctx.db.questInstance.update({
        where: { id: input.instanceId },
        data: {
          status: "pending_review",
          confirmationData: input.confirmationData,
        },
      });
    }),

  review: protectedProcedure
    .input(
      z.object({
        instanceId: z.uuid(),
        action: z.enum(["approve", "reject", "return"]),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.db.questInstance.findUnique({
        where: { id: input.instanceId },
        include: { quest: true, player: { include: { character: true } } },
      });
      if (!instance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest instance not found" });
      }
      if (instance.status !== "pending_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quest must be pending_review to review",
        });
      }

      await assertGuildMaster(ctx, instance.quest.guildId);

      if (input.action === "approve") {
        const result = await ctx.db.$transaction(async (tx) => {
          // Read character inside transaction to prevent race conditions
          const character = await tx.character.findUnique({
            where: { playerId: instance.playerId },
          });
          if (!character) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Player has no character" });
          }

          const newTotalXp = character.xp + instance.quest.xpReward;
          const { newLevel, remainingXp, levelsGained } = checkLevelUp(
            character.level,
            newTotalXp
          );

          await tx.questInstance.update({
            where: { id: input.instanceId },
            data: { status: "completed", completedAt: new Date() },
          });

          await tx.character.update({
            where: { id: character.id },
            data: {
              xp: remainingXp,
              level: newLevel,
              gold: { increment: instance.quest.goldReward },
              faithPoints: { increment: instance.quest.faithReward },
            },
          });

          // Create ActivityLog entries for each level gained
          for (let i = 1; i <= levelsGained; i++) {
            const gainedLevel = character.level + i;
            await tx.activityLog.create({
              data: {
                guildId: instance.quest.guildId,
                actorType: "system",
                actorId: ctx.session!.userId,
                action: "level_up",
                details: {
                  playerId: instance.playerId,
                  playerName: instance.player.name,
                  characterId: character.id,
                  oldLevel: gainedLevel - 1,
                  newLevel: gainedLevel,
                },
                logLevel: "important",
              },
            });
          }

          return { levelsGained, newLevel };
        });

        return {
          status: "completed" as const,
          xpAwarded: instance.quest.xpReward,
          goldAwarded: instance.quest.goldReward,
          levelsGained: result.levelsGained,
          newLevel: result.newLevel,
        };
      }

      if (input.action === "reject") {
        return ctx.db.questInstance.update({
          where: { id: input.instanceId },
          data: {
            status: "rejected",
            rejectionReason: input.rejectionReason || null,
          },
        });
      }

      // return
      return ctx.db.questInstance.update({
        where: { id: input.instanceId },
        data: { status: "accepted" },
      });
    }),

  pending: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      return ctx.db.questInstance.findMany({
        where: {
          status: "pending_review",
          quest: { guildId: input.guildId },
        },
        include: {
          quest: { select: { title: true, xpReward: true, goldReward: true } },
          player: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
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
