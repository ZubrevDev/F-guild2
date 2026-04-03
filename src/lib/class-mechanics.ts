import type { CharacterClass } from "@prisma/client";
import type { DiceModifier } from "@/lib/dice";

// ==================== TYPES ====================

export type ClassAbilityName =
  | "second_wind"
  | "arcane_focus"
  | "natures_guide"
  | "divine_prayer"
  | "lucky_break"
  | "inspire";

export type ClassAbilityEffect =
  | { type: "reroll"; description: string }
  | { type: "auto_success"; rollOverride: number; description: string }
  | { type: "passive_modifier"; modifier: DiceModifier; description: string }
  | { type: "free_prayer"; description: string }
  | { type: "roll_bonus"; bonus: number; description: string }
  | { type: "inspire_buff"; bonus: number; description: string };

export interface ClassAbility {
  name: ClassAbilityName;
  displayName: string;
  description: string;
  class: CharacterClass;
  isPassive: boolean;
  /** Number of uses per day (0 = passive, no cooldown) */
  usesPerDay: number;
  effect: ClassAbilityEffect;
  /** Contexts where this ability applies (empty = all contexts) */
  contexts: string[];
}

// ==================== OUTDOOR CONTEXTS ====================

const OUTDOOR_CONTEXTS = new Set([
  "survival",
  "perception",
  "ranged",
  "stealth",
  "tracking",
  "foraging",
  "exploration",
  "navigation",
  "hunting",
  "nature",
  "outdoor",
]);

// ==================== ABILITY DEFINITIONS ====================

const CLASS_ABILITIES: ClassAbility[] = [
  {
    name: "second_wind",
    displayName: "Second Wind",
    description: "Once per day, re-roll a failed dice check.",
    class: "fighter",
    isPassive: false,
    usesPerDay: 1,
    effect: { type: "reroll", description: "Re-roll a failed dice check" },
    contexts: [],
  },
  {
    name: "arcane_focus",
    displayName: "Arcane Focus",
    description: "Once per day, guarantee success on next dice roll (auto-20).",
    class: "wizard",
    isPassive: false,
    usesPerDay: 1,
    effect: {
      type: "auto_success",
      rollOverride: 20,
      description: "Guarantee success on next dice roll (auto-20)",
    },
    contexts: [],
  },
  {
    name: "natures_guide",
    displayName: "Nature's Guide",
    description: "Passive +2 to all outdoor-context dice rolls.",
    class: "ranger",
    isPassive: true,
    usesPerDay: 0,
    effect: {
      type: "passive_modifier",
      modifier: { source: "Nature's Guide", type: "class", value: 2 },
      description: "+2 to all outdoor-context dice rolls",
    },
    contexts: [...OUTDOOR_CONTEXTS],
  },
  {
    name: "divine_prayer",
    displayName: "Divine Prayer",
    description: "Once per day, send a prayer that costs 0 faith points.",
    class: "cleric",
    isPassive: false,
    usesPerDay: 1,
    effect: {
      type: "free_prayer",
      description: "Next prayer costs 0 faith points",
    },
    contexts: [],
  },
  {
    name: "lucky_break",
    displayName: "Lucky Break",
    description: "Once per day, add +5 to any dice roll after seeing the result.",
    class: "rogue",
    isPassive: false,
    usesPerDay: 1,
    effect: {
      type: "roll_bonus",
      bonus: 5,
      description: "Add +5 to a dice roll retroactively",
    },
    contexts: [],
  },
  {
    name: "inspire",
    displayName: "Inspire",
    description: "Once per day, give another player +3 to their next roll.",
    class: "bard",
    isPassive: false,
    usesPerDay: 1,
    effect: {
      type: "inspire_buff",
      bonus: 3,
      description: "Grant +3 to another player's next roll",
    },
    contexts: [],
  },
];

// ==================== INSPIRE BUFF HELPERS ====================

/** Key used in the character's activeBuffs JSON to mark an inspire buff. */
export const INSPIRE_BUFF_SOURCE = "Inspire (Bard)";
export const INSPIRE_BONUS = 3;

// ==================== PUBLIC API ====================

/**
 * Get the class ability definition for a given class.
 */
export function getClassAbility(className: CharacterClass): ClassAbility | null {
  return CLASS_ABILITIES.find((a) => a.class === className) ?? null;
}

