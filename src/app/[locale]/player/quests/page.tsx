"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { usePlayerSession } from "@/lib/player-session";
import { Coins, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRarityClass } from "@/lib/rarity";

type Quest = {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  goldReward: number;
  faithReward: number;
  confirmationType: string;
  itemRewards?: Array<{
    claimed: boolean;
    quantity: number;
    item: { id: string; name: string; rarity: string };
  }>;
};

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
    itemRewards?: Array<{
      claimed: boolean;
      quantity: number;
      item: { id: string; name: string; rarity: string };
    }>;
  };
};

export default function QuestBoard() {
  const t = useTranslations("questBoard");
  const router = useRouter();
  const { session, loading } = usePlayerSession();
  const [activeTab, setActiveTab] = useState<"available" | "my">("available");
  const [proofTexts, setProofTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/player-login");
    }
  }, [loading, session, router]);

  const playerId = session?.playerId ?? "";
  const guildId = session?.guildId ?? "";

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

  if (loading || !session) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const questData = questsQuery.data;

  // Build per-quest instance map
  const instanceMap = new Map<string, QuestInstance>(
    (questData?.instances ?? []).map((i) => [i.questId, i as QuestInstance])
  );

  // Available quests (no instance yet)
  const mandatoryAvailable: Quest[] = [];
  const optionalAvailable: Quest[] = [];

  if (questData) {
    for (const quest of questData.mandatoryQuests as Quest[]) {
      if (!instanceMap.has(quest.id)) {
        mandatoryAvailable.push(quest);
      }
    }
    for (const quest of questData.optionalQuests as Quest[]) {
      if (!instanceMap.has(quest.id)) {
        optionalAvailable.push(quest);
      }
    }
  }

  // My quest instances grouped by status
  const acceptedInstances: QuestInstance[] = [];
  const pendingInstances: QuestInstance[] = [];
  const completedInstances: QuestInstance[] = [];

  if (questData) {
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

  const hasNoAvailable = mandatoryAvailable.length === 0 && optionalAvailable.length === 0;
  const hasNoMyQuests =
    acceptedInstances.length === 0 &&
    pendingInstances.length === 0 &&
    completedInstances.length === 0;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex border-b border-purple-500/15">
        <button
          onClick={() => setActiveTab("available")}
          className={cn(
            "px-4 py-2 min-h-[44px] text-sm font-medium transition-colors",
            activeTab === "available"
              ? "border-b-2 border-purple-500 text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("available")}
        </button>
        <button
          onClick={() => setActiveTab("my")}
          className={cn(
            "px-4 py-2 min-h-[44px] text-sm font-medium transition-colors",
            activeTab === "my"
              ? "border-b-2 border-purple-500 text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("myQuests")}
        </button>
      </div>

      {/* Available tab */}
      {activeTab === "available" && (
        <div className="space-y-4">
          {questsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {!questsQuery.isLoading && hasNoAvailable && (
            <div className="gradient-card rounded-lg p-6 text-center">
              <p className="text-sm font-medium">{t("noAvailable")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("noAvailableDesc")}</p>
            </div>
          )}

          {/* Mandatory quests */}
          {mandatoryAvailable.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground px-1">
                {t("mandatory")}
              </p>
              {mandatoryAvailable.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  t={t}
                  onAccept={() => handleAccept(quest.id)}
                  acceptPending={acceptMutation.isPending}
                />
              ))}
            </div>
          )}

          {/* Optional quests */}
          {optionalAvailable.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground px-1">
                {t("optional")}
              </p>
              {optionalAvailable.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  t={t}
                  onAccept={() => handleAccept(quest.id)}
                  acceptPending={acceptMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Quests tab */}
      {activeTab === "my" && (
        <div className="space-y-4">
          {questsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {!questsQuery.isLoading && hasNoMyQuests && (
            <div className="gradient-card rounded-lg p-6 text-center">
              <p className="text-sm font-medium">{t("noMyQuests")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("noMyQuestsDesc")}</p>
            </div>
          )}

          {/* Accepted / In progress */}
          {acceptedInstances.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground px-1">
                {t("inProgress")}
              </p>
              {acceptedInstances.map((instance) => (
                <div key={instance.id} className="gradient-card rounded-lg p-4 space-y-3">
                  <div>
                    <p className="font-medium">{instance.quest.title}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {instance.quest.xpReward > 0 && (
                        <span className="flex items-center gap-1 text-xs text-xp">
                          <Sparkles className="h-3 w-3" />
                          {t("xpReward", { amount: instance.quest.xpReward })}
                        </span>
                      )}
                      {instance.quest.goldReward > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gold">
                          <Coins className="h-3 w-3" />
                          {t("goldReward", { amount: instance.quest.goldReward })}
                        </span>
                      )}
                      {instance.quest.faithReward > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-400">
                          <Star className="h-3 w-3" />
                          {t("faithReward", { amount: instance.quest.faithReward })}
                        </span>
                      )}
                      {instance.quest.itemRewards?.map((reward, i) => (
                        <span
                          key={`item-${i}`}
                          className={`flex items-center gap-1 text-xs ${getRarityClass(reward.item.rarity)} ${reward.claimed ? "line-through opacity-50" : ""}`}
                        >
                          🎁 {reward.item.name}
                          {reward.quantity > 1 ? ` x${reward.quantity}` : ""}
                          {reward.claimed ? ` (${t("claimed")})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
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
                      className="w-full rounded-md border border-purple-500/20 bg-white/5 px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:border-purple-500/50 focus:outline-none resize-none"
                    />
                  )}
                  <Button
                    size="sm"
                    className="gradient-btn-primary w-full"
                    disabled={submitMutation.isPending}
                    onClick={() => handleSubmit(instance)}
                  >
                    {t("submit")}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pending review */}
          {pendingInstances.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground px-1">
                {t("pendingReview")}
              </p>
              {pendingInstances.map((instance) => (
                <div
                  key={instance.id}
                  className="gradient-card rounded-lg p-4 flex items-center justify-between"
                >
                  <p className="font-medium">{instance.quest.title}</p>
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-0">
                    {t("pendingReview")}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Completed */}
          {completedInstances.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground px-1">
                {t("completed")}
              </p>
              {completedInstances.map((instance) => (
                <div
                  key={instance.id}
                  className="gradient-card rounded-lg p-4 flex items-center justify-between"
                >
                  <p className="font-medium">{instance.quest.title}</p>
                  <Badge className="bg-green-500/20 text-green-400 border-0">
                    {t("completed")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Quest card component for available quests
function QuestCard({
  quest,
  t,
  onAccept,
  acceptPending,
}: {
  quest: Quest;
  t: (key: string, values?: Record<string, string | number>) => string;
  onAccept: () => void;
  acceptPending: boolean;
}) {
  return (
    <div className="gradient-card rounded-lg p-4 space-y-3">
      <div>
        <p className="font-medium">{quest.title}</p>
        {quest.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {quest.description}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {quest.xpReward > 0 && (
          <span className="flex items-center gap-1 text-xs text-xp">
            <Sparkles className="h-3 w-3" />
            {t("xpReward", { amount: quest.xpReward })}
          </span>
        )}
        {quest.goldReward > 0 && (
          <span className="flex items-center gap-1 text-xs text-gold">
            <Coins className="h-3 w-3" />
            {t("goldReward", { amount: quest.goldReward })}
          </span>
        )}
        {quest.faithReward > 0 && (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Star className="h-3 w-3" />
            {t("faithReward", { amount: quest.faithReward })}
          </span>
        )}
        {quest.itemRewards?.map((reward, i) => (
          <span
            key={`item-${i}`}
            className={`flex items-center gap-1 text-xs ${getRarityClass(reward.item.rarity)} ${reward.claimed ? "line-through opacity-50" : ""}`}
          >
            🎁 {reward.item.name}
            {reward.quantity > 1 ? ` x${reward.quantity}` : ""}
            {reward.claimed ? ` (${t("claimed")})` : ""}
          </span>
        ))}
        <span className="text-xs text-muted-foreground">
          {t(quest.confirmationType as "photo" | "text" | "timer" | "master_confirm")}
        </span>
      </div>
      <Button
        size="sm"
        className="gradient-btn-primary w-full"
        disabled={acceptPending}
        onClick={onAccept}
      >
        {t("accept")}
      </Button>
    </div>
  );
}
