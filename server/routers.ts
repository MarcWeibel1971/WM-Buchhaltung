import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  getAllAccounts, getAccountByNumber, getAccountBalance,
  getJournalEntries, getJournalEntryWithLines, createJournalEntry,
  approveJournalEntry, rejectJournalEntry, updateJournalEntryLines,
  getBankAccounts, getPendingBankTransactions, saveBankTransaction, approveBankTransaction, updateBankTransaction, getBankTransactionsByIds,
  getEmployees, getPayrollEntries,
  getBalanceSheet, getIncomeStatement,
  getVatPeriods, getCreditCardStatements, getDashboardStats,
  getDb,
  findMatchingRule, getAllBookingRules, upsertBookingRule, incrementRuleUsage,
  autoMatchDocuments, applyMatches, getMatchedDocument, improveBookingSuggestionFromDocument, unmatchDocument,
} from "./db";
import { bankTransactions, journalEntries, journalLines, payrollEntries, vatPeriods, creditCardStatements, employees, accounts, openingBalances, bookingRules } from "../drizzle/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import crypto from "crypto";
import { normaliseDate } from "../shared/bankParser";

/**
 * Converts a date string or Date object to 'YYYY-MM-DD' string for Drizzle date() columns.
 * Drizzle's date() in mysql2 mode expects a plain string, NOT a Date object.
 */
function toDateStr(val: string | Date | undefined | null): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return undefined;
    return val.toISOString().substring(0, 10);
  }
  // Already a string – normalise to YYYY-MM-DD
  const s = String(val).trim();
  // DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // YYYY-MM-DD (already ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  // YYYYMMDD compact
  if (/^\d{8}$/.test(s)) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
  return undefined;
}

// ─── Accounts Router ──────────────────────────────────────────────────────────
const accountsRouter = router({
  list: publicProcedure.query(() => getAllAccounts()),

  getBalance: publicProcedure
    .input(z.object({ accountId: z.number(), fiscalYear: z.number().optional() }))
    .query(({ input }) => getAccountBalance(input.accountId, input.fiscalYear)),

  getLedger: publicProcedure
    .input(z.object({ accountId: z.number(), fiscalYear: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { account: null, lines: [], openingBalance: 0 };

      const [account] = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
      if (!account) return { account: null, lines: [], openingBalance: 0 };

      let openingBalance = 0;
      if (input.fiscalYear) {
        const ob = await db.select().from(openingBalances)
          .where(and(eq(openingBalances.accountId, input.accountId), eq(openingBalances.fiscalYear, input.fiscalYear)))
          .limit(1);
        if (ob[0]) openingBalance = parseFloat(ob[0].balance as string);
      }

      const lines = await db.select({
        line: journalLines,
        entry: journalEntries,
      }).from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalLines.accountId, input.accountId),
          eq(journalEntries.status, "approved"),
          input.fiscalYear ? eq(journalEntries.fiscalYear, input.fiscalYear) : sql`1=1`
        ))
        .orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));

      return { account, lines, openingBalance };
    }),
});

