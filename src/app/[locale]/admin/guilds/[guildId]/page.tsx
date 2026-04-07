"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Sword, Crown } from "lucide-react";

export default function AdminGuildDetailPage({
  params,
}: {
  params: Promise<{ guildId: string; locale: string }>;
}) {
  const { guildId } = use(params);
  const t = useTranslations("admin");
  const { data: guild, isLoading } = trpc.admin.guildDetail.useQuery({
    guildId,
  });

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!guild) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/guilds">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("guildDetail.back")}
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">{t("guildDetail.notFound")}</p>
      </div>
    );
  }

  const isDeleted = !!guild.deletedAt;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const isActive = !isDeleted && new Date(guild.lastActivityAt) >= thirtyDaysAgo;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/guilds">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("guildDetail.back")}
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{guild.name}</h1>
          {guild.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {guild.description}
            </p>
          )}
        </div>
        <Badge variant={isDeleted ? "destructive" : isActive ? "default" : "secondary"}>
          {isDeleted
            ? t("guilds.statusDeleted")
            : isActive
            ? t("guilds.statusActive")
            : t("guilds.statusInactive")}
        </Badge>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("guildDetail.masters")}
            </CardTitle>
            <Crown className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{guild._count.masters}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("guildDetail.players")}
            </CardTitle>
            <Users className="h-4 w-4 text-mana-blue" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{guild._count.players}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("guildDetail.quests")}
            </CardTitle>
            <Sword className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{guild._count.quests}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card>
        <CardContent className="grid gap-3 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("guildDetail.guildId")}</span>
            <span className="font-mono text-xs">{guild.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("guildDetail.createdBy")}</span>
            <span>{guild.createdBy.name} ({guild.createdBy.email})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("guildDetail.createdAt")}</span>
            <span>{new Date(guild.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("guildDetail.lastActivity")}</span>
            <span>{new Date(guild.lastActivityAt).toLocaleString()}</span>
          </div>
          {guild.deletedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("guildDetail.deletedAt")}</span>
              <span className="text-destructive">
                {new Date(guild.deletedAt).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("guildDetail.inviteCode")}</span>
            <span className="font-mono text-xs">{guild.inviteCode}</span>
          </div>
        </CardContent>
      </Card>

      {/* Masters list */}
      {guild.masters.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("guildDetail.mastersList")}</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {guild.masters.map((m) => (
                  <div
                    key={m.user.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{m.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.user.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">
                        {m.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t("guildDetail.joinedAt")}{" "}
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
