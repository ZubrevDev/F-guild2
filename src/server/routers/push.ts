import { z } from "zod/v4";
import { router, protectedProcedure } from "../trpc";
import {
  savePushSubscription,
  removePushSubscription,
} from "../../lib/push-subscription";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/**
 * Push notification router.
 *
 * Manages browser push subscriptions and per-user push preferences.
 */
export const pushRouter = router({
  /**
   * Save a new push subscription.
   * recipientType must match the caller's session role.
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        recipientType: z.enum(["master", "player"]),
        recipientId: z.uuid(),
        subscription: subscriptionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const recipient =
        input.recipientType === "master"
          ? { userId: input.recipientId }
          : { playerId: input.recipientId };

      await savePushSubscription(ctx.db, recipient, input.subscription);

      return { success: true };
    }),

  /**
   * Remove a push subscription by endpoint.
   */
  unsubscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await removePushSubscription(ctx.db, input.endpoint);
      return { success: true };
    }),

  /**
   * Update push preferences for the current master user.
   * Players currently use a fixed default (push enabled, no quiet hours).
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        pushEnabled: z.boolean(),
        quietHoursStart: z.number().int().min(0).max(23).optional(),
        quietHoursEnd: z.number().int().min(0).max(23).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only masters have a User record with notificationPreferences.
      if (ctx.session.role !== "master") {
        return { success: true }; // no-op for players
      }

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.userId },
        select: { notificationPreferences: true },
      });

      const existing =
        (user?.notificationPreferences as Record<string, unknown> | null) ?? {};

      await ctx.db.user.update({
        where: { id: ctx.session.userId },
        data: {
          notificationPreferences: {
            ...existing,
            pushEnabled: input.pushEnabled,
            ...(input.quietHoursStart !== undefined && {
              quietHoursStart: input.quietHoursStart,
            }),
            ...(input.quietHoursEnd !== undefined && {
              quietHoursEnd: input.quietHoursEnd,
            }),
          },
        },
      });

      return { success: true };
    }),
});
