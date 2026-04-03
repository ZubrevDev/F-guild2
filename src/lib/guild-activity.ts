/**
 * Guild activity tracking helper.
 * Call touchGuildActivity() whenever a meaningful action occurs inside a guild
 * so that the inactive-guild cleanup cron has an accurate last_activity_at value.
 */

import { type PrismaClient } from "@prisma/client";

/**
 * Update the lastActivityAt timestamp for a guild to the current time.
 *
 * @param db      - PrismaClient instance (passed in to avoid circular imports)
 * @param guildId - UUID of the guild that just had activity
 */
export async function touchGuildActivity(
  db: PrismaClient,
  guildId: string
): Promise<void> {
  await db.guild.update({
    where: { id: guildId },
    data: { lastActivityAt: new Date() },
  });
}
