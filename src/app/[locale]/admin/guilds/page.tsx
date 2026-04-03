"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

type GuildStatus = "active" | "inactive" | "deleted" | "all";

export default function AdminGuildsPage() {
  const t = useTranslations("admin");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<GuildStatus>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.admin.guilds.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    page,
    limit: 20,
  });

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatus(value as GuildStatus);
    setPage(1);
  }

  function getBadgeVariant(guild: {
    deletedAt: Date | null;
    isActive: boolean;
    lastActivityAt: Date;
  }) {
    if (guild.deletedAt) return "destructive" as const;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (new Date(guild.lastActivityAt) >= thirtyDaysAgo)
      return "default" as const;
    return "secondary" as const;
  }

  function getStatusLabel(guild: {
    deletedAt: Date | null;
    isActive: boolean;
    lastActivityAt: Date;
  }) {
    if (guild.deletedAt) return t("guilds.statusDeleted");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (new Date(guild.lastActivityAt) >= thirtyDaysAgo)
      return t("guilds.statusActive");
    return t("guilds.statusInactive");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("guilds.title")}</h1>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder={t("guilds.searchPlaceholder")}
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-md border border-border bg-card px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary sm:w-40"
        >
          <option value="all">{t("guilds.filterAll")}</option>
          <option value="active">{t("guilds.statusActive")}</option>
          <option value="inactive">{t("guilds.statusInactive")}</option>
          <option value="deleted">{t("guilds.statusDeleted")}</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : !data?.guilds.length ? (
            <p className="p-6 text-sm text-muted-foreground">
              {t("guilds.noResults")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.guilds.map((guild) => (
                <div
                  key={guild.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/guilds/${guild.id}`}
                      className="font-medium hover:underline truncate block"
                    >
                      {guild.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("guilds.membersCount", {
                        count: guild._count.masters,
                      })}{" "}
                      &middot;{" "}
                      {t("guilds.playersCount", {
                        count: guild._count.players,
                      })}{" "}
                      &middot;{" "}
                      {t("guilds.lastActivity")}{" "}
                      {new Date(guild.lastActivityAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={getBadgeVariant(guild)}>
                    {getStatusLabel(guild)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t("guilds.pageInfo", {
              page: data.page,
              totalPages: data.totalPages,
              total: data.total,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