/**
 * Get the class ability definition by ability name.
 */
export function getClassAbilityByName(abilityName: string): ClassAbility | null {
  return CLASS_ABILITIES.find((a) => a.name === abilityName) ?? null;
}

/**
 * Check whether a character can use an active (non-passive) class ability.
 * Returns { canUse: true } or { canUse: false, reason: string }.
 */
export async function canUseAbility(
  db: DbClient,
  characterId: string,
  abilityName: string,
): Promise<{ canUse: true } | { canUse: false; reason: string }> {
  const ability = getClassAbilityByName(abilityName);
  if (!ability) {
    return { canUse: false, reason: "Unknown ability" };
  }
  if (ability.isPassive) {
    return { canUse: false, reason: "Passive abilities cannot be activated manually" };
  }

  const now = new Date();

  // Count usages that haven't reset yet
  const activeUsages = await db.classAbilityUsage.count({
    where: {
      characterId,
      abilityName,
      resetsAt: { gt: now },
    },
  });

  if (activeUsages >= ability.usesPerDay) {
    return { canUse: false, reason: "Ability already used today" };
  }

  return { canUse: true };
}

/**
 * Mark an active class ability as used. Returns the effect to apply.
 */
export async function useAbility(
  db: DbClient,
  characterId: string,
  abilityName: string,
): Promise<ClassAbilityEffect> {
  const check = await canUseAbility(db, characterId, abilityName);
  if (!check.canUse) {
    throw new Error(check.reason);
  }

  const ability = getClassAbilityByName(abilityName)!;
  const now = new Date();
  const resetsAt = getNextDailyReset(now);

  await db.classAbilityUsage.create({
    data: {
      characterId,
      abilityName,
      usedAt: now,
      resetsAt,
    },
  });

  return ability.effect;
}

/**
 * Get passive modifiers for a character class in a given context.
 * Returns an array of DiceModifier to add to dice rolls.
 */
export function getClassPassives(
  className: CharacterClass,
  context: string,
): DiceModifier[] {
  const modifiers: DiceModifier[] = [];

  for (const ability of CLASS_ABILITIES) {
    if (ability.class !== className) continue;
    if (!ability.isPassive) continue;
    if (ability.effect.type !== "passive_modifier") continue;

    // Check if context matches (empty contexts = all)
    if (ability.contexts.length > 0) {
      const normalizedContext = context.toLowerCase().trim();
      if (!ability.contexts.includes(normalizedContext)) continue;
    }

    modifiers.push(ability.effect.modifier);
  }

  return modifiers;
}

/**
 * Get ability status for a character (for display purposes).
 */
export async function getAbilityStatus(
  db: DbClient,
  characterId: string,
  className: CharacterClass,
): Promise<{
  ability: ClassAbility;
  usesRemaining: number;
  resetsAt: Date | null;
} | null> {
  const ability = getClassAbility(className);
  if (!ability) return null;

  if (ability.isPassive) {
    return { ability, usesRemaining: 0, resetsAt: null };
  }

  const now = new Date();
  const activeUsages = await db.classAbilityUsage.count({
    where: {
      characterId,
      abilityName: ability.name,
      resetsAt: { gt: now },
    },
  });

  const nextReset = getNextDailyReset(now);

  return {
    ability,
    usesRemaining: Math.max(0, ability.usesPerDay - activeUsages),
    resetsAt: activeUsages > 0 ? nextReset : null,
  };
}

/**
 * Delete all expired ability usages (cleanup).
 */
export async function resetDailyCooldowns(db: DbClient): Promise<number> {
  const now = new Date();
  const result = await db.classAbilityUsage.deleteMany({
    where: { resetsAt: { lte: now } },
  });
  return result.count;
}

// ==================== HELPERS ====================

/**
 * Calculate the next daily reset time (midnight UTC).
 */
function getNextDailyReset(from: Date): Date {
  const reset = new Date(from);
  reset.setUTCDate(reset.getUTCDate() + 1);
  reset.setUTCHours(0, 0, 0, 0);
  return reset;
}

/**
 * Check whether a context is considered outdoor.
 */
export function isOutdoorContext(context: string): boolean {
  return OUTDOOR_CONTEXTS.has(context.toLowerCase().trim());
}

// ==================== DB TYPE ====================

type DbClient = import("@prisma/client").PrismaClient;
