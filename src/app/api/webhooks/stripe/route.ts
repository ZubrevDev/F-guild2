import { NextRequest, NextResponse } from "next/server";
import { getStripe, ENABLE_BILLING } from "@/lib/stripe";
import { db } from "@/server/db";
import type Stripe from "stripe";

/**
 * Stripe webhook handler.
 *
 * When ENABLE_BILLING is false the endpoint returns 200 immediately so it
 * exists in the routing table but does nothing.
 */
export async function POST(req: NextRequest) {
  if (!ENABLE_BILLING) {
    return NextResponse.json(
      { received: true, billing: "disabled" },
      { status: 200 },
    );
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error("Error handling Stripe event:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.userId) {
        await db.user.update({
          where: { id: session.metadata.userId },
          data: {
            subscriptionTier: "premium",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const user = await db.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (user) {
        const isActive =
          subscription.status === "active" ||
          subscription.status === "trialing";
        await db.user.update({
          where: { id: user.id },
          data: {
            subscriptionTier: isActive ? "premium" : "free",
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const user = await db.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: {
            subscriptionTier: "free",
            stripeSubscriptionId: null,
          },
        });
      }
      break;
    }

    default:
      // Unhandled event type — log and move on
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }
}
