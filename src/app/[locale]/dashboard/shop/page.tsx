"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { RARITY_CONFIG, getRarityClass } from "@/lib/rarity";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ItemCategory = "game_item" | "real_reward";
type ClassRequired =
  | "fighter"
  | "wizard"
  | "ranger"
  | "cleric"
  | "rogue"
  | "bard"
  | "";

interface CreateItemForm {
  name: string;
  description: string;
  category: ItemCategory;
  price: number;
  unlimitedStock: boolean;
  stock: number;
  levelRequired: number;
  classRequired: ClassRequired;
  effectJson: string;
  rarity: string;
}

const DEFAULT_FORM: CreateItemForm = {
  name: "",
  description: "",
  category: "game_item",
  price: 10,
  unlimitedStock: true,
  stock: 1,
  levelRequired: 1,
  classRequired: "",
  effectJson: "",
  rarity: "common",
};

interface EditItemForm {
  name: string;
  description: string;
  category: ItemCategory;
  price: number;
  unlimitedStock: boolean;
  stock: number;
  levelRequired: number;
  classRequired: ClassRequired;
  effectJson: string;
  rarity: string;
}

export default function ShopPage() {
  const t = useTranslations("shop");
  const { data: session } = useSession();
  const guildId = (session?.user as { guildId?: string } | undefined)?.guildId;

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateItemForm>(DEFAULT_FORM);
  const [createError, setCreateError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditItemForm>(DEFAULT_FORM);
  const [editError, setEditError] = useState("");

  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.shop.listItems.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const createMutation = trpc.shop.createItem.useMutation({
    onSuccess: () => {
      utils.shop.listItems.invalidate({ guildId: guildId! });
      setCreateOpen(false);
      setForm(DEFAULT_FORM);
      setCreateError("");
    },
    onError: (err) => setCreateError(err.message),
  });

  const updateMutation = trpc.shop.updateItem.useMutation({
    onSuccess: () => {
      utils.shop.listItems.invalidate({ guildId: guildId! });
      setEditOpen(false);
      setEditItemId(null);
      setEditError("");
    },
    onError: (err) => setEditError(err.message),
  });

  const deactivateMutation = trpc.shop.deactivateItem.useMutation({
    onSuccess: () => {
      utils.shop.listItems.invalidate({ guildId: guildId! });
    },
  });

  function parseEffect(json: string): Record<string, unknown> | null {
    if (!json.trim()) return null;
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    if (!form.effectJson.trim() || parseEffect(form.effectJson) !== null || form.effectJson.trim() === "") {
      // valid or empty
    } else {
      setCreateError("Effect JSON is invalid");
      return;
    }
    createMutation.mutate({
      guildId,
      name: form.name,
      description: form.description,
      category: form.category,
      price: form.price,
      stock: form.unlimitedStock ? null : form.stock,
      levelRequired: form.levelRequired,
      classRequired: form.classRequired || null,
      effect: form.effectJson.trim() ? parseEffect(form.effectJson) : null,
      rarity: form.rarity as "common" | "uncommon" | "rare" | "epic" | "legendary",
    });
  }

  function openEdit(item: {
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    stock: number | null;
    levelRequired: number;
    classRequired: string | null;
    effect: unknown;
    rarity?: string;
  }) {
    setEditItemId(item.id);
    setEditForm({
      name: item.name,
      description: item.description,
      category: item.category as ItemCategory,
      price: item.price,
      unlimitedStock: item.stock === null,
      stock: item.stock ?? 1,
      levelRequired: item.levelRequired,
      classRequired: (item.classRequired ?? "") as ClassRequired,
      effectJson: item.effect ? JSON.stringify(item.effect, null, 2) : "",
      rarity: (item as { rarity?: string }).rarity ?? "common",
    });
    setEditError("");
    setEditOpen(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItemId) return;
    if (editForm.effectJson.trim() && parseEffect(editForm.effectJson) === null) {
      setEditError("Effect JSON is invalid");
      return;
    }
    updateMutation.mutate({
      itemId: editItemId,
      name: editForm.name,
      description: editForm.description,
      category: editForm.category,
      price: editForm.price,
      stock: editForm.unlimitedStock ? null : editForm.stock,
      levelRequired: editForm.levelRequired,
      classRequired: editForm.classRequired || null,
      effect: editForm.effectJson.trim() ? parseEffect(editForm.effectJson) : null,
      rarity: editForm.rarity as "common" | "uncommon" | "rare" | "epic" | "legendary",
    });
  }

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
        <Button onClick={() => setCreateOpen(true)}>{t("createItem")}</Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!items || items.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 text-6xl" aria-hidden="true">
            🛒
          </div>
          <h2 className="mb-2 text-xl font-semibold">{t("noItems")}</h2>
          <p className="mb-6 text-sm text-muted-foreground">{t("noItemsDesc")}</p>
          <Button onClick={() => setCreateOpen(true)}>{t("createItem")}</Button>
        </div>
      )}

      {/* Items grid */}
      {!isLoading && items && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className={!item.isActive ? "opacity-50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className={`text-base leading-snug ${getRarityClass((item as { rarity?: string }).rarity ?? "common")}`}>
                  {item.name}
                </CardTitle>
                  <Badge
                    className={
                      item.category === "game_item"
                        ? "shrink-0 bg-blue-500 text-white hover:bg-blue-500"
                        : "shrink-0 bg-amber-500 text-white hover:bg-amber-500"
                    }
                  >
                    {item.category === "game_item" ? t("gameItem") : t("realReward")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {item.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                )}

                <div className="text-sm font-medium">🪙 {item.price} {t("price").replace(" (Gold)", "")}</div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t("stock")}:{" "}
                    {item.stock === null ? t("unlimited") : item.stock}
                  </span>
                  {item.levelRequired > 1 && (
                    <span>
                      {t("levelRequired")}: {item.levelRequired}
                    </span>
                  )}
                  {item.classRequired && (
                    <span>
                      {t("classRequired")}: {item.classRequired}
                    </span>
                  )}
                </div>

                {!item.isActive && (
                  <p className="text-xs text-destructive">Inactive</p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs min-h-[44px]"
                    onClick={() => openEdit(item)}
                  >
                    {t("edit")}
                  </Button>
                  {item.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs min-h-[44px] text-destructive hover:text-destructive"
                      disabled={deactivateMutation.isPending}
                      onClick={() => deactivateMutation.mutate({ itemId: item.id })}
                    >
                      {t("deactivate")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Item modal */}
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
          <div className="my-8 w-full max-w-lg rounded-lg border border-purple-500/30 bg-[#1e1240] p-6 shadow-2xl shadow-purple-900/30">
            <h2 className="mb-4 text-lg font-semibold">{t("createItem")}</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <ItemFormFields form={form} setForm={setForm} t={t} />

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
                  {createMutation.isPending ? "…" : t("createItem")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditOpen(false);
              setEditError("");
            }
          }}
        >
          <div className="my-8 w-full max-w-lg rounded-lg border border-purple-500/30 bg-[#1e1240] p-6 shadow-2xl shadow-purple-900/30">
            <h2 className="mb-4 text-lg font-semibold">{t("edit")}</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <ItemFormFields form={editForm} setForm={setEditForm} t={t} />

              {editError && (
                <p className="text-sm text-destructive">{editError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditOpen(false);
                    setEditError("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "…" : t("edit")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface ItemFormFieldsProps {
  form: CreateItemForm;
  setForm: React.Dispatch<React.SetStateAction<CreateItemForm>>;
  t: (key: string) => string;
}

const INPUT_CLASS_FORM =
  "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function ItemFormFields({ form, setForm, t }: ItemFormFieldsProps) {
  return (
    <>
      {/* Name */}
      <div>
        <label className="text-sm font-medium">{t("itemName")} *</label>
        <input
          type="text"
          required
          minLength={1}
          maxLength={200}
          className={INPUT_CLASS_FORM}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium">{t("itemDescription")} *</label>
        <textarea
          rows={3}
          required
          minLength={1}
          maxLength={2000}
          className={INPUT_CLASS_FORM + " resize-none"}
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-sm font-medium">{t("category")}</label>
        <select
          className={INPUT_CLASS_FORM}
          value={form.category}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, category: e.target.value as ItemCategory }))
          }
        >
          <option value="game_item">{t("gameItem")}</option>
          <option value="real_reward">{t("realReward")}</option>
        </select>
      </div>

      {/* Rarity */}
      <div>
        <label className="text-sm font-medium">{t("rarity")}</label>
        <select
          className={INPUT_CLASS_FORM}
          value={form.rarity}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, rarity: e.target.value }))
          }
        >
          {Object.entries(RARITY_CONFIG).map(([key, config]) => (
            <option key={key} value={key} style={{ color: config.color }}>
              {t(key as "common" | "uncommon" | "rare" | "epic" | "legendary")}
            </option>
          ))}
        </select>
      </div>

      {/* Price */}
      <div>
        <label className="text-sm font-medium">{t("price")}</label>
        <input
          type="number"
          min={0}
          required
          className={INPUT_CLASS_FORM}
          value={form.price}
          onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
        />
      </div>

      {/* Stock */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.unlimitedStock}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, unlimitedStock: e.target.checked }))
            }
            className="h-4 w-4"
          />
          {t("unlimited")}
        </label>
        {!form.unlimitedStock && (
          <div className="mt-2">
            <label className="text-sm font-medium">{t("stock")}</label>
            <input
              type="number"
              min={0}
              required
              className={INPUT_CLASS_FORM}
              value={form.stock}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))
              }
            />
          </div>
        )}
      </div>

      {/* Level Required */}
      <div>
        <label className="text-sm font-medium">{t("levelRequired")}</label>
        <input
          type="number"
          min={1}
          className={INPUT_CLASS_FORM}
          value={form.levelRequired}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, levelRequired: Number(e.target.value) }))
          }
        />
      </div>

      {/* Class Required */}
      <div>
        <label className="text-sm font-medium">{t("classRequired")}</label>
        <select
          className={INPUT_CLASS_FORM}
          value={form.classRequired}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, classRequired: e.target.value as ClassRequired }))
          }
        >
          <option value="">{t("anyClass")}</option>
          <option value="fighter">Fighter</option>
          <option value="wizard">Wizard</option>
          <option value="ranger">Ranger</option>
          <option value="cleric">Cleric</option>
          <option value="rogue">Rogue</option>
          <option value="bard">Bard</option>
        </select>
      </div>

      {/* Effect (JSON) */}
      <div>
        <label className="text-sm font-medium">{t("effect")} (JSON)</label>
        <textarea
          rows={3}
          className={INPUT_CLASS_FORM + " resize-none font-mono text-xs"}
          placeholder={'{"consumable": true, "xp_bonus": 50}'}
          value={form.effectJson}
          onChange={(e) => setForm((prev) => ({ ...prev, effectJson: e.target.value }))}
        />
      </div>
    </>
  );
}
