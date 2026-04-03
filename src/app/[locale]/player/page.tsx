"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharacterCard } from "@/components/player/character-card";
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

type Quest = {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  goldReward: number;
  faithReward: number;
  confirmationType: string;
};

export default function PlayerDashboard() {
  const t = useTranslations("playerDashboard");
  const router = useRouter();
  const { session, loading, logout } = usePlayerSession();

  // Proof text state: maps instanceId -> proof text
  const [proofTexts, setProofTexts] = useState<Record<string, string>>({});

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

  const acceptMutation = trpc.quest.accept.useMutation({
    onSuccess: () => questsQuery.refetch(),
  });

  const submitMutation = trpc.quest.submit.useMutation({
    onSuccess: (_data, variables) => {
      setProofTexts((prev) => {
        const next = { ...prev };
        delete next[variables.instanceId];
        return next;
      });
      questsQuery.refetch();
    },
  });

  function handleAccept(questId: string) {
    acceptMutation.mutate({ questId, playerId });
  }

  function handleSubmit(instance: QuestInstance) {
    const text = proofTexts[instance.id] ?? "";
    submitMutation.mutate({
      instanceId: instance.id,
      playerId,
      confirmationData: {
        type: instance.quest.confirmationType as "text" | "photo" | "timer" | "master_confirm",
        text: text || undefined,
      },
    });
  }

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

  // Build per-quest instance map
  const instanceMap = new Map<string, QuestInstance>(
    (questData?.instances ?? []).map((i) => [i.questId, i as QuestInstance])
  );

  // Group quests
  const availableQuests: Quest[] = [];
  const acceptedInstances: QuestInstance[] = [];
  const pendingInstances: QuestInstance[] = [];
  const completedInstances: QuestInstance[] = [];

  if (questData) {
    const allQuests = [
      ...questData.mandatoryQuests,
      ...questData.optionalQuests,
    ] as Quest[];

    for (const quest of allQuests) {
      const instance = instanceMap.get(quest.id);
      if (!instance) {
        availableQuests.push(quest);
      }
    }

    for (const instance of questData.instances as QuestInstance[]) {
      if (instance.status === "accepted") {
        acceptedInstances.push(instance);
      } else if (instance.status === "pending_review") {
        pendingInstances.push(instance);
      } else if (instance.status === "completed") {
        completedInstances.push(instance);
      }
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Header with welcome and logout */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {t("welcome", { name: session.playerName })}
        </h1>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          {t("logout")}
        </Button>
      </div>

      {/* Character card */}
      {character ? (
        <CharacterCard
          playerName={session.playerName}
          character={{
            class: character.class,
            level: character.level,
            xp: character.xp,
            gold: character.gold,
            faithPoints: character.faithPoints,
          }}
        />
      ) : characterQuery.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Loading character...</p>
        </div>
      ) : null}

      {/* Quests section */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h3 className="font-semibold">{t("activeQuests")}</h3>

        {questsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading quests...</p>
        )}

        {!questsQuery.isLoading && questData &&
          availableQuests.length === 0 &&
          acceptedInstances.length === 0 &&
          pendingInstances.length === 0 &&
          completedInstances.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm font-medium">{t("noQuests")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("noQuestsDesc")}</p>
            </div>
          )}

        {/* Available quests */}
        {availableQuests.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {t("available")}
            </p>
            {availableQuests.map((quest) => (
              <div
                key={quest.id}
                className="rounded-md border border-border p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{quest.title}</p>
                    <p className="text-xs text-muted-foreground">{quest.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {quest.xpReward} XP · {quest.goldReward} Gold
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acceptMutation.isPending}
                    onClick={() => handleAccept(quest.id)}
                  >
                    {t("acceptQuest")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Accepted / In progress */}
        {acceptedInstances.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {t("accepted")}
            </p>
            {acceptedInstances.map((instance) => (
              <div
                key={instance.id}
                className="rounded-md border border-border p-3 space-y-2"
              >
                <p className="text-sm font-medium">{instance.quest.title}</p>
                <p className="text-xs text-muted-foreground">{instance.quest.description}</p>
                <p className="text-xs text-muted-foreground">
                  {instance.quest.xpReward} XP · {instance.quest.goldReward} Gold
                </p>
                {instance.quest.confirmationType === "text" && (
                  <textarea
                    rows={2}
                    placeholder={t("addProof")}
                    value={proofTexts[instance.id] ?? ""}
                    onChange={(e) =>
                      setProofTexts((prev) => ({
                        ...prev,
                        [instance.id]: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                )}
                <Button
                  size="sm"
                  disabled={submitMutation.isPending}
                  onClick={() => handleSubmit(instance)}
                >
                  {t("submitQuest")}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Pending review */}
        {pendingInstances.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {t("pendingReview")}
            </p>
            {pendingInstances.map((instance) => (
              <div
                key={instance.id}
                className="rounded-md border border-border p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{instance.quest.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {instance.quest.xpReward} XP · {instance.quest.goldReward} Gold
                  </p>
                </div>
                <Badge variant="secondary">{t("pendingReview")}</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Completed */}
        {completedInstances.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {t("completed")}
            </p>
            {completedInstances.map((instance) => (
              <div
                key={instance.id}
                className="rounded-md border border-border p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{instance.quest.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {instance.quest.xpReward} XP · {instance.quest.goldReward} Gold
                  </p>
                </div>
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                  {t("completed")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
