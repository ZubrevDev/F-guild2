"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { addToSyncQueue, processSyncQueue, getSyncQueueCount } from "./sync-queue";
import type { SyncQueueItem } from "./db";

// ---------------------------------------------------------------------------
// useOnlineStatus
// ---------------------------------------------------------------------------

/**
 * Tracks whether the browser currently has network connectivity.
 * Subscribes to `online` / `offline` window events.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

// ---------------------------------------------------------------------------
// useOfflineCache
// ---------------------------------------------------------------------------

interface OfflineCacheResult<T> {
  data: T | null;
  isLoading: boolean;
  isFromCache: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetches fresh data when online and falls back to a cached value when
 * offline. The caller supplies:
 *   - `key`     — a stable string identifying this data (used for re-runs)
 *   - `fetcher` — async function that resolves fresh data from the network
 *   - `cache`   — optional cached value to use when offline / on error
 */
export function useOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  cache?: T | null
): OfflineCacheResult<T> {
  const isOnline = useOnlineStatus();
  const [data, setData] = useState<T | null>(cache ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetch = useCallback(async () => {
    if (!isOnline) {
      // Stay with whatever is cached
      if (cache !== undefined && cache !== null) {
        setData(cache);
        setIsFromCache(true);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fresh = await fetcherRef.current();
      setData(fresh);
      setIsFromCache(false);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);

      // Fall back to cache on network failure
      if (cache !== undefined && cache !== null) {
        setData(cache);
        setIsFromCache(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, cache]);

  useEffect(() => {
    void fetch();
    // `key` intentionally forces a re-fetch when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isOnline]);

  return { data, isLoading, isFromCache, error, refetch: fetch };
}

// ---------------------------------------------------------------------------
// useOfflineAction
// ---------------------------------------------------------------------------

interface OfflineActionOptions {
  /** Called when online — should perform the actual API call. */
  onExecute: () => Promise<void>;
  /** Action name stored in the queue when offline. */
  actionName: string;
  /** Payload serialized into the queue entry. */
  payload: Record<string, unknown>;
}

interface OfflineActionResult {
  execute: () => Promise<void>;
  isQueued: boolean;
  isPending: boolean;
}

/**
 * Wraps a mutation so it is either:
 *   - Executed immediately when online, or
 *   - Queued in IndexedDB when offline and replayed once connectivity returns.
 */
export function useOfflineAction({
  onExecute,
  actionName,
  payload,
}: OfflineActionOptions): OfflineActionResult {
  const isOnline = useOnlineStatus();
  const [isQueued, setIsQueued] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(async () => {
    if (!isOnline) {
      await addToSyncQueue(actionName, payload);
      setIsQueued(true);
      return;
    }

    setIsPending(true);
    try {
      await onExecute();
      setIsQueued(false);
    } finally {
      setIsPending(false);
    }
  }, [isOnline, actionName, payload, onExecute]);

  return { execute, isQueued, isPending };
}

// ---------------------------------------------------------------------------
// useSyncOnReconnect
// ---------------------------------------------------------------------------

interface SyncOnReconnectOptions {
  /**
   * Executor passed to processSyncQueue — responsible for replaying a single
   * queued action against the real API.
   */
  executor: (item: SyncQueueItem) => Promise<void>;
}

interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncResult: { processed: number; failed: number } | null;
}

/**
 * Automatically processes the sync queue when the app comes back online.
 * Returns sync status so the UI can show progress.
 */
export function useSyncOnReconnect({ executor }: SyncOnReconnectOptions): SyncStatus {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<{
    processed: number;
    failed: number;
  } | null>(null);

  const wasOfflineRef = useRef(!isOnline);

  // Refresh pending count whenever online status changes
  useEffect(() => {
    getSyncQueueCount()
      .then(setPendingCount)
      .catch(() => setPendingCount(0));
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      // Just came back online — process the queue
      void (async () => {
        setIsSyncing(true);
        try {
          const result = await processSyncQueue(executor);
          setLastSyncResult(result);
          setPendingCount(0);
        } finally {
          setIsSyncing(false);
        }
      })();
    }

    wasOfflineRef.current = !isOnline;
  }, [isOnline, executor]);

  return { isSyncing, pendingCount, lastSyncResult };
}
