/**
 * POS Webhook Handler
 * Verarbeitet eingehende Webhooks von Stripe Terminal und SumUp.
 * Erstellt automatisch posTransactions und Bank-Transaktionen.
 */
import express from "express";
import crypto from "crypto";
import Stripe from "stripe";
import { getDb } from "./db";
import {
  posConfig,
  posTransactions,
  bankTransactions,
  bankAccounts,
  journalEntries,
  journalLines,
  accounts,
  type InsertJournalEntry,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "./_core/logger";

const logger = createLogger("posWebhook");

export const posWebhookRouter = express.Router();

// ─── Stripe Terminal Webhook ──────────────────────────────────────────────────
// Stripe sendet raw body – MUSS vor express.json() registriert werden
posWebhookRouter.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB not available" });

    // Stripe-Signatur verifizieren
    const sig = req.headers["stripe-signature"] as string;
    if (!sig) return res.status(400).json({ error: "Missing stripe-signature" });

    // Alle aktiven Stripe Terminal Konfigurationen laden
    const configs = await db
      .select()
      .from(posConfig)
      .where(and(eq(posConfig.provider, "stripe_terminal"), eq(posConfig.isActive, true)));

    let event: Stripe.Event | null = null;
    let matchedConfig: typeof configs[0] | null = null;

    for (const cfg of configs) {
      if (!cfg.webhookSecret) continue;
      try {
        const stripe = new Stripe(cfg.apiKey ?? "", { apiVersion: "2026-03-25.dahlia" });
        event = stripe.webhooks.constructEvent(req.body, sig, cfg.webhookSecret);
        matchedConfig = cfg;
        break;
      } catch {
        // Falscher Webhook-Secret für diese Konfiguration – weiter versuchen
      }
    }

    if (!event || !matchedConfig) {
      logger.warn("[POS Webhook] Stripe: Keine passende Konfiguration gefunden");
      return res.status(400).json({ error: "Invalid signature" });
    }

    try {
      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handleStripePayment(db, matchedConfig, pi);
      } else if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Fehlgeschlagene Zahlung als failed markieren (falls bereits vorhanden)
        await db
          .update(posTransactions)
          .set({ status: "failed" })
          .where(eq(posTransactions.externalId, pi.id));
      }
      res.json({ received: true });
    } catch (err: any) {
      logger.error("[POS Webhook] Stripe Verarbeitungsfehler:", err);
      res.status(500).json({ error: "Processing failed" });
    }
  }
);

// ─── SumUp Webhook ────────────────────────────────────────────────────────────
posWebhookRouter.post(
  "/sumup",
  express.json(),
  async (req, res) => {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB not available" });

    // SumUp sendet HMAC-SHA256 Signatur im Header X-SumUp-Signature
    const signature = req.headers["x-sumup-signature"] as string;
    const body = req.body;

    // Alle aktiven SumUp Konfigurationen laden
    const configs = await db
      .select()
      .from(posConfig)
      .where(and(eq(posConfig.provider, "sumup"), eq(posConfig.isActive, true)));

    if (configs.length === 0) {
      return res.status(400).json({ error: "No SumUp configuration found" });
    }

    // Signatur verifizieren (falls webhookSecret gesetzt)
    let matchedConfig = configs[0];
    if (signature && matchedConfig.webhookSecret) {
      const expected = crypto
        .createHmac("sha256", matchedConfig.webhookSecret)
        .update(JSON.stringify(body))
        .digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return res.status(400).json({ error: "Invalid signature" });
      }
    }

    try {
      // SumUp Webhook-Payload: { type: "PAYMENT", event_type: "SUCCESSFUL", ... }
      if (body.event_type === "SUCCESSFUL" || body.type === "PAYMENT") {
        await handleSumUpPayment(db, matchedConfig, body);
      }
      res.json({ received: true });
    } catch (err: any) {
      logger.error("[POS Webhook] SumUp Verarbeitungsfehler:", err);
      res.status(500).json({ error: "Processing failed" });
    }
  }
);

// ─── Stripe Terminal Zahlung verarbeiten ─────────────────────────────────────
async function handleStripePayment(
  db: Awaited<ReturnType<typeof getDb>>,
  cfg: typeof posConfig.$inferSelect,
  pi: Stripe.PaymentIntent
) {
  if (!db) return;

  const amountChf = (pi.amount / 100).toFixed(2); // Stripe: Rappen → CHF
  const paidAt = new Date(pi.created * 1000);
  const pm = pi.payment_method as Stripe.PaymentMethod | null;
  const cardBrand = typeof pm === "object" ? pm?.card?.brand ?? null : null;
  const cardLast4 = typeof pm === "object" ? pm?.card?.last4 ?? null : null;

  // Duplikat-Check
  const existing = await db
    .select()
    .from(posTransactions)
    .where(eq(posTransactions.externalId, pi.id))
    .limit(1);
  if (existing.length > 0) return;

  // POS-Transaktion speichern
  const [posTx] = await db.insert(posTransactions).values({
    organizationId: cfg.organizationId,
    provider: "stripe_terminal",
    externalId: pi.id,
    amount: amountChf,
    currency: (pi.currency ?? "chf").toUpperCase(),
    paymentMethod: "card",
    cardBrand: cardBrand ?? undefined,
    cardLast4: cardLast4 ?? undefined,
    description: pi.description ?? `Stripe Terminal Zahlung ${pi.id}`,
    status: "completed",
    paidAt,
    rawPayload: pi as any,
  }).$returningId();

  // Bank-Transaktion erstellen (falls Bankkonto konfiguriert)
  if (cfg.bankAccountId) {
    const txHash = crypto
      .createHash("sha256")
      .update(`stripe_terminal:${pi.id}`)
      .digest("hex");

    await db.insert(bankTransactions).values({
      organizationId: cfg.organizationId,
      bankAccountId: cfg.bankAccountId,
      transactionDate: paidAt.toISOString().split("T")[0],
      valueDate: paidAt.toISOString().split("T")[0],
      amount: amountChf,
      currency: (pi.currency ?? "chf").toUpperCase(),
      description: `Stripe Terminal: ${pi.description ?? pi.id}`,
      reference: pi.id,
      counterparty: cardBrand ? `${cardBrand.toUpperCase()} ****${cardLast4}` : "EC-Karte",
      status: "pending",
      txHash,
    });
  }

  // Automatische Buchung erstellen (falls Ertragskonto konfiguriert)
  if (cfg.bankAccountId && cfg.revenueAccountId) {
    await createPosJournalEntry(db, cfg, amountChf, paidAt, `Stripe Terminal ${pi.id}`);
  }

  logger.info(`[POS Webhook] Stripe Terminal Zahlung verarbeitet: ${pi.id} CHF ${amountChf}`);
}

