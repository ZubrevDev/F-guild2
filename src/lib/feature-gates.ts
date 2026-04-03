import type { SubscriptionTier } from "@prisma/client";

/**
 * Features that can be gated behind a subscription tier.
 *
 * Add entries here as premium features are introduced.
 */
export type GatedFeature =
  | "unlimited_guilds"
  | "custom_themes"
  | "advanced_analytics"
  | "priority_support";

/**
 * Map of features to the minimum tier required.
 */
const FEATURE_TIER_MAP: Record<GatedFeature, SubscriptionTier> = {
  unlimited_guilds: "premium",
  custom_themes: "premium",
  advanced_analytics: "premium",
  priority_support: "premium",
};

/**
 * Tier hierarchy — higher index = higher tier.
 */
const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  premium: 1,
};

/**
 * Check whether a user with the given tier can access a feature.
 *
 * When ENABLE_BILLING is false every feature is accessible regardless of tier,
 * so MVP functionality is never blocked.
 */
export function canAccessFeature(
  tier: SubscriptionTier,
  feature: GatedFeature,
): boolean {
  const billingEnabled = process.env.ENABLE_BILLING === "true";
  if (!billingEnabled) return true;

  const requiredTier = FEATURE_TIER_MAP[feature];
  return TIER_RANK[tier] >= TIER_RANK[requiredTier];
}

/**
 * Limits per tier (guild count, etc.). Extend as needed.
 */
export const TIER_LIMITS: Record<SubscriptionTier, { maxGuilds: number }> = {
  free: { maxGuilds: 3 },
  premium: { maxGuilds: 50 },
};

/**
 * Get limits for a specific tier. When billing is disabled, returns premium
 * limits so nothing is restricted on MVP.
 */
export function getTierLimits(tier: SubscriptionTier) {
  const billingEnabled = process.env.ENABLE_BILLING === "true";
  if (!billingEnabled) return TIER_LIMITS.premium;
  return TIER_LIMITS[tier];
}
