import type { CharacterClass } from "@prisma/client";

// ==================== TYPES ====================

export type AbilityEffectType =
  | "dice_modifier"
  | "xp_bonus"
  | "gold_bonus"
  | "special_action";

export interface AbilityEffect {
  type: AbilityEffectType;
  value: number;
  description: string;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  branch: 1 | 2 | 3;
  tier: 1 | 2 | 3;
  prerequisiteIds: string[];
  effect: AbilityEffect;
}

export type AbilityTree = Ability[];

// ==================== ABILITY TREES ====================

const fighterAbilities: AbilityTree = [
  // Branch 1: Might
  {
    id: "fighter_might_1",
    name: "Power Strike",
    description: "Raw strength enhances your combat rolls.",
    branch: 1,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "dice_modifier", value: 1, description: "+1 to combat dice rolls" },
  },
  {
    id: "fighter_might_2",
    name: "Crushing Blow",
    description: "Devastating attacks yield greater rewards.",
    branch: 1,
    tier: 2,
    prerequisiteIds: ["fighter_might_1"],
    effect: { type: "gold_bonus", value: 10, description: "+10% gold from quests" },
  },
  {
    id: "fighter_might_3",
    name: "Unstoppable Force",
    description: "Your might knows no bounds.",
    branch: 1,
    tier: 3,
    prerequisiteIds: ["fighter_might_2"],
    effect: { type: "dice_modifier", value: 3, description: "+3 to combat dice rolls" },
  },
  // Branch 2: Defense
  {
    id: "fighter_defense_1",
    name: "Shield Wall",
    description: "Defensive training sharpens your discipline.",
    branch: 2,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "xp_bonus", value: 5, description: "+5% XP from quests" },
  },
  {
    id: "fighter_defense_2",
    name: "Iron Skin",
    description: "Your resilience inspires others to reward you.",
    branch: 2,
    tier: 2,
    prerequisiteIds: ["fighter_defense_1"],
    effect: { type: "gold_bonus", value: 15, description: "+15% gold from quests" },
  },
  {
    id: "fighter_defense_3",
    name: "Immovable Object",
    description: "Nothing can break your will.",
    branch: 2,
    tier: 3,
    prerequisiteIds: ["fighter_defense_2"],
    effect: { type: "special_action", value: 1, description: "Auto-succeed one quest per week" },
  },
  // Branch 3: Valor
  {
    id: "fighter_valor_1",
    name: "Battle Cry",
    description: "Your courage inspires faster growth.",
    branch: 3,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "xp_bonus", value: 10, description: "+10% XP from quests" },
  },
  {
    id: "fighter_valor_2",
    name: "Veteran's Instinct",
    description: "Experience sharpens your reflexes.",
    branch: 3,
    tier: 2,
    prerequisiteIds: ["fighter_valor_1"],
    effect: { type: "dice_modifier", value: 2, description: "+2 to dice rolls" },
  },
  {
    id: "fighter_valor_3",
    name: "Legendary Champion",
    description: "Your legend precedes you everywhere.",
    branch: 3,
    tier: 3,
    prerequisiteIds: ["fighter_valor_2"],
    effect: { type: "xp_bonus", value: 20, description: "+20% XP from quests" },
  },
];

const wizardAbilities: AbilityTree = [
  // Branch 1: Arcane
  {
    id: "wizard_arcane_1",
    name: "Arcane Insight",
    description: "Magical knowledge accelerates learning.",
    branch: 1,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "xp_bonus", value: 10, description: "+10% XP from quests" },
  },
  {
    id: "wizard_arcane_2",
    name: "Mana Surge",
    description: "Magical overflow enhances your rolls.",
    branch: 1,
    tier: 2,
    prerequisiteIds: ["wizard_arcane_1"],
    effect: { type: "dice_modifier", value: 2, description: "+2 to dice rolls" },
  },
  {
    id: "wizard_arcane_3",
    name: "Archmage's Will",
    description: "Supreme arcane mastery.",
    branch: 1,
    tier: 3,
    prerequisiteIds: ["wizard_arcane_2"],
    effect: { type: "xp_bonus", value: 25, description: "+25% XP from quests" },
  },
  // Branch 2: Elemental
  {
    id: "wizard_elemental_1",
    name: "Flame Bolt",
    description: "Elemental power boosts your attacks.",
    branch: 2,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "dice_modifier", value: 1, description: "+1 to dice rolls" },
  },
  {
    id: "wizard_elemental_2",
    name: "Storm Shield",
    description: "Elemental mastery yields material gains.",
    branch: 2,
    tier: 2,
    prerequisiteIds: ["wizard_elemental_1"],
    effect: { type: "gold_bonus", value: 15, description: "+15% gold from quests" },
  },
  {
    id: "wizard_elemental_3",
    name: "Cataclysm",
    description: "Unleash elemental devastation.",
    branch: 2,
    tier: 3,
    prerequisiteIds: ["wizard_elemental_2"],
    effect: { type: "dice_modifier", value: 3, description: "+3 to dice rolls" },
  },
  // Branch 3: Enchantment
  {
    id: "wizard_enchant_1",
    name: "Minor Enchantment",
    description: "Enchant items for better prices.",
    branch: 3,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "gold_bonus", value: 10, description: "+10% gold from quests" },
  },
  {
    id: "wizard_enchant_2",
    name: "Spellweaving",
    description: "Weave multiple enchantments for XP.",
    branch: 3,
    tier: 2,
    prerequisiteIds: ["wizard_enchant_1"],
    effect: { type: "xp_bonus", value: 15, description: "+15% XP from quests" },
  },
  {
    id: "wizard_enchant_3",
    name: "Reality Warp",
    description: "Bend reality to your will.",
    branch: 3,
    tier: 3,
    prerequisiteIds: ["wizard_enchant_2"],
    effect: { type: "special_action", value: 1, description: "Re-roll one failed quest per week" },
  },
];

