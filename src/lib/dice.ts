import { getRandomValues } from "node:crypto";

/**
 * Roll a d20 using cryptographically secure random number generation.
 * Uses rejection sampling to ensure uniform distribution across 1-20.
 */
export function rollD20(): number {
  const buffer = new Uint32Array(1);

  // Rejection sampling: discard values that would cause modulo bias
  // 20 divides evenly into 4294967280 (= 20 * 214748364)
  const MAX_UNBIASED = 4294967280; // largest multiple of 20 that fits in uint32

  let value: number;
  do {
    getRandomValues(buffer);
    value = buffer[0];
  } while (value >= MAX_UNBIASED);

  return (value % 20) + 1;
}

export type DiceModifier = {
  source: string;
  type: "ability" | "item" | "buff" | "class";
  value: number;
};

export type DiceRollResult = {
  roll: number;
  modifiers: DiceModifier[];
  total: number;
  dc: number;
  success: boolean;
};

/**
 * Calculate the D&D-style ability modifier from a stat value.
 * Formula: floor((stat - 10) / 2)
 */
export function abilityModifier(statValue: number): number {
  return Math.floor((statValue - 10) / 2);
}
