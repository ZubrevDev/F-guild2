"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EquipmentSlots } from "@/components/player/equipment-slots";
import { BackpackGrid } from "@/components/player/backpack-grid";
import { trpc } from "@/lib/trpc";
import { usePlayerSession } from "@/lib/player-session";
import { xpProgress } from "@/lib/leveling";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function parseStats(raw: unknown) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const s = raw as Record<string, unknown>;
    return {
      strength: typeof s.strength === "number" ? s.strength : 10,
      dexterity: typeof s.dexterity === "number" ? s.dexterity : 10,
      intelligence: typeof s.intelligence === "number" ? s.intelligence : 10,
      wisdom: typeof s.wisdom === "number" ? s.wisdom : 10,
      charisma: typeof s.charisma === "number" ? s.charisma : 10,
    };
  }
  return { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, charisma: 10 };
}

const STAT_LABELS: { key: keyof ReturnType<typeof parseStats>; label: string }[] = [
  { key: "strength", label: "STR" },
  { key: "dexterity", label: "DEX" },
  { key: "intelligence", label: "INT" },
  { key: "wisdom", label: "WIS" },
  { key: "charisma", label: "CHA" },
];

const CLASS_INFO: Record<string, { emoji: string; name: string }> = {
  fighter: { emoji: "⚔️", name: "Воин" },
  wizard: { emoji: "🧙", name: "Маг" },
  ranger: { emoji: "🏹", name: "Следопыт" },
  cleric: { emoji: "✝️", name: "Клирик" },
  rogue: { emoji: "🗡️", name: "Плут" },
  bard: { emoji: "🎵", name: "Бард" },
};

