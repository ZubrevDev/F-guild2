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
});
