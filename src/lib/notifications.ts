import type { PrismaClient, Prisma } from "@prisma/client";
import type { NotificationType, RecipientType } from "@prisma/client";

export interface CreateNotificationOpts {
  recipientType: RecipientType;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

/**
 * Create a notification record in the database.
 *
 * This is a helper intended for use by other server modules (routers, cron
 * jobs, etc.) that need to emit notifications as a side-effect.
 */
export async function createNotification(
  db: PrismaClient,
  opts: CreateNotificationOpts,
) {
  return db.notification.create({
    data: {
      recipientType: opts.recipientType,
      recipientId: opts.recipientId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      data: opts.data ?? {},
    },
  });
}

/**
 * Create multiple notifications in a single transaction.
 */
export async function createNotifications(
  db: PrismaClient,
  items: CreateNotificationOpts[],
) {
  return db.notification.createMany({
    data: items.map((opts) => ({
      recipientType: opts.recipientType,
      recipientId: opts.recipientId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      data: opts.data ?? {},
    })),
  });
}
