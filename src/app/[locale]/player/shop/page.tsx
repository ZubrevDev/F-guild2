"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { usePlayerSession } from "@/lib/player-session";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayerShopPage() {
  const t = useTranslations("shop");
  const router = useRouter();
  const { session, loading } = usePlayerSession();

  const [activeTab, setActiveTab] = useState<"shop" | "inventory">("shop");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

  const shopQuery = trpc.shop.playerItems.useQuery(
    { playerId, guildId },
    { enabled: !!playerId && !!guildId }
  );

  const inventoryQuery = trpc.shop.playerInventory.useQuery(
    { playerId },
    { enabled: !!playerId }
  );

  const purchaseMutation = trpc.shop.purchase.useMutation({
    onSuccess: () => {
      characterQuery.refetch();
      shopQuery.refetch();
      inventoryQuery.refetch();
      showSuccess(t("purchased"));
    },
    onError: (err) => showError(err.message),
  });

  const equipMutation = trpc.shop.equip.useMutation({
    onSuccess: (data) => {
      inventoryQuery.refetch();
      showSuccess(data.isEquipped ? t("equipped") : t("unequip"));
    },
    onError: (err) => showError(err.message),
  });

  const useItemMutation = trpc.shop.useItem.useMutation({
    onSuccess: () => {
      characterQuery.refetch();
      inventoryQuery.refetch();
      showSuccess(t("used"));
    },
    onError: (err) => showError(err.message),
  });

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setErrorMessage("");
    setTimeout(() => setSuccessMessage(""), 3000);
  }

  function showError(msg: string) {
    setErrorMessage(msg);
    setSuccessMessage("");
    setTimeout(() => setErrorMessage(""), 4000);
  }

  const character = characterQuery.data;
  const gold = character?.gold ?? 0;

  if (loading || (!session && !loading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const shopItems = shopQuery.data ?? [];
  const inventoryData = inventoryQuery.data;
  const inventoryItems = inventoryData?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Gold balance */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="rounded-full bg-gold/20 px-4 py-1.5 text-sm font-semibold text-gold">
          🪙 {gold} {t("yourGold")}
        </div>
      </div>

      {/* Toast messages */}
      {successMessage && (
        <div className="rounded-md border border-xp/30 bg-xp/10 px-4 py-2 text-sm text-xp">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("shop")}
          className={[
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "shop"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {t("title")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={[
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "inventory"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {t("inventory")}
          {inventoryItems.length > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {inventoryItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Shop tab */}
      {activeTab === "shop" && (
        <div className="space-y-4">
          {shopQuery.isLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {!shopQuery.isLoading && shopItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-6xl" aria-hidden="true">
                🛒
              </div>
              <h2 className="mb-2 text-xl font-semibold">{t("noItems")}</h2>
              <p className="text-sm text-muted-foreground">{t("noItemsDesc")}</p>
            </div>
          )}

          {!shopQuery.isLoading && shopItems.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shopItems.map((item) => {
                const canAfford = gold >= item.price;
                const outOfStock = item.stock !== null && item.stock <= 0;

                return (
                  <Card key={item.id} className="gradient-card border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{item.name}</CardTitle>
                        <div className="flex shrink-0 flex-wrap gap-1">
                          <Badge
                            className={
                              item.category === "game_item"
                                ? "bg-mana-blue/80 text-white hover:bg-mana-blue/80"
                                : "bg-gold/80 text-white hover:bg-gold/80"
                            }
                          >
                            {item.category === "game_item" ? t("gameItem") : t("realReward")}
                          </Badge>
                          {item.equipSlot && (
                            <Badge variant="outline" className="text-[10px]">
                              {item.equipSlot}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {item.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">🪙 {item.price}</span>
                        {item.stock !== null && (
                          <span className="text-xs text-muted-foreground">
                            {t("stock")}: {item.stock}
                          </span>
                        )}
                      </div>

                      <Button
                        size="sm"
                        className="w-full text-xs bg-primary hover:bg-primary/90 text-white"
                        disabled={
                          !canAfford ||
                          outOfStock ||
                          purchaseMutation.isPending
                        }
                        onClick={() =>
                          purchaseMutation.mutate({ playerId, itemId: item.id })
                        }
                      >
                        {outOfStock
                          ? "Out of stock"
                          : !canAfford
                          ? t("notEnoughGold")
                          : t("buy")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inventory tab */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          {inventoryQuery.isLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {!inventoryQuery.isLoading && inventoryItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-6xl" aria-hidden="true">
                🎒
              </div>
              <h2 className="mb-2 text-xl font-semibold">{t("noInventory")}</h2>
            </div>
          )}

          {!inventoryQuery.isLoading && inventoryItems.length > 0 && (
            <>
              {inventoryData && (
                <p className="text-xs text-muted-foreground">
                  {inventoryData.usedSlots} / {inventoryData.totalSlots} slots used
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inventoryItems.map((inv) => {
                  const isGameItem = inv.item.category === "game_item";
                  const effect = inv.item.effect as Record<string, unknown> | null;
                  const isConsumable = effect?.consumable === true;

                  return (
                    <Card key={inv.id} className={`gradient-card ${inv.isEquipped ? "border-primary/60" : "border-border"}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-snug">
                            {inv.item.name}
                            {inv.quantity > 1 && (
                              <span className="ml-1 text-sm font-normal text-muted-foreground">
                                x{inv.quantity}
                              </span>
                            )}
                          </CardTitle>
                          <Badge
                            className={
                              isGameItem
                                ? "shrink-0 bg-mana-blue/80 text-white hover:bg-mana-blue/80"
                                : "shrink-0 bg-gold/80 text-white hover:bg-gold/80"
                            }
                          >
                            {isGameItem ? t("gameItem") : t("realReward")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        {inv.item.description && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {inv.item.description}
                          </p>
                        )}

                        {inv.isEquipped && (
                          <p className="text-xs font-medium text-primary">
                            {t("equipped")}
                          </p>
                        )}

                        <div className="flex gap-2 pt-1">
                          {isGameItem && (
                            <Button
                              variant={inv.isEquipped ? "default" : "outline"}
                              size="sm"
                              className="flex-1 text-xs"
                              disabled={equipMutation.isPending}
                              onClick={() =>
                                equipMutation.mutate({
                                  inventoryItemId: inv.id,
                                  playerId,
                                })
                              }
                            >
                              {inv.isEquipped ? t("unequip") : t("equip")}
                            </Button>
                          )}
                          {isConsumable && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs"
                              disabled={useItemMutation.isPending}
                              onClick={() =>
                                useItemMutation.mutate({
                                  inventoryItemId: inv.id,
                                  playerId,
                                })
                              }
                            >
                              {t("use")}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