const rangerAbilities: AbilityTree = [
  // Branch 1: Marksmanship
  {
    id: "ranger_marks_1",
    name: "Keen Eye",
    description: "Precision aiming improves your rolls.",
    branch: 1,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "dice_modifier", value: 1, description: "+1 to dice rolls" },
  },
  {
    id: "ranger_marks_2",
    name: "Sniper's Focus",
    description: "Deadly precision under pressure.",
    branch: 1,
    tier: 2,
    prerequisiteIds: ["ranger_marks_1"],
    effect: { type: "dice_modifier", value: 2, description: "+2 to dice rolls" },
  },
  {
    id: "ranger_marks_3",
    name: "Perfect Shot",
    description: "One shot, one kill.",
    branch: 1,
    tier: 3,
    prerequisiteIds: ["ranger_marks_2"],
    effect: { type: "special_action", value: 1, description: "Auto-succeed one quest per week" },
  },
  // Branch 2: Survival
  {
    id: "ranger_survival_1",
    name: "Forager",
    description: "Find extra resources on every journey.",
    branch: 2,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "gold_bonus", value: 10, description: "+10% gold from quests" },
  },
  {
    id: "ranger_survival_2",
    name: "Trailblazer",
    description: "Navigate shortcuts to finish faster.",
    branch: 2,
    tier: 2,
    prerequisiteIds: ["ranger_survival_1"],
    effect: { type: "xp_bonus", value: 15, description: "+15% XP from quests" },
  },
  {
    id: "ranger_survival_3",
    name: "Master Tracker",
    description: "Nothing escapes your notice.",
    branch: 2,
    tier: 3,
    prerequisiteIds: ["ranger_survival_2"],
    effect: { type: "gold_bonus", value: 25, description: "+25% gold from quests" },
  },
  // Branch 3: Beast Bond
  {
    id: "ranger_beast_1",
    name: "Animal Companion",
    description: "A loyal companion aids your quests.",
    branch: 3,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "xp_bonus", value: 10, description: "+10% XP from quests" },
  },
  {
    id: "ranger_beast_2",
    name: "Pack Tactics",
    description: "Fight alongside your beast.",
    branch: 3,
    tier: 2,
    prerequisiteIds: ["ranger_beast_1"],
    effect: { type: "dice_modifier", value: 2, description: "+2 to dice rolls" },
  },
  {
    id: "ranger_beast_3",
    name: "Alpha Bond",
    description: "Unbreakable bond with your companion.",
    branch: 3,
    tier: 3,
    prerequisiteIds: ["ranger_beast_2"],
    effect: { type: "xp_bonus", value: 20, description: "+20% XP from quests" },
  },
];

