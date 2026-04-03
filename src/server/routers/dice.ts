import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { rollD20, abilityModifier, type DiceModifier, type DiceRollResult } from "@/lib/dice";

/**
 * Expected JSON shape for Item.effect and Buff.effect:
 * { "stat": "strength", "modifier": 2 }
 *
 * "stat" refers to the character stat the effect modifies.
 * "modifier" is the flat bonus (positive or negative).
 */

type CharacterStats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

type EffectJson = {
  stat?: string;
  modifier?: number;
};

function isValidEffect(val: unknown): val is EffectJson {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    (typeof obj.stat === "string" || obj.stat === undefined) &&
    (typeof obj.modifier === "number" || obj.modifier === undefined)
  );
}

/**
 * Determine the primary stat for a given roll context.
 * Falls back to "strength" if context is unrecognized.
 */
function contextToStat(context: string): keyof CharacterStats {
  const mapping: Record<string, keyof CharacterStats> = {
    attack: "strength",
    melee: "strength",
    ranged: "dexterity",
    stealth: "dexterity",
    reflex: "dexterity",
    arcana: "intelligence",
    investigation: "intelligence",
    knowledge: "intelligence",
    perception: "wisdom",
    insight: "wisdom",
    survival: "wisdom",
    persuasion: "charisma",
    deception: "charisma",
    intimidation: "charisma",
    performance: "charisma",
  };

  const key = context.toLowerCase().trim();
  return mapping[key] ?? "strength";
}

export const diceRouter = router({
  roll: protectedProcedure
    .input(
      z.object({
        characterId: z.uuid(),
        context: z.string().min(1).max(100),
        dc: z.number().int().min(1).max(30),
      })
    )
    .mutation(async ({ ctx, input }): Promise<DiceRollResult> => {
      // Fetch character with inventory (equipped items) and active buffs
      const character = await ctx.db.character.findUnique({
        where: { id: input.characterId },
        include: {
          inventory: {
            where: { isEquipped: true },
            include: { item: true },
          },
          activeBuffs: {
            where: {
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            include: { buff: true },
          },
          player: { select: { guildId: true } },
        },
      });

      if (!character) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      // Verify the caller is a master of this guild
      const membership = await ctx.db.guildMaster.findUnique({
        where: {
          guildId_userId: {
            guildId: character.player.guildId,
            userId: ctx.session.userId,
          },
        },
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a master of this guild",
        });
      }

      const modifiers: DiceModifier[] = [];

      // 1. Ability modifier from character stats
      const stats = character.stats as CharacterStats;
      const relevantStat = contextToStat(input.context);
      const statValue = stats[relevantStat] ?? 10;
      const abilityMod = abilityModifier(statValue);
      if (abilityMod !== 0) {
        modifiers.push({
          source: relevantStat,
          type: "ability",
          value: abilityMod,
        });
      }

      // 2. Item modifiers from equipped inventory
      for (const inv of character.inventory) {
        const effect = inv.item.effect;
        if (!isValidEffect(effect)) continue;
        if (typeof effect.modifier !== "number") continue;

        modifiers.push({
          source: inv.item.name,
          type: "item",
          value: effect.modifier,
        });
      }

      // 3. Buff modifiers from active buffs
      for (const ab of character.activeBuffs) {
        const effect = ab.buff.effect;
        if (!isValidEffect(effect)) continue;
        if (typeof effect.modifier !== "number") continue;

        const value =
          ab.buff.type === "debuff"
            ? -Math.abs(effect.modifier)
            : Math.abs(effect.modifier);

        modifiers.push({
          source: ab.buff.name,
          type: "buff",
          value,
        });
      }

      // Roll the d20
      const roll = rollD20();
      const totalModifier = modifiers.reduce((sum, m) => sum + m.value, 0);
      const total = roll + totalModifier;
      const success = total >= input.dc;

      // Record in DiceLog
      await ctx.db.diceLog.create({
        data: {
          characterId: input.characterId,
          rollValue: roll,
          modifiers: JSON.stringify(modifiers),
          total,
          difficultyClass: input.dc,
          success,
          context: input.context,
        },
      });

      return {
        roll,
        modifiers,
        total,
        dc: input.dc,
        success,
      };
    }),

  history: protectedProcedure
    .input(
      z.object({
        characterId: z.uuid(),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db.diceLog.findMany({
        where: { characterId: input.characterId },
        orderBy: { rolledAt: "desc" },
        take: input.limit,
      });
      return logs;
    }),

  /** Master-only: filterable, paginated dice log for entire guild */
  log: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        playerId: z.uuid().optional(),
        dateFrom: z.iso.datetime().optional(),
        dateTo: z.iso.datetime().optional(),
        context: z.string().max(100).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const where = buildDiceLogWhere(input);
      const skip = (input.page - 1) * input.limit;

      const [logs, total] = await Promise.all([
        ctx.db.diceLog.findMany({
          where,
          orderBy: { rolledAt: "desc" },
          skip,
          take: input.limit,
          include: {
            character: {
              include: {
                player: { select: { id: true, name: true } },
              },
            },
          },
        }),
        ctx.db.diceLog.count({ where }),
      ]);

      return {
        items: logs.map((log) => ({
          id: log.id,
          rollValue: log.rollValue,
          modifiers: log.modifiers,
          total: log.total,
          difficultyClass: log.difficultyClass,
          success: log.success,
          context: log.context,
          rolledAt: log.rolledAt,
          playerName: log.character.player.name,
          playerId: log.character.player.id,
          characterId: log.characterId,
        })),
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /** Master-only: dice roll statistics for guild */
  stats: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        playerId: z.uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const where = buildDiceLogWhere(input);

      const [aggregation, criticalHits, criticalFails, successCount, totalRolls] =
        await Promise.all([
          ctx.db.diceLog.aggregate({
            where,
            _avg: { rollValue: true },
            _count: { id: true },
          }),
          ctx.db.diceLog.count({ where: { ...where, rollValue: 20 } }),
          ctx.db.diceLog.count({ where: { ...where, rollValue: 1 } }),
          ctx.db.diceLog.count({ where: { ...where, success: true } }),
          ctx.db.diceLog.count({ where }),
        ]);

      return {
        totalRolls: aggregation._count.id,
        avgRoll: aggregation._avg.rollValue
          ? Math.round(aggregation._avg.rollValue * 100) / 100
          : 0,
        criticalHits,
        criticalFails,
        successRate:
          totalRolls > 0
            ? Math.round((successCount / totalRolls) * 10000) / 100
            : 0,
      };
    }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertGuildMaster(
  ctx: {
    db: typeof import("../db").db;
    session: { userId: string; role: string };
  },
  guildId: string,
) {
  const membership = await ctx.db.guildMaster.findUnique({
    where: { guildId_userId: { guildId, userId: ctx.session.userId } },
  });
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a master of this guild",
    });
  }
  return membership;
}

/**
 * Build a Prisma where clause for DiceLog filtered by guild, player,
 * date range, and context.
 */
function buildDiceLogWhere(filters: {
  guildId: string;
  playerId?: string;
  dateFrom?: string;
  dateTo?: string;
  context?: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    character: {
      player: {
        guildId: filters.guildId,
        ...(filters.playerId ? { id: filters.playerId } : {}),
      },
    },
  };

  if (filters.dateFrom || filters.dateTo) {
    where.rolledAt = {};
    if (filters.dateFrom) where.rolledAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.rolledAt.lte = new Date(filters.dateTo);
  }

  if (filters.context) {
    where.context = { contains: filters.context, mode: "insensitive" };
  }

  return where;
}
