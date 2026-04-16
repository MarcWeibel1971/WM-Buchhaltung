import { Router, raw } from "express";
import { constructWebhookEvent, type PlanKey } from "./stripe";
import { getDb } from "./db";
import { subscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export const stripeWebhookRouter = Router();

// Stripe sends raw body – must NOT be parsed as JSON
stripeWebhookRouter.post(
  "/",
  raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    if (!sig) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(req.body, sig);
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database unavailable" });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode !== "subscription") break;

          const orgId = parseInt(session.metadata?.organizationId ?? "0");
          const userId = parseInt(session.metadata?.userId ?? "0");
          const plan = (session.metadata?.plan ?? "starter") as PlanKey;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          if (!orgId || !userId) {
            console.error("[Stripe Webhook] Missing orgId or userId in metadata");
            break;
          }

          // Check if subscription record already exists for this org
          const [existing] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.organizationId, orgId))
            .limit(1);

          if (existing) {
            await db
              .update(subscriptions)
              .set({
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                plan,
                status: "trialing",
              })
              .where(eq(subscriptions.id, existing.id));
          } else {
            await db.insert(subscriptions).values({
              organizationId: orgId,
              userId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan,
              status: "trialing",
            });
          }
          console.log(`[Stripe Webhook] Checkout completed: org=${orgId} plan=${plan}`);
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const subId = sub.id;

          const [existing] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.stripeSubscriptionId, subId))
            .limit(1);

          if (existing) {
            const status = mapStripeStatus(sub.status);
            const plan = getPlanFromSubscription(sub);

            // In Stripe v22 (2026-03-25.dahlia), current_period is on SubscriptionItem
            const firstItem = sub.items?.data?.[0];
            const periodStart = firstItem?.current_period_start
              ? new Date(firstItem.current_period_start * 1000)
              : null;
            const periodEnd = firstItem?.current_period_end
              ? new Date(firstItem.current_period_end * 1000)
              : null;

            await db
              .update(subscriptions)
              .set({
                status,
                plan: plan ?? existing.plan,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: sub.cancel_at_period_end,
                trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
              })
              .where(eq(subscriptions.id, existing.id));

            console.log(`[Stripe Webhook] Subscription updated: ${subId} status=${status}`);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const subId = sub.id;

          await db
            .update(subscriptions)
            .set({ status: "canceled" })
            .where(eq(subscriptions.stripeSubscriptionId, subId));

          console.log(`[Stripe Webhook] Subscription deleted: ${subId}`);
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          // In v22, subscription is under invoice.parent.subscription_details.subscription
          const subId = getSubscriptionIdFromInvoice(invoice);
          if (!subId) break;

          const [existing] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.stripeSubscriptionId, subId))
            .limit(1);

          if (existing && existing.status !== "active") {
            await db
              .update(subscriptions)
              .set({ status: "active" })
              .where(eq(subscriptions.id, existing.id));
            console.log(`[Stripe Webhook] Invoice paid, subscription activated: ${subId}`);
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subId = getSubscriptionIdFromInvoice(invoice);
          if (!subId) break;

          await db
            .update(subscriptions)
            .set({ status: "past_due" })
            .where(eq(subscriptions.stripeSubscriptionId, subId));

          console.log(`[Stripe Webhook] Payment failed for subscription: ${subId}`);
          break;
        }

        default:
          break;
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("[Stripe Webhook] Processing error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapStripeStatus(
  status: Stripe.Subscription.Status
): "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "incomplete";
  }
}

function getPlanFromSubscription(sub: Stripe.Subscription): PlanKey | null {
  if (sub.metadata?.plan) return sub.metadata.plan as PlanKey;
  const item = sub.items?.data?.[0];
  if (item?.price?.metadata?.klax_plan) {
    return item.price.metadata.klax_plan as PlanKey;
  }
  return null;
}

/**
 * Extract subscription ID from Invoice in Stripe v22 (2026-03-25.dahlia).
 * In v22, the subscription reference moved to invoice.parent.subscription_details.subscription
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (!parent) return null;
  const subDetails = parent.subscription_details;
  if (!subDetails) return null;
  const sub = subDetails.subscription;
  if (!sub) return null;
  // Can be string or Subscription object
  return typeof sub === "string" ? sub : sub.id;
}
