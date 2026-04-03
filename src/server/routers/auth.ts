import { z } from "zod/v4";
import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { createStripeCustomer } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

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

  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 3 requests per 15 minutes per email address
      const rateLimitKey = `password_reset:${input.email.toLowerCase()}`;
      const rateCheck = checkRateLimit(rateLimitKey, {
        max: 3,
        windowMs: 15 * 60 * 1000,
      });

      if (!rateCheck.allowed) {
        // Return generic success to prevent timing-based enumeration
        return { success: true };
      }

      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true, email: true, name: true, deletedAt: true },
      });

      // Always return success to prevent email enumeration
      if (!user || user.deletedAt !== null) {
        return { success: true };
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

      await ctx.db.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      await sendEmail(
        user.email,
        "password_reset",
        {
          username: user.name,
          resetUrl,
          expiresIn: "1 hour",
        },
        user.id
      );

      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const resetToken = await ctx.db.passwordResetToken.findUnique({
        where: { token: input.token },
        include: { user: { select: { id: true, deletedAt: true } } },
      });

      if (
        !resetToken ||
        resetToken.usedAt !== null ||
        resetToken.expiresAt < new Date() ||
        resetToken.user.deletedAt !== null
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      const passwordHash = await hash(input.newPassword, 12);

      // Mark token as used and update password in a transaction
      await ctx.db.$transaction([
        ctx.db.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
        ctx.db.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        }),
      ]);

      return { success: true };
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
