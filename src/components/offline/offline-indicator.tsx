"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus, useSyncOnReconnect } from "@/lib/offline/hooks";
import type { SyncQueueItem } from "@/lib/offline/db";

// ---------------------------------------------------------------------------
// Default no-op executor — replace at the usage site with real tRPC calls
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const defaultExecutor = async (_item: SyncQueueItem): Promise<void> => {
  // No-op: consumers should pass their own executor via props if needed.
};

interface OfflineIndicatorProps {
  /** Custom executor for replaying queued actions on reconnect. */
  executor?: (item: SyncQueueItem) => Promise<void>;
  className?: string;
}

/**
 * Non-intrusive status banner that appears at the bottom of the screen:
 *   - "You're offline" when disconnected
 *   - "Syncing X changes..." while processing the queue after reconnect
 *   - "All changes synced" briefly on successful sync
 */
export function OfflineIndicator({
  executor = defaultExecutor,
  className,
}: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const { isSyncing, pendingCount, lastSyncResult } = useSyncOnReconnect({ executor });

  // Show a "synced" confirmation for 3 seconds after a successful sync
  const [showSynced, setShowSynced] = useState(false);

  useEffect(() => {
    if (lastSyncResult && lastSyncResult.processed > 0 && !isSyncing) {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncResult, isSyncing]);

  // Nothing to show when online, not syncing, and no recent sync confirmation
  if (isOnline && !isSyncing && !showSynced) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg",
        "transition-all duration-300",
        !isOnline
          ? "bg-destructive text-white"
          : isSyncing
          ? "bg-yellow-500 text-black"
          : "bg-green-600 text-white",
        className
      )}
    >
      {!isOnline && (
        <>
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            You&apos;re offline.{" "}
            {pendingCount > 0
              ? `${pendingCount} change${pendingCount !== 1 ? "s" : ""} will sync when connected.`
              : "Changes will sync when connected."}
          </span>
        </>
      )}

      {isOnline && isSyncing && (
        <>
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>Syncing changes&hellip;</span>
        </>
      )}

      {isOnline && !isSyncing && showSynced && lastSyncResult && (
        <>
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            All changes synced
            {lastSyncResult.failed > 0
              ? ` (${lastSyncResult.failed} failed)`
              : "."}
          </span>
        </>
      )}
    </div>
  );
}
