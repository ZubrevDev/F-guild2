import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { xpProgress, MAX_LEVEL } from "@/lib/leveling";

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