type Tab = "equipment" | "abilities" | "buffs";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CharacterPage() {
  const t = useTranslations("characterPage");
  const tEq = useTranslations("equipment");
  const router = useRouter();
  const { session, loading } = usePlayerSession();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("equipment");

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/player-login");
    }
  }, [loading, session, router]);

  const playerId = session?.playerId ?? "";

  const characterQuery = trpc.character.get.useQuery(
    { playerId },
    { enabled: !!playerId }
  );
  const abilitiesQuery = trpc.character.abilities.useQuery(
    { playerId },
    { enabled: !!playerId }
  );
  const classAbilityStatusQuery = trpc.character.classAbilityStatus.useQuery(
    { characterId: characterQuery.data?.id ?? "" },
    { enabled: !!characterQuery.data?.id }
  );
  const equippedQuery = trpc.shop.equippedItems.useQuery(
    { playerId },
    { enabled: !!playerId }
  );
  const inventoryQuery = trpc.shop.playerInventory.useQuery(
    { playerId },
    { enabled: !!playerId }
  );
  const buffsQuery = trpc.buff.activeForPlayer.useQuery(
    { playerId },
    { enabled: !!playerId }
  );

  const learnAbilityMutation = trpc.character.learnAbility.useMutation({
    onSuccess: () => void abilitiesQuery.refetch(),
  });
  const equipMutation = trpc.shop.equip.useMutation({
    onSuccess: () => {
      void equippedQuery.refetch();
      void inventoryQuery.refetch();
    },
  });
  const useItemMutation = trpc.shop.useItem.useMutation({
    onSuccess: () => {
      void inventoryQuery.refetch();
      void characterQuery.refetch();
    },
  });
  const createCharacterMutation = trpc.character.createSelf.useMutation({
    onSuccess: () => void characterQuery.refetch(),
  });

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const character = characterQuery.data;
  const abilityData = abilitiesQuery.data;
  const classStatus = classAbilityStatusQuery.data;
  const inventoryData = inventoryQuery.data;
  const equippedData = equippedQuery.data ?? {};
  const activeBuffs = buffsQuery.data ?? [];
  const stats = character ? parseStats(character.stats) : null;
  const xpInfo = character ? xpProgress(character.level, character.xp) : null;
  const backpackItems = (inventoryData?.items ?? []).filter((inv) => !inv.isEquipped);
  const totalSlots = inventoryData?.totalSlots ?? 20;

  // =========================================================================
  // No character — class picker
  // =========================================================================
  if (!characterQuery.isLoading && !character) {
    return (
      <div className="mx-auto max-w-md space-y-4 pb-8">
        <div className="gradient-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white text-center">Выбери свой класс</h2>
          <p className="text-sm text-muted-foreground text-center">
            Создай персонажа чтобы начать приключение
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(CLASS_INFO)).map(([cls, info]) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                  selectedClass === cls
                    ? "border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/10"
                    : "border-purple-500/20 bg-white/5 hover:border-purple-500/40 hover:bg-white/10"
                )}
              >
                <span className="text-2xl">{info.emoji}</span>
                <span className="text-sm font-medium text-white">{info.name}</span>
              </button>
            ))}
          </div>
          {selectedClass && (
            <Button
              className="w-full gradient-btn-primary"
              disabled={createCharacterMutation.isPending}
              onClick={() =>
                createCharacterMutation.mutate({
                  playerId,
                  class: selectedClass as "fighter" | "wizard" | "ranger" | "cleric" | "rogue" | "bard",
                })
              }
            >
              {createCharacterMutation.isPending ? "..." : "Создать персонажа"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (characterQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="gradient-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Loading character...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Sections (reusable between mobile tabs and desktop columns)
  // =========================================================================

  const headerSection = character && xpInfo && stats && (
    <>
      {/* Character header */}
      <div className="gradient-hero rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-white">{session.playerName}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">{character.class}</Badge>
            <span className="text-sm text-gold font-semibold">Lvl {character.level}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>XP</span>
            <span className="text-xp">
              {xpInfo.isMaxLevel ? "MAX" : `${character.xp} / ${xpInfo.xpToNext}`}
            </span>
          </div>
          <Progress value={xpInfo.xpPercent} className="h-2" />
        </div>
        <div className="flex gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🪙</span>
            <span className="text-sm font-bold text-gold">{character.gold}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">✨</span>
            <span className="text-sm font-bold text-blue-400">{character.faithPoints}</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="gradient-card rounded-lg p-2 flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
            <span className="text-base font-bold text-gold">{stats[key]}</span>
          </div>
        ))}
      </div>
    </>
  );

  const equipmentSection = (
    <>
      {/* Equipment slots */}
      <div className="gradient-card rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">{tEq("title")}</h2>
        {equippedQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <EquipmentSlots
            equipped={equippedData}
            onUnequip={(id) => equipMutation.mutate({ inventoryItemId: id, playerId })}
          />
        )}
      </div>

      {/* Backpack */}
      <div className="gradient-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{tEq("backpack")}</h2>
          {inventoryData && (
            <span className="text-xs text-muted-foreground">
              {tEq("backpackSlots", { used: inventoryData.usedSlots, total: inventoryData.totalSlots })}
            </span>
          )}
        </div>
        {inventoryQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <BackpackGrid
            items={backpackItems.map((inv) => ({
              id: inv.id,
              quantity: inv.quantity,
              item: {
                name: inv.item.name,
                description: inv.item.description,
                category: inv.item.category,
                equipSlot: inv.item.equipSlot,
                effect: inv.item.effect as Record<string, unknown> | null,
                imageUrl: inv.item.imageUrl,
              },
            }))}
            totalSlots={totalSlots}
            onEquip={(id) => equipMutation.mutate({ inventoryItemId: id, playerId })}
            onUse={(id) => useItemMutation.mutate({ inventoryItemId: id, playerId })}
          />
        )}
      </div>
    </>
  );

  const abilitiesSection = (
    <>
      {/* Class ability */}
      <div className="gradient-card rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">{t("classAbility")}</h2>
        {classAbilityStatusQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {classStatus && (
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="font-medium text-sm text-white">{classStatus.ability.displayName}</p>
              <p className="text-xs text-muted-foreground">{classStatus.ability.description}</p>
            </div>
            {classStatus.ability.isPassive ? (
              <Badge variant="secondary">Passive</Badge>
            ) : classStatus.usesRemaining > 0 ? (
              <Badge className="bg-green-500/20 text-green-400 border-0">{t("useAbility")}</Badge>
            ) : (
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{t("abilityUsed")}</Badge>
                <span className="text-xs text-muted-foreground">{t("availableTomorrow")}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ability tree */}
      <div className="gradient-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{t("abilityTree")}</h2>
          {abilityData && (
            <span className="text-xs text-muted-foreground">
              {t("abilityPoints", { count: abilityData.remainingPoints })}
            </span>
          )}
        </div>
        {abilitiesQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {abilityData && abilityData.abilities.length === 0 && (
          <p className="text-sm text-muted-foreground py-1">No abilities available yet.</p>
        )}
        {abilityData && abilityData.abilities.length > 0 && (
          <div className="space-y-2">
            {abilityData.abilities.map((ability) => {
              const isLearned = ability.learned;
              const prereqsMet = ability.prerequisiteIds.every(
                (preId) => abilityData.abilities.find((a) => a.id === preId)?.learned ?? false
              );
              const canLearn = !isLearned && prereqsMet && abilityData.remainingPoints > 0;
              const isLocked = !isLearned && !prereqsMet;

              return (
                <div
                  key={ability.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-md border p-3",
                    isLearned
                      ? "border-green-500/40 bg-green-500/5"
                      : isLocked
                        ? "border-purple-500/20 opacity-50"
                        : "border-blue-500/40 bg-blue-500/5"
                  )}
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium truncate">{ability.name}</p>
                    <p className="text-xs text-muted-foreground">{ability.description}</p>
                    <p className="text-xs text-muted-foreground">{ability.effect.description}</p>
                  </div>
                  <div className="shrink-0">
                    {isLearned && (
                      <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">{t("learned")}</Badge>
                    )}
                    {isLocked && <Badge variant="secondary" className="text-xs">{t("locked")}</Badge>}
                    {canLearn && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={learnAbilityMutation.isPending}
                        onClick={() => learnAbilityMutation.mutate({ playerId, abilityId: ability.id })}
                      >
                        {t("learn")}
                      </Button>
                    )}
                    {!isLearned && !isLocked && !canLearn && (
                      <Badge variant="secondary" className="text-xs">{t("locked")}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const buffsSection = (
    <div className="gradient-card rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">{tEq("buffs")}</h2>
      {buffsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!buffsQuery.isLoading && activeBuffs.length === 0 && (
        <p className="text-sm text-muted-foreground py-1">{tEq("noBuffs")}</p>
      )}
      {activeBuffs.length > 0 && (
        <div className="space-y-2">
          {activeBuffs.map((ab) => {
            const eff = ab.buff.effect as { type: string; value: number };
            return (
              <div key={ab.id} className="flex items-start justify-between gap-3 rounded-md border border-purple-500/20 bg-white/5 p-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{ab.buff.name}</p>
                    <Badge className={cn(
                      "text-xs border-0 shrink-0",
                      ab.buff.type === "buff" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {eff.type} {eff.value > 0 ? `+${eff.value}` : eff.value}
                    </Badge>
                  </div>
                  {ab.buff.description && (
                    <p className="text-xs text-muted-foreground">{ab.buff.description}</p>
                  )}
                </div>
                {ab.remainingSeconds !== null && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t("expiresIn", { time: formatSeconds(ab.remainingSeconds) })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // =========================================================================
  // Tabs (mobile only)
  // =========================================================================
  const tabs: { key: Tab; label: string }[] = [
    { key: "equipment", label: tEq("title") },
    { key: "abilities", label: tEq("abilities") },
    { key: "buffs", label: tEq("buffs") },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8">
      {/* Header + Stats — always visible */}
      {headerSection}

      {/* Mobile: tab bar */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1 md:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 rounded-md py-2 text-xs font-medium transition-all",
              activeTab === tab.key
                ? "bg-purple-500/20 text-white shadow-sm"
                : "text-muted-foreground hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile: tab content */}
      <div className="space-y-4 md:hidden">
        {activeTab === "equipment" && equipmentSection}
        {activeTab === "abilities" && abilitiesSection}
        {activeTab === "buffs" && buffsSection}
      </div>

      {/* Desktop: 2-column layout */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-4">
        <div className="space-y-4">
          {equipmentSection}
        </div>
        <div className="space-y-4">
          {abilitiesSection}
          {buffsSection}
        </div>
      </div>
    </div>
  );
}
