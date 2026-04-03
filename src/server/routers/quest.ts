import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { checkLevelUp } from "@/lib/leveling";
import { generateRecurringInstances, getRecurringProgress, getPeriodStart, getTotalForPeriod } from "@/lib/recurring-quests";
import { calculateBuffModifiers, applyModifier } from "@/lib/buff-modifiers";

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
        timerSeconds: z.number().int().min(1).optional(),
        assignedTo: z.array(z.uuid()).default([]),
        imageUrl: z.string().url().optional(),
        itemRewards: z
          .array(z.object({ itemId: z.uuid(), quantity: z.number().int().min(1) }))
          .default([]),
      }).refine(
        (data) => {
          if (data.confirmationType === "timer") {
            return typeof data.timerSeconds === "number" && data.timerSeconds > 0;
          }
          return true;
        },
        { message: "timerSeconds is required and must be positive when confirmationType is timer" }
      )
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
          timerSeconds: input.timerSeconds ?? null,
          assignedTo: input.assignedTo,
          imageUrl: input.imageUrl,
          itemRewards: input.itemRewards.length > 0
            ? {
                create: input.itemRewards.map((r) => ({
                  itemId: r.itemId,
                  quantity: r.quantity,
                })),
              }
            : undefined,
        },
        include: { itemRewards: { include: { item: { select: { id: true, name: true, rarity: true } } } } },
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
        timerSeconds: z.number().int().min(1).nullable().optional(),
        assignedTo: z.array(z.uuid()).optional(),
        imageUrl: z.string().url().nullable().optional(),
        itemRewards: z
          .array(z.object({ itemId: z.uuid(), quantity: z.number().int().min(1) }))
          .optional(),
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

      // Handle itemRewards separately — replace strategy
      if (input.itemRewards !== undefined) {
        await ctx.db.questItemReward.deleteMany({ where: { questId: input.questId } });
        if (input.itemRewards.length > 0) {
          await ctx.db.questItemReward.createMany({
            data: input.itemRewards.map((r) => ({
              questId: input.questId,
              itemId: r.itemId,
              quantity: r.quantity,
            })),
          });
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { questId, itemRewards: _itemRewards, ...rest } = input;
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
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
          itemRewards: {
            include: { item: { select: { id: true, name: true, rarity: true, equipSlot: true } } },
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
          itemRewards: {
            include: { item: { select: { id: true, name: true, rarity: true, equipSlot: true } } },
          },
        },
      });
      if (!quest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      }
      await assertGuildMaster(ctx, quest.guildId);
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
      await assertPlayerInGuild(ctx, input.playerId, input.guildId);

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
        include: {
          itemRewards: {
            include: { item: { select: { id: true, name: true, rarity: true, equipSlot: true } } },
          },
        },
      });

      // Optional quests (guild board) — if assignedTo is empty, visible to all
      const optionalQuests = await ctx.db.quest.findMany({
        where: {
          guildId: input.guildId,
          isActive: true,
          type: "optional",
          OR: [
            { assignedTo: { has: input.playerId } },
            { assignedTo: { isEmpty: true } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          itemRewards: {
            include: { item: { select: { id: true, name: true, rarity: true, equipSlot: true } } },
          },
        },
      });

      // Player's quest instances
      const instances = await ctx.db.questInstance.findMany({
        where: {
          playerId: input.playerId,
          ...(input.status === "completed"
            ? { status: "completed" }
            : { status: { in: ["available", "accepted", "pending_review"] } }),
        },
        include: {
          quest: {
            include: {
              itemRewards: {
                include: { item: { select: { id: true, name: true, rarity: true, equipSlot: true } } },
              },
            },
          },
        },
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
      await assertPlayerInGuild(ctx, input.playerId, quest.guildId);

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
        playerId: z.uuid(),
        confirmationData: z.object({
          type: z.enum(["text", "photo", "timer", "master_confirm"]),
          text: z.string().optional(),
          photoUrl: z.string().optional(),
          timerStartedAt: z.string().datetime().optional(),
          timerSeconds: z.number().int().min(1).optional(),
        }).refine(
          (data) => {
            if (data.type === "photo") {
              return typeof data.photoUrl === "string" && data.photoUrl.startsWith("/uploads/");
            }
            return true;
          },
          { message: "photoUrl is required and must start with /uploads/ when type is photo" }
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.db.questInstance.findUnique({
        where: { id: input.instanceId },
      });
      if (!instance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest instance not found" });
      }
      if (instance.playerId !== input.playerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your quest instance" });
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

  startTimer: publicProcedure
    .input(
      z.object({
        instanceId: z.uuid(),
        playerId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.db.questInstance.findUnique({
        where: { id: input.instanceId },
        include: { quest: true },
      });
      if (!instance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest instance not found" });
      }
      if (instance.playerId !== input.playerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your quest instance" });
      }
      if (instance.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quest must be in accepted status to start timer",
        });
      }
      if (instance.quest.confirmationType !== "timer") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quest confirmation type is not timer",
        });
      }
      if (!instance.quest.timerSeconds) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quest does not have timerSeconds configured",
        });
      }

      // Check if timer was already started
      const existingData = instance.confirmationData as Record<string, unknown> | null;
      if (existingData?.timerStartedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Timer already started",
        });
      }

      const now = new Date().toISOString();

      return ctx.db.questInstance.update({
        where: { id: input.instanceId },
        data: {
          confirmationData: {
            type: "timer",
            timerStartedAt: now,
            timerSeconds: instance.quest.timerSeconds,
          },
        },
        include: { quest: { select: { timerSeconds: true } } },
      });
    }),

  completeTimer: publicProcedure
    .input(
      z.object({
        instanceId: z.uuid(),
        playerId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.db.questInstance.findUnique({
        where: { id: input.instanceId },
        include: { quest: true },
      });
      if (!instance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest instance not found" });
      }
      if (instance.playerId !== input.playerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your quest instance" });
      }
      if (instance.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quest must be in accepted status to complete timer",
        });
      }
      if (instance.quest.confirmationType !== "timer") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quest confirmation type is not timer",
        });
      }

      const confirmationData = instance.confirmationData as Record<string, unknown> | null;
      if (!confirmationData?.timerStartedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Timer has not been started",
        });
      }

      const timerStartedAt = new Date(confirmationData.timerStartedAt as string);
      const requiredSeconds = instance.quest.timerSeconds ?? 0;
      const elapsedMs = Date.now() - timerStartedAt.getTime();
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      // Allow 2-second tolerance for network latency
      if (elapsedSeconds < requiredSeconds - 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Timer has not expired yet. ${requiredSeconds - elapsedSeconds} seconds remaining.`,
        });
      }

      return ctx.db.questInstance.update({
        where: { id: input.instanceId },
        data: {
          status: "pending_review",
          confirmationData: {
            type: "timer",
            timerStartedAt: confirmationData.timerStartedAt,
            timerSeconds: requiredSeconds,
            timerCompletedAt: new Date().toISOString(),
          },
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
        // Fetch active buffs for the player's character to apply reward modifiers
        const now = new Date();
        const character = await ctx.db.character.findUnique({
          where: { playerId: instance.playerId },
        });
        if (!character) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Player has no character" });
        }

        const activeBuffs = await ctx.db.activeBuff.findMany({
          where: {
            characterId: character.id,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: { buff: { select: { effect: true } } },
        });

        const modifiers = calculateBuffModifiers(activeBuffs);

        const baseXp = instance.quest.xpReward;
        const baseGold = instance.quest.goldReward;
        const finalXp = applyModifier(baseXp, modifiers.xpModifier);
        const finalGold = applyModifier(baseGold, modifiers.goldModifier);

        const result = await ctx.db.$transaction(async (tx) => {
          // Re-read character inside transaction to prevent race conditions
          const txCharacter = await tx.character.findUnique({
            where: { playerId: instance.playerId },
          });
          if (!txCharacter) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Player has no character" });
          }

          const newTotalXp = txCharacter.xp + finalXp;
          const { newLevel, remainingXp, levelsGained } = checkLevelUp(
            txCharacter.level,
            newTotalXp
          );

          await tx.questInstance.update({
            where: { id: input.instanceId },
            data: { status: "completed", completedAt: new Date() },
          });

          await tx.character.update({
            where: { id: txCharacter.id },
            data: {
              xp: remainingXp,
              level: newLevel,
              gold: { increment: finalGold },
              faithPoints: { increment: instance.quest.faithReward },
            },
          });

          // Claim unclaimed item rewards
          const unclaimedRewards = await tx.questItemReward.findMany({
            where: { questId: instance.questId, claimed: false },
            include: { item: { select: { id: true, name: true, rarity: true } } },
          });

          const awardedItems: Array<{ name: string; rarity: string; quantity: number }> = [];

          for (const reward of unclaimedRewards) {
            await tx.questItemReward.update({
              where: { id: reward.id },
              data: { claimed: true },
            });

            await tx.inventory.create({
              data: {
                characterId: txCharacter.id,
                itemId: reward.itemId,
                quantity: reward.quantity,
              },
            });

            awardedItems.push({
              name: reward.item.name,
              rarity: reward.item.rarity,
              quantity: reward.quantity,
            });
          }

          // Create ActivityLog entries for each level gained
          for (let i = 1; i <= levelsGained; i++) {
            const gainedLevel = txCharacter.level + i;
            await tx.activityLog.create({
              data: {
                guildId: instance.quest.guildId,
                actorType: "system",
                actorId: ctx.session!.userId,
                action: "level_up",
                details: {
                  playerId: instance.playerId,
                  playerName: instance.player.name,
                  characterId: txCharacter.id,
                  oldLevel: gainedLevel - 1,
                  newLevel: gainedLevel,
                },
                logLevel: "important",
              },
            });
          }

          return { levelsGained, newLevel, awardedItems };
        });

        return {
          status: "completed" as const,
          baseXp,
          baseGold,
          xpAwarded: finalXp,
          goldAwarded: finalGold,
          xpModifier: modifiers.xpModifier,
          goldModifier: modifiers.goldModifier,
          levelsGained: result.levelsGained,
          newLevel: result.newLevel,
          awardedItems: result.awardedItems,
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
          quest: {
            select: {
              title: true,
              xpReward: true,
              goldReward: true,
              itemRewards: {
                include: { item: { select: { id: true, name: true, rarity: true } } },
              },
            },
          },
          player: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  generateRecurring: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const createdCount = await generateRecurringInstances(
        ctx.db,
        input.guildId
      );

      return { instancesCreated: createdCount };
    }),

  recurringProgress: publicProcedure
    .input(
      z.object({
        questId: z.uuid(),
        playerId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const quest = await ctx.db.quest.findUnique({
        where: { id: input.questId },
      });
      if (!quest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      }

      await assertPlayerInGuild(ctx, input.playerId, quest.guildId);

      return getRecurringProgress(ctx.db, input.questId, input.playerId);
    }),

  recurringStats: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const now = new Date();

      const quests = await ctx.db.quest.findMany({
        where: {
          guildId: input.guildId,
          isActive: true,
          recurrence: { notIn: ["once", "custom"] },
        },
        include: {
          instances: {
            select: {
              id: true,
              playerId: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return quests.map((quest) => {
        const periodStart = getPeriodStart(quest.recurrence, now);
        const { total, label } = getTotalForPeriod(quest.recurrence, now);

        // Current period instances
        const currentInstances = quest.instances.filter(
          (i) =>
            i.createdAt &&
            i.createdAt.getTime() >= periodStart.getTime()
        );

        const currentCompleted = currentInstances.filter(
          (i) => i.status === "completed"
        ).length;

        const currentTotal = currentInstances.length;

        // All-time stats
        const allCompleted = quest.instances.filter(
          (i) => i.status === "completed"
        ).length;

        const uniquePlayers = new Set(
          quest.instances.map((i) => i.playerId)
        ).size;

        return {
          questId: quest.id,
          title: quest.title,
          recurrence: quest.recurrence,
          assignedTo: quest.assignedTo,
          currentPeriod: {
            completed: currentCompleted,
            total: currentTotal,
            label,
          },
          trackingWindow: {
            total,
            label,
          },
          allTime: {
            completed: allCompleted,
            totalInstances: quest.instances.length,
            uniquePlayers,
          },
        };
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
