"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  recipientType: "master" | "player";
  recipientId: string;
}

/**
 * Returns a human-readable relative time string for a given date.
 */
function formatTimeAgo(
  date: Date,
  t: ReturnType<typeof useTranslations<"notifications">>
): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return t("justNow");
  if (diffMinutes < 60) return t("minutesAgo", { count: diffMinutes });
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });
  return t("daysAgo", { count: diffDays });
}

/**
 * Notification bell icon with unread badge and popover list.
 * Works for both master (NextAuth session) and player (localStorage) recipients.
 */
export function NotificationBell({ recipientType, recipientId }: NotificationBellProps) {
  const t = useTranslations("notifications");
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const isPlayer = recipientType === "player";

  // Queries — pick the right procedure based on recipientType
  const masterInput = { recipientType: "master" as const, recipientId };
  const playerInput = { playerId: recipientId };

  const { data: countData } = isPlayer
    ? trpc.notification.playerUnreadCount.useQuery(playerInput, { refetchInterval: 30_000 })
    : trpc.notification.unreadCount.useQuery(masterInput, { refetchInterval: 30_000 });

  const { data: listData } = isPlayer
    ? trpc.notification.playerList.useQuery(playerInput, { enabled: open })
    : trpc.notification.list.useQuery(masterInput, { enabled: open });

  const markReadMaster = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      void utils.notification.unreadCount.invalidate(masterInput);
      void utils.notification.list.invalidate(masterInput);
    },
  });

  const markReadPlayer = trpc.notification.playerMarkRead.useMutation({
    onSuccess: () => {
      void utils.notification.playerUnreadCount.invalidate(playerInput);
      void utils.notification.playerList.invalidate(playerInput);
    },
  });

  const markAllReadMaster = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notification.unreadCount.invalidate(masterInput);
      void utils.notification.list.invalidate(masterInput);
    },
  });

  const markAllReadPlayer = trpc.notification.playerMarkAllRead.useMutation({
    onSuccess: () => {
      void utils.notification.playerUnreadCount.invalidate(playerInput);
      void utils.notification.playerList.invalidate(playerInput);
    },
  });

  const unreadCount = countData?.count ?? 0;
  const notifications = listData?.items ?? [];
  const hasUnread = unreadCount > 0;

  function handleMarkAllRead() {
    if (isPlayer) {
      markAllReadPlayer.mutate(playerInput);
    } else {
      markAllReadMaster.mutate(masterInput);
    }
  }

  function handleMarkRead(notificationId: string) {
    if (isPlayer) {
      markReadPlayer.mutate({ notificationId, playerId: recipientId });
    } else {
      markReadMaster.mutate({ notificationId });
    }
  }

  const isPending = isPlayer
    ? markReadPlayer.isPending || markAllReadPlayer.isPending
    : markReadMaster.isPending || markAllReadMaster.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={t("title")}
        >
          <Bell className="size-4" />
          {hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">
            {t("title")}
          </span>
          {hasUnread && (
            <button
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {t("markAllRead")}
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    onClick={() => {
                      if (!notification.isRead) {
                        handleMarkRead(notification.id);
                      }
                    }}
                    disabled={notification.isRead || isPending}
                    className={cn(
                      "w-full cursor-default px-4 py-3 text-left transition-colors",
                      !notification.isRead
                        ? "cursor-pointer bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.isRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div
                        className={cn(
                          "flex-1 space-y-0.5",
                          notification.isRead && "pl-4"
                        )}
                      >
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {formatTimeAgo(new Date(notification.createdAt), t)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
