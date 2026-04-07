import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { xpProgress, MAX_LEVEL } from "@/lib/leveling";
import {
  getAbilityTree,
  getAvailableAbilities,
  getAbilityPoints,
  findAbility,
} from "@/lib/ability-trees";
import {
  canUseAbility,
  useAbility,
  getAbilityStatus,
  getClassAbility,
  resetDailyCooldowns,
} from "@/lib/class-mechanics";

const CLASS_STATS: Record<
  string,
  { strength: number; dexterity: number; intelligence: number; wisdom: number; charisma: number }
> = {
  fighter: { strength: 16, dexterity: 12, intelligence: 8, wisdom: 10, charisma: 10 },
  wizard: { strength: 8, dexterity: 10, intelligence: 16, wisdom: 12, charisma: 10 },
  ranger: { strength: 12, dexterity: 16, intelligence: 10, wisdom: 10, charisma: 8 },
  cleric: { strength: 12, dexterity: 8, intelligence: 10, wisdom: 16, charisma: 10 },
  rogue: { strength: 10, dexterity: 16, intelligence: 12, wisdom: 8, charisma: 10 },
  bard: { strength: 8, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 16 },
};

export const characterRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        class: z.enum(["fighter", "wizard", "ranger", "cleric", "rogue", "bard"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      }
      await assertGuildMaster(ctx, player.guildId);
      if (player.character) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Player already has a character",
        });
      }

      const stats = CLASS_STATS[input.class];

      const character = await ctx.db.character.create({
        data: {
          playerId: input.playerId,
          class: input.class,
          level: 1,
          xp: 0,
          gold: 100,
          faithPoints: 10,
          stats: JSON.stringify(stats),
          abilities: JSON.stringify([]),
        },
      });

      return character;
    }),

  createSelf: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        class: z.enum(["fighter", "wizard", "ranger", "cleric", "rogue", "bard"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      }
      if (player.character) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Player already has a character",
        });
      }

      const stats = CLASS_STATS[input.class];

      return ctx.db.character.create({
        data: {
          playerId: input.playerId,
          class: input.class,
          level: 1,
          xp: 0,
          gold: 100,
          faithPoints: 10,
          stats: JSON.stringify(stats),
          abilities: JSON.stringify([]),
        },
      });
    }),

  get: publicProcedure
    .input(z.object({ playerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const character = await ctx.db.character.findUnique({
        where: { playerId: input.playerId },
      });
      return character;
    }),

  getByGuild: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const players = await ctx.db.player.findMany({
        where: { guildId: input.guildId },
        include: {
          character: true,
        },
        orderBy: { createdAt: "asc" },
      });
      return players.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        character: p.character
          ? {
              ...p.character,
              ...xpProgress(p.character.level, p.character.xp),
            }
          : null,
      }));
    }),

  xpProgress: publicProcedure
    .input(z.object({ playerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const character = await ctx.db.character.findUnique({
        where: { playerId: input.playerId },
      });
      if (!character) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      const progress = xpProgress(character.level, character.xp);

      return {
        level: character.level,
        currentXp: character.xp,
        ...progress,
        maxLevel: MAX_LEVEL,
      };
    }),

  /** Returns the full ability tree for a character's class with learned status. */
  abilities: publicProcedure
    .input(z.object({ playerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const character = await ctx.db.character.findUnique({
        where: { playerId: input.playerId },
      });
      if (!character) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      const learnedIds = character.abilities as string[];
      const tree = getAbilityTree(character.class);
      const totalPoints = getAbilityPoints(character.level);
      const usedPoints = learnedIds.length;

      return {
        characterClass: character.class,
        level: character.level,
        totalPoints,
        usedPoints,
        remainingPoints: totalPoints - usedPoints,
        abilities: tree.map((ability) => ({
          ...ability,
          learned: learnedIds.includes(ability.id),
        })),
      };
    }),

  /** Returns abilities that the character can currently learn. */
  availableAbilities: publicProcedure
    .input(z.object({ playerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const character = await ctx.db.character.findUnique({
        where: { playerId: input.playerId },
      });
      if (!character) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      const learnedIds = character.abilities as string[];
      const available = getAvailableAbilities(character.class, character.level, learnedIds);
      const totalPoints = getAbilityPoints(character.level);
      const remainingPoints = totalPoints - learnedIds.length;

      return {
        remainingPoints,
        abilities: available,
      };
    }),

  /** Player picks an ability on level-up. */
  learnAbility: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        abilityId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const character = await ctx.db.character.findUnique({
        where: { playerId: input.playerId },
      });
      if (!character) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      const learnedIds = character.abilities as string[];

      // Check ability points
      const totalPoints = getAbilityPoints(character.level);
      if (learnedIds.length >= totalPoints) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No ability points available",
        });
      }

      // Check ability exists and belongs to class
      const ability = findAbility(input.abilityId);
      if (!ability) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ability not found" });
      }
      if (ability.class !== character.class) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ability does not belong to your class",
        });
      }

      // Check not already learned
      if (learnedIds.includes(input.abilityId)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ability already learned",
        });
      }

      // Check prerequisites
      const missingPrereqs = ability.prerequisiteIds.filter(
        (preId) => !learnedIds.includes(preId)
      );
      if (missingPrereqs.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Prerequisites not met",
        });
      }

      // Learn the ability
      const updatedAbilities = [...learnedIds, input.abilityId];
      await ctx.db.character.update({
        where: { playerId: input.playerId },
        data: { abilities: updatedAbilities },
      });

      return {
        learned: ability,
        remainingPoints: totalPoints - updatedAbilities.length,
      };
    }),

  /** Use an active class ability (e.g. Fighter's Second Wind, Wizard's Arcane Focus). */
  // publicProcedure: players authenticate via PIN/localStorage, not NextAuth
  useClassAbility: publicProcedure
    .input(
      z.object({
        characterId: z.uuid(),
        abilityName: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const character = await ctx.db.character.findUnique({
        where: { id: input.characterId },
        include: { player: { select: { guildId: true } } },
      });
      if (!character) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      // If caller is authenticated (master), verify guild membership
      if (ctx.session) {
        await assertGuildMaster(ctx as { db: typeof ctx.db; session: NonNullable<typeof ctx.session> }, character.player.guildId);
      }

      // Verify the ability belongs to this character's class
      const classAbility = getClassAbility(character.class);
      if (!classAbility || classAbility.name !== input.abilityName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ability does not belong to your class",
        });
      }

      const check = await canUseAbility(ctx.db, input.characterId, input.abilityName);
      if (!check.canUse) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: check.reason,
        });
      }

      const effect = await useAbility(ctx.db, input.characterId, input.abilityName);

      return {
        abilityName: input.abilityName,
        displayName: classAbility.displayName,
        effect,
      };
    }),

  /** Get class ability status for a character (cooldown, uses remaining). */
  classAbilityStatus: publicProcedure
    .input(z.object({ characterId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const character = await ctx.db.character.findUnique({
        where: { id: input.characterId },
      });
      if (!character) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      const status = await getAbilityStatus(ctx.db, input.characterId, character.class);
      return status;
    }),

  /** Admin: reset all expired daily ability cooldowns. */
  resetClassCooldowns: protectedProcedure
    .mutation(async ({ ctx }) => {
      const cleared = await resetDailyCooldowns(ctx.db);
      return { cleared };
    }),

  /**
   * Bard "Inspire": give another player +3 to their next dice roll.
   * Can only be used once per day by a bard character.
   * The target must be in the same guild.
   */
  inspire: protectedProcedure
    .input(
      z.object({
        bardCharacterId: z.uuid(),
        targetCharacterId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.bardCharacterId === input.targetCharacterId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot inspire yourself",
        });
      }

      // Fetch the bard character
      const bardChar = await ctx.db.character.findUnique({
        where: { id: input.bardCharacterId },
        include: { player: { select: { guildId: true, name: true } } },
      });

      if (!bardChar) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bard character not found",
        });
      }

      if (bardChar.class !== "bard") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only bards can use Inspire",
        });
      }

      // Verify the caller is a master of this guild
      await assertGuildMaster(ctx, bardChar.player.guildId);

      // Fetch the target character and verify same guild
      const targetChar = await ctx.db.character.findUnique({
        where: { id: input.targetCharacterId },
        include: { player: { select: { guildId: true, name: true } } },
      });

      if (!targetChar) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target character not found",
        });
      }

      if (targetChar.player.guildId !== bardChar.player.guildId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target must be in the same guild",
        });
      }

      // Check cooldown
      const check = await canUseAbility(ctx.db, bardChar.id, "inspire");
      if (!check.canUse) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: check.reason,
        });
      }

      // Check if target already has a pending inspire buff
      const existingInspire = await ctx.db.classAbilityUsage.findFirst({
        where: {
          characterId: input.targetCharacterId,
          abilityName: "inspire_received",
          resetsAt: { gt: new Date() },
        },
      });

      if (existingInspire) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Target already has an active Inspire buff",
        });
      }

      const now = new Date();
      const resetsAt = new Date(now);
      resetsAt.setUTCDate(resetsAt.getUTCDate() + 1);
      resetsAt.setUTCHours(0, 0, 0, 0);

      // Record bard's usage and place inspire buff on target in a transaction
      await ctx.db.$transaction(async (tx) => {
        // Record the bard used their ability
        await tx.classAbilityUsage.create({
          data: {
            characterId: bardChar.id,
            abilityName: "inspire",
            resetsAt,
          },
        });

        // Place the inspire buff on the target (consumed on next roll)
        await tx.classAbilityUsage.create({
          data: {
            characterId: input.targetCharacterId,
            abilityName: "inspire_received",
            resetsAt,
          },
        });
      });

      return {
        bardName: bardChar.player.name,
        targetName: targetChar.player.name,
        bonus: 3,
        message: `${bardChar.player.name} inspired ${targetChar.player.name} with +3 to their next roll!`,
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