const clericAbilities: AbilityTree = [
  // Branch 1: Healing
  {
    id: "cleric_heal_1",
    name: "Blessing",
    description: "Divine favor accelerates growth.",
    branch: 1,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "xp_bonus", value: 10, description: "+10% XP from quests" },
  },
  {
    id: "cleric_heal_2",
    name: "Restoration",
    description: "Healing arts bring prosperity.",
    branch: 1,
    tier: 2,
    prerequisiteIds: ["cleric_heal_1"],
    effect: { type: "gold_bonus", value: 15, description: "+15% gold from quests" },
  },
  {
    id: "cleric_heal_3",
    name: "Miracle",
    description: "Channel divine miracles.",
    branch: 1,
    tier: 3,
    prerequisiteIds: ["cleric_heal_2"],
    effect: { type: "special_action", value: 1, description: "Revive one failed quest per week" },
  },
  // Branch 2: Smite
  {
    id: "cleric_smite_1",
    name: "Holy Strike",
    description: "Righteous fury empowers your attacks.",
    branch: 2,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "dice_modifier", value: 1, description: "+1 to dice rolls" },
  },
  {
    id: "cleric_smite_2",
    name: "Divine Wrath",
    description: "Smite the unworthy with greater force.",
    branch: 2,
    tier: 2,
    prerequisiteIds: ["cleric_smite_1"],
    effect: { type: "dice_modifier", value: 2, description: "+2 to dice rolls" },
  },
  {
    id: "cleric_smite_3",
    name: "Judgment",
    description: "Pass final judgment on your foes.",
    branch: 2,
    tier: 3,
    prerequisiteIds: ["cleric_smite_2"],
    effect: { type: "dice_modifier", value: 3, description: "+3 to dice rolls" },
  },
  // Branch 3: Protection
  {
    id: "cleric_protect_1",
    name: "Sacred Shield",
    description: "Divine protection guides your path.",
    branch: 3,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "xp_bonus", value: 5, description: "+5% XP from quests" },
  },
  {
    id: "cleric_protect_2",
    name: "Ward of Faith",
    description: "Faith shields you and enriches you.",
    branch: 3,
    tier: 2,
    prerequisiteIds: ["cleric_protect_1"],
    effect: { type: "gold_bonus", value: 20, description: "+20% gold from quests" },
  },
  {
    id: "cleric_protect_3",
    name: "Divine Aegis",
    description: "An impenetrable holy barrier.",
    branch: 3,
    tier: 3,
    prerequisiteIds: ["cleric_protect_2"],
    effect: { type: "xp_bonus", value: 25, description: "+25% XP from quests" },
  },
];

const rogueAbilities: AbilityTree = [
  // Branch 1: Stealth
  {
    id: "rogue_stealth_1",
    name: "Shadow Step",
    description: "Move unseen for bonus rewards.",
    branch: 1,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "gold_bonus", value: 10, description: "+10% gold from quests" },
  },
  {
    id: "rogue_stealth_2",
    name: "Vanish",
    description: "Disappear to avoid failure.",
    branch: 1,
    tier: 2,
    prerequisiteIds: ["rogue_stealth_1"],
    effect: { type: "dice_modifier", value: 2, description: "+2 to dice rolls" },
  },
  {
    id: "rogue_stealth_3",
    name: "Phantom",
    description: "Exist between shadows.",
    branch: 1,
    tier: 3,
    prerequisiteIds: ["rogue_stealth_2"],
    effect: { type: "special_action", value: 1, description: "Avoid one quest failure per week" },
  },
  // Branch 2: Cunning
  {
    id: "rogue_cunning_1",
    name: "Quick Wits",
    description: "Think fast, earn fast.",
    branch: 2,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "xp_bonus", value: 10, description: "+10% XP from quests" },
  },
  {
    id: "rogue_cunning_2",
    name: "Exploit Weakness",
    description: "Find and exploit every vulnerability.",
    branch: 2,
    tier: 2,
    prerequisiteIds: ["rogue_cunning_1"],
    effect: { type: "dice_modifier", value: 2, description: "+2 to dice rolls" },
  },
  {
    id: "rogue_cunning_3",
    name: "Mastermind",
    description: "Always three steps ahead.",
    branch: 2,
    tier: 3,
    prerequisiteIds: ["rogue_cunning_2"],
    effect: { type: "xp_bonus", value: 25, description: "+25% XP from quests" },
  },
  // Branch 3: Thievery
  {
    id: "rogue_thief_1",
    name: "Pickpocket",
    description: "Light fingers find extra coin.",
    branch: 3,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "gold_bonus", value: 15, description: "+15% gold from quests" },
  },
  {
    id: "rogue_thief_2",
    name: "Heist Expert",
    description: "Plan and execute perfect heists.",
    branch: 3,
    tier: 2,
    prerequisiteIds: ["rogue_thief_1"],
    effect: { type: "gold_bonus", value: 20, description: "+20% gold from quests" },
  },
  {
    id: "rogue_thief_3",
    name: "Master Thief",
    description: "Steal from the richest vaults.",
    branch: 3,
    tier: 3,
    prerequisiteIds: ["rogue_thief_2"],
    effect: { type: "dice_modifier", value: 3, description: "+3 to dice rolls" },
  },
];

