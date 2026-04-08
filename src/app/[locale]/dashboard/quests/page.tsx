"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { getRarityClass } from "@/lib/rarity";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

type QuestType = "mandatory" | "optional";
type QuestRecurrence = "once" | "daily" | "weekly" | "monthly" | "custom";
type ConfirmationType = "photo" | "text" | "timer" | "master_confirm";
type FilterType = "all" | "mandatory" | "optional";
type FilterRecurrence = "all" | "daily" | "weekly" | "monthly" | "once";

interface CreateQuestForm {
  title: string;
  description: string;
  type: QuestType;
  recurrence: QuestRecurrence;
  xpReward: number;
  goldReward: number;
  faithReward: number;
  difficultyClass: number;
  confirmationType: ConfirmationType;
  assignedTo: string[];
  itemRewards: Array<{ itemId: string; quantity: number }>;
}

const DEFAULT_FORM: CreateQuestForm = {
  title: "",
  description: "",
  type: "optional",
  recurrence: "once",
  xpReward: 50,
  goldReward: 20,
  faithReward: 1,
  difficultyClass: 10,
  confirmationType: "text",
  assignedTo: [],
  itemRewards: [],
};

export default function QuestsPage() {
  const t = useTranslations("quests");
  const { data: session } = useSession();
  const guildId = (session?.user as { guildId?: string } | undefined)?.guildId;

  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterRecurrence, setFilterRecurrence] = useState<FilterRecurrence>("all");

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateQuestForm>(DEFAULT_FORM);
  const [createError, setCreateError] = useState("");

  // Review state: per-instance feedback text and expanded state
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [expandedFeedback, setExpandedFeedback] = useState<Record<string, boolean>>({});
  const [reviewSuccess, setReviewSuccess] = useState("");

  const utils = trpc.useUtils();

  const { data: quests, isLoading: questsLoading } = trpc.quest.list.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const { data: pendingInstances, isLoading: pendingLoading } = trpc.quest.pending.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const { data: players } = trpc.player.list.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const { data: guildItems } = trpc.shop.listItems.useQuery(
    { guildId: guildId!, isActive: true },
    { enabled: !!guildId }
  );

  const createMutation = trpc.quest.create.useMutation({
    onSuccess: () => {
      utils.quest.list.invalidate({ guildId: guildId! });
      setCreateOpen(false);
      setForm(DEFAULT_FORM);
      setCreateError("");
    },
    onError: (err) => {
      setCreateError(err.message);
    },
  });

  const deactivateMutation = trpc.quest.deactivate.useMutation({
    onSuccess: () => {
      utils.quest.list.invalidate({ guildId: guildId! });
    },
  });

  const reviewMutation = trpc.quest.review.useMutation({
    onSuccess: (data, variables) => {
      utils.quest.pending.invalidate({ guildId: guildId! });
      utils.quest.list.invalidate({ guildId: guildId! });
      if (variables.action === "approve" && "xpAwarded" in data) {
        const awarded = data as { xpAwarded: number; goldAwarded: number; awardedItems?: Array<{ name: string }> };
        let msg = t("awarded", { xp: awarded.xpAwarded, gold: awarded.goldAwarded });
        if (awarded.awardedItems && awarded.awardedItems.length > 0) {
          msg += " | " + t("awardedItems", { items: awarded.awardedItems.map((i) => i.name).join(", ") });
        }
        setReviewSuccess(msg);
        setTimeout(() => setReviewSuccess(""), 4000);
      }
    },
  });

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    createMutation.mutate({
      guildId,
      title: form.title,
      description: form.description,
      type: form.type,
      recurrence: form.recurrence,
      xpReward: form.xpReward,
      goldReward: form.goldReward,
      faithReward: form.faithReward,
      difficultyClass: form.difficultyClass,
      confirmationType: form.confirmationType,
      assignedTo: form.assignedTo,
      itemRewards: form.itemRewards,
    });
  }

  function togglePlayerAssign(playerId: string) {
    setForm((prev) => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(playerId)
        ? prev.assignedTo.filter((id) => id !== playerId)
        : [...prev.assignedTo, playerId],
    }));
  }

  function handleApprove(instanceId: string) {
    reviewMutation.mutate({ instanceId, action: "approve" });
  }

  function handleReject(instanceId: string) {
    reviewMutation.mutate({
      instanceId,
      action: "reject",
      rejectionReason: feedbackMap[instanceId] || undefined,
    });
  }

  // Client-side filtering
  const filteredQuests = (quests ?? []).filter((q) => {
    if (filterType !== "all" && q.type !== filterType) return false;
    if (filterRecurrence !== "all" && q.recurrence !== filterRecurrence) return false;
    return true;
  });

  const pendingCount = pendingInstances?.length ?? 0;

  if (!guildId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t("createQuest")}</Button>
      </div>

      {/* Review success toast */}
      {reviewSuccess && (
        <div className="rounded-md border border-xp/30 bg-xp/10 px-4 py-2 text-sm text-xp">
          {reviewSuccess}
        </div>
      )}

      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={[
            "px-4 py-2 min-h-[44px] text-sm font-medium border-b-2 transition-colors",
            activeTab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {t("allQuests")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={[
            "flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium border-b-2 transition-colors",
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {t("pendingReview")}
          {pendingCount > 0 && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: All Quests */}
      {activeTab === "all" && (
        <div className="space-y-4">
          {/* Filter row */}
          <div className="flex flex-wrap gap-2">
            {(["all", "mandatory", "optional"] as FilterType[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                className={[
                  "rounded-full border px-3 py-1 min-h-[44px] text-xs font-medium transition-colors",
                  filterType === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                ].join(" ")}
              >
                {f === "all" ? "All" : t(f)}
              </button>
            ))}
            <div className="w-px bg-border mx-1" />
            {(["all", "once", "daily", "weekly", "monthly"] as FilterRecurrence[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFilterRecurrence(r)}
                className={[
                  "rounded-full border px-3 py-1 min-h-[44px] text-xs font-medium transition-colors",
                  filterRecurrence === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                ].join(" ")}
              >
                {r === "all" ? "All" : t(r)}
              </button>
            ))}
          </div>

          {/* Loading */}
          {questsLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {/* Empty state */}
          {!questsLoading && filteredQuests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-6xl" aria-hidden="true">
                📜
              </div>
              <h2 className="mb-2 text-xl font-semibold">{t("noQuests")}</h2>
              <p className="mb-6 text-sm text-muted-foreground">{t("noQuestsDesc")}</p>
              <Button onClick={() => setCreateOpen(true)}>{t("createQuest")}</Button>
            </div>
          )}

          {/* Quest grid */}
          {!questsLoading && filteredQuests.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredQuests.map((quest) => (
                <Card key={quest.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{quest.title}</CardTitle>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Badge
                          className={
                            quest.type === "mandatory"
                              ? "bg-destructive text-destructive-foreground hover:bg-destructive"
                              : "bg-mana-blue/80 text-white hover:bg-mana-blue/80"
                          }
                        >
                          {t(quest.type as "mandatory" | "optional")}
                        </Badge>
                        {quest.recurrence !== "custom" && (
                          <Badge variant="outline" className="capitalize">
                            {t(quest.recurrence as "once" | "daily" | "weekly" | "monthly")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {/* Description — 2 lines clamped */}
                    {quest.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {quest.description}
                      </p>
                    )}

                    {/* Rewards */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>⚡ {quest.xpReward} XP</span>
                      <span>🪙 {quest.goldReward} Gold</span>
                      {quest.faithReward > 0 && <span>🙏 {quest.faithReward} Faith</span>}
                      {/* Item rewards */}
                      {(quest as unknown as { itemRewards?: Array<{ claimed: boolean; quantity: number; item: { name: string; rarity: string } }> }).itemRewards?.map((reward, i) => (
                        <span
                          key={i}
                          className={`text-xs ${getRarityClass(reward.item.rarity)} ${reward.claimed ? "line-through opacity-50" : ""}`}
                        >
                          🎁 {reward.item.name} x{reward.quantity}
                          {reward.claimed ? ` (${t("itemClaimed")})` : ""}
                        </span>
                      ))}
                    </div>

                    {/* DC */}
                    {quest.difficultyClass > 0 && (
                      <div className="text-xs text-muted-foreground">
                        DC {quest.difficultyClass}
                      </div>
                    )}

                    {/* Confirmation type */}
                    <div className="text-xs text-muted-foreground capitalize">
                      {t("confirmation")}:{" "}
                      {quest.confirmationType === "master_confirm"
                        ? t("masterConfirm")
                        : t(quest.confirmationType as "photo" | "text" | "timer")}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        disabled={deactivateMutation.isPending}
                        onClick={() => deactivateMutation.mutate({ questId: quest.id })}
                      >
                        {t("deactivate")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Pending Review */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {/* Loading */}
          {pendingLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {/* Empty state */}
          {!pendingLoading && pendingCount === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-6xl" aria-hidden="true">
                ✅
              </div>
              <h2 className="mb-2 text-xl font-semibold">{t("noPending")}</h2>
              <p className="text-sm text-muted-foreground">{t("noPendingDesc")}</p>
            </div>
          )}

          {/* Pending cards */}
          {!pendingLoading && pendingCount > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(pendingInstances ?? []).map((instance) => {
                const isExpanded = expandedFeedback[instance.id] ?? false;
                const confirmationData = instance.confirmationData as
                  | Record<string, unknown>
                  | null
                  | undefined;

                return (
                  <Card key={instance.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{instance.quest.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{instance.player.name}</p>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {/* Submitted date */}
                      <p className="text-xs text-muted-foreground">
                        {new Date(instance.createdAt).toLocaleDateString()}
                      </p>

                      {/* Proof text if any */}
                      {confirmationData &&
                        typeof confirmationData.text === "string" &&
                        confirmationData.text && (
                          <p className="rounded-md border border-input bg-muted/50 p-2 text-sm">
                            {confirmationData.text}
                          </p>
                        )}

                      {/* Rewards preview */}
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>⚡ {instance.quest.xpReward} XP</span>
                        <span>🪙 {instance.quest.goldReward} Gold</span>
                        {(instance.quest as unknown as { itemRewards?: Array<{ claimed: boolean; quantity: number; item: { name: string; rarity: string } }> }).itemRewards
                          ?.filter((r) => !r.claimed)
                          .map((reward, i) => (
                            <span
                              key={i}
                              className={`text-xs ${getRarityClass(reward.item.rarity)}`}
                            >
                              🎁 {reward.item.name} x{reward.quantity}
                            </span>
                          ))}
                      </div>

                      {/* Feedback textarea (expandable for reject) */}
                      {isExpanded && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            {t("feedback")}
                          </label>
                          <textarea
                            rows={3}
                            className={INPUT_CLASS + " resize-none"}
                            value={feedbackMap[instance.id] ?? ""}
                            onChange={(e) =>
                              setFeedbackMap((prev) => ({
                                ...prev,
                                [instance.id]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      )}

                      {/* Approve / Reject buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-xp/80 text-white hover:bg-xp text-xs"
                          disabled={reviewMutation.isPending}
                          onClick={() => handleApprove(instance.id)}
                        >
                          {t("approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 text-xs"
                          disabled={reviewMutation.isPending}
                          onClick={() => {
                            if (!isExpanded) {
                              setExpandedFeedback((prev) => ({
                                ...prev,
                                [instance.id]: true,
                              }));
                            } else {
                              handleReject(instance.id);
                            }
                          }}
                        >
                          {t("reject")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Quest modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCreateOpen(false);
              setCreateError("");
              setForm(DEFAULT_FORM);
            }
          }}
        >
          <div className="my-8 w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">{t("createQuest")}</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm font-medium">{t("questTitle")} *</label>
                <input
                  type="text"
                  required
                  minLength={1}
                  maxLength={200}
                  className={INPUT_CLASS}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium">{t("questDescription")}</label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  required
                  className={INPUT_CLASS + " resize-none"}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* Type + Recurrence row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t("type")}</label>
                  <select
                    className={INPUT_CLASS}
                    value={form.type}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, type: e.target.value as QuestType }))
                    }
                  >
                    <option value="mandatory">{t("mandatory")}</option>
                    <option value="optional">{t("optional")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t("recurrence")}</label>
                  <select
                    className={INPUT_CLASS}
                    value={form.recurrence}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        recurrence: e.target.value as QuestRecurrence,
                      }))
                    }
                  >
                    <option value="once">{t("once")}</option>
                    <option value="daily">{t("daily")}</option>
                    <option value="weekly">{t("weekly")}</option>
                    <option value="monthly">{t("monthly")}</option>
                  </select>
                </div>
              </div>

              {/* Rewards row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">{t("xpReward")}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className={INPUT_CLASS}
                    value={form.xpReward}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, xpReward: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("goldReward")}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className={INPUT_CLASS}
                    value={form.goldReward}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, goldReward: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("faithReward")}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className={INPUT_CLASS}
                    value={form.faithReward}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, faithReward: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>

              {/* DC + Confirmation row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t("difficulty")}</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    className={INPUT_CLASS}
                    value={form.difficultyClass}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        difficultyClass: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("confirmation")}</label>
                  <select
                    className={INPUT_CLASS}
                    value={form.confirmationType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        confirmationType: e.target.value as ConfirmationType,
                      }))
                    }
                  >
                    <option value="text">{t("text")}</option>
                    <option value="photo">{t("photo")}</option>
                    <option value="timer">{t("timer")}</option>
                    <option value="master_confirm">{t("masterConfirm")}</option>
                  </select>
                </div>
              </div>

              {/* Assign to players */}
              {players && players.length > 0 && (
                <div>
                  <label className="text-sm font-medium">{t("assignTo")}</label>
                  <p className="mb-2 text-xs text-muted-foreground">{t("allPlayers")}</p>
                  <div className="space-y-1 rounded-md border border-input p-3">
                    {players.map((player) => (
                      <label
                        key={player.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.assignedTo.includes(player.id)}
                          onChange={() => togglePlayerAssign(player.id)}
                          className="h-5 w-5 rounded border-input"
                        />
                        {player.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Item Rewards */}
              <div>
                <label className="text-sm font-medium">{t("itemRewards")}</label>
                <div className="space-y-2 mt-2">
                  {form.itemRewards.map((reward, index) => {
                    const item = guildItems?.find((i: { id: string }) => i.id === reward.itemId);
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <span className={`flex-1 text-sm ${item ? getRarityClass((item as { rarity?: string }).rarity ?? "common") : ""}`}>
                          {(item as { name?: string })?.name ?? "..."}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={reward.quantity}
                          onChange={(e) => {
                            const next = [...form.itemRewards];
                            next[index] = { ...next[index], quantity: Number(e.target.value) || 1 };
                            setForm((prev) => ({ ...prev, itemRewards: next }));
                          }}
                          className={INPUT_CLASS + " w-20 text-center"}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              itemRewards: prev.itemRewards.filter((_, i) => i !== index),
                            }));
                          }}
                          className="text-xs text-destructive hover:underline"
                        >
                          {t("removeItem")}
                        </button>
                      </div>
                    );
                  })}
                  {guildItems && (guildItems as Array<{ id: string; name: string; rarity: string }>).length > 0 && (
                    <select
                      className={INPUT_CLASS}
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setForm((prev) => ({
                          ...prev,
                          itemRewards: [...prev.itemRewards, { itemId: e.target.value, quantity: 1 }],
                        }));
                      }}
                    >
                      <option value="">{t("selectItem")}</option>
                      {(guildItems as Array<{ id: string; name: string }>)
                        .filter((item) => !form.itemRewards.some((r) => r.itemId === item.id))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateError("");
                    setForm(DEFAULT_FORM);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "…" : t("createQuest")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
