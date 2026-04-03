import { z } from "zod/v4";
import { router, protectedProcedure, publicProcedure } from "../trpc";

const RECIPIENT_TYPES = ["master", "player"] as const;

const PAGE_SIZE = 20;

export const notificationRouter = router({
  /**
   * List notifications for the current user/player with cursor-based pagination.
   * Masters pass their userId; players pass their playerId.
   */
  list: protectedProcedure
    .input(
      z.object({
        recipientType: z.enum(RECIPIENT_TYPES),
        recipientId: z.uuid(),
        unreadOnly: z.boolean().optional().default(false),
        cursor: z.uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        recipientType: input.recipientType,
        recipientId: input.recipientId,
      };

      if (input.unreadOnly) {
        where.isRead = false;
      }

      const notifications = await ctx.db.notification.findMany({
        where,
        take: PAGE_SIZE + 1,
        ...(input.cursor
          ? {
              cursor: { id: input.cursor },
              skip: 1,
            }
          : {}),
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (notifications.length > PAGE_SIZE) {
        const next = notifications.pop();
        nextCursor = next?.id;
      }

      return {
        items: notifications,
        nextCursor,
      };
    }),

  /**
   * Count of unread notifications for the given recipient.
   */
  unreadCount: protectedProcedure
    .input(
      z.object({
        recipientType: z.enum(RECIPIENT_TYPES),
        recipientId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.notification.count({
        where: {
          recipientType: input.recipientType,
          recipientId: input.recipientId,
          isRead: false,
        },
      });

      return { count };
    }),

  /**
   * Mark a single notification as read.
   */
  markRead: protectedProcedure
    .input(
      z.object({
        notificationId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notification.update({
        where: { id: input.notificationId },
        data: { isRead: true },
      });

      return { success: true };
    }),

  /**
   * Mark all notifications as read for a given recipient.
   */
  markAllRead: protectedProcedure
    .input(
      z.object({
        recipientType: z.enum(RECIPIENT_TYPES),
        recipientId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.notification.updateMany({
        where: {
          recipientType: input.recipientType,
          recipientId: input.recipientId,
          isRead: false,
        },
        data: { isRead: true },
      });

      return { updated: result.count };
    }),

  /** Player-facing: list notifications */
  playerList: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        unreadOnly: z.boolean().optional().default(false),
        cursor: z.uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        recipientType: "player",
        recipientId: input.playerId,
      };
      if (input.unreadOnly) {
        where.isRead = false;
      }

      const notifications = await ctx.db.notification.findMany({
        where,
        take: PAGE_SIZE + 1,
        ...(input.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (notifications.length > PAGE_SIZE) {
        const next = notifications.pop();
        nextCursor = next?.id;
      }

      return { items: notifications, nextCursor };
    }),

  /** Player-facing: unread count */
  playerUnreadCount: publicProcedure
    .input(z.object({ playerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.notification.count({
        where: {
          recipientType: "player",
          recipientId: input.playerId,
          isRead: false,
        },
      });
      return { count };
    }),

  /** Player-facing: mark one as read */
  playerMarkRead: publicProcedure
    .input(z.object({ notificationId: z.uuid(), playerId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the notification belongs to this player
      const notification = await ctx.db.notification.findFirst({
        where: {
          id: input.notificationId,
          recipientType: "player",
          recipientId: input.playerId,
        },
      });
      if (!notification) return { success: false };

      await ctx.db.notification.update({
        where: { id: input.notificationId },
        data: { isRead: true },
      });
      return { success: true };
    }),

  /** Player-facing: mark all as read */
  playerMarkAllRead: publicProcedure
    .input(z.object({ playerId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.notification.updateMany({
        where: {
          recipientType: "player",
          recipientId: input.playerId,
          isRead: false,
        },
        data: { isRead: true },
      });
      return { updated: result.count };
    }),
});
