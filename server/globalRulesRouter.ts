/**
 * Global Rules Router – Admin-only endpoints for managing global KI-Regeln
 * These rules are trained by the admin and serve as base rules for all organizations.
 * Org-specific rules always have priority over global rules.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { bookingRules, accounts } from "../drizzle/schema";
import { and, eq, desc, sql, like } from "drizzle-orm";

const globalRuleInput = z.object({
  counterpartyPattern: z.string().min(1).max(300),
  descriptionPattern: z.string().max(500).optional(),
  bookingTextTemplate: z.string().max(500).optional(),
  globalDebitAccountNumber: z.string().max(20).optional(),
  globalCreditAccountNumber: z.string().max(20).optional(),
  categoryHint: z.string().max(200).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  source: z.enum(["manual", "ai"]).optional(),
});

export const globalRulesRouter = router({
  // ── List all global rules ──────────────────────────────────────────────────
  list: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(10).max(200).default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const search = input?.search?.toLowerCase();
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 50;

      const allGlobal = await db.select().from(bookingRules)
        .where(eq(bookingRules.scope, "global"))
        .orderBy(desc(bookingRules.priority), desc(bookingRules.usageCount));

      // Filter by search
      const filtered = search
        ? allGlobal.filter(r =>
            r.counterpartyPattern.toLowerCase().includes(search) ||
            (r.bookingTextTemplate ?? "").toLowerCase().includes(search) ||
            (r.categoryHint ?? "").toLowerCase().includes(search)
          )
        : allGlobal;

      const total = filtered.length;
      const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

      return {
        rules: paginated,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // ── Get stats ──────────────────────────────────────────────────────────────
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allGlobal = await db.select().from(bookingRules)
      .where(eq(bookingRules.scope, "global"));

    const active = allGlobal.filter(r => r.isActive).length;
    const inactive = allGlobal.filter(r => !r.isActive).length;
    const manual = allGlobal.filter(r => r.source === "manual").length;
    const ai = allGlobal.filter(r => r.source === "ai").length;
    const totalUsage = allGlobal.reduce((sum, r) => sum + r.usageCount, 0);

    return {
      total: allGlobal.length,
      active,
      inactive,
      manual,
      ai,
      totalUsage,
    };
  }),

  // ── Create a global rule ───────────────────────────────────────────────────
  create: adminProcedure
    .input(globalRuleInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check for duplicate pattern
      const existing = await db.select().from(bookingRules)
        .where(and(
          eq(bookingRules.scope, "global"),
          eq(bookingRules.counterpartyPattern, input.counterpartyPattern),
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Eine globale Regel mit dem Muster "${input.counterpartyPattern}" existiert bereits.`,
        });
      }

      await db.insert(bookingRules).values({
        organizationId: 0, // Global rules don't belong to a specific org
        scope: "global",
        counterpartyPattern: input.counterpartyPattern,
        descriptionPattern: input.descriptionPattern,
        bookingTextTemplate: input.bookingTextTemplate,
        globalDebitAccountNumber: input.globalDebitAccountNumber,
        globalCreditAccountNumber: input.globalCreditAccountNumber,
        categoryHint: input.categoryHint,
        vatRate: input.vatRate !== undefined ? String(input.vatRate) : undefined,
        priority: input.priority ?? 5, // Global rules have lower default priority than org rules
        source: input.source ?? "manual",
        usageCount: 0,
        isActive: true,
      });

      return { success: true };
    }),

  // ── Update a global rule ───────────────────────────────────────────────────
  update: adminProcedure
    .input(globalRuleInput.extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, vatRate, ...rest } = input;
      await db.update(bookingRules).set({
        ...rest,
        vatRate: vatRate !== undefined ? String(vatRate) : undefined,
      }).where(and(
        eq(bookingRules.id, id),
        eq(bookingRules.scope, "global"),
      ));

      return { success: true };
    }),

  // ── Delete a global rule ───────────────────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(bookingRules).where(and(
        eq(bookingRules.id, input.id),
        eq(bookingRules.scope, "global"),
      ));

      return { success: true };
    }),

  // ── Toggle active/inactive ─────────────────────────────────────────────────
  toggle: adminProcedure
    .input(z.object({ id: z.number().int(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(bookingRules)
        .set({ isActive: input.isActive })
        .where(and(
          eq(bookingRules.id, input.id),
          eq(bookingRules.scope, "global"),
        ));

      return { success: true };
    }),

  // ── Bulk import global rules ───────────────────────────────────────────────
  // Allows admin to import multiple rules at once (e.g., from training sessions)
  bulkImport: adminProcedure
    .input(z.object({
      rules: z.array(globalRuleInput).min(1).max(500),
      overwriteExisting: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const rule of input.rules) {
        const existing = await db.select().from(bookingRules)
          .where(and(
            eq(bookingRules.scope, "global"),
            eq(bookingRules.counterpartyPattern, rule.counterpartyPattern),
          ))
          .limit(1);

        if (existing.length > 0) {
          if (input.overwriteExisting) {
            await db.update(bookingRules).set({
              bookingTextTemplate: rule.bookingTextTemplate,
              globalDebitAccountNumber: rule.globalDebitAccountNumber,
              globalCreditAccountNumber: rule.globalCreditAccountNumber,
              categoryHint: rule.categoryHint,
              vatRate: rule.vatRate !== undefined ? String(rule.vatRate) : undefined,
              priority: rule.priority ?? existing[0].priority,
              source: rule.source ?? "manual",
            }).where(eq(bookingRules.id, existing[0].id));
            updated++;
          } else {
            skipped++;
          }
        } else {
          await db.insert(bookingRules).values({
            organizationId: 0,
            scope: "global",
            counterpartyPattern: rule.counterpartyPattern,
            descriptionPattern: rule.descriptionPattern,
            bookingTextTemplate: rule.bookingTextTemplate,
            globalDebitAccountNumber: rule.globalDebitAccountNumber,
            globalCreditAccountNumber: rule.globalCreditAccountNumber,
            categoryHint: rule.categoryHint,
            vatRate: rule.vatRate !== undefined ? String(rule.vatRate) : undefined,
            priority: rule.priority ?? 5,
            source: rule.source ?? "manual",
            usageCount: 0,
            isActive: true,
          });
          created++;
        }
      }

      return { created, updated, skipped, total: input.rules.length };
    }),

  // ── Promote org rule to global ─────────────────────────────────────────────
  // Admin can promote a well-tested org-specific rule to a global rule
  promoteToGlobal: adminProcedure
    .input(z.object({
      ruleId: z.number().int(),
      organizationId: z.number().int(), // Which org the rule belongs to
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get the org rule
      const [orgRule] = await db.select().from(bookingRules)
        .where(and(
          eq(bookingRules.id, input.ruleId),
          eq(bookingRules.organizationId, input.organizationId),
          eq(bookingRules.scope, "org"),
        ))
        .limit(1);

      if (!orgRule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Regel nicht gefunden" });
      }

      // Resolve account IDs to account numbers for global storage
      let debitNum: string | undefined;
      let creditNum: string | undefined;

      if (orgRule.debitAccountId) {
        const [acc] = await db.select({ number: accounts.number }).from(accounts)
          .where(eq(accounts.id, orgRule.debitAccountId)).limit(1);
        debitNum = acc?.number;
      }
      if (orgRule.creditAccountId) {
        const [acc] = await db.select({ number: accounts.number }).from(accounts)
          .where(eq(accounts.id, orgRule.creditAccountId)).limit(1);
        creditNum = acc?.number;
      }

      // Check if global rule with same pattern already exists
      const existing = await db.select().from(bookingRules)
        .where(and(
          eq(bookingRules.scope, "global"),
          eq(bookingRules.counterpartyPattern, orgRule.counterpartyPattern),
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing global rule
        await db.update(bookingRules).set({
          bookingTextTemplate: orgRule.bookingTextTemplate,
          globalDebitAccountNumber: debitNum,
          globalCreditAccountNumber: creditNum,
          source: "manual",
          usageCount: sql`${bookingRules.usageCount} + ${orgRule.usageCount}`,
        }).where(eq(bookingRules.id, existing[0].id));
      } else {
        // Create new global rule
        await db.insert(bookingRules).values({
          organizationId: 0,
          scope: "global",
          counterpartyPattern: orgRule.counterpartyPattern,
          descriptionPattern: orgRule.descriptionPattern,
          bookingTextTemplate: orgRule.bookingTextTemplate,
          globalDebitAccountNumber: debitNum,
          globalCreditAccountNumber: creditNum,
          vatRate: orgRule.vatRate,
          priority: 5,
          source: "manual",
          usageCount: orgRule.usageCount,
          isActive: true,
        });
      }

      return { success: true, pattern: orgRule.counterpartyPattern };
    }),
});
