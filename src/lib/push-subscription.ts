import type { PrismaClient } from "@prisma/client";

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Save or update a push subscription for a user or player.
 * Uses upsert so re-subscribing after a browser refresh works cleanly.
 */
export async function savePushSubscription(
  db: PrismaClient,
  recipient: { userId?: string; playerId?: string },
  subscription: PushSubscriptionPayload,
): Promise<void> {
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: recipient.userId ?? null,
      playerId: recipient.playerId ?? null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      userId: recipient.userId ?? null,
      playerId: recipient.playerId ?? null,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

/**
 * Remove a push subscription by endpoint.
 */
export async function removePushSubscription(
  db: PrismaClient,
  endpoint: string,
): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Get all push subscriptions for a given recipient (userId or playerId).
 */
export async function getPushSubscriptions(
  db: PrismaClient,
  recipient: { userId?: string; playerId?: string },
) {
  const orConditions: Array<Record<string, string>> = [];
  if (recipient.userId) {
    orConditions.push({ userId: recipient.userId });
  }
  if (recipient.playerId) {
    orConditions.push({ playerId: recipient.playerId });
  }

  if (orConditions.length === 0) return [];

  return db.pushSubscription.findMany({
    where: { OR: orConditions },
  });
}
