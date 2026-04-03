"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Activity, Gamepad2 } from "lucide-react";

export default function AdminOverviewPage() {
  const t = useTranslations("admin");
  const { data, isLoading } = trpc.admin.stats.useQuery();

  const statCards = [
    {
      key: "totalUsers",
      icon: Users,
      value: data?.totalUsers,
      color: "text-blue-400",
    },
    {
      key: "totalGuilds",
      icon: Building2,
      value: data?.totalGuilds,
      color: "text-purple-400",
    },
    {
      key: "activeGuilds",
      icon: Activity,
      value: data?.activeGuilds,
      color: "text-green-400",
    },
    {
      key: "totalPlayers",
      icon: Gamepad2,
      value: data?.totalPlayers,
      color: "text-yellow-400",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("overview.title")}</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ key, icon: Icon, value, color }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`overview.stats.${key}`)}
              </CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {isLoading ? "—" : (value ?? 0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
