export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type ItemRarity = (typeof RARITY_ORDER)[number];

export const RARITY_CONFIG: Record<
  ItemRarity,
  { label: string; color: string; twClass: string }
> = {
  common:    { label: "Common",    color: "#9ca3af", twClass: "text-gray-400" },
  uncommon:  { label: "Uncommon",  color: "#22c55e", twClass: "text-green-500" },
  rare:      { label: "Rare",      color: "#3b82f6", twClass: "text-blue-500" },
  epic:      { label: "Epic",      color: "#a855f7", twClass: "text-purple-400" },
  legendary: { label: "Legendary", color: "#f59e0b", twClass: "text-amber-500" },
};

export function getRarityClass(rarity: string): string {
  return RARITY_CONFIG[rarity as ItemRarity]?.twClass ?? "text-gray-400";
}

export function getRarityLabel(rarity: string): string {
  return RARITY_CONFIG[rarity as ItemRarity]?.label ?? "Common";
}
