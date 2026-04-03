import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { router, protectedProcedure, publicProcedure } from "../trpc";

const MAX_PLAYERS = 10;

export const playerRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        name: z.string().min(1).max(50),
        authMethod: z.enum(["pin", "qr", "email"]),
        pin: z.string().min(4).max(6).regex(/^\d+$/).optional(),
        email: z.email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const playerCount = await ctx.db.player.count({
        where: { guildId: input.guildId },
      });
      if (playerCount >= MAX_PLAYERS) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Maximum ${MAX_PLAYERS} players per guild`,
        });
      }

      if (input.authMethod === "pin" && !input.pin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "PIN is required for pin auth method",
        });
      }

      const pinHash = input.pin ? await hash(input.pin, 10) : null;

      const player = await ctx.db.player.create({
        data: {
          guildId: input.guildId,
          name: input.name,
          authMethod: input.authMethod,
          pin: pinHash,
          email: input.email,
          qrToken: randomBytes(32).toString("hex"),
        },
      });

      return { id: player.id, name: player.name, authMethod: player.authMethod };
    }),

  list: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      return ctx.db.player.findMany({
        where: { guildId: input.guildId },
        select: {
          id: true,
          name: true,
          authMethod: true,
          email: true,
          createdAt: true,
          character: { select: { id: true, class: true, level: true } },
        },
      });
    }),

  resetPin: protectedProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        newPin: z.string().min(4).max(6).regex(/^\d+$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
      });
      if (!player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      }

      await assertGuildMaster(ctx, player.guildId);

      const pinHash = await hash(input.newPin, 10);
      await ctx.db.player.update({
        where: { id: input.playerId },
        data: { pin: pinHash },
      });

      return { success: true };
    }),

  getQrCode: protectedProcedure
    .input(z.object({ playerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { guild: { select: { id: true, inviteCode: true } } },
      });
      if (!player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      }

      await assertGuildMaster(ctx, player.guildId);

      const loginUrl = `/player-login?invite=${encodeURIComponent(player.guild.inviteCode)}&name=${encodeURIComponent(player.name)}&guild=${player.guild.id}`;

      const dataUrl = await QRCode.toDataURL(loginUrl, {
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });

      return { qrDataUrl: dataUrl, loginUrl };
    }),

  regenerateQrToken: protectedProcedure
    .input(z.object({ playerId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { guild: { select: { id: true, inviteCode: true } } },
      });
      if (!player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      }

      await assertGuildMaster(ctx, player.guildId);

      const newToken = randomBytes(32).toString("hex");
      await ctx.db.player.update({
        where: { id: input.playerId },
        data: { qrToken: newToken },
      });

      const loginUrl = `/player-login?invite=${encodeURIComponent(player.guild.inviteCode)}&name=${encodeURIComponent(player.name)}&guild=${player.guild.id}`;

      const dataUrl = await QRCode.toDataURL(loginUrl, {
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });

      return { qrDataUrl: dataUrl, loginUrl };
    }),

  loginByPin: publicProcedure
    .input(
      z.object({
        inviteCode: z.string(),
        playerName: z.string(),
        pin: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await ctx.db.guild.findUnique({
        where: { inviteCode: input.inviteCode },
      });
      if (!guild) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Guild not found" });
      }

      const player = await ctx.db.player.findUnique({
        where: { guildId_name: { guildId: guild.id, name: input.playerName } },
      });
      if (!player || !player.pin) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const valid = await compare(input.pin, player.pin);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      return {
        playerId: player.id,
        playerName: player.name,
        guildId: guild.id,
        guildName: guild.name,
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
