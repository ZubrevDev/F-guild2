import Stripe from "stripe";

/**
 * Stripe client singleton.
 *
 * ENABLE_BILLING=false (default) keeps all Stripe functionality inactive.
 * The client is only instantiated when STRIPE_SECRET_KEY is present.
 */

export const ENABLE_BILLING = process.env.ENABLE_BILLING === "true";

function createStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  return new Stripe(key);
}

/** May be null when Stripe is not configured. Guard usage with `ENABLE_BILLING`. */
export const stripe = createStripeClient();

/**
 * Ensure the Stripe client is available. Throws when billing is disabled or
 * the secret key is missing.
 */
export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY and ENABLE_BILLING=true.",
    );
  }
  return stripe;
}

/**
 * Price IDs are read from env so they can differ per environment.
 */
export const PRICE_IDS = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID ?? "",
} as const;

/**
 * Create a Stripe customer for a newly registered user.
 * No-op when billing is disabled.
 */
export async function createStripeCustomer(
  email: string,
  name: string,
): Promise<string | null> {
  if (!ENABLE_BILLING || !stripe) return null;

  const customer = await stripe.customers.create({ email, name });
  return customer.id;
}
