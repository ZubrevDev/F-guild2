"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";

const CLASS_EMOJIS: Record<string, string> = {
  fighter: "⚔️",
  wizard: "🧙",
  ranger: "🏹",
  cleric: "✝️",
  rogue: "🗡️",
  bard: "🎵",
};

const ACTION_EMOJIS: Record<string, string> = {
  quest_complete: "✅",
  level_up: "⬆️",
  purchase: "🛒",
  buff_applied: "✨",
  prayer_sent: "🙏",
  quest_accepted: "📜",
  quest_rejected: "❌",
  item_acquired: "🎁",
  buff_expired: "⏰",
  prayer_answered: "💬",
};

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-40 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-6 w-24 rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { data: session, status } = useSession();

  const guildId = (session?.user as { guildId?: string } | undefined)?.guildId;

  const playersQuery = trpc.player.list.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const pendingQuestsQuery = trpc.quest.pending.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const unreadPrayersQuery = trpc.prayer.unreadCount.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const activityQuery = trpc.activity.list.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  if (status === "loading") {
    return <LoadingSkeleton />;
  }

  if (!guildId) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">{t("noGuildId")}</p>
      </div>
    );
  }

  const isLoading =
    playersQuery.isLoading ||
    pendingQuestsQuery.isLoading ||
    unreadPrayersQuery.isLoading ||
    activityQuery.isLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const players = playersQuery.data ?? [];
  const pendingQuests = pendingQuestsQuery.data ?? [];
  const unreadCount = unreadPrayersQuery.data?.count ?? 0;
  const activityItems = activityQuery.data?.items ?? [];

  const statCards = [
    { label: t("players"), count: players.length, emoji: "👥" },
    { label: t("pendingQuests"), count: pendingQuests.length, emoji: "📋" },
    { label: t("unreadPrayers"), count: unreadCount, emoji: "🙏" },
    { label: t("todayActivity"), count: activityItems.length, emoji: "⚡" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Stat cards — 2x2 on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
                {card.emoji}
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{card.count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Player cards */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("players")}</h2>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => {
              const charClass = player.character?.class ?? "";
              const classEmoji = CLASS_EMOJIS[charClass] ?? "🧑";
              const level = player.character?.level ?? null;

              return (
                <Link key={player.id} href="/dashboard/players">
                  <Card className="cursor-pointer transition-colors hover:bg-accent">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
                        {classEmoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{player.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {player.character
                            ? `${charClass} · Lvl ${level}`
                            : t("noCharacter")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("activity")}</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {activityItems.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t("noActivity")}</p>
            ) : (
              activityItems.slice(0, 10).map((event) => {
                const emoji = ACTION_EMOJIS[event.action] ?? "📌";
                const actorName = event.actor?.name ?? "System";
                const details = (event.details as Record<string, unknown> | null) ?? {};
                const description = [actorName, event.action.replace(/_/g, " ")]
                  .filter(Boolean)
                  .join(" — ");

                return (
                  <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg">{emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{description}</p>
                      {typeof details.playerName === "string" && (
                        <p className="text-xs text-muted-foreground">{details.playerName}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(event.createdAt)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("quickActions")}</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/quests">
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-2 px-4 py-3">
                <span className="text-lg">📜</span>
                <span className="text-sm font-medium">{t("createQuest")}</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/players">
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-2 px-4 py-3">
                <span className="text-lg">👤</span>
                <span className="text-sm font-medium">{t("addPlayer")}</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/shop">
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-2 px-4 py-3">
                <span className="text-lg">🛒</span>
                <span className="text-sm font-medium">{t("viewShop")}</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
