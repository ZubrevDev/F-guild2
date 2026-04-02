"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sword, Wand2, TreePine, Cross, Eye, Music, Shield, AlertCircle, MessageCircle } from "lucide-react";

const CLASS_ICONS: Record<string, typeof Shield> = {
  fighter: Sword,
  wizard: Wand2,
  ranger: TreePine,
  cleric: Cross,
  rogue: Eye,
  bard: Music,
};

// TODO: Replace with tRPC data when guild context is available
const MOCK_PLAYERS = [
  { name: "Артас", class: "fighter", level: 3, xp: 180, gold: 250 },
  { name: "Гэндальф", class: "wizard", level: 2, xp: 80, gold: 150 },
  { name: "Робин", class: "ranger", level: 1, xp: 30, gold: 100 },
];

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">{t("pendingQuests")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MessageCircle className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">{t("unreadPrayers")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Player cards */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("players")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_PLAYERS.map((player) => {
            const Icon = CLASS_ICONS[player.class] || Shield;
            return (
              <Card key={player.name}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{player.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                        {player.class}
                      </Badge>
                      <span>Lvl {player.level}</span>
                      <span>{player.xp} XP</span>
                      <span>{player.gold}g</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Activity feed placeholder */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("activity")}</h2>
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t("noActivity")}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
