"use client";

import { openDB, type IDBPDatabase } from "idb";

// ---------------------------------------------------------------------------
// Cache shape types
// ---------------------------------------------------------------------------

export interface QuestCache {
  id: string;
  guildId: string;
  title: string;
  description: string;
  type: string;
  recurrence: string;
  xpReward: number;
  goldReward: number;
  faithReward: number;
  difficultyClass: number;
  confirmationType: string;
  isActive: boolean;
  deadline: string | null;
  assignedTo: string[];
  imageUrl: string | null;
  cachedAt: number;
}

export interface CharacterCache {
  playerId: string;
  id: string;
  class: string;
  level: number;
  xp: number;
  gold: number;
  faithPoints: number;
  stats: unknown;
  abilities: unknown;
  cachedAt: number;
}

export interface InventoryCache {
  playerId: string;
  items: InventoryItem[];
  cachedAt: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  imageUrl: string | null;
}

export interface SyncQueueItem {
  id?: number;
  action: string;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

// ---------------------------------------------------------------------------
// DB schema
// ---------------------------------------------------------------------------

interface FGuildDB {
  quests: {
    key: string;
    value: QuestCache;
  };
  character: {
    key: string;
    value: CharacterCache;
  };
  inventory: {
    key: string;
    value: InventoryCache;
  };
  syncQueue: {
    key: number;
    value: SyncQueueItem;
    autoIncrement: true;
  };
}

const DB_NAME = "fguild-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FGuildDB>> | null = null;

/**
 * Returns (and lazily creates) the IndexedDB instance.
 * Safe to call multiple times — returns the same promise.
 */
export function getOfflineDB(): Promise<IDBPDatabase<FGuildDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available on the server"));
  }

  if (!dbPromise) {
    dbPromise = openDB<FGuildDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("quests")) {
          db.createObjectStore("quests", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("character")) {
          db.createObjectStore("character", { keyPath: "playerId" });
        }
        if (!db.objectStoreNames.contains("inventory")) {
          db.createObjectStore("inventory", { keyPath: "playerId" });
        }
        if (!db.objectStoreNames.contains("syncQueue")) {
          db.createObjectStore("syncQueue", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      },
    });
  }

  return dbPromise;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/**
 * Persist an array of quests into the local cache.
 * Existing entries are replaced by key.
 */
export async function cacheQuests(quests: Omit<QuestCache, "cachedAt">[]): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction("quests", "readwrite");
  const now = Date.now();

  await Promise.all([
    ...quests.map((q) => tx.store.put({ ...q, cachedAt: now })),
    tx.done,
  ]);
}

/**
 * Retrieve all cached quests.
 */
export async function getCachedQuests(): Promise<QuestCache[]> {
  const db = await getOfflineDB();
  return db.getAll("quests");
}

/**
 * Persist a player's character into the local cache.
 */
export async function cacheCharacter(character: Omit<CharacterCache, "cachedAt">): Promise<void> {
  const db = await getOfflineDB();
  await db.put("character", { ...character, cachedAt: Date.now() });
}

/**
 * Retrieve a cached character by playerId.
 */
export async function getCachedCharacter(playerId: string): Promise<CharacterCache | undefined> {
  const db = await getOfflineDB();
  return db.get("character", playerId);
}

/**
 * Persist a player's inventory into the local cache.
 */
export async function cacheInventory(inventory: Omit<InventoryCache, "cachedAt">): Promise<void> {
  const db = await getOfflineDB();
  await db.put("inventory", { ...inventory, cachedAt: Date.now() });
}

/**
 * Retrieve a cached inventory by playerId.
 */
export async function getCachedInventory(playerId: string): Promise<InventoryCache | undefined> {
  const db = await getOfflineDB();
  return db.get("inventory", playerId);
}
