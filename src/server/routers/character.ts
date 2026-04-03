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