const bardAbilities: AbilityTree = [
  // Branch 1: Song
  {
    id: "bard_song_1",
    name: "Inspiring Melody",
    description: "Your songs inspire faster growth.",
    branch: 1,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "xp_bonus", value: 10, description: "+10% XP from quests" },
  },
  {
    id: "bard_song_2",
    name: "Ballad of Fortune",
    description: "Songs of wealth attract gold.",
    branch: 1,
    tier: 2,
    prerequisiteIds: ["bard_song_1"],
    effect: { type: "gold_bonus", value: 15, description: "+15% gold from quests" },
  },
  {
    id: "bard_song_3",
    name: "Epic Symphony",
    description: "A masterpiece that echoes through time.",
    branch: 1,
    tier: 3,
    prerequisiteIds: ["bard_song_2"],
    effect: { type: "xp_bonus", value: 25, description: "+25% XP from quests" },
  },
  // Branch 2: Performance
  {
    id: "bard_perform_1",
    name: "Dazzle",
    description: "Your performances distract and confuse.",
    branch: 2,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "dice_modifier", value: 1, description: "+1 to dice rolls" },
  },
  {
    id: "bard_perform_2",
    name: "Showstopper",
    description: "A performance so good it changes outcomes.",
    branch: 2,
    tier: 2,
    prerequisiteIds: ["bard_perform_1"],
    effect: { type: "dice_modifier", value: 2, description: "+2 to dice rolls" },
  },
  {
    id: "bard_perform_3",
    name: "Grand Finale",
    description: "The ultimate performance.",
    branch: 2,
    tier: 3,
    prerequisiteIds: ["bard_perform_2"],
    effect: { type: "special_action", value: 1, description: "Re-roll one failed quest per week" },
  },
  // Branch 3: Lore
  {
    id: "bard_lore_1",
    name: "Traveler's Tales",
    description: "Knowledge from your travels brings gold.",
    branch: 3,
    tier: 1,
    prerequisiteIds: [],
    effect: { type: "gold_bonus", value: 10, description: "+10% gold from quests" },
  },
  {
    id: "bard_lore_2",
    name: "Ancient Knowledge",
    description: "Forgotten lore accelerates learning.",
    branch: 3,
    tier: 2,
    prerequisiteIds: ["bard_lore_1"],
    effect: { type: "xp_bonus", value: 15, description: "+15% XP from quests" },
  },
  {
    id: "bard_lore_3",
    name: "Omniscience",
    description: "You know everything worth knowing.",
    branch: 3,
    tier: 3,
    prerequisiteIds: ["bard_lore_2"],
    effect: { type: "gold_bonus", value: 25, description: "+25% gold from quests" },
  },
];

// ==================== REGISTRY ====================

const abilityTrees: Record<CharacterClass, AbilityTree> = {
  fighter: fighterAbilities,
  wizard: wizardAbilities,
  ranger: rangerAbilities,
  cleric: clericAbilities,
  rogue: rogueAbilities,
  bard: bardAbilities,
};

/**
 * Get the full ability tree for a character class.
 */
export function getAbilityTree(characterClass: CharacterClass): AbilityTree {
  return abilityTrees[characterClass];
}

/**
 * Find a specific ability by ID across all classes.
 */
export function findAbility(abilityId: string): (Ability & { class: CharacterClass }) | null {
  for (const [cls, tree] of Object.entries(abilityTrees)) {
    const ability = tree.find((a) => a.id === abilityId);
    if (ability) {
      return { ...ability, class: cls as CharacterClass };
    }
  }
  return null;
}

/**
 * Calculate how many ability points a character has earned.
 * 1 point per level starting at level 2.
 */
export function getAbilityPoints(level: number): number {
  return Math.max(0, level - 1);
}

/**
 * Get abilities available for a character to learn.
 * Filters by: class tree, not already learned, prerequisites met, tier unlocked by level.
 */
export function getAvailableAbilities(
  characterClass: CharacterClass,
  level: number,
  learnedAbilityIds: string[]
): Ability[] {
  const tree = getAbilityTree(characterClass);
  const totalPoints = getAbilityPoints(level);
  const usedPoints = learnedAbilityIds.length;
  const remainingPoints = totalPoints - usedPoints;

  if (remainingPoints <= 0) {
    return [];
  }

  return tree.filter((ability) => {
    // Already learned
    if (learnedAbilityIds.includes(ability.id)) {
      return false;
    }

    // Prerequisites not met
    if (ability.prerequisiteIds.some((preId) => !learnedAbilityIds.includes(preId))) {
      return false;
    }

    return true;
  });
}
