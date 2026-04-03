import { z } from "zod/v4";
import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { createStripeCustomer } from "@/lib/stripe";

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        email: z.email(),
        password: z.string().min(8).max(128),
        consent: z.boolean().refine((v) => v === true, {
          message: "You must accept the Terms and Privacy Policy",
        }),
        ageVerified: z.boolean().refine((v) => v === true, {
          message: "You must confirm you are at least 13 years old",
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });
      }

      const passwordHash = await hash(input.password, 12);

      // Create Stripe customer (no-op when billing is disabled)
      const stripeCustomerId = await createStripeCustomer(
        input.email,
        input.name,
      );

      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          consentedAt: new Date(),
          ageVerified: true,
          ...(stripeCustomerId && { stripeCustomerId }),
        },
      });

      return { id: user.id, email: user.email, name: user.name };
    }),

  exportData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.userId;

    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        locale: true,
        subscriptionTier: true,
        consentedAt: true,
        ageVerified: true,
        createdAt: true,
        updatedAt: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const guildMasters = await ctx.db.guildMaster.findMany({
      where: { userId },
      include: { guild: { select: { id: true, name: true } } },
    });

    const createdGuilds = await ctx.db.guild.findMany({
      where: { createdById: userId },
      select: { id: true, name: true, createdAt: true },
    });

    const createdQuests = await ctx.db.quest.findMany({
      where: { createdById: userId },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        createdAt: true,
      },
    });

    const appliedBuffs = await ctx.db.activeBuff.findMany({
      where: { appliedById: userId },
      select: {
        id: true,
        appliedAt: true,
        isActive: true,
        buff: { select: { name: true } },
      },
    });

    const prayerReplies = await ctx.db.prayerReply.findMany({
      where: { authorId: userId },
      select: { id: true, message: true, createdAt: true },
    });

    const activityLogs = await ctx.db.activityLog.findMany({
      where: { actorId: userId },
      select: {
        id: true,
        action: true,
        details: true,
        logLevel: true,
        createdAt: true,
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      user,
      guildMemberships: guildMasters,
      createdGuilds,
      createdQuests,
      appliedBuffs,
      prayerReplies,
      activityLogs,
    };
  }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.userId;

    const user = await ctx.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    await ctx.db.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: `deleted_${userId}@deleted.local`,
        name: "Deleted User",
        passwordHash: null,
        oauthProvider: null,
        notificationPreferences: {},
      },
    });

    return { success: true };
  }),
});
