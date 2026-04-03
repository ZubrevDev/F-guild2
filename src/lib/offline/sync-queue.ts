"use client";

import { getOfflineDB, type SyncQueueItem } from "./db";

// ---------------------------------------------------------------------------
// Queue management
// ---------------------------------------------------------------------------

/**
 * Add an action to the offline sync queue.
 * Call this whenever the user performs an action while offline.
 */
export async function addToSyncQueue(
  action: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getOfflineDB();
  const item: Omit<SyncQueueItem, "id"> = {
    action,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  };
  await db.add("syncQueue", item as SyncQueueItem);
}

/**
 * Returns the number of pending items waiting to sync.
 * Useful for showing a badge in the UI.
 */
export async function getSyncQueueCount(): Promise<number> {
  const db = await getOfflineDB();
  return db.count("syncQueue");
}

/**
 * Returns all items currently in the sync queue.
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getOfflineDB();
  return db.getAll("syncQueue");
}

// ---------------------------------------------------------------------------
// Conflict resolution helpers
// ---------------------------------------------------------------------------

/**
 * Numeric fields (XP, gold, faithPoints) — server value wins.
 * Text/draft fields — client value wins.
 *
 * Merges server data with the queued client payload according to
 * the defined conflict strategy.
 */
export function resolveConflict(
  serverData: Record<string, unknown>,
  clientPayload: Record<string, unknown>
): Record<string, unknown> {
  // Fields where server always wins (prevent cheating on numeric stats)
  const serverWinsFields = new Set(["xp", "gold", "faithPoints", "level"]);

  const merged: Record<string, unknown> = { ...clientPayload };

  for (const field of serverWinsFields) {
    if (field in serverData) {
      merged[field] = serverData[field];
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Queue processing
// ---------------------------------------------------------------------------

/**
 * Processes the sync queue by replaying each action against the server.
 *
 * Pass an `executor` function that knows how to call the actual tRPC/API
 * endpoints. This keeps the queue logic decoupled from the transport layer.
 *
 * The executor should throw if the action fails. On failure the retry count
 * is incremented; items that exceed MAX_RETRIES are dropped to avoid
 * infinite loops.
 */
export async function processSyncQueue(
  executor: (item: SyncQueueItem) => Promise<void>
): Promise<{ processed: number; failed: number }> {
  const MAX_RETRIES = 3;
  const db = await getOfflineDB();
  const items = await db.getAll("syncQueue");

  let processed = 0;
  let failed = 0;

  for (const item of items) {
    if (item.id === undefined) continue;

    try {
      await executor(item);
      await db.delete("syncQueue", item.id);
      processed++;
    } catch {
      if (item.retryCount >= MAX_RETRIES) {
        // Give up — remove from queue to avoid it blocking forever
        await db.delete("syncQueue", item.id);
        failed++;
      } else {
        // Increment retry counter
        await db.put("syncQueue", { ...item, retryCount: item.retryCount + 1 });
        failed++;
      }
    }
  }

  return { processed, failed };
}

/**
 * Clears the entire sync queue (e.g. after a full resync from server).
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await getOfflineDB();
  await db.clear("syncQueue");
}
