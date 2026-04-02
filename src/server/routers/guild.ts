import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { router, protectedProcedure } from "../trpc";

const MAX_MASTERS = 5;

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export const guildRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const guild = await ctx.db.guild.create({
        data: {
          name: input.name,
          inviteCode: generateInviteCode(),
          createdById: ctx.session.userId,
          masters: {
            create: {
              userId: ctx.session.userId,
              role: "owner",
            },
          },
        },
        include: { masters: true },
      });
      return guild;
    }),

  get: protectedProcedure
    .input(z.object({ guildId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const guild = await ctx.db.guild.findUnique({
        where: { id: input.guildId },
        include: {
          masters: { include: { user: { select: { id: true, email: true, name: true } } } },
          players: { select: { id: true, name: true } },
        },
      });
      if (!guild) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Guild not found" });
      }
      // Check user is a master of this guild
      const isMaster = guild.masters.some((m) => m.userId === ctx.session.userId);
      if (!isMaster) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this guild" });
      }
      return guild;
    }),

  update: protectedProcedure
    .input(z.object({ guildId: z.uuid(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);
      return ctx.db.guild.update({
        where: { id: input.guildId },
        data: { name: input.name },
      });
    }),

  myGuilds: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.guildMaster.findMany({
      where: { userId: ctx.session.userId },
      include: {
        guild: {
          select: { id: true, name: true, inviteCode: true, isActive: true, createdAt: true },
        },
      },
    });
    return memberships.map((m) => ({ ...m.guild, role: m.role }));
  }),

  addMaster: protectedProcedure
    .input(z.object({ guildId: z.uuid(), email: z.email() }))
    .mutation(async ({ ctx, input }) => {
      await assertGuildOwner(ctx, input.guildId);

      const masterCount = await ctx.db.guildMaster.count({
        where: { guildId: input.guildId },
      });
      if (masterCount >= MAX_MASTERS) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Maximum ${MAX_MASTERS} masters per guild`,
        });
      }

      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const existing = await ctx.db.guildMaster.findUnique({
        where: { guildId_userId: { guildId: input.guildId, userId: user.id } },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "User is already a master" });
      }

      return ctx.db.guildMaster.create({
        data: {
          guildId: input.guildId,
          userId: user.id,
          role: "master",
        },
      });
    }),

  removeMaster: protectedProcedure
    .input(z.object({ guildId: z.uuid(), userId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertGuildOwner(ctx, input.guildId);

      if (input.userId === ctx.session.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove yourself as owner",
        });
      }

      const target = await ctx.db.guildMaster.findUnique({
        where: { guildId_userId: { guildId: input.guildId, userId: input.userId } },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Master not found" });
      }
      if (target.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the owner",
        });
      }

      return ctx.db.guildMaster.delete({
        where: { guildId_userId: { guildId: input.guildId, userId: input.userId } },
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

async function assertGuildOwner(
  ctx: { db: typeof import("../db").db; session: { userId: string; role: string } },
  guildId: string
) {
  const membership = await assertGuildMaster(ctx, guildId);
  if (membership.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can perform this action" });
  }
  return membership;
}
