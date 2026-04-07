export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type ItemRarity = (typeof RARITY_ORDER)[number];

export const RARITY_CONFIG: Record<
  ItemRarity,
  { label: string; color: string; twClass: string }
> = {
  common:    { label: "Common",    color: "#9ca3af", twClass: "text-rarity-common" },
  uncommon:  { label: "Uncommon",  color: "#22c55e", twClass: "text-rarity-uncommon" },
  rare:      { label: "Rare",      color: "#3b82f6", twClass: "text-rarity-rare" },
  epic:      { label: "Epic",      color: "#a855f7", twClass: "text-rarity-epic" },
  legendary: { label: "Legendary", color: "#f59e0b", twClass: "text-rarity-legendary" },
};

export function getRarityClass(rarity: string): string {
  return RARITY_CONFIG[rarity as ItemRarity]?.twClass ?? "text-muted-foreground";
}

export function getRarityLabel(rarity: string): string {
  return RARITY_CONFIG[rarity as ItemRarity]?.label ?? "Common";
}
