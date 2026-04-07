"use client";

import { useTranslations } from "next-intl";
import { Crown, Shirt, Sword, Shield, Footprints, Gem, Hand } from "lucide-react";
import { getRarityClass } from "@/lib/rarity";

const SLOT_CONFIG = [
  { slot: "head", icon: Crown, gridArea: "head" },
  { slot: "weapon", icon: Sword, gridArea: "weapon" },
  { slot: "body", icon: Shirt, gridArea: "body" },
  { slot: "shield", icon: Shield, gridArea: "shield" },
  { slot: "gloves", icon: Hand, gridArea: "gloves" },
  { slot: "accessory", icon: Gem, gridArea: "accessory" },
  { slot: "boots", icon: Footprints, gridArea: "boots" },
] as const;

interface EquippedItem {
  id: string;
  item: { name: string; description: string; imageUrl: string | null; rarity?: string };
}

interface EquipmentSlotsProps {
  equipped: Record<string, EquippedItem>;
  onUnequip: (inventoryItemId: string) => void;
}

export function EquipmentSlots({ equipped, onUnequip }: EquipmentSlotsProps) {
  const t = useTranslations("equipment");

  return (
    <div
      className="grid gap-2 justify-items-center"
      style={{
        gridTemplateAreas: `
          ". head ."
          "weapon body shield"
          "gloves . accessory"
          ". boots ."
        `,
        gridTemplateColumns: "1fr 1fr 1fr",
      }}
    >
      {SLOT_CONFIG.map(({ slot, icon: Icon, gridArea }) => {
        const item = equipped[slot];
        return (
          <div key={slot} style={{ gridArea }} className="flex flex-col items-center gap-1">
            <button
              onClick={() => item && onUnequip(item.id)}
              disabled={!item}
              title={item ? `${item.item.name}\n${item.item.description}` : t(slot as Parameters<typeof t>[0])}
              className={[
                "flex h-16 w-16 items-center justify-center rounded-lg transition-all",
                item
                  ? "border-2 border-primary/60 bg-primary/10 hover:border-primary hover:bg-primary/20 cursor-pointer shadow-md"
                  : "border-2 border-dashed border-border bg-muted/20 cursor-default",
              ].join(" ")}
            >
              {item ? (
                <span className={`text-xs font-medium text-center px-1 leading-tight line-clamp-2 ${getRarityClass(item.item.rarity ?? "common")}`}>
                  {item.item.name}
                </span>
              ) : (
                <Icon className="h-6 w-6 text-muted-foreground/50" />
              )}
            </button>
            <span className="text-[10px] text-muted-foreground">{t(slot as Parameters<typeof t>[0])}</span>
          </div>
        );
      })}
    </div>
  );
}
