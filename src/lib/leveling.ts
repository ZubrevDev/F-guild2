const BASE_XP = 100;
const MODIFIER = 1.5;
const MAX_LEVEL = 20;

/**
 * Calculate XP required to advance from the given level to the next.
 * Formula: base_xp * level * modifier
 */
export function xpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.floor(BASE_XP * level * MODIFIER);
}

/**
 * Check if a character should level up, handling multi-level jumps
 * and XP carry-over.
 */
export function checkLevelUp(
  currentLevel: number,
  currentXp: number
): { newLevel: number; remainingXp: number; levelsGained: number } {
  let level = currentLevel;
  let xp = currentXp;

  while (level < MAX_LEVEL) {
    const needed = xpToNextLevel(level);
    if (xp < needed) break;
    xp -= needed;
    level++;
  }

  // If at max level, XP stays as-is (no overflow reset)
  return {
    newLevel: level,
    remainingXp: xp,
    levelsGained: level - currentLevel,
  };
}

export { MAX_LEVEL };