// ─── Journal Router ───────────────────────────────────────────────────────────
const journalRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      source: z.string().optional(),
      fiscalYear: z.number().optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(({ input }) => getJournalEntries(input)),

  getWithLines: publicProcedure
    .input(z.object({ entryId: z.number() }))
    .query(({ input }) => getJournalEntryWithLines(input.entryId)),

  create: protectedProcedure
    .input(z.object({
      bookingDate: z.string(),
      valueDate: z.string().optional(),
      description: z.string().min(1),
      source: z.enum(["manual", "bank_import", "credit_card", "payroll", "vat", "system"]).default("manual"),
      fiscalYear: z.number().optional(),
      lines: z.array(z.object({
        accountId: z.number(),
        side: z.enum(["debit", "credit"]),
        amount: z.string(),
        description: z.string().optional(),
        vatAmount: z.string().optional(),
        vatRate: z.string().optional(),
      })).min(2),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const year = input.fiscalYear ?? new Date(input.bookingDate).getFullYear();
      const entryId = await createJournalEntry({
        bookingDate: toDateStr(input.bookingDate) as string,
        valueDate: toDateStr(input.valueDate),
        description: input.description,
        source: input.source,
        fiscalYear: year,
        status: "pending",
        lines: input.lines,
      });
      return { entryId };
    }),

  approve: protectedProcedure
    .input(z.object({
      entryId: z.number(),
      lines: z.array(z.object({
        accountId: z.number(),
        side: z.enum(["debit", "credit"]),
        amount: z.string(),
        description: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (input.lines) {
        await updateJournalEntryLines(input.entryId, input.lines);
      }
      await approveJournalEntry(input.entryId, ctx.user.id);
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ entryId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      await rejectJournalEntry(input.entryId);
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      entryId: z.number(),
      description: z.string().optional(),
      bookingDate: z.string().optional(),
      lines: z.array(z.object({
        accountId: z.number(),
        side: z.enum(["debit", "credit"]),
        amount: z.string(),
        description: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updateData: Record<string, unknown> = {};
      if (input.description) updateData.description = input.description;
      if (input.bookingDate) updateData.bookingDate = toDateStr(input.bookingDate);
      if (Object.keys(updateData).length > 0) {
        await db.update(journalEntries).set(updateData).where(eq(journalEntries.id, input.entryId));
      }
      if (input.lines) await updateJournalEntryLines(input.entryId, input.lines);
      return { success: true };
    }),
});

// ─── Bank Import Router ───────────────────────────────────────────────────────
const bankImportRouter = router({
  getBankAccounts: publicProcedure.query(() => getBankAccounts()),

  getPendingTransactions: publicProcedure
    .input(z.object({ bankAccountId: z.number().optional() }))
    .query(({ input }) => getPendingBankTransactions(input.bankAccountId)),

  importTransactions: protectedProcedure
    .input(z.object({
      bankAccountId: z.number(),
      transactions: z.array(z.object({
        transactionDate: z.string(),
        valueDate: z.string().nullable().optional(),
        amount: z.string(),
        currency: z.string().default("CHF"),
        description: z.string(),
        reference: z.string().nullable().optional(),
        counterparty: z.string().nullable().optional(),
        counterpartyIban: z.string().nullable().optional(),
      })),
      importBatchId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const batchId = input.importBatchId ?? `import-${Date.now()}`;
      let imported = 0, duplicates = 0, skipped = 0;
      for (const tx of input.transactions) {
        // Validate date before insert – skip rows with invalid dates
        const transactionDate = normaliseDate(tx.transactionDate);
        if (!transactionDate) { skipped++; continue; }
        const valueDate = tx.valueDate ? (normaliseDate(tx.valueDate) ?? undefined) : undefined;
        const hash = crypto.createHash("sha256")
          .update(`${input.bankAccountId}-${transactionDate}-${tx.amount}-${tx.description}`)
          .digest("hex");
        const saved = await saveBankTransaction({
          bankAccountId: input.bankAccountId,
          transactionDate,
          valueDate,
          amount: tx.amount,
          currency: tx.currency,
          description: tx.description,
          reference: tx.reference ?? undefined,
          counterparty: tx.counterparty ?? undefined,
          counterpartyIban: tx.counterpartyIban ?? undefined,
          importBatchId: batchId,
          status: "pending",
          txHash: hash,
        });

        if (saved) imported++;
        else duplicates++;
      }

      return { imported, duplicates, skipped, batchId };
    }),

  categorizeWithAI: protectedProcedure
    .input(z.object({ transactionIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const allAccounts = await getAllAccounts();
      const accountList = allAccounts.map(a => `${a.number}: ${a.name} (${a.accountType})`).join("\n");

      const transactions = await db.select().from(bankTransactions)
        .where(inArray(bankTransactions.id, input.transactionIds));

      const results = [];
      for (const tx of transactions) {
        try {
          const prompt = `Du bist ein Schweizer Buchhalter für die WM Weibel Mueller AG (Finanzberatung, Luzern).
Analysiere diese Banktransaktion und schlage die passenden Buchungskonten vor.

Transaktion:
- Datum: ${tx.transactionDate}
- Betrag: CHF ${tx.amount} (positiv = Eingang, negativ = Ausgang)
- Beschreibung: ${tx.description}
- Gegenpartei: ${tx.counterparty ?? "unbekannt"}

Kontenplan (Auszug):
${accountList}

Antworte NUR mit JSON:
{
  "debitAccountNumber": "XXXX",
  "creditAccountNumber": "XXXX", 
  "confidence": 0-100,
  "reasoning": "kurze Begründung auf Deutsch"
}

Regeln:
- Eingang (positiv): Kreditkonto = Ertragskonto (6xxx) oder Aktivkonto, Debitkonto = Bankkonto (1031/1032/1033)
- Ausgang (negativ): Debitkonto = Aufwandskonto (3xxx-4xxx), Kreditkonto = Bankkonto
- Lohn: Debit 4000/4001, Credit 1031/1032/1033
- Miete: Debit 4100, Credit 1031
- Zinsen: Debit 4220, Credit 1031`;

          const response = await invokeLLM({
            messages: [{ role: "user", content: prompt }],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "booking_suggestion",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    debitAccountNumber: { type: "string" },
                    creditAccountNumber: { type: "string" },
                    confidence: { type: "integer" },
                    reasoning: { type: "string" },
                  },
                  required: ["debitAccountNumber", "creditAccountNumber", "confidence", "reasoning"],
                  additionalProperties: false,
                },
              },
            },
          });

          const rawContent = response.choices[0]?.message?.content;
          const content = typeof rawContent === 'string' ? rawContent : null;
          if (content) {
            const suggestion = JSON.parse(content);
            const debitAccount = allAccounts.find(a => a.number === suggestion.debitAccountNumber);
            const creditAccount = allAccounts.find(a => a.number === suggestion.creditAccountNumber);

            if (debitAccount && creditAccount) {
              await db.update(bankTransactions).set({
                suggestedDebitAccountId: debitAccount.id,
                suggestedCreditAccountId: creditAccount.id,
                aiConfidence: suggestion.confidence,
                aiReasoning: suggestion.reasoning,
              }).where(eq(bankTransactions.id, tx.id));

              results.push({ txId: tx.id, success: true, confidence: suggestion.confidence });
            }
          }
        } catch (e) {
          console.error(`AI categorization failed for tx ${tx.id}:`, e);
          results.push({ txId: tx.id, success: false });
        }
      }

      return { results };
    }),

  approveTransaction: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
      debitAccountId: z.number(),
      creditAccountId: z.number(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [tx] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, input.transactionId)).limit(1);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });

      const amount = Math.abs(parseFloat(tx.amount as string));
      const year = new Date(tx.transactionDate as any).getFullYear();

      const entryId = await createJournalEntry({
        bookingDate: toDateStr(tx.transactionDate as string) as string,
        valueDate: toDateStr(tx.valueDate as string),
        description: input.description ?? tx.description ?? "Bankbuchung",
        source: "bank_import",
        sourceRef: `bank-tx-${tx.id}`,
        fiscalYear: year,
        status: "approved",
        lines: [
          { accountId: input.debitAccountId, side: "debit", amount: amount.toFixed(2) },
          { accountId: input.creditAccountId, side: "credit", amount: amount.toFixed(2) },
        ],
      });

      await approveBankTransaction(input.transactionId, entryId);
      await approveJournalEntry(entryId, ctx.user.id);

      // ── Learn booking rule from this approval ──
      if (tx.counterparty) {
        try {
          // Extract a clean counterparty pattern (first significant word(s))
          const cpClean = tx.counterparty.trim();
          // Use the booking text as template if user provided a custom description
          const bookingText = input.description ?? tx.description ?? undefined;
          await upsertBookingRule({
            counterpartyPattern: cpClean,
            bookingTextTemplate: bookingText,
            debitAccountId: input.debitAccountId,
            creditAccountId: input.creditAccountId,
          });
        } catch (e) {
          console.error("Failed to learn booking rule:", e);
        }
      }

      return { success: true, entryId };
    }),

  ignoreTransaction: protectedProcedure
    .input(z.object({ transactionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(bankTransactions).set({ status: "ignored" }).where(eq(bankTransactions.id, input.transactionId));
      return { success: true };
    }),

  updateTransaction: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
      description: z.string().optional(),
      counterparty: z.string().optional(),
      counterpartyIban: z.string().optional(),
      reference: z.string().optional(),
      suggestedDebitAccountId: z.number().nullable().optional(),
      suggestedCreditAccountId: z.number().nullable().optional(),
      aiReasoning: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { transactionId, ...data } = input;
      await updateBankTransaction(transactionId, data);
      return { success: true };
    }),

  bulkApprove: protectedProcedure
    .input(z.object({
      transactions: z.array(z.object({
        transactionId: z.number(),
        debitAccountId: z.number(),
        creditAccountId: z.number(),
        description: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const results = [];
      for (const item of input.transactions) {
        try {
          const [tx] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, item.transactionId)).limit(1);
          if (!tx || tx.status !== "pending") { results.push({ txId: item.transactionId, success: false, error: "Nicht ausstehend" }); continue; }

          const amount = Math.abs(parseFloat(tx.amount as string));
          const dateStr = toDateStr(tx.transactionDate as string);
          const year = dateStr ? parseInt(dateStr.substring(0, 4)) : new Date().getFullYear();

          const entryId = await createJournalEntry({
            bookingDate: dateStr as string,
            valueDate: toDateStr(tx.valueDate as string),
            description: item.description ?? tx.description ?? "Bankbuchung",
            source: "bank_import",
            sourceRef: `bank-tx-${tx.id}`,
            fiscalYear: year,
            status: "approved",
            lines: [
              { accountId: item.debitAccountId, side: "debit", amount: amount.toFixed(2) },
              { accountId: item.creditAccountId, side: "credit", amount: amount.toFixed(2) },
            ],
          });

          await approveBankTransaction(item.transactionId, entryId);
          await approveJournalEntry(entryId, ctx.user.id);
          results.push({ txId: item.transactionId, success: true, entryId });

          // ── Learn booking rule from this approval ──
          if (tx.counterparty) {
            try {
              await upsertBookingRule({
                counterpartyPattern: tx.counterparty.trim(),
                bookingTextTemplate: item.description ?? tx.description ?? undefined,
                debitAccountId: item.debitAccountId,
                creditAccountId: item.creditAccountId,
              });
            } catch (e) {
              console.error("Failed to learn booking rule:", e);
            }
          }
        } catch (e: any) {
          results.push({ txId: item.transactionId, success: false, error: e.message });
        }
      }
      return { results, approved: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length };
    }),

  generateBookingText: protectedProcedure
    .input(z.object({ transactionIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const txs = await getBankTransactionsByIds(input.transactionIds);
      if (!txs.length) return { results: [] };

      const results = [];
      for (const tx of txs) {
        try {
          const dateStr = tx.transactionDate as string;
          const d = new Date(dateStr);
          const monthNames = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
          const month = monthNames[d.getMonth()] ?? "";
          const year = d.getFullYear();
          const quarter = `${Math.ceil((d.getMonth() + 1) / 3)}. Quartal`;

          const response = await invokeLLM({
            messages: [{
              role: "user",
              content: `Du bist Buchhalter der WM Weibel Mueller AG (Finanzberatung, Luzern).
Erstelle einen kurzen, präzisen Buchungstext für diese Banktransaktion.

Transaktion:
- Datum: ${dateStr}
- Betrag: CHF ${tx.amount}
- Beschreibung: ${tx.description}
- Gegenpartei: ${tx.counterparty ?? "unbekannt"}
- IBAN: ${tx.counterpartyIban ?? "unbekannt"}

Regeln:
- Maximal 60 Zeichen
- Lieferantenname + Zeitraum (Monat oder Quartal + Jahr)
- Beispiele: "Sunrise 1. Quartal 2026", "SBB GA Januar 2026", "Miete Büro April 2026", "Lohn mw März 2026"
- Aktueller Monat: ${month} ${year}, Quartal: ${quarter} ${year}
- Bei Lohnzahlungen: "Lohn [Kürzel] [Monat] [Jahr]"
- Bei Daueraufträgen/Abos: Lieferant + Periode
- Kein "CHF", keine Beträge im Text

Antworte NUR mit dem Buchungstext, nichts anderes.`
            }],
          });

          const rawContent = response.choices[0]?.message?.content;
          const bookingText = (typeof rawContent === "string" ? rawContent : "").trim().replace(/^"|"$/g, "");
          if (bookingText) {
            await updateBankTransaction(tx.id, { description: bookingText });
            results.push({ txId: tx.id, success: true, bookingText });
          } else {
            results.push({ txId: tx.id, success: false });
          }
        } catch (e) {
          results.push({ txId: tx.id, success: false });
        }
      }
      return { results };
    }),

  // ── Refresh: Apply learned rules to all pending transactions ──
  refreshSuggestions: protectedProcedure
    .input(z.object({ bankAccountId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rules = await getAllBookingRules();
      if (!rules.length) return { updated: 0, total: 0, message: "Keine gelernten Regeln vorhanden. Verbuchen Sie zuerst einige Transaktionen manuell." };

      // Get all pending transactions
      const conditions = [eq(bankTransactions.status, "pending" as const)];
      if (input.bankAccountId) {
        conditions.push(eq(bankTransactions.bankAccountId, input.bankAccountId));
      }
      const pending = await db.select().from(bankTransactions)
        .where(and(...conditions))
        .orderBy(asc(bankTransactions.transactionDate));

      const allAccounts = await getAllAccounts();
      let updated = 0;

      for (const tx of pending) {
        const cpName = (tx.counterparty ?? "").toLowerCase();
        if (!cpName) continue;

        // Find best matching rule
        let matchedRule = null;
        for (const rule of rules) {
          if (cpName.includes(rule.counterpartyPattern.toLowerCase())) {
            matchedRule = rule;
            break; // Rules are already sorted by priority desc
          }
        }

        if (!matchedRule) continue;

        // Build update payload
        const updateData: Record<string, any> = {};
        let changed = false;

        // Apply account suggestions
        if (matchedRule.debitAccountId) {
          updateData.suggestedDebitAccountId = matchedRule.debitAccountId;
          changed = true;
        }
        if (matchedRule.creditAccountId) {
          updateData.suggestedCreditAccountId = matchedRule.creditAccountId;
          changed = true;
        }

        // Apply booking text template with date substitution
        if (matchedRule.bookingTextTemplate) {
          const dateStr = tx.transactionDate as string;
          const d = new Date(dateStr);
          const monthNames = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
          const month = monthNames[d.getMonth()] ?? "";
          const year = d.getFullYear();
          const quarter = `${Math.ceil((d.getMonth() + 1) / 3)}. Quartal`;

          // Replace date placeholders in template
          let text = matchedRule.bookingTextTemplate;
          // Detect month/year patterns and replace with transaction's month/year
          // e.g., "SBB GA Februar 2026" → "SBB GA März 2026" for a March transaction
          text = text.replace(/(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/g, `${month} ${year}`);
          // Also handle quarter patterns
          text = text.replace(/\d+\.\s*Quartal\s+\d{4}/g, `${quarter} ${year}`);

          updateData.description = text;
          changed = true;
        }

        // Set AI reasoning to indicate rule-based
        if (changed) {
          updateData.aiReasoning = `Gelernte Regel: ${matchedRule.counterpartyPattern} (${matchedRule.usageCount}x verwendet)`;
          updateData.aiConfidence = 98; // High confidence for learned rules
          await db.update(bankTransactions).set(updateData).where(eq(bankTransactions.id, tx.id));
          await incrementRuleUsage(matchedRule.id);
          updated++;
        }
      }

      return { updated, total: pending.length, message: `${updated} von ${pending.length} Transaktionen mit gelernten Regeln aktualisiert.` };
    }),

  // ── List all learned booking rules ──
  listRules: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const rules = await getAllBookingRules();
      const allAccounts = await getAllAccounts();
      return rules.map(r => ({
        ...r,
        debitAccountName: allAccounts.find(a => a.id === r.debitAccountId)?.name,
        debitAccountNumber: allAccounts.find(a => a.id === r.debitAccountId)?.number,
        creditAccountName: allAccounts.find(a => a.id === r.creditAccountId)?.name,
        creditAccountNumber: allAccounts.find(a => a.id === r.creditAccountId)?.number,
      }));
    }),
});

// ─── Credit Card Router ───────────────────────────────────────────────────────
const creditCardRouter = router({
  list: publicProcedure.query(() => getCreditCardStatements()),

  uploadStatement: protectedProcedure
    .input(z.object({
      statementDate: z.string(),
      totalAmount: z.string(),
      rawText: z.string(),
      parsedItems: z.array(z.object({
        date: z.string(),
        description: z.string(),
        amount: z.string(),
        category: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(creditCardStatements).values({
        statementDate: toDateStr(input.statementDate) as string,
        totalAmount: input.totalAmount,
        owner: "mw",
        status: "pending",
        rawText: input.rawText,
        parsedItems: input.parsedItems,
      });

      return { statementId: (result as any).insertId };
    }),

  approveStatement: protectedProcedure
    .input(z.object({
      statementId: z.number(),
      debitAccountId: z.number(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [stmt] = await db.select().from(creditCardStatements).where(eq(creditCardStatements.id, input.statementId)).limit(1);
      if (!stmt) throw new TRPCError({ code: "NOT_FOUND" });

      const visaAccount = await getAccountByNumber("1082");
      if (!visaAccount) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Konto 1082 nicht gefunden" });

      const amount = Math.abs(parseFloat(stmt.totalAmount as string));
      const year = new Date(stmt.statementDate as any).getFullYear();

      const entryId = await createJournalEntry({
        bookingDate: toDateStr(stmt.statementDate as string) as string,
        description: input.description ?? `VISA Sammelbelastung ${stmt.statementDate}`,
        source: "credit_card",
        sourceRef: `cc-stmt-${stmt.id}`,
        fiscalYear: year,
        status: "approved",
        lines: [
          { accountId: input.debitAccountId, side: "debit", amount: amount.toFixed(2), description: "Kreditkartenaufwand" },
          { accountId: visaAccount.id, side: "credit", amount: amount.toFixed(2), description: "Durchlaufkonto VISA mw" },
        ],
      });

      await db.update(creditCardStatements).set({ status: "approved", journalEntryId: entryId }).where(eq(creditCardStatements.id, input.statementId));
      await approveJournalEntry(entryId, ctx.user.id);

      return { success: true, entryId };
    }),

  // Dedicated credit card PDF parsing via LLM
  parsePdf: protectedProcedure
    .input(z.object({ documentUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Load all booking rules and accounts for context
      const allRules = await getAllBookingRules();
      const allAccts = await getAllAccounts();

      // Build account lookup map
      const acctMap: Record<number, { number: string; name: string }> = {};
      allAccts.forEach(a => { acctMap[a.id] = { number: a.number, name: a.name }; });

      // Build learned rules context for the LLM
      const rulesContext = allRules
        .filter(r => r.debitAccountId)
        .map(r => {
          const acct = acctMap[r.debitAccountId!];
          return acct ? `${r.counterpartyPattern} → ${acct.number} ${acct.name}` : null;
        })
        .filter(Boolean)
        .join("\n");

      // Build full account list (only expense/asset accounts relevant for CC)
      const accountList = allAccts
        .filter(a => a.number.startsWith("4") || a.number.startsWith("1"))
        .map(a => `${a.number} ${a.name}`)
        .join("\n");

      const prompt = `Du bist Buchhalter der WM Weibel Mueller AG in der Schweiz.
Analysiere diese Kreditkartenabrechnung (VISA Cornèr Banca SA) und extrahiere ALLE Einzelpositionen/Transaktionen.

WICHTIG:
- Jede Zeile in der Abrechnung ist eine separate Transaktion
- Extrahiere ALLE Transaktionen, überspringe keine
- Das Datum steht links (Format DD.MM.YYYY), dann der Beschreibungstext, dann der Betrag rechts
- Beträge sind in CHF, verwende den Absolutwert (ohne Minus)
- Ignoriere Zeilen wie "Saldo Vormonat", "Zahlung", "Neuer Saldo", "Total" – nur echte Einkäufe/Transaktionen
- Die Beschreibung soll den Vendor/Händler-Namen enthalten, NICHT die ganze Zeile kopieren

GELERNTE KONTENZUORDNUNGEN (verwende diese als Priorität!):
${rulesContext}

VOLLSTÄNDIGER KONTENPLAN (falls kein gelernter Match):
${accountList}

FALLBACK-REGELN:
- Software/SaaS/Cloud → 4305 Software & ITBeratung mw
- Restaurant/Essen auswärts (geschäftlich) → 4891 Repräsentationsspesen mw
- Restaurant/Essen (privat) → 1081 Kontokorrent mw
- Reisen/Transport/SBB/Taxi/Uber/Parkhaus → 4821 Reisespesen mw
- Bücher/Zeitungen/Medien → 4711 Fachliteratur mw
- Lebensmittel/Migros/Coop/Aldi → 4792 Übriger Betriebs- und Verwaltungsaufwand jm
- Kleidung/Shopping (privat) → 1081 Kontokorrent mw
- Bankgebühren/Kartengebühren → 4222 Bankspesen mw
- Zinsen → 4220 Zinsen
- Unbekannt → 4799 Diverser Aufwand

Antwort NUR als JSON-Array, keine Erklärung:
[{"date": "YYYY-MM-DD", "description": "Vendor/Händler Kurzbeschreibung", "amount": "123.45", "suggestedAccount": "4xxx Kontoname"}]`;

      const response = await invokeLLM({
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "file_url", file_url: { url: input.documentUrl, mime_type: "application/pdf" } },
          ],
        }],
      });

      const rawContent = response.choices[0]?.message?.content;
      let text = typeof rawContent === "string" ? rawContent : "";
      // Strip markdown code fences if present
      text = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
      // Extract JSON from response
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "KI konnte keine Positionen extrahieren" });

      try {
        const items = JSON.parse(jsonMatch[0]);
        return { items: items.map((i: any) => ({
          date: i.date ?? "",
          description: i.description ?? "",
          amount: String(Math.abs(parseFloat(i.amount ?? "0"))),
          suggestedAccount: i.suggestedAccount ?? "",
        })) };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "JSON-Parsing fehlgeschlagen" });
      }
    }),

  // Approve with individual items (Sammelbuchung with per-position accounts)
  approveWithItems: protectedProcedure
    .input(z.object({
      bankTransactionId: z.number().optional(),
      statementDate: z.string(),
      counterparty: z.string(),
      items: z.array(z.object({
        date: z.string(),
        description: z.string(),
        amount: z.string(),
        debitAccountId: z.number(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const visaAccount = await getAccountByNumber("1082");
      if (!visaAccount) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Konto 1082 nicht gefunden" });

      const totalAmount = input.items.reduce((s, i) => s + Math.abs(parseFloat(i.amount)), 0);
      const dateStr = toDateStr(input.statementDate) ?? new Date().toISOString().split("T")[0];
      const year = parseInt(dateStr.substring(0, 4));

      // Build journal lines: one debit per item + one credit total for 1082
      const debitLines = input.items.map(item => ({
        accountId: item.debitAccountId,
        side: "debit" as const,
        amount: Math.abs(parseFloat(item.amount)).toFixed(2),
        description: item.description,
      }));

      const creditLine = {
        accountId: visaAccount.id,
        side: "credit" as const,
        amount: totalAmount.toFixed(2),
        description: `Durchlaufkonto VISA mw – ${input.counterparty}`,
      };

      const entryId = await createJournalEntry({
        bookingDate: dateStr,
        description: `VISA Sammelbuchung ${input.counterparty} ${dateStr}`,
        source: "credit_card",
        sourceRef: `cc-items-${Date.now()}`,
        fiscalYear: year,
        status: "approved",
        lines: [...debitLines, creditLine],
      });

      await approveJournalEntry(entryId, ctx.user.id);

      // Mark bank transaction as matched if provided
      if (input.bankTransactionId) {
        await approveBankTransaction(input.bankTransactionId, entryId);
      }

      // Save as credit card statement
      await db.insert(creditCardStatements).values({
        statementDate: dateStr,
        totalAmount: totalAmount.toFixed(2),
        owner: "mw",
        status: "approved",
        journalEntryId: entryId,
        rawText: input.items.map(i => `${i.date} ${i.description} ${i.amount}`).join("\n"),
        parsedItems: input.items,
      });

      return { success: true, entryId, totalAmount: totalAmount.toFixed(2), itemCount: input.items.length };
    }),
});

// ─── Payroll Router ───────────────────────────────────────────────────────────
const payrollRouter = router({
  getEmployees: publicProcedure.query(() => getEmployees()),

  list: publicProcedure
    .input(z.object({ year: z.number().optional(), employeeId: z.number().optional() }))
    .query(({ input }) => getPayrollEntries(input.year, input.employeeId)),

  create: protectedProcedure
    .input(z.object({
      employeeId: z.number(),
      year: z.number(),
      month: z.number().min(1).max(12),
      grossSalary: z.string(),
      ahvEmployee: z.string().default("0"),
      ahvEmployer: z.string().default("0"),
      bvgEmployee: z.string().default("0"),
      bvgEmployer: z.string().default("0"),
      ktgUvgEmployee: z.string().default("0"),
      ktgUvgEmployer: z.string().default("0"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const gross = parseFloat(input.grossSalary);
      const ahvEmp = parseFloat(input.ahvEmployee);
      const bvgEmp = parseFloat(input.bvgEmployee);
      const ktgEmp = parseFloat(input.ktgUvgEmployee);
      const netSalary = gross - ahvEmp - bvgEmp - ktgEmp;
      const ahvEmpr = parseFloat(input.ahvEmployer);
      const bvgEmpr = parseFloat(input.bvgEmployer);
      const ktgEmpr = parseFloat(input.ktgUvgEmployer);
      const totalEmployerCost = gross + ahvEmpr + bvgEmpr + ktgEmpr;

      const [result] = await db.insert(payrollEntries).values({
        employeeId: input.employeeId,
        year: input.year,
        month: input.month,
        grossSalary: input.grossSalary,
        ahvEmployee: input.ahvEmployee,
        ahvEmployer: input.ahvEmployer,
        bvgEmployee: input.bvgEmployee,
        bvgEmployer: input.bvgEmployer,
        ktgUvgEmployee: input.ktgUvgEmployee,
        ktgUvgEmployer: input.ktgUvgEmployer,
        netSalary: netSalary.toFixed(2),
        totalEmployerCost: totalEmployerCost.toFixed(2),
        status: "draft",
        notes: input.notes,
      });

      return { payrollId: (result as any).insertId };
    }),

  approve: protectedProcedure
    .input(z.object({ payrollId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [payroll] = await db.select({
        payroll: payrollEntries,
        employee: employees,
      }).from(payrollEntries)
        .innerJoin(employees, eq(payrollEntries.employeeId, employees.id))
        .where(eq(payrollEntries.id, input.payrollId)).limit(1);

      if (!payroll) throw new TRPCError({ code: "NOT_FOUND" });

      const { payroll: p, employee: emp } = payroll;
      const gross = parseFloat(p.grossSalary as string);
      const net = parseFloat(p.netSalary as string);
      const ahvTotal = parseFloat(p.ahvEmployee as string) + parseFloat(p.ahvEmployer as string);
      const bvgTotal = parseFloat(p.bvgEmployee as string) + parseFloat(p.bvgEmployer as string);
      const ktgTotal = parseFloat(p.ktgUvgEmployee as string) + parseFloat(p.ktgUvgEmployer as string);

      // Get accounts
      const grossAccNum = emp.code === "mw" ? "4000" : "4001";
      const grossAcc = await getAccountByNumber(grossAccNum);
      const ahvAcc = await getAccountByNumber("4010");
      const bvgAcc = await getAccountByNumber("4040");
      const ktgAcc = await getAccountByNumber("4025");
      const bankAcc = await getAccountByNumber("1031"); // LUKB Kontokorrent
      const kkAcc = emp.code === "mw"
        ? await getAccountByNumber("1081")
        : await getAccountByNumber("1071");

      if (!grossAcc || !ahvAcc || !bvgAcc || !ktgAcc || !bankAcc) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Lohnkonten nicht gefunden" });
      }

      const monthName = new Date(p.year, p.month - 1).toLocaleString("de-CH", { month: "long" });
      const lines = [];

      // Bruttolohn
      lines.push({ accountId: grossAcc.id, side: "debit" as const, amount: gross.toFixed(2), description: `Bruttolohn ${emp.code} ${monthName} ${p.year}` });

      // AHV Arbeitgeberanteil
      if (ahvTotal > 0) lines.push({ accountId: ahvAcc.id, side: "debit" as const, amount: ahvTotal.toFixed(2), description: `AHV ${emp.code}` });

      // BVG Arbeitgeberanteil
      if (bvgTotal > 0) lines.push({ accountId: bvgAcc.id, side: "debit" as const, amount: bvgTotal.toFixed(2), description: `BVG ${emp.code}` });

      // KTG/UVG Arbeitgeberanteil
      if (ktgTotal > 0) lines.push({ accountId: ktgAcc.id, side: "debit" as const, amount: ktgTotal.toFixed(2), description: `KTG/UVG ${emp.code}` });

      // Nettolohn an Kontokorrent oder Bank
      const totalDebit = gross + (ahvTotal > 0 ? ahvTotal : 0) + (bvgTotal > 0 ? bvgTotal : 0) + (ktgTotal > 0 ? ktgTotal : 0);
      const creditAcc = kkAcc ?? bankAcc;
      lines.push({ accountId: creditAcc.id, side: "credit" as const, amount: totalDebit.toFixed(2), description: `Nettolohn ${emp.code}` });

      const entryId = await createJournalEntry({
        bookingDate: `${p.year}-${String(p.month).padStart(2,"0")}-25`,
        description: `Lohn ${emp.code} ${monthName} ${p.year}`,
        source: "payroll",
        sourceRef: `payroll-${p.id}`,
        fiscalYear: p.year,
        status: "approved",
        lines,
      });

      await db.update(payrollEntries).set({ status: "approved", journalEntryId: entryId }).where(eq(payrollEntries.id, input.payrollId));
      await approveJournalEntry(entryId, ctx.user.id);

      return { success: true, entryId };
    }),
});

// ─── Reports Router ───────────────────────────────────────────────────────────
const reportsRouter = router({
  balanceSheet: publicProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input }) => getBalanceSheet(input.fiscalYear)),

  incomeStatement: publicProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input }) => getIncomeStatement(input.fiscalYear)),

  dashboard: publicProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input }) => getDashboardStats(input.fiscalYear)),
});

