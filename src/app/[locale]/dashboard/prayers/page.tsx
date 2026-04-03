"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FilterState = "all" | "unanswered" | "answered";

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

export default function MasterPrayersPage() {
  const t = useTranslations("prayers");
  const { data: session } = useSession();
  const guildId = (session?.user as { guildId?: string } | undefined)?.guildId;

  const [filter, setFilter] = useState<FilterState>("all");
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState("");
  const [successId, setSuccessId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Map filter to API status param
  const statusParam =
    filter === "unanswered" ? "sent" : filter === "answered" ? "answered" : undefined;

  const { data: prayers, isLoading } = trpc.prayer.listForMaster.useQuery(
    { guildId: guildId!, status: statusParam },
    { enabled: !!guildId }
  );

  const replyMutation = trpc.prayer.reply.useMutation({
    onSuccess: (_, vars) => {
      utils.prayer.listForMaster.invalidate({ guildId: guildId! });
      setSuccessId(vars.prayerId);
      setReplyOpenId(null);
      setReplyText("");
      setReplyError("");
      setTimeout(() => setSuccessId(null), 3000);
    },
    onError: (err) => setReplyError(err.message),
  });

  function handleReplySubmit(e: React.FormEvent, prayerId: string) {
    e.preventDefault();
    if (!replyText.trim()) return;
    replyMutation.mutate({ prayerId, message: replyText.trim() });
  }

  if (!guildId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["all", "unanswered", "answered"] as FilterState[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
              filter === f
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {f === "all" ? "All" : f === "unanswered" ? t("unanswered") : t("answered")}
          </button>
        ))}
      </div>

      {/* Success toast */}
      {successId && (
        <div className="rounded-md bg-green-100 px-4 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          {t("replied")}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!prayers || prayers.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 text-6xl" aria-hidden="true">
            🙏
          </div>
          <h3 className="mb-2 text-xl font-semibold">{t("noPrayers")}</h3>
          <p className="text-sm text-muted-foreground">{t("noPrayersDesc")}</p>
        </div>
      )}

      {/* Prayers list */}
      {!isLoading && prayers && prayers.length > 0 && (
        <div className="space-y-4">
          {prayers.map((prayer) => {
            const isAnswered = prayer.status === "answered";
            const isReplying = replyOpenId === prayer.id;

            return (
              <Card key={prayer.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {prayer.player.name}
                    </CardTitle>
                    <Badge
                      className={
                        isAnswered
                          ? "shrink-0 bg-green-500 text-white hover:bg-green-500"
                          : "shrink-0 bg-yellow-500 text-white hover:bg-yellow-500"
                      }
                    >
                      {isAnswered ? t("answered") : t("unanswered")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(prayer.createdAt)}
                  </p>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Prayer message */}
                  <p className="text-sm">{prayer.message}</p>

                  {/* Existing replies */}
                  {prayer.replies.length > 0 && (
                    <div className="space-y-2 border-l-2 border-primary/30 pl-3">
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

                  {/* Reply button / form */}
                  {!isReplying && !isAnswered && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyOpenId(prayer.id);
                        setReplyText("");
                        setReplyError("");
                      }}
                    >
                      {t("reply")}
                    </Button>
                  )}

                  {isReplying && (
                    <form
                      onSubmit={(e) => handleReplySubmit(e, prayer.id)}
                      className="space-y-2"
                    >
                      <textarea
                        rows={3}
                        required
                        minLength={1}
                        maxLength={2000}
                        placeholder={t("replyPlaceholder")}
                        className={INPUT_CLASS + " resize-none"}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        autoFocus
                      />
                      {replyError && (
                        <p className="text-xs text-destructive">{replyError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyOpenId(null);
                            setReplyText("");
                            setReplyError("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={replyMutation.isPending || !replyText.trim()}
                        >
                          {replyMutation.isPending ? "…" : t("send")}
                        </Button>
                      </div>
                    </form>
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
