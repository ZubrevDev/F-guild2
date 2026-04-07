"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertTriangle, CheckCircle } from "lucide-react";

type CleanupResult = {
  warned: number;
  softDeleted: number;
  hardDeleted: number;
  timestamp: string;
};

export default function AdminCleanupPage() {
  const t = useTranslations("admin");
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { data: inactiveGuilds, isLoading } =
    trpc.admin.inactiveGuilds.useQuery();

  const cleanupMutation = trpc.admin.triggerCleanup.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      setConfirmed(false);
    },
  });

  function handleTrigger() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    cleanupMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("cleanup.title")}</h1>

      {/* Manual trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-4 w-4 text-destructive" />
            {t("cleanup.manualTrigger")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("cleanup.manualTriggerDescription")}
          </p>

          {confirmed && (
            <div className="flex items-start gap-2 rounded-md border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("cleanup.confirmWarning")}</span>
            </div>
          )}

          <Button
            variant={confirmed ? "destructive" : "outline"}
            onClick={handleTrigger}
            disabled={cleanupMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {confirmed
              ? t("cleanup.confirmButton")
              : t("cleanup.triggerButton")}
          </Button>

          {confirmed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmed(false)}
              disabled={cleanupMutation.isPending}
            >
              {t("cleanup.cancelButton")}
            </Button>
          )}

          {/* Last result */}
          {lastResult && (
            <div className="flex items-start gap-2 rounded-md border border-xp/30 bg-xp/10 p-3 text-sm text-xp">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">{t("cleanup.resultTitle")}</p>
                <p>
                  {t("cleanup.resultWarned", { count: lastResult.warned })}
                </p>
                <p>
                  {t("cleanup.resultSoftDeleted", {
                    count: lastResult.softDeleted,
                  })}
                </p>
                <p>
                  {t("cleanup.resultHardDeleted", {
                    count: lastResult.hardDeleted,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(lastResult.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {cleanupMutation.isError && (
            <p className="text-sm text-destructive">
              {cleanupMutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Inactive guilds list */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">
          {t("cleanup.inactiveGuildsTitle")}
        </h2>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : !inactiveGuilds?.length ? (
              <p className="p-6 text-sm text-muted-foreground">
                {t("cleanup.noInactiveGuilds")}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {inactiveGuilds.map((guild) => {
                  const twelveMonthsAgo = new Date();
                  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
                  const isDeletionImminent =
                    new Date(guild.lastActivityAt) <= twelveMonthsAgo;

                  return (
                    <div
                      key={guild.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{guild.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {guild.masters[0]?.user
                            ? `${guild.masters[0].user.name} (${guild.masters[0].user.email})`
                            : t("cleanup.noOwner")}
                          {" · "}
                          {t("cleanup.lastActivityLabel")}{" "}
                          {new Date(guild.lastActivityAt).toLocaleDateString()}
                          {" · "}
                          {t("cleanup.playersCount", {
                            count: guild._count.players,
                          })}
                        </p>
                      </div>
                      <Badge
                        variant={
                          isDeletionImminent ? "destructive" : "secondary"
                        }
                      >
                        {isDeletionImminent
                          ? t("cleanup.deletionImminent")
                          : t("cleanup.warningSoon")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