// ─── VAT Router ───────────────────────────────────────────────────────────────
const vatRouter = router({
  list: publicProcedure
    .input(z.object({ year: z.number().optional() }))
    .query(({ input }) => getVatPeriods(input.year)),

  create: protectedProcedure
    .input(z.object({
      year: z.number(),
      period: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(vatPeriods).values({
        year: input.year,
        period: input.period,
        startDate: toDateStr(input.startDate) as string,
        endDate: toDateStr(input.endDate) as string,
      });
      return { periodId: (result as any).insertId };
    }),
});

// ─── Documents Router ─────────────────────────────────────────────────────────
const documentsRouter = router({
  list: protectedProcedure
    .input(z.object({
      journalEntryId: z.number().optional(),
      bankTransactionId: z.number().optional(),
      documentType: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { and, eq: eqOp, desc: descOp } = await import("drizzle-orm");
      const conditions = [];
      if (input.journalEntryId) conditions.push(eqOp(docs.journalEntryId, input.journalEntryId));
      if (input.bankTransactionId) conditions.push(eqOp(docs.bankTransactionId, input.bankTransactionId));
      if (input.documentType) conditions.push(eqOp(docs.documentType, input.documentType as any));
      const rows = await db.select().from(docs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(descOp(docs.createdAt))
        .limit(input.limit);
      return rows;
    }),

  getAiMetadata: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      const [doc] = await db.select().from(docs).where(eqOp(docs.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      let metadata = null;
      if (doc.aiMetadata) {
        try { metadata = JSON.parse(doc.aiMetadata); } catch { /* ignore */ }
      }
      return { document: doc, metadata };
    }),

  linkToEntry: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      journalEntryId: z.number().optional(),
      bankTransactionId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      await db.update(docs).set({
        journalEntryId: input.journalEntryId,
        bankTransactionId: input.bankTransactionId,
      }).where(eqOp(docs.id, input.documentId));
      return { success: true };
    }),

  // Auto-match unmatched documents with pending bank transactions
  autoMatch: protectedProcedure
    .input(z.object({ threshold: z.number().default(50) }))
    .mutation(async ({ input }) => {
      const matches = await autoMatchDocuments(input.threshold);
      const applied = await applyMatches(matches);
      return { matched: applied, total: matches.length, details: matches };
    }),

  // Unmatch a document from a transaction
  unmatch: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      await unmatchDocument(input.documentId);
      return { success: true };
    }),

  // Get match info for a bank transaction (document details + improved suggestion)
  getMatchInfo: protectedProcedure
    .input(z.object({ transactionId: z.number() }))
    .query(async ({ input }) => {
      const doc = await getMatchedDocument(input.transactionId);
      if (!doc) return { matched: false, document: null, improvements: null };
      let metadata = null;
      if (doc.aiMetadata) {
        try { metadata = JSON.parse(doc.aiMetadata); } catch { /* ignore */ }
      }
      const improvements = improveBookingSuggestionFromDocument(metadata, {});
      return { matched: true, document: doc, metadata, improvements };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  accounts: accountsRouter,
  journal: journalRouter,
  bankImport: bankImportRouter,
  creditCard: creditCardRouter,
  payroll: payrollRouter,
  reports: reportsRouter,
  vat: vatRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;

