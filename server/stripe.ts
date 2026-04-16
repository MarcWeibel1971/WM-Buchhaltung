import Stripe from "stripe";
import { ENV } from "./_core/env";

// ─── Stripe Client ──────────────────────────────────────────────────────────
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return stripeInstance;
}

// ─── Plan Configuration ─────────────────────────────────────────────────────
// Stripe Price IDs will be created dynamically on first use (test mode).
// In production, these should be pre-configured Price IDs from the Stripe Dashboard.
export const PLANS = {
  starter: {
    name: "Starter",
    description: "Für Einzelunternehmen",
    priceChf: 2900, // in Rappen (CHF 29.00)
    features: ["1 Firma", "Doppelte Buchhaltung", "QR-Rechnungen", "Bankimport", "MWST-Abrechnung"],
    maxOrganizations: 1,
  },
  professional: {
    name: "Professional",
    description: "Für wachsende KMU",
    priceChf: 5900, // CHF 59.00
    features: ["Bis 3 Firmen", "Alles aus Starter", "Lohnbuchhaltung", "KI-Buchungsvorschläge", "Dokumenten-Scan", "Kreditoren-Verwaltung"],
    maxOrganizations: 3,
  },
  enterprise: {
    name: "Enterprise",
    description: "Für Treuhandgesellschaften",
    priceChf: 9900, // CHF 99.00
    features: ["Unbegrenzte Firmen", "Alles aus Professional", "Zeiterfassung", "Mandanten-Verwaltung", "Prioritäts-Support", "Individuelle Anpassungen"],
    maxOrganizations: 999,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ─── Price Management ───────────────────────────────────────────────────────
// Cache for Stripe Price IDs (created on demand in test mode)
const priceIdCache: Record<string, string> = {};

/**
 * Get or create a Stripe Price for a given plan.
 * In test mode, creates products/prices dynamically.
 */
export async function getOrCreatePriceId(plan: PlanKey): Promise<string> {
  const cacheKey = `klax_${plan}`;
  if (priceIdCache[cacheKey]) return priceIdCache[cacheKey];

  const stripe = getStripe();
  const planConfig = PLANS[plan];

  // Search for existing product
  const products = await stripe.products.search({
    query: `metadata['klax_plan']:'${plan}'`,
  });

  let productId: string;
  if (products.data.length > 0) {
    productId = products.data[0].id;
    // Check if there's an active price
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      currency: "chf",
      type: "recurring",
      limit: 1,
    });
    if (prices.data.length > 0) {
      priceIdCache[cacheKey] = prices.data[0].id;
      return prices.data[0].id;
    }
  } else {
    // Create product
    const product = await stripe.products.create({
      name: `KLAX ${planConfig.name}`,
      description: planConfig.description,
      metadata: { klax_plan: plan },
    });
    productId = product.id;
  }

  // Create price
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: planConfig.priceChf,
    currency: "chf",
    recurring: { interval: "month" },
    metadata: { klax_plan: plan },
  });

  priceIdCache[cacheKey] = price.id;
  return price.id;
}

// ─── Checkout Session ───────────────────────────────────────────────────────
export async function createCheckoutSession(opts: {
  plan: PlanKey;
  customerId?: string;
  customerEmail?: string;
  organizationId: number;
  userId: number;
  origin: string;
}): Promise<string> {
  const stripe = getStripe();
  const priceId = await getOrCreatePriceId(opts.plan);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    currency: "chf",
    locale: "de",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${opts.origin}/settings?tab=subscription&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/settings?tab=subscription&canceled=true`,
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        organizationId: String(opts.organizationId),
        userId: String(opts.userId),
        plan: opts.plan,
      },
    },
    metadata: {
      organizationId: String(opts.organizationId),
      userId: String(opts.userId),
      plan: opts.plan,
    },
  };

  if (opts.customerId) {
    sessionParams.customer = opts.customerId;
  } else if (opts.customerEmail) {
    sessionParams.customer_email = opts.customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session.url!;
}

// ─── Customer Portal ────────────────────────────────────────────────────────
export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
  return session.url;
}

// ─── Webhook Signature Verification ─────────────────────────────────────────
export function constructWebhookEvent(
  payload: Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  if (!ENV.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return stripe.webhooks.constructEvent(payload, signature, ENV.stripeWebhookSecret);
}