// ─── SumUp Zahlung verarbeiten ────────────────────────────────────────────────
async function handleSumUpPayment(
  db: Awaited<ReturnType<typeof getDb>>,
  cfg: typeof posConfig.$inferSelect,
  payload: any
) {
  if (!db) return;

  const txId = payload.id ?? payload.transaction_id ?? payload.transaction_code;
  if (!txId) return;

  const amount = parseFloat(payload.amount ?? payload.transaction_amount ?? "0").toFixed(2);
  const currency = (payload.currency ?? "CHF").toUpperCase();
  const paidAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
  const cardType = payload.card?.type ?? payload.payment_type ?? null;
  const last4 = payload.card?.last_4_digits ?? null;

  // Duplikat-Check
  const existing = await db
    .select()
    .from(posTransactions)
    .where(eq(posTransactions.externalId, String(txId)))
    .limit(1);
  if (existing.length > 0) return;

  // POS-Transaktion speichern
  await db.insert(posTransactions).values({
    organizationId: cfg.organizationId,
    provider: "sumup",
    externalId: String(txId),
    amount,
    currency,
    paymentMethod: "card",
    cardBrand: cardType ?? undefined,
    cardLast4: last4 ?? undefined,
    description: payload.description ?? `SumUp Zahlung ${txId}`,
    status: "completed",
    paidAt,
    rawPayload: payload,
  });

  // Bank-Transaktion erstellen
  if (cfg.bankAccountId) {
    const txHash = crypto
      .createHash("sha256")
      .update(`sumup:${txId}`)
      .digest("hex");

    await db.insert(bankTransactions).values({
      organizationId: cfg.organizationId,
      bankAccountId: cfg.bankAccountId,
      transactionDate: paidAt.toISOString().split("T")[0],
      valueDate: paidAt.toISOString().split("T")[0],
      amount,
      currency,
      description: `SumUp: ${payload.description ?? txId}`,
      reference: String(txId),
      counterparty: cardType ? `${cardType.toUpperCase()} ****${last4 ?? ""}` : "EC-Karte",
      status: "pending",
      txHash,
    });
  }

  // Automatische Buchung
  if (cfg.bankAccountId && cfg.revenueAccountId) {
    await createPosJournalEntry(db, cfg, amount, paidAt, `SumUp ${txId}`);
  }

  logger.info(`[POS Webhook] SumUp Zahlung verarbeitet: ${txId} ${currency} ${amount}`);
}

// ─── Journal-Eintrag für POS-Zahlung erstellen ───────────────────────────────
async function createPosJournalEntry(
  db: Awaited<ReturnType<typeof getDb>>,
  cfg: typeof posConfig.$inferSelect,
  amount: string,
  date: Date,
  reference: string
) {
  if (!db || !cfg.bankAccountId || !cfg.revenueAccountId) return;

  // Bankkonto-Nummer ermitteln
  const [bankAcc] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, cfg.bankAccountId))
    .limit(1);

  // Konto-Nummer für Bankkonto ermitteln
  // Bankkonto als Buchungskonto (Kasse/Bank) – wir nutzen das erste Konto der Klasse 1
  const [debitAcc] = await db
    .select()
    .from(accounts)
    .where(and(
      eq(accounts.organizationId, cfg.organizationId),
      eq(accounts.id, cfg.revenueAccountId ?? 0)
    ))
    .limit(1);

  // Ertragskonto ermitteln
  const [creditAcc] = await db
    .select()
    .from(accounts)
    .where(and(
      eq(accounts.organizationId, cfg.organizationId),
      eq(accounts.id, cfg.revenueAccountId)
    ))
    .limit(1);

  if (!debitAcc || !creditAcc) return;

  // Journal-Eintrag erstellen
  const [entry] = await db.insert(journalEntries).values({
    organizationId: cfg.organizationId,
    bookingDate: date.toISOString().split("T")[0],
    description: `POS-Zahlung: ${reference}`,
    sourceRef: reference,
    status: "approved",
    source: "manual",
    fiscalYear: date.getFullYear(),
  }).$returningId();

  if (!entry?.id) return;

  // Buchungszeilen: Soll Bankkonto / Haben Ertragskonto
  await db.insert(journalLines).values({
    entryId: entry.id,
    accountId: debitAcc.id,
    side: "debit",
    amount,
    description: `POS-Einnahme: ${reference}`,
  });
  await db.insert(journalLines).values({
    entryId: entry.id,
    accountId: creditAcc.id,
    side: "credit",
    amount,
    description: `POS-Einnahme: ${reference}`,
  });
}
