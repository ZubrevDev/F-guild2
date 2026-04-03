"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DiceLogPage() {
  const t = useTranslations("dice");
  const { data: session } = useSession();
  const guildId = (session?.user as { guildId?: string } | undefined)?.guildId ?? "";

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [page, setPage] = useState(1);

  const statsQuery = trpc.dice.stats.useQuery(
    { guildId, playerId: selectedPlayerId || undefined },
    { enabled: !!guildId },
  );

  const logQuery = trpc.dice.log.useQuery(
    {
      guildId,
      playerId: selectedPlayerId || undefined,
      page,
      limit: 20,
    },
    { enabled: !!guildId },
  );

  const playersQuery = trpc.player.list.useQuery(
    { guildId },
    { enabled: !!guildId },
  );

  function handlePlayerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedPlayerId(e.target.value);
    setPage(1);
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleString();
  }

  const stats = statsQuery.data;
  const logData = logQuery.data;
  const players = playersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("diceLog")}</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalRolls")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalRolls ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("avgRoll")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.avgRoll ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("crits")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">
              {stats?.criticalHits ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("fails")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">
              {stats?.criticalFails ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("successRate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {stats?.successRate ?? 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter row + export */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedPlayerId}
          onChange={handlePlayerChange}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label={t("filterByPlayer")}
        >
          <option value="">{t("allPlayers")}</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(`/api/dice-log/export?guildId=${guildId}`, "_blank")
          }
        >
          {t("exportCsv")}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {logQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !logData || logData.items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base font-medium">{t("noRolls")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("noRollsDesc")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("date")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("player")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("context")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    {t("roll")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    {t("modifiers")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    {t("total")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    {t("dc")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    {t("result")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logData.items.map((entry, idx) => {
                  const modifiers =
                    typeof entry.modifiers === "string"
                      ? (JSON.parse(entry.modifiers) as { value: number }[])
                      : (entry.modifiers as { value: number }[]);

                  const totalModifier = Array.isArray(modifiers)
                    ? modifiers.reduce(
                        (sum: number, m: { value: number }) => sum + m.value,
                        0,
                      )
                    : 0;

                  const isCrit = entry.rollValue === 20;
                  const isFail = entry.rollValue === 1;

                  return (
                    <tr
                      key={entry.id}
                      className={
                        idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                      }
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.rolledAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {entry.playerName}
                      </td>
                      <td className="px-4 py-3 capitalize">{entry.context}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            isCrit
                              ? "font-bold text-yellow-500"
                              : isFail
                                ? "font-bold text-red-500"
                                : ""
                          }
                        >
                          {entry.rollValue}
                          {isCrit && " ★"}
                          {isFail && " ✕"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {totalModifier >= 0 ? `+${totalModifier}` : totalModifier}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {entry.total}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.difficultyClass}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.success ? (
                          <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                            {t("success")}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="border-0">
                            {t("failure")}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {logData && logData.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {logData.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= logData.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
