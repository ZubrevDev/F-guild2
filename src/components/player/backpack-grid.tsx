"use client";

import { useTranslations } from "next-intl";
import { Package } from "lucide-react";
import { getRarityClass } from "@/lib/rarity";

interface BackpackItem {
  id: string;
  quantity: number;
  item: {
    name: string;
    description: string;
    category: string;
    equipSlot: string | null;
    effect: Record<string, unknown> | null;
    imageUrl: string | null;
    rarity?: string;
  };
}

interface BackpackGridProps {
  items: BackpackItem[];
  totalSlots: number;
  onEquip: (inventoryItemId: string) => void;
  onUse: (inventoryItemId: string) => void;
}

export function BackpackGrid({ items, totalSlots, onEquip, onUse }: BackpackGridProps) {
  const t = useTranslations("equipment");

  // Create array with empty slots to fill grid
  const emptyCount = Math.max(0, totalSlots - items.length);

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {items.map((inv) => {
        const isConsumable = inv.item.effect?.consumable === true;
        const canEquip = inv.item.equipSlot !== null;

        return (
          <button
            key={inv.id}
            onClick={() => {
              if (canEquip) onEquip(inv.id);
              else if (isConsumable) onUse(inv.id);
            }}
            title={`${inv.item.name}\n${inv.item.description}${canEquip ? `\n→ ${t("equip")}` : ""}${isConsumable ? `\n→ ${t("use")}` : ""}`}
            className="relative flex h-16 w-full flex-col items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/5 p-1 transition-all hover:border-purple-400 hover:bg-purple-500/15 cursor-pointer"
          >
            <Package className="h-5 w-5 text-purple-400/70 mb-0.5" />
            <span className={`text-[9px] text-center leading-tight line-clamp-2 px-0.5 ${getRarityClass(inv.item.rarity ?? "common")}`}>
              {inv.item.name}
            </span>
            {inv.quantity > 1 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[9px] font-bold text-white">
                {inv.quantity}
              </span>
            )}
            {canEquip && (
              <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] text-white">
                E
              </span>
            )}
          </button>
        );
      })}
      {/* Empty slots */}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="flex h-16 w-full items-center justify-center rounded-lg border border-dashed border-purple-500/15 bg-white/[0.02]"
        >
          <span className="text-[10px] text-muted-foreground/30">{i + items.length + 1}</span>
        </div>
      ))}
    </div>
  );
}
