"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { usePlayerSession } from "@/lib/player-session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PlayerPrayersPage() {
  const t = useTranslations("prayers");
  const router = useRouter();
  const { session, loading } = usePlayerSession();

  const [prayerText, setPrayerText] = useState("");
  const [useDivine, setUseDivine] = useState(false);
  const [sendError, setSendError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/player-login");
    }
  }, [loading, session, router]);

  const playerId = session?.playerId ?? "";
  const guildId = session?.guildId ?? "";

  const characterQuery = trpc.character.get.useQuery(
    { playerId },
    { enabled: !!playerId }
  );

  const prayersQuery = trpc.prayer.listForPlayer.useQuery(
    { playerId, guildId },
    { enabled: !!playerId && !!guildId }
  );

  const sendMutation = trpc.prayer.send.useMutation({
    onSuccess: () => {
      prayersQuery.refetch();
      characterQuery.refetch();
      setPrayerText("");
      setSendError("");
      setUseDivine(false);
      setSuccessMessage(t("sent"));
      setTimeout(() => setSuccessMessage(""), 3000);
    },
    onError: (err) => {
      setSendError(err.message);
    },
  });

  function handleSendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prayerText.trim() || !playerId || !guildId) return;
    sendMutation.mutate({
      playerId,
      guildId,
      message: prayerText.trim(),
      useDivinePrayer: useDivine,
    });
  }

  const character = characterQuery.data;
  const faithPoints = character?.faithPoints ?? 0;
  const isCleric = character?.class === "cleric";

  if (loading || (!session && !loading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const prayers = prayersQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header + faith balance */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {character && (
          <div className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
            🕊️ {t("faithBalance", { count: faithPoints })}
          </div>
        )}
      </div>

      {/* Send Prayer form */}
      <Card className="gradient-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("sendPrayer")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendSubmit} className="space-y-3">
            <textarea
              rows={4}
              required
              minLength={1}
              maxLength={1000}
              placeholder={t("prayerText")}
              className={INPUT_CLASS + " resize-none"}
              value={prayerText}
              onChange={(e) => setPrayerText(e.target.value)}
            />

            {/* Cleric divine prayer toggle */}
            {isCleric && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDivine}
                  onChange={(e) => setUseDivine(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                  {t("clericFree")}
                </span>
              </label>
            )}

            {/* Cost note */}
            {!useDivine && (
              <p className="text-xs text-muted-foreground">{t("faithCost")}</p>
            )}

            {sendError && (
              <p className="text-sm text-destructive">{sendError}</p>
            )}

            {successMessage && (
              <p className="text-sm text-xp">{successMessage}</p>
            )}

            <Button
              type="submit"
              disabled={
                sendMutation.isPending ||
                !prayerText.trim() ||
                (!useDivine && faithPoints < 1)
              }
            >
              {sendMutation.isPending ? "…" : t("send")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Prayers list */}
      {prayersQuery.isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {!prayersQuery.isLoading && prayers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 text-6xl" aria-hidden="true">
            🙏
          </div>
          <h3 className="mb-2 text-xl font-semibold">{t("noPlayerPrayers")}</h3>
          <p className="text-sm text-muted-foreground">{t("noPlayerPrayersDesc")}</p>
        </div>
      )}

      {!prayersQuery.isLoading && prayers.length > 0 && (
        <div className="space-y-4">
          {prayers.map((prayer) => {
            const isAnswered = prayer.status === "answered";

            return (
              <Card key={prayer.id} className="gradient-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(prayer.createdAt)}
                    </p>
                    <Badge
                      className={
                        isAnswered
                          ? "shrink-0 bg-xp/80 text-white hover:bg-xp/80"
                          : "shrink-0 bg-gold/80 text-white hover:bg-gold/80"
                      }
                    >
                      {isAnswered ? t("answered") : t("unanswered")}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Prayer message */}
                  <p className="text-sm">{prayer.message}</p>

                  {/* Master replies */}
                  {prayer.replies.length > 0 && (
                    <div className="space-y-2 border-l-2 border-border pl-3">
                      {prayer.replies.map((reply) => (
                        <div key={reply.id}>
                          <p className="text-xs font-medium text-muted-foreground">
                            {reply.author.name} · {formatDate(reply.createdAt)}
                          </p>
                          <p className="text-sm">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
