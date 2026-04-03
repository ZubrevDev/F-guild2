/**
 * Calculate aggregate modifiers from a list of active buffs.
 *
 * Each buff has an `effect` JSON with `{ type, value }`.
 * Bonuses and penalties stack additively:
 *   finalXp = baseXp * (1 + totalXpMod / 100)
 */

interface BuffEffect {
  type: string;
  value: number;
  description?: string;
}

interface ActiveBuffWithEffect {
  buff: {
    effect: unknown;
  };
}

export interface BuffModifiers {
  xpModifier: number;
  goldModifier: number;
  diceModifier: number;
  shopDiscount: number;
}

/**
 * Calculates cumulative modifier percentages from active buffs.
 *
 * @param activeBuffs - Array of active buff records including their buff template
 * @returns Aggregated modifier percentages (can be negative)
 */
export function calculateBuffModifiers(
  activeBuffs: ActiveBuffWithEffect[]
): BuffModifiers {
  const modifiers: BuffModifiers = {
    xpModifier: 0,
    goldModifier: 0,
    diceModifier: 0,
    shopDiscount: 0,
  };

  for (const ab of activeBuffs) {
    const effect = ab.buff.effect as BuffEffect;
    if (!effect || typeof effect.value !== "number") continue;

    switch (effect.type) {
      case "xp_bonus":
        modifiers.xpModifier += effect.value;
        break;
      case "xp_penalty":
        modifiers.xpModifier -= effect.value;
        break;
      case "gold_bonus":
        modifiers.goldModifier += effect.value;
        break;
      case "gold_penalty":
        modifiers.goldModifier -= effect.value;
        break;
      case "dice_bonus":
        modifiers.diceModifier += effect.value;
        break;
      case "dice_penalty":
        modifiers.diceModifier -= effect.value;
        break;
      case "shop_discount":
        modifiers.shopDiscount += effect.value;
        break;
      case "shop_markup":
        modifiers.shopDiscount -= effect.value;
        break;
    }
  }

  return modifiers;
}

/**
 * Apply an XP modifier percentage to a base value.
 * Result is floored and never goes below 0.
 */
export function applyModifier(base: number, modifierPercent: number): number {
  return Math.max(0, Math.floor(base * (1 + modifierPercent / 100)));
}
