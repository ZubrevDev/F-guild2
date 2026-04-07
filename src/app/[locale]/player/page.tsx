"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { DiceRollButton } from "@/components/dice/dice-roll-button";
import { trpc } from "@/lib/trpc";
import { usePlayerSession } from "@/lib/player-session";

type QuestInstance = {
  id: string;
  questId: string;
  playerId: string;
  status: string;
  quest: {
    id: string;
    title: string;
    description: string;
    xpReward: number;
    goldReward: number;
    faithReward: number;
    confirmationType: string;
  };
};

export default function PlayerHome() {
  const t = useTranslations("playerHome");
  const router = useRouter();
  const { session, loading, logout } = usePlayerSession();

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

  const questsQuery = trpc.quest.forPlayer.useQuery(
    { playerId, guildId },
    { enabled: !!playerId && !!guildId }
  );

  function handleLogout() {
    logout();
    router.replace("/player-login");
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const character = characterQuery.data;
  const questData = questsQuery.data;

  // Collect accepted and pending_review instances
  const activeInstances: QuestInstance[] = [];
  if (questData) {
    for (const instance of questData.instances as QuestInstance[]) {
      if (instance.status === "accepted" || instance.status === "pending_review") {
        activeInstances.push(instance);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Hero welcome banner */}
      <div className="gradient-hero rounded-xl p-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            {t("welcome", { name: session.playerName })}
          </h1>
          {character && (
            <p className="text-sm text-white/60 mt-1">
              {character.class} · {t("level", { level: character.level })}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="border-border/40 text-white hover:bg-muted/20"
        >
          {t("logout")}
        </Button>
      </div>

      {/* Mini character stats */}
      {character && (
        <div className="grid grid-cols-3 gap-3">
          <div className="gradient-card rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-gold">{character.gold}</p>
            <p className="text-xs text-muted-foreground">{t("gold")}</p>
          </div>
          <div className="gradient-card rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-xp">{character.xp}</p>
            <p className="text-xs text-muted-foreground">{t("xp")}</p>
          </div>
          <div className="gradient-card rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-mana-blue">{character.faithPoints}</p>
            <p className="text-xs text-muted-foreground">{t("faith")}</p>
          </div>
        </div>
      )}

      {/* Active quests */}
      <div className="gradient-card rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">{t("myQuests")}</h2>

        {questsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {!questsQuery.isLoading && activeInstances.length === 0 && (
          <div className="text-center py-3">
            <p className="text-sm font-medium">{t("noActiveQuests")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("noActiveQuestsDesc")}
            </p>
            <Link
              href="/player/quests"
              className="mt-3 inline-block text-xs text-primary hover:text-primary/80 underline underline-offset-2"
            >
              {t("viewBoard")}
            </Link>
          </div>
        )}

        {activeInstances.map((instance) => (
          <div
            key={instance.id}
            className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{instance.quest.title}</p>
              <p className="text-xs text-muted-foreground">
                {instance.quest.xpReward} XP · {instance.quest.goldReward} Gold
              </p>
            </div>
            {instance.status === "accepted" ? (
              <Badge className="bg-primary/20 text-primary border-0">
                {t("inProgress")}
              </Badge>
            ) : (
              <Badge className="bg-gold/20 text-gold border-0">
                {t("pendingReview")}
              </Badge>
            )}
          </div>
        ))}
      </div>

      {/* Dice roll */}
      {character && (
        <div className="gradient-card rounded-lg p-4 space-y-3">
          <h3 className="font-semibold">{t("diceRoll")}</h3>
          <DiceRollButton characterId={character.id} context="general" dc={10} />
        </div>
      )}
    </div>
  );
}
