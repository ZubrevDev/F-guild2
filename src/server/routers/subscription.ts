import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { getStripe, ENABLE_BILLING, PRICE_IDS } from "@/lib/stripe";

export const subscriptionRouter = router({
  /**
   * Create a Stripe Checkout session for upgrading to premium.
   */
  createCheckoutSession: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ENABLE_BILLING) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Billing is not enabled",
      });
    }

    const stripe = getStripe();
    const userId = ctx.session.userId;

    const user = await ctx.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    if (user.subscriptionTier === "premium") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Already subscribed to premium",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      line_items: [
        {
          price: PRICE_IDS.premium,
          quantity: 1,
        },
      ],
      metadata: { userId },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=cancelled`,
    });

    return { url: session.url };
  }),

  /**
   * Get current subscription status.
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.userId;

    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      tier: user.subscriptionTier,
      hasActiveSubscription: user.stripeSubscriptionId !== null,
      billingEnabled: ENABLE_BILLING,
    };
  }),

  /**
   * Cancel the current subscription.
   */
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ENABLE_BILLING) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Billing is not enabled",
      });
    }

    const stripe = getStripe();
    const userId = ctx.session.userId;

    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    });

    if (!user?.stripeSubscriptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active subscription to cancel",
      });
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return { success: true, message: "Subscription will cancel at period end" };
  }),
});
