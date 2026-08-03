/**
 * POS Router – tRPC-Prozeduren für POS-Terminal-Integration
 * (Stripe Terminal + SumUp)
 */
import { z } from "zod";
import { router, orgProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { posConfig, posTransactions, bankAccounts, accounts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { maskSecret, prepareSecretForWrite } from "./secrets";

export const posRouter = router({
  // ─── Konfiguration ──────────────────────────────────────────────────────
  getConfig: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(posConfig)
      .where(eq(posConfig.organizationId, ctx.organizationId));
    // Secrets niemals im Klartext an den Client (Phase 2.2) – nur maskiert
    return rows.map(r => ({
      ...r,
      apiKey: maskSecret(r.apiKey),
      webhookSecret: maskSecret(r.webhookSecret),
    }));
  }),

  saveConfig: orgProcedure
    .input(
      z.object({
        id: z.number().optional(),
        provider: z.enum(["stripe_terminal", "sumup"]),
        apiKey: z.string().optional(),
        merchantCode: z.string().optional(),
        webhookSecret: z.string().optional(),
        bankAccountId: z.number().optional(),
        revenueAccountId: z.number().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      if (input.id) {
        // Secrets nur schreiben, wenn ein neuer Wert geliefert wird –
        // Masken-Platzhalter ("••••…") aus dem Formular bedeuten "behalten"
        const updateSet: Record<string, unknown> = {
          provider: input.provider,
          merchantCode: input.merchantCode,
          bankAccountId: input.bankAccountId,
          revenueAccountId: input.revenueAccountId,
          isActive: input.isActive,
        };
        const encApiKey = prepareSecretForWrite(input.apiKey);
        const encWebhookSecret = prepareSecretForWrite(input.webhookSecret);
        if (encApiKey !== undefined) updateSet.apiKey = encApiKey === "" ? null : encApiKey;
        if (encWebhookSecret !== undefined) updateSet.webhookSecret = encWebhookSecret === "" ? null : encWebhookSecret;

        await db
          .update(posConfig)
          .set(updateSet)
          .where(
            and(
              eq(posConfig.id, input.id),
              eq(posConfig.organizationId, ctx.organizationId)
            )
          );
        return { success: true, id: input.id };
      } else {
        const [result] = await db
          .insert(posConfig)
          .values({
            organizationId: ctx.organizationId,
            provider: input.provider,
            apiKey: prepareSecretForWrite(input.apiKey) ?? null,
            merchantCode: input.merchantCode,
            webhookSecret: prepareSecretForWrite(input.webhookSecret) ?? null,
            bankAccountId: input.bankAccountId,
            revenueAccountId: input.revenueAccountId,
            isActive: input.isActive,
          })
          .$returningId();
        return { success: true, id: result?.id };
      }
    }),

  deleteConfig: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .delete(posConfig)
        .where(
          and(
            eq(posConfig.id, input.id),
            eq(posConfig.organizationId, ctx.organizationId)
          )
        );
      return { success: true };
    }),

  // ─── Transaktionen ───────────────────────────────────────────────────────
  getTransactions: orgProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        provider: z.enum(["stripe_terminal", "sumup"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { transactions: [], total: 0 };

      const conditions = [eq(posTransactions.organizationId, ctx.organizationId)];
      if (input.provider) {
        conditions.push(eq(posTransactions.provider, input.provider));
      }

      const txs = await db
        .select()
        .from(posTransactions)
        .where(and(...conditions))
        .orderBy(desc(posTransactions.paidAt))
        .limit(input.limit)
        .offset(input.offset);

      return { transactions: txs, total: txs.length };
    }),

  // ─── Hilfsdaten ─────────────────────────────────────────────────────────
  getBankAccounts: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.organizationId, ctx.organizationId));
  }),

  getRevenueAccounts: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    // Ertragskonten: Klasse 3 (3000-3999)
    return db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.organizationId, ctx.organizationId),
          eq(accounts.isActive, true)
        )
      )
      .then((rows) =>
        rows.filter(
          (r) =>
            r.number >= "3000" && r.number <= "3999"
        )
      );
  }),

  // ─── Webhook-URL für Konfiguration ───────────────────────────────────────
  getWebhookUrls: orgProcedure.query(async ({ ctx }) => {
    // Diese URLs müssen in Stripe/SumUp Dashboard eingetragen werden
    return {
      stripe: `/api/pos/webhook/stripe`,
      sumup: `/api/pos/webhook/sumup`,
    };
  }),
});
