"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type EffectType =
  | "xp_bonus"
  | "xp_penalty"
  | "gold_bonus"
  | "gold_penalty"
  | "gold_drain"
  | "dice_bonus"
  | "dice_penalty"
  | "shop_discount"
  | "shop_markup"
  | "faith_bonus"
  | "custom";

type DurationType = "permanent" | "timed" | "manual_cancel";
type BuffType = "buff" | "debuff";

interface CreateBuffForm {
  name: string;
  description: string;
  type: BuffType;
  effectType: EffectType;
  effectValue: number;
  durationType: DurationType;
  defaultDurationMinutes: number;
}

const DEFAULT_FORM: CreateBuffForm = {
  name: "",
  description: "",
  type: "buff",
  effectType: "xp_bonus",
  effectValue: 10,
  durationType: "timed",
  defaultDurationMinutes: 60,
};

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function effectBadgeClass(type: string): string {
  switch (type) {
    case "xp_bonus":
      return "bg-green-500 text-white hover:bg-green-500";
    case "gold_bonus":
      return "bg-amber-500 text-white hover:bg-amber-500";
    case "dice_bonus":
      return "bg-blue-500 text-white hover:bg-blue-500";
    case "xp_penalty":
    case "gold_penalty":
    case "dice_penalty":
      return "bg-red-500 text-white hover:bg-red-500";
    case "shop_discount":
      return "bg-purple-500 text-white hover:bg-purple-500";
    case "gold_drain":
      return "bg-red-900 text-white hover:bg-red-900";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatExpiry(expiresAt: Date | string | null): string {
  if (!expiresAt) return "∞";
  const date = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff <= 0) return "Expired";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

export default function BuffsPage() {
  const t = useTranslations("buffs");
  const { data: session } = useSession();
  const guildId = (session?.user as { guildId?: string } | undefined)?.guildId;

  const utils = trpc.useUtils();

  // --- Create Buff modal state ---
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateBuffForm>(DEFAULT_FORM);
  const [createError, setCreateError] = useState("");

  // --- Apply Buff dialog state ---
  const [applyBuffId, setApplyBuffId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState(false);

  // --- Queries ---
  const { data: templates, isLoading: loadingTemplates } = trpc.buff.list.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const { data: activeBuffs, isLoading: loadingActive } = trpc.buff.activeForGuild.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const { data: players } = trpc.player.list.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId && applyBuffId !== null }
  );

  // --- Mutations ---
  const createMutation = trpc.buff.create.useMutation({
    onSuccess: () => {
      utils.buff.list.invalidate({ guildId: guildId! });
      setCreateOpen(false);
      setForm(DEFAULT_FORM);
      setCreateError("");
    },
    onError: (err) => setCreateError(err.message),
  });

  const applyMutation = trpc.buff.applyBuff.useMutation({
    onSuccess: () => {
      utils.buff.activeForGuild.invalidate({ guildId: guildId! });
      setApplySuccess(true);
      setTimeout(() => {
        setApplyBuffId(null);
        setSelectedPlayerId("");
        setApplyError("");
        setApplySuccess(false);
      }, 1200);
    },
    onError: (err) => setApplyError(err.message),
  });

  const removeMutation = trpc.buff.remove.useMutation({
    onSuccess: () => {
      utils.buff.activeForGuild.invalidate({ guildId: guildId! });
    },
  });

  // --- Handlers ---
  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    createMutation.mutate({
      guildId,
      name: form.name,
      description: form.description,
      type: form.type,
      effect: {
        type: form.effectType,
        value: form.effectValue,
      },
      durationType: form.durationType,
      defaultDurationMinutes:
        form.durationType === "timed" ? form.defaultDurationMinutes : undefined,
      icon: "shield",
    });
  }

  function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!applyBuffId || !selectedPlayerId) return;
    applyMutation.mutate({ buffId: applyBuffId, playerId: selectedPlayerId });
  }

  function effectLabel(type: string): string {
    const map: Record<string, string> = {
      xp_bonus: t("xpBonus"),
      gold_bonus: t("goldBonus"),
      dice_bonus: t("diceBonus"),
      xp_penalty: t("xpPenalty"),
      gold_penalty: t("goldPenalty"),
      dice_penalty: t("dicePenalty"),
      shop_discount: t("shopDiscount"),
      gold_drain: t("goldDrain"),
      shop_markup: "Shop Markup",
      faith_bonus: "Faith Bonus",
      custom: "Custom",
    };
    return map[type] ?? type;
  }

  if (!guildId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Section 1: Buff Templates ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button onClick={() => setCreateOpen(true)}>{t("createBuff")}</Button>
        </div>

        <h2 className="mb-3 text-lg font-semibold text-muted-foreground">{t("templates")}</h2>

        {loadingTemplates && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!loadingTemplates && (!templates || templates.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-6xl" aria-hidden="true">✨</div>
            <h3 className="mb-2 text-xl font-semibold">{t("noBuffs")}</h3>
            <p className="mb-6 text-sm text-muted-foreground">{t("noBuffsDesc")}</p>
            <Button onClick={() => setCreateOpen(true)}>{t("createBuff")}</Button>
          </div>
        )}

        {!loadingTemplates && templates && templates.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((buff) => {
              const effect = buff.effect as { type: string; value: number } | null;
              return (
                <Card key={buff.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{buff.name}</CardTitle>
                      {effect && (
                        <Badge className={effectBadgeClass(effect.type) + " shrink-0 text-xs"}>
                          {effectLabel(effect.type)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {buff.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {buff.description}
                      </p>
                    )}

                    {effect && (
                      <p className="text-sm font-medium">
                        {effect.type.includes("penalty") || effect.type === "gold_drain"
                          ? `-${effect.value}`
                          : `+${effect.value}`}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {buff.durationType === "timed" && buff.defaultDurationMinutes != null
                        ? `${buff.defaultDurationMinutes} ${t("duration").replace(" (minutes)", "")}`
                        : buff.durationType}
                    </p>

                    <Button
                      size="sm"
                      className="mt-1 w-full"
                      onClick={() => {
                        setApplyBuffId(buff.id);
                        setSelectedPlayerId("");
                        setApplyError("");
                        setApplySuccess(false);
                      }}
                    >
                      {t("apply")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Active Buffs ── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-muted-foreground">{t("activeBuffs")}</h2>

        {loadingActive && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!loadingActive && (!activeBuffs || activeBuffs.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-5xl" aria-hidden="true">💤</div>
            <h3 className="mb-1 text-lg font-semibold">{t("noActive")}</h3>
            <p className="text-sm text-muted-foreground">{t("noActiveDesc")}</p>
          </div>
        )}

        {!loadingActive && activeBuffs && activeBuffs.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Player</th>
                  <th className="px-4 py-3 text-left font-medium">{t("buffName")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("effectType")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("expires")}</th>
                  <th className="px-4 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {activeBuffs.map((ab) => {
                  const effect = ab.buff.effect as { type: string; value: number } | null;
                  const playerName = ab.character?.player?.name ?? "—";
                  return (
                    <tr key={ab.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{playerName}</td>
                      <td className="px-4 py-3">{ab.buff.name}</td>
                      <td className="px-4 py-3">
                        {effect && (
                          <Badge className={effectBadgeClass(effect.type) + " text-xs"}>
                            {effectLabel(effect.type)} {effect.type.includes("penalty") || effect.type === "gold_drain" ? `-${effect.value}` : `+${effect.value}`}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatExpiry(ab.expiresAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate({ activeBuffId: ab.id })}
                        >
                          {t("remove")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Buff Modal ── */}
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
          <div className="my-8 w-full max-w-lg rounded-lg bg-background p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{t("createBuff")}</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium">{t("buffName")} *</label>
                <input
                  type="text"
                  required
                  minLength={1}
                  maxLength={200}
                  className={INPUT_CLASS}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium">{t("buffDescription")} *</label>
                <textarea
                  rows={3}
                  required
                  minLength={1}
                  maxLength={2000}
                  className={INPUT_CLASS + " resize-none"}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              {/* Buff / Debuff */}
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className={INPUT_CLASS}
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as BuffType }))}
                >
                  <option value="buff">Buff</option>
                  <option value="debuff">Debuff</option>
                </select>
              </div>

              {/* Effect Type */}
              <div>
                <label className="text-sm font-medium">{t("effectType")} *</label>
                <select
                  className={INPUT_CLASS}
                  value={form.effectType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, effectType: e.target.value as EffectType }))
                  }
                >
                  <option value="xp_bonus">{t("xpBonus")}</option>
                  <option value="gold_bonus">{t("goldBonus")}</option>
                  <option value="dice_bonus">{t("diceBonus")}</option>
                  <option value="xp_penalty">{t("xpPenalty")}</option>
                  <option value="gold_penalty">{t("goldPenalty")}</option>
                  <option value="dice_penalty">{t("dicePenalty")}</option>
                  <option value="shop_discount">{t("shopDiscount")}</option>
                  <option value="gold_drain">{t("goldDrain")}</option>
                  <option value="shop_markup">Shop Markup</option>
                  <option value="faith_bonus">Faith Bonus</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Effect Value */}
              <div>
                <label className="text-sm font-medium">{t("effectValue")} *</label>
                <input
                  type="number"
                  required
                  min={1}
                  className={INPUT_CLASS}
                  value={form.effectValue}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, effectValue: Number(e.target.value) }))
                  }
                />
              </div>

              {/* Duration Type */}
              <div>
                <label className="text-sm font-medium">Duration Type</label>
                <select
                  className={INPUT_CLASS}
                  value={form.durationType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, durationType: e.target.value as DurationType }))
                  }
                >
                  <option value="timed">Timed</option>
                  <option value="permanent">Permanent</option>
                  <option value="manual_cancel">Manual Cancel</option>
                </select>
              </div>

              {/* Default Duration Minutes (only for timed) */}
              {form.durationType === "timed" && (
                <div>
                  <label className="text-sm font-medium">{t("duration")} *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    className={INPUT_CLASS}
                    value={form.defaultDurationMinutes}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        defaultDurationMinutes: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              )}

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
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "…" : t("createBuff")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Apply Buff Dialog ── */}
      {applyBuffId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setApplyBuffId(null);
              setSelectedPlayerId("");
              setApplyError("");
              setApplySuccess(false);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{t("apply")}</h2>

            {applySuccess ? (
              <p className="py-4 text-center text-green-600 font-medium">{t("applied")}</p>
            ) : (
              <form onSubmit={handleApplySubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t("selectPlayer")} *</label>
                  <select
                    className={INPUT_CLASS}
                    required
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                  >
                    <option value="">{t("selectPlayer")}</option>
                    {players?.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </div>

                {applyError && (
                  <p className="text-sm text-destructive">{applyError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setApplyBuffId(null);
                      setSelectedPlayerId("");
                      setApplyError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={applyMutation.isPending || !selectedPlayerId}
                  >
                    {applyMutation.isPending ? "…" : t("apply")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
