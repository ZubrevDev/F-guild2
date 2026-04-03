import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

const notificationPreferencesSchema = z.object({
  email: z
    .object({
      questCompleted: z.boolean().optional(),
      questSubmitted: z.boolean().optional(),
      prayerReceived: z.boolean().optional(),
      playerJoined: z.boolean().optional(),
      levelUp: z.boolean().optional(),
    })
    .optional(),
  inApp: z
    .object({
      questCompleted: z.boolean().optional(),
      questSubmitted: z.boolean().optional(),
      prayerReceived: z.boolean().optional(),
      playerJoined: z.boolean().optional(),
      levelUp: z.boolean().optional(),
    })
    .optional(),
});

export const settingsRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.userId },
      select: {
        name: true,
        email: true,
        locale: true,
        theme: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100).optional(),
        locale: z.enum(["en", "ru", "fr"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, string> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.locale !== undefined) data.locale = input.locale;

      if (Object.keys(data).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      const user = await ctx.db.user.update({
        where: { id: ctx.session.userId },
        data,
        select: {
          name: true,
          locale: true,
        },
      });

      return user;
    }),

  updateNotificationPreferences: protectedProcedure
    .input(notificationPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.user.findUnique({
        where: { id: ctx.session.userId },
        select: { notificationPreferences: true },
      });

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const existing =
        typeof current.notificationPreferences === "object" &&
        current.notificationPreferences !== null
          ? (current.notificationPreferences as Record<string, unknown>)
          : {};

      const merged = {
        ...existing,
        ...(input.email !== undefined && { email: { ...(existing.email as Record<string, unknown> | undefined), ...input.email } }),
        ...(input.inApp !== undefined && { inApp: { ...(existing.inApp as Record<string, unknown> | undefined), ...input.inApp } }),
      };

      const user = await ctx.db.user.update({
        where: { id: ctx.session.userId },
        data: { notificationPreferences: merged },
        select: { notificationPreferences: true },
      });

      return user;
    }),

  updateTheme: protectedProcedure
    .input(
      z.object({
        theme: z.enum(["dark", "light", "system"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.update({
        where: { id: ctx.session.userId },
        data: { theme: input.theme },
        select: { theme: true },
      });

      return user;
    }),
});
