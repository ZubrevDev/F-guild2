import webpush from "web-push";
import type { PrismaClient } from "@prisma/client";
import type { RecipientType } from "@prisma/client";
import { getPushSubscriptions } from "./push-subscription";

// Configure VAPID once when this module is loaded.
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

/** Shape of the push preferences stored in User.notificationPreferences */
interface PushPreferences {
  pushEnabled?: boolean;
  quietHoursStart?: number; // 0-23, default 22
  quietHoursEnd?: number;   // 0-23, default 8
}

const DEFAULT_QUIET_START = 22;
const DEFAULT_QUIET_END = 8;

/**
 * Returns true when the current UTC hour is inside the user's quiet window.
 */
function isQuietHour(prefs: PushPreferences): boolean {
  const start = prefs.quietHoursStart ?? DEFAULT_QUIET_START;
  const end = prefs.quietHoursEnd ?? DEFAULT_QUIET_END;
  const hour = new Date().getUTCHours();

  // Handles wrap-around midnight (e.g. 22 → 08)
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

/** Payload sent inside the push message */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Send push notifications to every subscription that belongs to the recipient.
 *
 * - Skips silently if VAPID keys are not configured (useful in dev).
 * - Checks the user/player's push preferences and quiet hours.
 * - Removes stale subscriptions that return 410 Gone.
 */
export async function sendPushNotification(
  db: PrismaClient,
  recipientType: RecipientType,
  recipientId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    // VAPID not configured — skip silently so in-app notifications still work.
    return;
  }

  // Resolve the push preferences for the recipient.
  const prefs = await getRecipientPushPrefs(db, recipientType, recipientId);

  if (!prefs.pushEnabled) return;
  if (isQuietHour(prefs)) return;

  const recipient =
    recipientType === "master"
      ? { userId: recipientId }
      : { playerId: recipientId };

  const subscriptions = await getPushSubscriptions(db, recipient);
  if (subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    ...payload.data,
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message,
        );
      } catch (err: unknown) {
        const status =
          err instanceof webpush.WebPushError ? err.statusCode : null;

        // 410 Gone / 404 Not Found — subscription is no longer valid, remove it.
        if (status === 410 || status === 404) {
          await db.pushSubscription
            .delete({ where: { endpoint: sub.endpoint } })
            .catch(() => void 0);
        }
        // Other errors (network, 5xx) are ignored — we'll retry on next event.
      }
    }),
  );
}

/** Fetch push preferences for the given recipient. */
async function getRecipientPushPrefs(
  db: PrismaClient,
  recipientType: RecipientType,
  recipientId: string,
): Promise<PushPreferences> {
  if (recipientType === "master") {
    const user = await db.user.findUnique({
      where: { id: recipientId },
      select: { notificationPreferences: true },
    });
    return (user?.notificationPreferences as PushPreferences | null) ?? {};
  }

  // Players don't have a notificationPreferences field yet — default to enabled.
  return { pushEnabled: true };
}
