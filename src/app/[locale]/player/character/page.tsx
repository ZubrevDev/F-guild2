"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CharacterCard } from "@/components/character/character-card";
import { trpc } from "@/lib/trpc";
import { usePlayerSession } from "@/lib/player-session";

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

function parseStats(raw: unknown): {
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
} {
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CharacterPage() {
  const t = useTranslations("characterPage");
  const tShop = useTranslations("shop");
  const router = useRouter();
  const { session, loading } = usePlayerSession();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/player-login");
    }
  }, [loading, session, router]);

  const playerId = session?.playerId ?? "";

  // Queries
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

  const inventoryQuery = trpc.shop.playerInventory.useQuery(
    { playerId },
    { enabled: !!playerId }
  );

  const buffsQuery = trpc.buff.activeForPlayer.useQuery(
    { playerId },
    { enabled: !!playerId }
  );

  // Mutations
  const learnAbilityMutation = trpc.character.learnAbility.useMutation({
    onSuccess: () => {
      void abilitiesQuery.refetch();
    },
  });

  const equipMutation = trpc.shop.equip.useMutation({
    onSuccess: () => {
      void inventoryQuery.refetch();
    },
  });

  const useItemMutation = trpc.shop.useItem.useMutation({
    onSuccess: () => {
      void inventoryQuery.refetch();
      void characterQuery.refetch();
    },
  });

  // Loading / no session guard
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
  const activeBuffs = buffsQuery.data ?? [];

  // Parse stats from JSON field
  const stats = character ? parseStats(character.stats) : null;

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Character Card                                                   */}
      {/* ------------------------------------------------------------------ */}
      {characterQuery.isLoading && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Loading character...</p>
        </div>
      )}

      {character && stats && (
        <CharacterCard
          playerName={session.playerName}
          character={{
            class: character.class,
            level: character.level,
            xp: character.xp,
            gold: character.gold,
            faithPoints: character.faithPoints,
            strength: stats.strength,
            dexterity: stats.dexterity,
            intelligence: stats.intelligence,
            wisdom: stats.wisdom,
            charisma: stats.charisma,
          }}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Class Ability                                                    */}
      {/* ------------------------------------------------------------------ */}
      {character && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("classAbility")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {classAbilityStatusQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}

            {classStatus && (
              <>
                <div className="space-y-1">
                  <p className="font-medium text-sm">{classStatus.ability.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {classStatus.ability.description}
                  </p>
                </div>

                {classStatus.ability.isPassive ? (
                  <Badge variant="secondary">Passive</Badge>
                ) : (
                  <div className="flex items-center gap-3">
                    {classStatus.usesRemaining > 0 ? (
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                        {t("useAbility")}
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="secondary">{t("abilityUsed")}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {t("availableTomorrow")}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. Ability Tree                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("abilityTree")}</CardTitle>
            {abilityData && (
              <span className="text-xs text-muted-foreground">
                {t("abilityPoints", { count: abilityData.remainingPoints })}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {abilitiesQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {abilityData && abilityData.abilities.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No abilities available yet.
            </p>
          )}

          {abilityData && abilityData.abilities.length > 0 && (
            <div className="space-y-2">
              {abilityData.abilities.map((ability) => {
                const isLearned = ability.learned;
                const prereqsMet = ability.prerequisiteIds.every(
                  (preId) =>
                    abilityData.abilities.find((a) => a.id === preId)?.learned ?? false
                );
                const canLearn =
                  !isLearned && prereqsMet && abilityData.remainingPoints > 0;
                const isLocked = !isLearned && !prereqsMet;

                return (
                  <div
                    key={ability.id}
                    className={[
                      "flex items-start justify-between gap-3 rounded-md border p-3",
                      isLearned
                        ? "border-green-500/40 bg-green-500/5"
                        : isLocked
                          ? "border-border opacity-50"
                          : "border-blue-500/40 bg-blue-500/5",
                    ].join(" ")}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium truncate">{ability.name}</p>
                      <p className="text-xs text-muted-foreground">{ability.description}</p>
                      <p className="text-xs text-muted-foreground">{ability.effect.description}</p>
                    </div>

                    <div className="shrink-0">
                      {isLearned && (
                        <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0 text-xs">
                          {t("learned")}
                        </Badge>
                      )}
                      {isLocked && (
                        <Badge variant="secondary" className="text-xs">
                          {t("locked")}
                        </Badge>
                      )}
                      {canLearn && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={learnAbilityMutation.isPending}
                          onClick={() =>
                            learnAbilityMutation.mutate({
                              playerId,
                              abilityId: ability.id,
                            })
                          }
                        >
                          {t("learn")}
                        </Button>
                      )}
                      {!isLearned && !isLocked && !canLearn && (
                        <Badge variant="secondary" className="text-xs">
                          {t("locked")}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Inventory                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("inventory")}</CardTitle>
            {inventoryData && (
              <span className="text-xs text-muted-foreground">
                {inventoryData.usedSlots}/{inventoryData.totalSlots}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {inventoryQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {inventoryData && inventoryData.items.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">{t("noItems")}</p>
          )}

          {inventoryData && inventoryData.items.length > 0 && (
            <div className="space-y-2">
              {inventoryData.items.map((inv) => {
                const isGameItem = inv.item.category === "game_item";
                const itemEffect = inv.item.effect as Record<string, unknown> | null;
                const isConsumable = itemEffect?.consumable === true;

                return (
                  <div
                    key={inv.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{inv.item.name}</p>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {isGameItem ? "Game" : "Reward"}
                        </Badge>
                        {inv.quantity > 1 && (
                          <span className="text-xs text-muted-foreground">
                            ×{inv.quantity}
                          </span>
                        )}
                        {inv.isEquipped && (
                          <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-0 text-xs shrink-0">
                            Equipped
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{inv.item.description}</p>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      {isGameItem && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={equipMutation.isPending}
                          onClick={() =>
                            equipMutation.mutate({
                              inventoryItemId: inv.id,
                              playerId,
                            })
                          }
                        >
                          {inv.isEquipped ? tShop("unequip") : tShop("equip")}
                        </Button>
                      )}
                      {isConsumable && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={useItemMutation.isPending}
                          onClick={() =>
                            useItemMutation.mutate({
                              inventoryItemId: inv.id,
                              playerId,
                            })
                          }
                        >
                          {tShop("use")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Active Buffs                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("activeBuffs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {buffsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {!buffsQuery.isLoading && activeBuffs.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">{t("noBuffs")}</p>
          )}

          {activeBuffs.length > 0 && (
            <div className="space-y-2">
              {activeBuffs.map((activeBuff) => {
                const buffEffect = activeBuff.buff.effect as {
                  type: string;
                  value: number;
                };

                return (
                  <div
                    key={activeBuff.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{activeBuff.buff.name}</p>
                        <Badge
                          className={[
                            "text-xs border-0 shrink-0",
                            activeBuff.buff.type === "buff"
                              ? "bg-green-500/20 text-green-700 dark:text-green-400"
                              : "bg-red-500/20 text-red-700 dark:text-red-400",
                          ].join(" ")}
                        >
                          {buffEffect.type}{" "}
                          {buffEffect.value > 0 ? `+${buffEffect.value}` : buffEffect.value}
                        </Badge>
                      </div>
                      {activeBuff.buff.description && (
                        <p className="text-xs text-muted-foreground">
                          {activeBuff.buff.description}
                        </p>
                      )}
                    </div>

                    {activeBuff.remainingSeconds !== null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t("expiresIn", {
                          time: formatSeconds(activeBuff.remainingSeconds),
                        })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
