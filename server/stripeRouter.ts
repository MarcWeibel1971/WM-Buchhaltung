import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orgProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { subscriptions, organizations, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  createCheckoutSession,
  createPortalSession,
  PLANS,
  type PlanKey,
} from "./stripe";

export const stripeRouter = router({
  /**
   * Get current subscription status for the active organization
   */
  getSubscription: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, ctx.organizationId))
      .limit(1);

    if (!sub) {
      return {
        plan: null,
        status: "none" as const,
        trialEnd: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    return {
      plan: sub.plan,
      status: sub.status,
      trialEnd: sub.trialEnd,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }),

  /**
   * Create a Stripe Checkout Session for a given plan
   */
  createCheckout: orgProcedure
    .input(
      z.object({
        plan: z.enum(["starter", "professional", "enterprise"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if already has an active subscription
      const [existingSub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, ctx.organizationId))
        .limit(1);

      // Get user email for Stripe
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const url = await createCheckoutSession({
        plan: input.plan as PlanKey,
        customerId: existingSub?.stripeCustomerId,
        customerEmail: user?.email ?? undefined,
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        origin: input.origin,
      });

      return { url };
    }),

  /**
   * Create a Stripe Customer Portal session (manage subscription, payment methods, etc.)
   */
  createPortal: orgProcedure
    .input(z.object({ returnUrl: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, ctx.organizationId))
        .limit(1);

      if (!sub?.stripeCustomerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kein aktives Abonnement gefunden. Bitte wählen Sie zuerst einen Plan.",
        });
      }

      const url = await createPortalSession({
        customerId: sub.stripeCustomerId,
        returnUrl: input.returnUrl,
      });

      return { url };
    }),

  /**
   * Get available plans with features
   */
  getPlans: orgProcedure.query(() => {
    return Object.entries(PLANS).map(([key, plan]) => ({
      key,
      name: plan.name,
      description: plan.description,
      priceChf: plan.priceChf / 100,
      features: plan.features,
      maxOrganizations: plan.maxOrganizations,
    }));
  }),
});
