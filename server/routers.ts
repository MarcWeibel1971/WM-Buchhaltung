import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, orgProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import {
  getAllAccounts, getAccountByNumber, getAccountBalance,
  getJournalEntries, getJournalEntryWithLines, createJournalEntry,
  approveJournalEntry, rejectJournalEntry, updateJournalEntryLines,
  getBankAccounts, getPendingBankTransactions, getBankTransactionsByStatus, saveBankTransaction, approveBankTransaction, updateBankTransaction, getBankTransactionsByIds,
  getEmployees, getPayrollEntries,
  getBalanceSheet, getIncomeStatement,
  getVatPeriods, getCreditCardStatements, getDashboardStats,
  getDb,
  findMatchingRule, getAllBookingRules, upsertBookingRule, incrementRuleUsage,
  autoMatchDocuments, applyMatches, getMatchedDocument, improveBookingSuggestionFromDocument, unmatchDocument, calculateMatchScore,
  deleteJournalEntry, revertBankTransaction, deleteCcStatement, revertCcStatement,
} from "./db";
import { bankTransactions, journalEntries, journalLines, payrollEntries, vatPeriods, creditCardStatements, employees, accounts, openingBalances, bookingRules, bankAccounts, insuranceSettings, importHistory, companySettings, documents, avatarSettings, importAutomationSettings } from "../drizzle/schema";
import { settingsRouter } from "./settingsRouter";
import { globalRulesRouter } from "./globalRulesRouter";
import { yearEndRouter } from "./yearEndRouter";
import { qrBillRouter } from "./qrBillRouter";
import { dsgRouter } from "./dsgRouter";
import { suppliersRouter } from "./suppliersRouter";
import { timeTrackingRouter } from "./timeTrackingRouter";
import { customersRouter } from "./customersRouter";
import { organizationsRouter } from "./organizationsRouter";
import { authRouter } from "./authRouter";
import { invoicesRouter } from "./invoicesRouter";
import { remindersRouter } from "./remindersRouter";
import { stripeRouter } from "./stripeRouter";
import { searchCompanies } from "./uidSearch";
import { eq, and, desc, asc, sql, inArray, like, gte, lte } from "drizzle-orm";
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
  list: orgProcedure.query(({ ctx }) => getAllAccounts(ctx.organizationId)),

  getBalance: orgProcedure
    .input(z.object({ accountId: z.number(), fiscalYear: z.number().optional() }))
    .query(({ input, ctx }) => getAccountBalance(ctx.organizationId, input.accountId, input.fiscalYear)),

  getLedger: orgProcedure
    .input(z.object({ accountId: z.number(), fiscalYear: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { account: null, lines: [], openingBalance: 0 };

      const [account] = await db.select().from(accounts)
        .where(and(
          eq(accounts.organizationId, ctx.organizationId),
          eq(accounts.id, input.accountId),
        ))
        .limit(1);
      if (!account) return { account: null, lines: [], openingBalance: 0 };

      let openingBalance = 0;
      if (input.fiscalYear) {
        const ob = await db.select().from(openingBalances)
          .where(and(
            eq(openingBalances.organizationId, ctx.organizationId),
            eq(openingBalances.accountId, input.accountId),
            eq(openingBalances.fiscalYear, input.fiscalYear),
          ))
          .limit(1);
        if (ob[0]) openingBalance = parseFloat(ob[0].balance as string);
      }

      const lines = await db.select({
        line: journalLines,
        entry: journalEntries,
      }).from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalEntries.organizationId, ctx.organizationId),
          eq(journalLines.accountId, input.accountId),
          eq(journalEntries.status, "approved"),
          input.fiscalYear ? eq(journalEntries.fiscalYear, input.fiscalYear) : sql`1=1`
        ))
        .orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));

      return { account, lines, openingBalance };
    }),
});

// ─── Journal Router ───────────────────────────────────────────────────────────
// Helper: Map account VAT rate to Infoniqa TaxId code
function getTaxId(acct: any, line: any): string {
  if (!acct) return '""';
  // Check if account is VAT relevant and has a default rate
  const vatRate = line?.vatRate ? parseFloat(line.vatRate as string) : (acct?.defaultVatRate ? parseFloat(acct.defaultVatRate as string) : null);
  if (!vatRate || vatRate === 0) return '""';
  if (vatRate === 8.1 || (vatRate >= 7.5 && vatRate <= 8.5)) return 'USt81';
  if (vatRate === 2.6 || (vatRate >= 2.0 && vatRate <= 3.0)) return 'USt26';
  if (vatRate === 3.8 || (vatRate >= 3.5 && vatRate <= 4.0)) return 'USt38';
  return '""';
}

const journalRouter = router({
  list: orgProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      source: z.string().optional(),
      fiscalYear: z.number().optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(({ input, ctx }) => getJournalEntries(ctx.organizationId, input)),

  getWithLines: orgProcedure
    .input(z.object({ entryId: z.number() }))
    .query(({ input, ctx }) => getJournalEntryWithLines(ctx.organizationId, input.entryId)),

  create: orgProcedure
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
        organizationId: ctx.organizationId,
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

  approve: orgProcedure
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

  reject: orgProcedure
    .input(z.object({ entryId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      await rejectJournalEntry(input.entryId);
      return { success: true };
    }),

  update: orgProcedure
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
      // GeBüV (Art. 957d OR): verbuchte Einträge sind unveränderlich.
      const [existing] = await db.select({ status: journalEntries.status })
        .from(journalEntries)
        .where(eq(journalEntries.id, input.entryId))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journal-Eintrag nicht gefunden" });
      }
      if (existing.status !== "pending") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Verbuchte Einträge sind unveränderlich (GeBüV). Erstellen Sie eine Stornobuchung.",
        });
      }
      const updateData: Record<string, unknown> = {};
      if (input.description) updateData.description = input.description;
      if (input.bookingDate) updateData.bookingDate = toDateStr(input.bookingDate);
      if (Object.keys(updateData).length > 0) {
        await db.update(journalEntries).set(updateData).where(eq(journalEntries.id, input.entryId));
      }
      if (input.lines) await updateJournalEntryLines(input.entryId, input.lines);
      return { success: true };
    }),
  // Delete a journal entry (only allowed for pending entries – GeBüV).
  // Approved entries müssen per Stornobuchung rückgängig gemacht werden.
  delete: orgProcedure
    .input(z.object({ entryId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // GeBüV (Art. 957d OR): verbuchte Einträge dürfen nicht gelöscht werden.
      const [existing] = await db.select({ status: journalEntries.status })
        .from(journalEntries)
        .where(eq(journalEntries.id, input.entryId))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Journal-Eintrag nicht gefunden" });
      }
      if (existing.status !== "pending") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Verbuchte Einträge können nicht gelöscht werden (GeBüV). Erstellen Sie eine Stornobuchung.",
        });
      }
      // Revert any linked bank transactions back to pending
      const linkedTxs = await db.select().from(bankTransactions)
        .where(eq(bankTransactions.journalEntryId, input.entryId));
      for (const tx of linkedTxs) {
        await revertBankTransaction(tx.id);
      }
      // Revert any linked CC statements back to pending
      const linkedStmts = await db.select().from(creditCardStatements)
        .where(eq(creditCardStatements.journalEntryId, input.entryId));
      for (const stmt of linkedStmts) {
        await revertCcStatement(stmt.id);
      }
      await deleteJournalEntry(input.entryId);
      return { success: true };
    }),
  // Revert an approved journal entry back to pending.
  // NOTE (Phase 1 GeBüV): Strictly speaking this violates journal-immutability
  // (Art. 957d OR). Kept as a convenience until Phase 1 introduces proper
  // Stornobuchungen. Must be removed or restricted to admin + audit-logged
  // before marketing to external customers.
  revert: orgProcedure
    .input(z.object({ entryId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(journalEntries)
        .set({ status: "pending", approvedBy: null, approvedAt: null })
        .where(eq(journalEntries.id, input.entryId));
      // Also clear journalEntryId from linked documents so they no longer show as "verbucht"
      await db.update(documents)
        .set({ journalEntryId: null, matchStatus: "unmatched" })
        .where(eq(documents.journalEntryId, input.entryId));
      return { success: true };
    }),

  // Bulk approve multiple journal entries. Uses approveJournalEntry() so that
  // each entry gets a gapless fiscal-year sequence number (GeBüV).
  bulkApprove: orgProcedure
    .input(z.object({ entryIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let approved = 0;
      let skipped = 0;
      for (const id of input.entryIds) {
        const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
        if (!entry || entry.status !== "pending") { skipped++; continue; }
        await approveJournalEntry(id, ctx.user.id);
        approved++;
      }
      return { approved, skipped };
    }),

  // Bulk delete multiple journal entries (with proper bank/CC transaction revert)
  bulkDelete: orgProcedure
    .input(z.object({ entryIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let deleted = 0;
      let skipped = 0;
      for (const id of input.entryIds) {
        try {
          // Revert linked bank transactions back to pending
          const linkedTxs = await db.select().from(bankTransactions)
            .where(eq(bankTransactions.journalEntryId, id));
          for (const tx of linkedTxs) {
            await revertBankTransaction(tx.id);
          }
          // Revert linked CC statements back to pending
          const linkedStmts = await db.select().from(creditCardStatements)
            .where(eq(creditCardStatements.journalEntryId, id));
          for (const stmt of linkedStmts) {
            await revertCcStatement(stmt.id);
          }
          await deleteJournalEntry(id);
          deleted++;
        } catch {
          skipped++;
        }
      }
      return { deleted, skipped };
    }),

  // Bulk revert multiple journal entries back to pending
  bulkRevert: orgProcedure
    .input(z.object({ entryIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let reverted = 0;
      let skipped = 0;
      for (const id of input.entryIds) {
        const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
        if (!entry || entry.status !== "approved") { skipped++; continue; }
        await db.update(journalEntries)
          .set({ status: "pending", approvedBy: null, approvedAt: null })
          .where(eq(journalEntries.id, id));
        // Also clear journalEntryId from linked documents
        await db.update(documents)
          .set({ journalEntryId: null, matchStatus: "unmatched" })
          .where(eq(documents.journalEntryId, id));
        reverted++;
      }
      return { reverted, skipped };
    }),

  // ─── Export Endpoints ─────────────────────────────────────────────────────
  exportInfoniqa: orgProcedure
    .input(z.object({
      fiscalYear: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      statusFilter: z.enum(["approved", "all"]).default("approved"),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Build conditions
      const conditions = [eq(journalEntries.fiscalYear, input.fiscalYear)];
      if (input.statusFilter === "approved") {
        conditions.push(eq(journalEntries.status, "approved"));
      }
      if (input.startDate) conditions.push(gte(journalEntries.bookingDate, input.startDate));
      if (input.endDate) conditions.push(lte(journalEntries.bookingDate, input.endDate));

      // Get all entries
      const entries = await db.select()
        .from(journalEntries)
        .where(and(...conditions))
        .orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));

      if (entries.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keine Buchungen für den Export gefunden" });
      }

      // Get all lines for these entries
      const entryIds = entries.map(e => e.id);
      const allLines = await db.select()
        .from(journalLines)
        .where(inArray(journalLines.entryId, entryIds));

      // Get all accounts for lookup
      const allAccounts = await db.select().from(accounts);
      const accountMap = new Map(allAccounts.map(a => [a.id, a]));

      // Build CSV rows
      const csvRows: string[] = [];
      csvRows.push('BlgNr,Date,AccId,Grp,Orig,MType,Type,CAcc,TaxId,TIdx,CIdx,BType,Code,ValNt,ValTx,ValFW,Text,Text2,PkKey,OpId,Flags,DocId');

      // Assign sequential BlgNr starting from 1
      let blgNr = 1;

      for (const entry of entries) {
        const lines = allLines.filter(l => l.entryId === entry.id);
        if (lines.length === 0) continue;

        // Format date as DD.MM.YY
        const [yyyy, mmPart, dd] = entry.bookingDate.split('-');
        const dateStr = `${dd}.${mmPart}.${yyyy.slice(2)}`;

        // Escape CSV text field
        const escCsv = (s: string) => {
          if (!s) return '""';
          if (s.includes(',') || s.includes('"') || s.includes(';') || s.includes(' ')) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        };

        const debitLines = lines.filter(l => l.side === 'debit');
        const creditLines = lines.filter(l => l.side === 'credit');

        // Determine if this is a collective booking (Sammelbuchung)
        const isCollective = lines.length > 2;

        if (isCollective) {
          // MType = 2: Sammelbuchung
          // Determine the "Sammelkonto" - usually the single credit or debit side
          // Pattern: one side has 1 line (the collective account), other side has multiple
          if (creditLines.length === 1 && debitLines.length >= 2) {
            // Single credit, multiple debits
            // First line: the credit (Haben) with CAcc="div"
            const creditLine = creditLines[0];
            const creditAcct = accountMap.get(creditLine.accountId);
            const creditAcctNum = creditAcct?.number ?? '0';
            const totalAmount = parseFloat(creditLine.amount as string);
            const taxId = getTaxId(creditAcct, creditLine);

            csvRows.push([
              blgNr, dateStr, creditAcctNum, '""', 0, 2, 1, 'div',
              taxId, 0, 0, 0, '""',
              totalAmount.toFixed(2), '0.00', '0.00',
              escCsv(entry.description), '""', 0, '""', 0, '""'
            ].join(','));

            // Then each debit line with CAcc=Sammelkonto
            for (const dLine of debitLines) {
              const dAcct = accountMap.get(dLine.accountId);
              const dAcctNum = dAcct?.number ?? '0';
              const dTaxId = getTaxId(dAcct, dLine);
              const lineDesc = dLine.description || entry.description;

              csvRows.push([
                blgNr, dateStr, dAcctNum, '""', 0, 2, 0, creditAcctNum,
                dTaxId, 0, 0, 0, '""',
                parseFloat(dLine.amount as string).toFixed(2), '0.00', '0.00',
                escCsv(lineDesc), '""', 0, '""', 0, '""'
              ].join(','));
            }
          } else if (debitLines.length === 1 && creditLines.length >= 2) {
            // Single debit, multiple credits
            const debitLine = debitLines[0];
            const debitAcct = accountMap.get(debitLine.accountId);
            const debitAcctNum = debitAcct?.number ?? '0';
            const totalAmount = parseFloat(debitLine.amount as string);
            const taxId = getTaxId(debitAcct, debitLine);

            csvRows.push([
              blgNr, dateStr, debitAcctNum, '""', 0, 2, 0, 'div',
              taxId, 0, 0, 0, '""',
              totalAmount.toFixed(2), '0.00', '0.00',
              escCsv(entry.description), '""', 0, '""', 0, '""'
            ].join(','));

            for (const cLine of creditLines) {
              const cAcct = accountMap.get(cLine.accountId);
              const cAcctNum = cAcct?.number ?? '0';
              const cTaxId = getTaxId(cAcct, cLine);
              const lineDesc = cLine.description || entry.description;

              csvRows.push([
                blgNr, dateStr, cAcctNum, '""', 0, 2, 1, debitAcctNum,
                cTaxId, 0, 0, 0, '""',
                parseFloat(cLine.amount as string).toFixed(2), '0.00', '0.00',
                escCsv(lineDesc), '""', 0, '""', 0, '""'
              ].join(','));
            }
          } else {
            // Fallback: treat as pairs (shouldn't happen normally)
            for (const line of lines) {
              const acct = accountMap.get(line.accountId);
              const acctNum = acct?.number ?? '0';
              const type = line.side === 'debit' ? 0 : 1;
              const taxId = getTaxId(acct, line);

              csvRows.push([
                blgNr, dateStr, acctNum, '""', 0, 2, type, 'div',
                taxId, 0, 0, 0, '""',
                parseFloat(line.amount as string).toFixed(2), '0.00', '0.00',
                escCsv(line.description || entry.description), '""', 0, '""', 0, '""'
              ].join(','));
            }
          }
        } else {
          // MType = 1: Einzelbuchung (2 lines: 1 debit, 1 credit)
          const debitLine = debitLines[0];
          const creditLine = creditLines[0];
          if (!debitLine || !creditLine) continue;

          const debitAcct = accountMap.get(debitLine.accountId);
          const creditAcct = accountMap.get(creditLine.accountId);
          const debitAcctNum = debitAcct?.number ?? '0';
          const creditAcctNum = creditAcct?.number ?? '0';
          const amount = parseFloat(debitLine.amount as string);
          const debitTaxId = getTaxId(debitAcct, debitLine);
          const creditTaxId = getTaxId(creditAcct, creditLine);

          // Debit line (Type=0)
          csvRows.push([
            blgNr, dateStr, debitAcctNum, '""', 0, 1, 0, creditAcctNum,
            debitTaxId, 0, 0, 0, '""',
            amount.toFixed(2), '0.00', '0.00',
            escCsv(entry.description), '""', 0, '""', 0, '""'
          ].join(','));

          // Credit line (Type=1)
          csvRows.push([
            blgNr, dateStr, creditAcctNum, '""', 0, 1, 1, debitAcctNum,
            creditTaxId, 0, 0, 0, '""',
            amount.toFixed(2), '0.00', '0.00',
            escCsv(entry.description), '""', 0, '""', 0, '""'
          ].join(','));
        }

        blgNr++;
      }

      const csvContent = csvRows.join('\n') + '\n';
      return {
        csv: csvContent,
        filename: `sfbbuch_${input.fiscalYear}.csv`,
        entryCount: entries.length,
      };
    }),

  exportCsv: orgProcedure
    .input(z.object({
      fiscalYear: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      statusFilter: z.enum(["approved", "all"]).default("approved"),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(journalEntries.fiscalYear, input.fiscalYear)];
      if (input.statusFilter === "approved") {
        conditions.push(eq(journalEntries.status, "approved"));
      }
      if (input.startDate) conditions.push(gte(journalEntries.bookingDate, input.startDate));
      if (input.endDate) conditions.push(lte(journalEntries.bookingDate, input.endDate));

      const entries = await db.select()
        .from(journalEntries)
        .where(and(...conditions))
        .orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));

      if (entries.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keine Buchungen für den Export gefunden" });
      }

      const entryIds = entries.map(e => e.id);
      const allLines = await db.select()
        .from(journalLines)
        .where(inArray(journalLines.entryId, entryIds));

      const allAccounts = await db.select().from(accounts);
      const accountMap = new Map(allAccounts.map(a => [a.id, a]));

      const csvRows: string[] = [];
      csvRows.push('Belegnummer;Datum;Konto;Kontoname;Gegenkonto;Gegenkontoname;Soll;Haben;Beschreibung;MWST-Satz;MWST-Betrag;Quelle;Status');

      for (const entry of entries) {
        const lines = allLines.filter(l => l.entryId === entry.id);
        for (const line of lines) {
          const acct = accountMap.get(line.accountId);
          // Find the counter account
          const counterLine = lines.find(l => l.id !== line.id && l.side !== line.side);
          const counterAcct = counterLine ? accountMap.get(counterLine.accountId) : null;

          const [yyyy, mmP, dd] = entry.bookingDate.split('-');
          const dateStr = `${dd}.${mmP}.${yyyy}`;

          csvRows.push([
            entry.entryNumber || '',
            dateStr,
            acct?.number || '',
            acct?.name || '',
            counterAcct?.number || '',
            counterAcct?.name || '',
            line.side === 'debit' ? parseFloat(line.amount as string).toFixed(2) : '',
            line.side === 'credit' ? parseFloat(line.amount as string).toFixed(2) : '',
            (line.description || entry.description).replace(/;/g, ','),
            line.vatRate ? `${line.vatRate}%` : '',
            line.vatAmount ? parseFloat(line.vatAmount as string).toFixed(2) : '',
            entry.source,
            entry.status,
          ].join(';'));
        }
      }

      const csvContent = csvRows.join('\n') + '\n';
      return {
        csv: csvContent,
        filename: `Journal_${input.fiscalYear}.csv`,
        entryCount: entries.length,
      };
    }),

  getAllIds: orgProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      fiscalYear: z.number().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [];
      if (input.status) conditions.push(eq(journalEntries.status, input.status));
      if (input.fiscalYear) conditions.push(eq(journalEntries.fiscalYear, input.fiscalYear));
      if (input.search) conditions.push(like(journalEntries.description, `%${input.search}%`));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select({ id: journalEntries.id }).from(journalEntries).where(whereClause);
      return { ids: rows.map(r => r.id) };
    }),
});

// ─── Bank Import Router ───────────────────────────────────────────────────────────────────────
// In-memory undo snapshot store (per user)
type UndoSnapshot = {
  id: string;
  actionName: string;
  timestamp: number;
  transactions: Array<{
    id: number;
    description: string | null;
    suggestedDebitAccountId: number | null;
    suggestedCreditAccountId: number | null;
    aiConfidence: number | null;
    aiReasoning: string | null;
    suggestedBookingText: string | null;
    isTransfer: boolean | null;
    transferPartnerId: number | null;
    manuallyEdited: boolean | null;
    matchedDocumentId: number | null;
    matchScore: number | null;
    status: string;
  }>;
};
const undoSnapshots = new Map<number, UndoSnapshot>();

const bankImportRouter = router({
  getBankAccounts: orgProcedure.query(({ ctx }) => getBankAccounts(ctx.organizationId)),
  updateBankAccount: orgProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      iban: z.string().nullable().optional(),
      bank: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.iban !== undefined) updateData.iban = input.iban;
      if (input.bank !== undefined) updateData.bank = input.bank;
      await db.update(bankAccounts).set(updateData).where(eq(bankAccounts.id, input.id));
      return { success: true };
    }),

  getPendingTransactions: orgProcedure
    .input(z.object({ bankAccountId: z.number().optional() }))
    .query(({ input, ctx }) => getPendingBankTransactions(ctx.organizationId, input.bankAccountId)),

  getTransactionsByStatus: orgProcedure
    .input(z.object({ status: z.enum(["pending", "matched", "all"]), bankAccountId: z.number().optional(), fiscalYear: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const txs = await getBankTransactionsByStatus(ctx.organizationId, input.status, input.bankAccountId, input.fiscalYear);
      // For transfer transactions, enrich with partner bank account name and accounting account IDs
      const db = await getDb();
      if (!db) return txs;
      const transferTxs = txs.filter(t => t.transferPartnerId);
      if (transferTxs.length === 0) return txs;
      const partnerIds = transferTxs.map(t => t.transferPartnerId!);
      const partners = await db.select({ id: bankTransactions.id, bankAccountId: bankTransactions.bankAccountId })
        .from(bankTransactions).where(inArray(bankTransactions.id, partnerIds));
      // Get all bank accounts involved (own + partner)
      const allBaIds = Array.from(new Set([
        ...transferTxs.map(t => t.bankAccountId),
        ...partners.map(p => p.bankAccountId),
      ]));
      const bas = await db.select({ id: bankAccounts.id, name: bankAccounts.name, accountId: bankAccounts.accountId })
        .from(bankAccounts).where(inArray(bankAccounts.id, allBaIds));
      const partnerMap = new Map(partners.map(p => [p.id, bas.find(b => b.id === p.bankAccountId)]));
      const ownBaMap = new Map(bas.map(b => [b.id, b]));
      return txs.map(t => {
        if (!t.isTransfer || !t.transferPartnerId) return { ...t, transferPartnerBankName: null };
        const partnerBa = partnerMap.get(t.transferPartnerId);
        const ownBa = ownBaMap.get(t.bankAccountId);
        const amtA = parseFloat(t.amount as string);
        // Determine debit/credit based on sign
        const debitAccountId = amtA >= 0 ? ownBa?.accountId : partnerBa?.accountId;
        const creditAccountId = amtA < 0 ? ownBa?.accountId : partnerBa?.accountId;
        return {
          ...t,
          transferPartnerBankName: partnerBa?.name ?? null,
          // Override suggested accounts for transfers
          suggestedDebitAccountId: debitAccountId ?? t.suggestedDebitAccountId,
          suggestedCreditAccountId: creditAccountId ?? t.suggestedCreditAccountId,
        };
      });
    }),

  importTransactions: orgProcedure
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
      filename: z.string().optional(),
      fileType: z.string().optional(),
      s3Key: z.string().optional(),
      s3Url: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      const batchId = input.importBatchId ?? `import-${Date.now()}`;
      let imported = 0, duplicates = 0, skipped = 0;
      let dateMin: string | null = null, dateMax: string | null = null;
      for (const tx of input.transactions) {
        const transactionDate = normaliseDate(tx.transactionDate);
        if (!transactionDate) { skipped++; continue; }
        // Track date range
        if (!dateMin || transactionDate < dateMin) dateMin = transactionDate;
        if (!dateMax || transactionDate > dateMax) dateMax = transactionDate;
        const valueDate = tx.valueDate ? (normaliseDate(tx.valueDate) ?? undefined) : undefined;
        const hash = crypto.createHash("sha256")
          .update(`${input.bankAccountId}-${transactionDate}-${tx.amount}-${tx.description}`)
          .digest("hex");
        const saved = await saveBankTransaction({
          organizationId: ctx.organizationId,
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

      // Save import history
      if (db && input.filename) {
        try {
          await db.insert(importHistory).values({
            organizationId: ctx.organizationId,
            bankAccountId: input.bankAccountId,
            filename: input.filename,
            fileType: input.fileType ?? "unknown",
            s3Key: input.s3Key ?? null,
            s3Url: input.s3Url ?? null,
            importBatchId: batchId,
            transactionsTotal: input.transactions.length,
            transactionsImported: imported,
            transactionsDuplicate: duplicates,
            transactionsSkipped: skipped,
            dateRangeFrom: dateMin,
            dateRangeTo: dateMax,
            importedBy: ctx.user.openId,
          });
        } catch (e) {
          console.error("Failed to save import history:", e);
        }
      }

      // ─── Auto-match imported transactions against known invoices ──────────
      // After importing, check if any newly imported transactions match documents
      // that were included in a pain.001 export (matchStatus = 'pain001') or unmatched invoices
      let autoMatched = 0;
      if (db && imported > 0) {
        try {
          // Get newly imported pending transactions from this batch
          const newTxns = await db.select().from(bankTransactions)
            .where(and(
              eq(bankTransactions.importBatchId, batchId),
              eq(bankTransactions.status, 'pending'),
            ));

          // Get documents that are invoices (have aiMetadata with totalAmount)
          // Focus on pain001 status (exported but not yet confirmed) and unmatched
          const invoiceDocs = await db.select().from(documents)
            .where(and(
              sql`${documents.aiMetadata} IS NOT NULL`,
              sql`${documents.matchStatus} IN ('pain001', 'unmatched')`,
            ));

          for (const txn of newTxns) {
            // Only match debit transactions (outgoing payments)
            const txnAmount = parseFloat(txn.amount);
            if (txnAmount >= 0) continue; // Skip credits/incoming

            let bestMatch: { docId: number; score: number } | null = null;

            for (const doc of invoiceDocs) {
              let meta: any;
              try { meta = JSON.parse(doc.aiMetadata || '{}'); } catch { continue; }
              if (!meta.totalAmount) continue;

              const score = calculateMatchScore(
                {
                  totalAmount: meta.totalAmount,
                  counterparty: meta.counterparty,
                  documentDate: meta.documentDate,
                  counterpartyIban: meta.counterpartyIban,
                  referenceNumber: meta.referenceNumber,
                },
                {
                  amount: txn.amount,
                  counterparty: txn.counterparty,
                  transactionDate: txn.transactionDate,
                  counterpartyIban: txn.counterpartyIban,
                  reference: txn.reference,
                }
              );

              // Higher threshold for auto-matching (60+)
              if (score >= 60 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { docId: doc.id, score };
              }
            }

            if (bestMatch) {
              // Apply match: link document to transaction
              await db.update(documents).set({
                bankTransactionId: txn.id,
                matchStatus: 'matched',
                matchScore: bestMatch.score,
              }).where(eq(documents.id, bestMatch.docId));

              await db.update(bankTransactions).set({
                matchedDocumentId: bestMatch.docId,
                matchScore: bestMatch.score,
              }).where(eq(bankTransactions.id, txn.id));

              autoMatched++;
              // Remove matched doc from candidates
              const idx = invoiceDocs.findIndex(d => d.id === bestMatch!.docId);
              if (idx >= 0) invoiceDocs.splice(idx, 1);
            }
          }
        } catch (e) {
          console.error("Auto-match after import failed:", e);
        }
      }

      return { imported, duplicates, skipped, batchId, autoMatched };
    }),

  getImportHistory: orgProcedure
    .input(z.object({ bankAccountId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = input.bankAccountId
        ? [eq(importHistory.bankAccountId, input.bankAccountId)]
        : [];
      const rows = await db.select().from(importHistory)
        .where(conditions.length ? conditions[0] : undefined)
        .orderBy(desc(importHistory.createdAt))
        .limit(50);
      // Enrich with bank account names
      const accts = await db.select().from(bankAccounts);
      const acctMap = Object.fromEntries(accts.map(a => [a.id, a.name]));
      return rows.map(r => ({ ...r, bankAccountName: acctMap[r.bankAccountId] ?? "Unbekannt" }));
    }),

  getLastImport: orgProcedure
    .input(z.object({ bankAccountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(importHistory)
        .where(eq(importHistory.bankAccountId, input.bankAccountId))
        .orderBy(desc(importHistory.createdAt))
        .limit(1);
      return row ?? null;
    }),

  categorizeWithAI: orgProcedure
    .input(z.object({ transactionIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      // Phase 1: Firmenname dynamisch aus Org-Settings laden statt hardcoded.
      const [orgRow] = await (await getDb())!.select({ name: companySettings.companyName })
        .from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId))
        .limit(1);
      const companyName = orgRow?.name ?? "Ihre Firma";
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const allAccounts = await getAllAccounts(ctx.organizationId);
      const accountList = allAccounts.map(a => `${a.number}: ${a.name} (${a.accountType})`).join("\n");

      // Load booking rules for this org and build a "learned rules" context for
      // the LLM – this replaces the old hardcoded business logic (Gewerbe-Treuhand,
      // LUKB mw, etc.) that only applied to one specific tenant. Now each org
      // provides its own rules through normal usage.
      const orgRules = await getAllBookingRules(ctx.organizationId);
      const accountByIdMap = new Map(allAccounts.map(a => [a.id, a]));
      const rulesContext = orgRules
        .slice(0, 40) // cap for prompt length
        .map(r => {
          const debit = r.debitAccountId ? accountByIdMap.get(r.debitAccountId) : null;
          const credit = r.creditAccountId ? accountByIdMap.get(r.creditAccountId) : null;
          const debitLabel = debit ? `${debit.number} ${debit.name}` : "?";
          const creditLabel = credit ? `${credit.number} ${credit.name}` : "?";
          return `- "${r.counterpartyPattern}" → Soll ${debitLabel} / Haben ${creditLabel}${r.bookingTextTemplate ? ` (Text: "${r.bookingTextTemplate}")` : ""}`;
        })
        .join("\n");

      const transactions = await db.select().from(bankTransactions)
        .where(and(
          eq(bankTransactions.organizationId, ctx.organizationId),
          inArray(bankTransactions.id, input.transactionIds),
        ));
      // Load bank accounts for IBAN-based account mapping (org-scoped)
      const allBankAccounts = await db.select({ id: bankAccounts.id, accountId: bankAccounts.accountId, name: bankAccounts.name, iban: bankAccounts.iban })
        .from(bankAccounts)
        .where(eq(bankAccounts.organizationId, ctx.organizationId));
      const bankAccountMap = new Map(allBankAccounts.map(ba => [ba.id, ba]));
      const results = [];
      for (const tx of transactions) {
        try {
          // Determine the correct bank account number for this transaction
          const ownBankAccount = bankAccountMap.get(tx.bankAccountId);
          const ownAccountObj = ownBankAccount ? allAccounts.find(a => a.id === ownBankAccount.accountId) : null;
          const ownAccountNumber = ownAccountObj?.number ?? "";
          const ownAccountName = ownAccountObj?.name ?? ownBankAccount?.name ?? "Bankkonto";
          const prompt = `Du bist ein Schweizer Buchhalter für ${companyName}.
Analysiere diese Banktransaktion und schlage die passenden Buchungskonten vor.

Transaktion:
- Datum: ${tx.transactionDate}
- Betrag: CHF ${tx.amount} (positiv = Eingang, negativ = Ausgang)
- Beschreibung: ${tx.description}
- Gegenpartei: ${tx.counterparty ?? "unbekannt"}
- Bankkonto (IBAN): ${ownBankAccount?.iban ?? "unbekannt"} = Konto ${ownAccountNumber} (${ownAccountName})

Kontenplan (Auszug):
${accountList}
${rulesContext ? `
Bereits gelernte Buchungsregeln dieser Firma (HÖCHSTE Priorität – verwende diese
wann immer die Gegenpartei zu einem Muster passt):
${rulesContext}
` : ""}
Antworte NUR mit JSON:
{
  "debitAccountNumber": "XXXX",
  "creditAccountNumber": "XXXX",
  "confidence": 0-100,
  "reasoning": "kurze Begründung auf Deutsch"
}

Regeln:
- WICHTIG: Das Bankkonto dieser Transaktion ist IMMER ${ownAccountNumber} (${ownAccountName}).
- Eingang (positiv): Kreditkonto = Ertragskonto (3xxx/6xxx) oder Aktivkonto, Debitkonto = ${ownAccountNumber}.
- Ausgang (negativ): Debitkonto = Aufwandskonto (4xxx-6xxx), Kreditkonto = ${ownAccountNumber}.
- Typische KMU-Zuordnungen: Löhne → 5000, Miete → 6000, Zinsaufwand → 6900,
  Materialaufwand → 4000, Werbeaufwand → 6600, MWST-Abrechnung → 2200/1170.
- Bei Unsicherheit confidence < 60 und die sinnvollste generische Kategorie wählen.
- Wenn eine gelernte Regel passt, übernehme sie und setze confidence ≥ 85.`;

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

  approveTransaction: orgProcedure
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
        organizationId: ctx.organizationId,
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
          // Get bank account IDs to exclude from rules (derived from transaction, not rule)
          const bankAccountIds = (await db.select({ accountId: bankAccounts.accountId }).from(bankAccounts)).map(ba => ba.accountId);
          const cpClean = tx.counterparty.trim();
          const bookingText = input.description ?? tx.description ?? undefined;
          const ruleData: Parameters<typeof upsertBookingRule>[0] = {
            organizationId: ctx.organizationId,
            counterpartyPattern: cpClean,
            bookingTextTemplate: bookingText,
          };
          // Only save non-bank-account IDs in the rule
          if (!bankAccountIds.includes(input.debitAccountId)) ruleData.debitAccountId = input.debitAccountId;
          if (!bankAccountIds.includes(input.creditAccountId)) ruleData.creditAccountId = input.creditAccountId;
          await upsertBookingRule(ruleData);
        } catch (e) {
          console.error("Failed to learn booking rule:", e);
        }
      }

      return { success: true, entryId };
    }),

  // ── Approve as Sammelbuchung (compound entry) ──
  approveCollectiveTransaction: orgProcedure
    .input(z.object({
      transactionId: z.number(),
      description: z.string().min(1),
      lines: z.array(z.object({
        accountId: z.number(),
        side: z.enum(["debit", "credit"]),
        amount: z.string(),
        description: z.string().optional(),
        vatRate: z.string().optional(),
      })).min(2),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [tx] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, input.transactionId)).limit(1);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });

      const year = new Date(tx.transactionDate as any).getFullYear();

      const entryId = await createJournalEntry({
        organizationId: ctx.organizationId,
        bookingDate: toDateStr(tx.transactionDate as string) as string,
        valueDate: toDateStr(tx.valueDate as string),
        description: input.description,
        source: "bank_import",
        sourceRef: `bank-tx-${tx.id}`,
        fiscalYear: year,
        status: "approved",
        lines: input.lines,
      });

      await approveBankTransaction(input.transactionId, entryId);
      await approveJournalEntry(entryId, ctx.user.id);

      return { success: true, entryId };
    }),

  ignoreTransaction: orgProcedure
    .input(z.object({ transactionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(bankTransactions).set({ status: "ignored" }).where(eq(bankTransactions.id, input.transactionId));
      return { success: true };
    }),

  // ── Revert a booked transaction back to pending ──
  unapproveTransaction: orgProcedure
    .input(z.object({ transactionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [tx] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, input.transactionId)).limit(1);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.status !== "matched") throw new TRPCError({ code: "BAD_REQUEST", message: "Transaktion ist nicht verbucht" });
      // Delete the linked journal entry
      if (tx.journalEntryId) {
        await deleteJournalEntry(tx.journalEntryId);
      }
      // Revert transaction to pending
      await revertBankTransaction(input.transactionId);
      return { success: true };
    }),

  updateTransaction: orgProcedure
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
      // Mark as manually edited so refresh won't overwrite
      await updateBankTransaction(transactionId, { ...data, manuallyEdited: true });

      // Also immediately learn/update the booking rule from this edit
      // so that future refreshes apply the NEW mapping to similar transactions
      const db = await getDb();
      if (db) {
        const [tx] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, transactionId)).limit(1);
        if (tx && tx.counterparty) {
          try {
            // Get bank account IDs to exclude them from rule learning
            // (bank accounts are derived from the transaction, not from rules)
            const bankAccountIds = (await db.select({ accountId: bankAccounts.accountId }).from(bankAccounts)).map(ba => ba.accountId);

            const ruleData: Parameters<typeof upsertBookingRule>[0] = {
              organizationId: ctx.organizationId,
              counterpartyPattern: tx.counterparty.trim(),
            };
            // Use the new description as booking text template
            if (data.description) ruleData.bookingTextTemplate = data.description;
            // Use the new account assignments, but EXCLUDE bank accounts
            // (bank accounts should be derived from the transaction's own bankAccountId)
            if (data.suggestedDebitAccountId && !bankAccountIds.includes(data.suggestedDebitAccountId)) {
              ruleData.debitAccountId = data.suggestedDebitAccountId;
            }
            if (data.suggestedCreditAccountId && !bankAccountIds.includes(data.suggestedCreditAccountId)) {
              ruleData.creditAccountId = data.suggestedCreditAccountId;
            }
            // Only upsert if we have meaningful changes (at least one account or description)
            if (ruleData.bookingTextTemplate || ruleData.debitAccountId || ruleData.creditAccountId) {
              await upsertBookingRule(ruleData);
            }
          } catch (e) {
            console.error("Failed to learn booking rule from edit:", e);
          }
        }
      }

      return { success: true };
    }),

  bulkApprove: orgProcedure
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

      // Get bank account IDs to exclude from rules
      const bankAccountIds = (await db.select({ accountId: bankAccounts.accountId }).from(bankAccounts)).map(ba => ba.accountId);

      const results = [];
      for (const item of input.transactions) {
        try {
          const [tx] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, item.transactionId)).limit(1);
          if (!tx || tx.status !== "pending") { results.push({ txId: item.transactionId, success: false, error: "Nicht ausstehend" }); continue; }

          const amount = Math.abs(parseFloat(tx.amount as string));
          const dateStr = toDateStr(tx.transactionDate as string);
          const year = dateStr ? parseInt(dateStr.substring(0, 4)) : new Date().getFullYear();

          const entryId = await createJournalEntry({
            organizationId: ctx.organizationId,
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
              const ruleData: Parameters<typeof upsertBookingRule>[0] = {
                organizationId: ctx.organizationId,
                counterpartyPattern: tx.counterparty.trim(),
                bookingTextTemplate: item.description ?? tx.description ?? undefined,
              };
              // Exclude bank accounts from rules (they are derived from the transaction)
              if (!bankAccountIds.includes(item.debitAccountId)) ruleData.debitAccountId = item.debitAccountId;
              if (!bankAccountIds.includes(item.creditAccountId)) ruleData.creditAccountId = item.creditAccountId;
              await upsertBookingRule(ruleData);
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

  generateBookingText: orgProcedure
    .input(z.object({ transactionIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const txs = await getBankTransactionsByIds(ctx.organizationId, input.transactionIds);
      if (!txs.length) return { results: [] };

      // Phase 1: Firmenname dynamisch aus Org-Settings.
      const [orgRow] = await (await getDb())!.select({ name: companySettings.companyName })
        .from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId))
        .limit(1);
      const companyName = orgRow?.name ?? "Ihre Firma";

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
              content: `Du bist Buchhalter der ${companyName}.
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
- Beispiele: "Sunrise 1. Quartal ${year}", "SBB GA ${month} ${year}", "Miete Büro ${month} ${year}"
- Aktueller Monat: ${month} ${year}, Quartal: ${quarter} ${year}
- Bei Lohnzahlungen: "Lohn [Mitarbeitername/Kürzel] [Monat] [Jahr]"
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

  // ── Refresh: Apply learned rules to all pending transactions (skip manually edited ones) ──
  refreshSuggestions: orgProcedure
    .input(z.object({ bankAccountId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rules = await getAllBookingRules(ctx.organizationId);
      if (!rules.length) return { updated: 0, skippedManual: 0, total: 0, message: "Keine gelernten Regeln vorhanden. Verbuchen Sie zuerst einige Transaktionen manuell." };

      // Load bank accounts for auto-filling the correct bank account per transaction
      const allBankAccounts = await db.select({ id: bankAccounts.id, accountId: bankAccounts.accountId, name: bankAccounts.name })
        .from(bankAccounts);

      // Get all pending transactions
      const conditions = [eq(bankTransactions.status, "pending" as const)];
      if (input.bankAccountId) {
        conditions.push(eq(bankTransactions.bankAccountId, input.bankAccountId));
      }
      const pending = await db.select().from(bankTransactions)
        .where(and(...conditions))
        .orderBy(asc(bankTransactions.transactionDate));

      let updated = 0;
      let skippedManual = 0;

      for (const tx of pending) {
        // ── SKIP manually edited transactions ──
        if (tx.manuallyEdited) {
          skippedManual++;
          continue;
        }

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

        // Resolve the transaction's own bank account (for debit/credit assignment)
        const txBankAccount = allBankAccounts.find(ba => ba.id === tx.bankAccountId);
        const txAccountId = txBankAccount?.accountId;
        const txAmount = parseFloat(tx.amount as string);

        // Apply account suggestions from rule
        if (matchedRule.debitAccountId) {
          updateData.suggestedDebitAccountId = matchedRule.debitAccountId;
          changed = true;
        }
        if (matchedRule.creditAccountId) {
          updateData.suggestedCreditAccountId = matchedRule.creditAccountId;
          changed = true;
        }

        // Auto-fill bank account: for outgoing payments (negative), credit = own bank; for incoming (positive), debit = own bank
        if (txAccountId) {
          if (txAmount < 0 && !updateData.suggestedCreditAccountId) {
            updateData.suggestedCreditAccountId = txAccountId;
            changed = true;
          } else if (txAmount >= 0 && !updateData.suggestedDebitAccountId) {
            updateData.suggestedDebitAccountId = txAccountId;
            changed = true;
          }
        }

        // Apply booking text template with date substitution
        if (matchedRule.bookingTextTemplate) {
          const dateStr = tx.transactionDate as string;
          const d = new Date(dateStr);
          const monthNames = ["Januar","Februar","M\u00e4rz","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
          const month = monthNames[d.getMonth()] ?? "";
          const year = d.getFullYear();
          const quarter = `${Math.ceil((d.getMonth() + 1) / 3)}. Quartal`;

          // Replace date placeholders in template
          let text = matchedRule.bookingTextTemplate;
          // Detect month/year patterns and replace with transaction's month/year
          text = text.replace(/(Januar|Februar|M\u00e4rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/g, `${month} ${year}`);
          // Also handle quarter patterns
          text = text.replace(/\d+\.\s*Quartal\s+\d{4}/g, `${quarter} ${year}`);

          // Generic placeholder substitution: rules can use {month}, {year}, {quarter},
          // {counterparty} and {customer} as tokens. This replaces the previous
          // hardcoded Gewerbe-Treuhand special case and works for any tenant that
          // trains its own booking rules.
          text = text
            .replace(/\{month\}/g, month)
            .replace(/\{year\}/g, String(year))
            .replace(/\{quarter\}/g, quarter)
            .replace(/\{counterparty\}/g, tx.counterparty ?? "");

          // {customer} token: extract customer name from the matched document (filename
          // or AI metadata description). Useful for trustee/agency workflows where the
          // bank text is generic but the document identifies the end customer.
          if (text.includes("{customer}") && tx.matchedDocumentId) {
            let customerName = "";
            try {
              const { documents: docsTbl } = await import("../drizzle/schema");
              const [matchedDoc] = await db.select().from(docsTbl)
                .where(and(
                  eq(docsTbl.organizationId, ctx.organizationId),
                  eq(docsTbl.id, tx.matchedDocumentId),
                ))
                .limit(1);
              if (matchedDoc) {
                // Try from filename: "<anything> <ref> <Customer Name>.pdf" -> "Customer Name"
                // (ASCII + German umlauts; avoids the /u flag that requires es2018+)
                const fnMatch = matchedDoc.filename.match(/\s([A-Za-z\u00c0-\u024f]+\s[A-Za-z\u00c0-\u024f]+)\.(pdf|jpg|png)$/i);
                if (fnMatch) customerName = fnMatch[1].trim();
                if (!customerName && matchedDoc.aiMetadata) {
                  try {
                    const meta = JSON.parse(matchedDoc.aiMetadata);
                    const descMatch = (meta.description ?? "").match(/f\u00fcr\s+(.+)/i);
                    if (descMatch) customerName = descMatch[1].trim();
                  } catch {}
                }
              }
            } catch {}
            text = text.replace(/\{customer\}/g, customerName);
          }

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

      const parts = [`${updated} von ${pending.length} Transaktionen aktualisiert`];
      if (skippedManual > 0) parts.push(`${skippedManual} manuell bearbeitete übersprungen`);
      return { updated, skippedManual, total: pending.length, message: parts.join(", ") + "." };
    }),

  // ── List all learned booking rules ──
  // ── Detect internal transfers between bank accounts ──
  detectTransfers: orgProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const dbRaw = await getDb();
      if (!dbRaw) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const db = dbRaw;
      // Get all pending transactions from all bank accounts
      const allPending = await db.select({
        id: bankTransactions.id,
        bankAccountId: bankTransactions.bankAccountId,
        transactionDate: bankTransactions.transactionDate,
        amount: bankTransactions.amount,
        description: bankTransactions.description,
        isTransfer: bankTransactions.isTransfer,
      }).from(bankTransactions)
        .where(and(eq(bankTransactions.status, 'pending')));

      // Find matching pairs: same absolute amount, opposite sign, within 2 days, different bank accounts
      const found: Array<{idA: number, idB: number, amount: number}> = [];
      const usedIds = new Set<number>();
      for (let i = 0; i < allPending.length; i++) {
        for (let j = i + 1; j < allPending.length; j++) {
          const a = allPending[i], b = allPending[j];
          if (usedIds.has(a.id) || usedIds.has(b.id)) continue;
          if (a.bankAccountId === b.bankAccountId) continue;
          const amtA = parseFloat(a.amount as string);
          const amtB = parseFloat(b.amount as string);
          if (Math.abs(Math.abs(amtA) - Math.abs(amtB)) > 0.01) continue;
          if (Math.sign(amtA) === Math.sign(amtB)) continue;
          const diffDays = Math.abs(new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()) / (1000*60*60*24);
          if (diffDays > 2) continue;
          found.push({ idA: a.id, idB: b.id, amount: Math.abs(amtA) });
          usedIds.add(a.id);
          usedIds.add(b.id);
        }
      }

      // Mark found pairs as transfers
      let marked = 0;
      for (const { idA, idB } of found) {
        await db.update(bankTransactions).set({ isTransfer: true, transferPartnerId: idB }).where(eq(bankTransactions.id, idA));
        await db.update(bankTransactions).set({ isTransfer: true, transferPartnerId: idA }).where(eq(bankTransactions.id, idB));
        marked += 2;
      }

      return { found: found.length, marked, pairs: found };
    }),

  // ── Approve an internal transfer: creates ONE journal entry ──
  approveTransfer: orgProcedure
    .input(z.object({
      txId: z.number(),          // The transaction we're approving
      bookingText: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const dbRaw2 = await getDb();
      if (!dbRaw2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const db = dbRaw2;

      // Get this transaction
      const [txA] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, input.txId));
      if (!txA) throw new TRPCError({ code: "NOT_FOUND", message: "Transaktion nicht gefunden" });
      if (!txA.isTransfer || !txA.transferPartnerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Keine Transfer-Transaktion" });

      // Get partner transaction
      const [txB] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, txA.transferPartnerId));
      if (!txB) throw new TRPCError({ code: "NOT_FOUND", message: "Partner-Transaktion nicht gefunden" });

      // Check if already booked (either one)
      if (txA.status === 'matched' || txB.status === 'matched') {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Übertrag bereits verbucht" });
      }

      // Get bank accounts to find accounting account IDs
      const [baA] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, txA.bankAccountId));
      const [baB] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, txB.bankAccountId));
      if (!baA || !baB) throw new TRPCError({ code: "NOT_FOUND", message: "Bankkonto nicht gefunden" });

      const amtA = parseFloat(txA.amount as string);
      // Determine debit/credit: the outgoing transaction (negative amount) is the credit side (Haben)
      // The incoming transaction (positive amount) is the debit side (Soll)
      let debitAccountId: number, creditAccountId: number;
      if (amtA < 0) {
        // txA is outgoing: credit = baA, debit = baB
        creditAccountId = baA.accountId;
        debitAccountId = baB.accountId;
      } else {
        // txA is incoming: debit = baA, credit = baB
        debitAccountId = baA.accountId;
        creditAccountId = baB.accountId;
      }

      const amount = Math.abs(amtA);
      const bookingDate = txA.transactionDate as string;
      const description = input.bookingText ?? txA.description ?? `Kontoübertrag ${amount.toFixed(2)}`;
      const fy = new Date(bookingDate).getFullYear();

      // Create journal entry (Belegnummer wird in approveJournalEntry vergeben).
      const newEntryId = await createJournalEntry({
        organizationId: ctx.organizationId,
        bookingDate,
        description,
        source: 'bank_import',
        fiscalYear: fy,
        status: 'approved',
        lines: [
          { accountId: debitAccountId, side: 'debit', amount: amount.toFixed(2), description },
          { accountId: creditAccountId, side: 'credit', amount: amount.toFixed(2), description },
        ],
      });
      await approveJournalEntry(newEntryId, ctx.user.id);

      // Mark both transactions as matched
      const db2 = db!;
      await db2.update(bankTransactions).set({ status: 'matched', journalEntryId: newEntryId }).where(eq(bankTransactions.id, txA.id));
      await db2.update(bankTransactions).set({ status: 'matched', journalEntryId: newEntryId }).where(eq(bankTransactions.id, txB.id));

      // Retrieve the allocated entry number for the response
      const [savedEntry] = await db2.select({ entryNumber: journalEntries.entryNumber })
        .from(journalEntries).where(eq(journalEntries.id, newEntryId)).limit(1);

      return { success: true, entryId: newEntryId, entryNumber: savedEntry?.entryNumber ?? null };
    }),

  listRules: orgProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const rules = await getAllBookingRules(ctx.organizationId);
      const allAccounts = await getAllAccounts(ctx.organizationId);
      return rules.map(r => ({
        ...r,
        debitAccountName: allAccounts.find(a => a.id === r.debitAccountId)?.name,
        debitAccountNumber: allAccounts.find(a => a.id === r.debitAccountId)?.number,
        creditAccountName: allAccounts.find(a => a.id === r.creditAccountId)?.name,
        creditAccountNumber: allAccounts.find(a => a.id === r.creditAccountId)?.number,
      }));
    }),

  // List unmatched bank transactions for manual matching from Documents page
  listUnmatchedTransactions: orgProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { bankTransactions: txns, bankAccounts: ba, accounts: accts } = await import("../drizzle/schema");
      const { and, eq: eqOp, or, like, desc: descOp, isNull } = await import("drizzle-orm");
      const conditions: any[] = [
        eqOp(txns.organizationId, ctx.organizationId),
        eqOp(txns.status, 'pending'),
        or(
          isNull(txns.matchedDocumentId),
          eqOp(txns.matchedDocumentId, 0),
        ),
      ];
      if (input.search) {
        const q = `%${input.search}%`;
        conditions.push(
          or(
            like(txns.suggestedBookingText, q),
            like(txns.counterparty, q),
            like(txns.description, q),
          )!
        );
      }
      const rows = await db.select({
        id: txns.id,
        transactionDate: txns.transactionDate,
        bookingText: txns.suggestedBookingText,
        description: txns.description,
        amount: txns.amount,
        counterparty: txns.counterparty,
        bankAccountId: txns.bankAccountId,
      }).from(txns)
        .where(and(...conditions))
        .orderBy(descOp(txns.transactionDate))
        .limit(input.limit);

      // Enrich with bank account names
      const bankAccountIds = Array.from(new Set(rows.map(r => r.bankAccountId).filter(Boolean)));
      let bankAccountMap: Record<number, string> = {};
      if (bankAccountIds.length > 0) {
        const bankRows = await db.select({ id: ba.id, name: ba.name }).from(ba).where(inArray(ba.id, bankAccountIds as number[]));
        bankAccountMap = Object.fromEntries(bankRows.map(b => [b.id, b.name]));
      }

      return rows.map(r => ({
        ...r,
        counterpartyName: r.counterparty ?? '',
        bankAccountName: r.bankAccountId ? bankAccountMap[r.bankAccountId] ?? '' : '',
      }));
    }),

  // ── Snapshot: Save current state of pending transactions before a bulk action ──
  createSnapshot: orgProcedure
    .input(z.object({ actionName: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get all pending transactions
      const pending = await db.select().from(bankTransactions)
        .where(eq(bankTransactions.status, 'pending'));
      // Store snapshot in memory (server-side cache)
      const snapshotId = `snap_${Date.now()}`;
      undoSnapshots.set(ctx.user.id as number, {
        id: snapshotId,
        actionName: input.actionName,
        timestamp: Date.now(),
        transactions: pending.map(tx => ({
          id: tx.id,
          description: tx.description,
          suggestedDebitAccountId: tx.suggestedDebitAccountId,
          suggestedCreditAccountId: tx.suggestedCreditAccountId,
          aiConfidence: tx.aiConfidence,
          aiReasoning: tx.aiReasoning,
          suggestedBookingText: tx.suggestedBookingText,
          isTransfer: tx.isTransfer,
          transferPartnerId: tx.transferPartnerId,
          manuallyEdited: tx.manuallyEdited,
          matchedDocumentId: tx.matchedDocumentId,
          matchScore: tx.matchScore,
          status: tx.status,
        })),
      });
      return { snapshotId, count: pending.length };
    }),

  // ── Get current snapshot info (for showing the undo button) ──
  getSnapshot: orgProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const snapshot = undoSnapshots.get(ctx.user.id as number);
      if (!snapshot) return null;
      return {
        id: snapshot.id,
        actionName: snapshot.actionName,
        timestamp: snapshot.timestamp,
        transactionCount: snapshot.transactions.length,
      };
    }),

  // ── Restore: Revert transactions to the snapshot state ──
  restoreSnapshot: orgProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const snapshot = undoSnapshots.get(ctx.user.id as number);
      if (!snapshot) throw new TRPCError({ code: "NOT_FOUND", message: "Kein Snapshot vorhanden" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let restored = 0;
      for (const txSnap of snapshot.transactions) {
        await db.update(bankTransactions).set({
          description: txSnap.description,
          suggestedDebitAccountId: txSnap.suggestedDebitAccountId,
          suggestedCreditAccountId: txSnap.suggestedCreditAccountId,
          aiConfidence: txSnap.aiConfidence,
          aiReasoning: txSnap.aiReasoning,
          suggestedBookingText: txSnap.suggestedBookingText,
          isTransfer: txSnap.isTransfer ?? false,
          transferPartnerId: txSnap.transferPartnerId,
          manuallyEdited: txSnap.manuallyEdited ?? false,
          matchedDocumentId: txSnap.matchedDocumentId,
          matchScore: txSnap.matchScore,
          status: txSnap.status as "pending" | "matched" | "ignored",
        }).where(eq(bankTransactions.id, txSnap.id));
        restored++;
      }
      // Remove snapshot after restore
      undoSnapshots.delete(ctx.user.id as number);
      return { restored, actionName: snapshot.actionName };
    }),

  // ── Clear snapshot (dismiss undo option) ──
  clearSnapshot: orgProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      undoSnapshots.delete(ctx.user.id as number);
      return { success: true };
    }),
});

// ─── Credit Card Router ───────────────────────────────────────────────────────
const creditCardRouter = router({
  list: orgProcedure.query(({ ctx }) => getCreditCardStatements(ctx.organizationId)),

  uploadStatement: orgProcedure
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
        organizationId: ctx.organizationId,
        statementDate: toDateStr(input.statementDate) as string,
        totalAmount: input.totalAmount,
        owner: "mw",
        status: "pending",
        rawText: input.rawText,
        parsedItems: input.parsedItems,
      });

      return { statementId: (result as any).insertId };
    }),

  approveStatement: orgProcedure
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

      const visaAccount = await getAccountByNumber(ctx.organizationId, "1082");
      if (!visaAccount) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Konto 1082 nicht gefunden" });

      const amount = Math.abs(parseFloat(stmt.totalAmount as string));
      const year = new Date(stmt.statementDate as any).getFullYear();

      const entryId = await createJournalEntry({
        organizationId: ctx.organizationId,
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
  parsePdf: orgProcedure
    .input(z.object({ documentUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Load all booking rules and accounts for context
      const allRules = await getAllBookingRules(ctx.organizationId);
      const allAccts = await getAllAccounts(ctx.organizationId);

      // Phase 1: Firmenname dynamisch aus Org-Settings.
      const [orgRow] = await (await getDb())!.select({ name: companySettings.companyName })
        .from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId))
        .limit(1);
      const companyName = orgRow?.name ?? "Ihre Firma";

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

      const prompt = `Du bist Buchhalter für ${companyName} in der Schweiz.
Analysiere diese Kreditkartenabrechnung und extrahiere ALLE Einzelpositionen/Transaktionen.

WICHTIG:
- Jede Zeile in der Abrechnung ist eine separate Transaktion.
- Extrahiere ALLE Transaktionen, überspringe keine.
- Das Datum steht links (Format DD.MM.YYYY), dann der Beschreibungstext, dann der Betrag rechts.
- Beträge sind in CHF (oder der angegebenen Fremdwährung), verwende den Absolutwert (ohne Minus).
- Ignoriere Zeilen wie "Saldo Vormonat", "Zahlung", "Neuer Saldo", "Total" – nur echte Einkäufe/Transaktionen.
- Die Beschreibung soll den Vendor/Händler-Namen enthalten, NICHT die ganze Zeile kopieren.

GELERNTE KONTENZUORDNUNGEN DIESER FIRMA (höchste Priorität – verwende diese wenn ein Vendor passt):
${rulesContext || "(keine gelernten Regeln vorhanden)"}

VOLLSTÄNDIGER KONTENPLAN DIESER FIRMA (falls kein gelernter Match passt):
${accountList}

GENERISCHE KATEGORIEN (nur wenn weder gelernte Regel noch passender Kontoname gefunden):
- Software/SaaS/Cloud: Aufwandskonto „Informatik" oder „Software"
- Restaurant/Bewirtung (geschäftlich): Aufwandskonto „Repräsentation" oder „Verpflegung"
- Reisen/Transport (SBB, Taxi, Uber, Parkhaus): Aufwandskonto „Reisespesen"
- Bücher/Zeitungen/Fachliteratur: Aufwandskonto „Fachliteratur" oder „Weiterbildung"
- Bank-/Kartengebühren: Aufwandskonto „Bankspesen"
- Zinsen: Aufwandskonto „Zinsaufwand"
- Unbekannt/nicht kategorisierbar: Aufwandskonto „Diverser Aufwand"

Wähle bei generischen Kategorien das Konto aus dem obigen Kontenplan, dessen Name
am besten passt. Erfinde keine Kontonummern.

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
  approveWithItems: orgProcedure
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

      const visaAccount = await getAccountByNumber(ctx.organizationId, "1082");
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
        organizationId: ctx.organizationId,
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
        organizationId: ctx.organizationId,
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

  // ── Approve CC from BankImport: creates TWO journal entries ──
  // Entry 1: 1082 Durchlaufkonto (Soll) / 1032 LUKB mw (Haben) → Totalbetrag
  // Entry 2: Diverse Aufwandkonten (Soll) / 1082 Durchlaufkonto (Haben) → Sammelbuchung
  approveCcFromBankImport: orgProcedure
    .input(z.object({
      bankTransactionId: z.number(),
      statementId: z.number().optional(), // existing CC statement to link
      statementDate: z.string(),
      counterparty: z.string(),
      paidAmount: z.string().optional(), // effektiv bezahlter Betrag (Bankbelastung), kann kleiner sein als Abrechnungstotal
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

      // Get the bank transaction to find the amount and date
      const [tx] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, input.bankTransactionId)).limit(1);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Banktransaktion nicht gefunden" });

      const visaAccount = await getAccountByNumber(ctx.organizationId, "1082");
      if (!visaAccount) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Konto 1082 nicht gefunden" });
      const bankAccount = await getAccountByNumber(ctx.organizationId, "1032");
      if (!bankAccount) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Konto 1032 nicht gefunden" });

      // totalAmount = Abrechnungstotal (alle Positionen)
      // paidAmount = effektiv bezahlter Betrag (Bankbelastung, kann kleiner sein wegen Vormonatsguthaben)
      const txAmount = Math.abs(parseFloat(tx.amount as string));
      const paidAmount = input.paidAmount ? Math.abs(parseFloat(input.paidAmount)) : txAmount;
      const dateStr = toDateStr(input.statementDate) ?? toDateStr(tx.transactionDate as string) ?? new Date().toISOString().split("T")[0];
      const year = parseInt(dateStr!.substring(0, 4));

      // ── Entry 1: 1082 Durchlaufkonto (Soll) / 1032 LUKB mw (Haben) → effektiv bezahlter Betrag ──
      const entry1Id = await createJournalEntry({
        organizationId: ctx.organizationId,
        bookingDate: dateStr as string,
        description: `${input.counterparty} ${dateStr} – Bankzahlung`,
        source: "bank_import",
        sourceRef: `bank-tx-${tx.id}`,
        fiscalYear: year,
        status: "approved",
        lines: [
          { accountId: visaAccount.id, side: "debit", amount: paidAmount.toFixed(2), description: "Durchlaufkonto VISA mw" },
          { accountId: bankAccount.id, side: "credit", amount: paidAmount.toFixed(2), description: "LUKB mw" },
        ],
      });
      await approveJournalEntry(entry1Id, ctx.user.id);

      // ── Entry 2: Diverse Aufwandkonten (Soll) / 1082 Durchlaufkonto (Haben) ──
      const itemsTotal = input.items.reduce((s, i) => s + Math.abs(parseFloat(i.amount)), 0);
      const debitLines = input.items.map(item => ({
        accountId: item.debitAccountId,
        side: "debit" as const,
        amount: Math.abs(parseFloat(item.amount)).toFixed(2),
        description: item.description,
      }));
      const entry2Id = await createJournalEntry({
        organizationId: ctx.organizationId,
        bookingDate: dateStr as string,
        description: `VISA Sammelbuchung ${input.counterparty} ${dateStr}`,
        source: "credit_card",
        sourceRef: `cc-items-${Date.now()}`,
        fiscalYear: year,
        status: "approved",
        lines: [
          ...debitLines,
          { accountId: visaAccount.id, side: "credit", amount: itemsTotal.toFixed(2), description: `Durchlaufkonto VISA mw – ${input.counterparty}` },
        ],
      });
      await approveJournalEntry(entry2Id, ctx.user.id);

      // Mark bank transaction as matched (linked to entry1)
      await approveBankTransaction(input.bankTransactionId, entry1Id);

      // Save or update credit card statement
      if (input.statementId) {
        await db.update(creditCardStatements)
          .set({ status: "approved", journalEntryId: entry2Id })
          .where(eq(creditCardStatements.id, input.statementId));
      } else {
        await db.insert(creditCardStatements).values({
          organizationId: ctx.organizationId,
          statementDate: dateStr as string,
          totalAmount: itemsTotal.toFixed(2),
          owner: "mw",
          status: "approved",
          journalEntryId: entry2Id,
          rawText: input.items.map(i => `${i.date} ${i.description} ${i.amount}`).join("\n"),
          parsedItems: input.items,
        });
      }
      return { success: true, entry1Id, entry2Id, totalAmount: itemsTotal.toFixed(2), paidAmount: paidAmount.toFixed(2), itemCount: input.items.length };
    }),

  // ── Revert a booked CC statement back to pending ──
  unapproveStatement: orgProcedure
    .input(z.object({ statementId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [stmt] = await db.select().from(creditCardStatements).where(eq(creditCardStatements.id, input.statementId)).limit(1);
      if (!stmt) throw new TRPCError({ code: "NOT_FOUND" });
      if (stmt.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Abrechnung ist nicht verbucht" });
      // Delete the linked journal entry
      if (stmt.journalEntryId) {
        await deleteJournalEntry(stmt.journalEntryId);
      }
      // Revert CC statement to pending
      await revertCcStatement(input.statementId);
      // Also revert linked bank transaction if any
      const [linkedTx] = await db.select().from(bankTransactions).where(eq(bankTransactions.journalEntryId, stmt.journalEntryId!)).limit(1);
      if (linkedTx) {
        await revertBankTransaction(linkedTx.id);
      }
      return { success: true };
    }),

  // ── Delete a pending CC statement ──
  deleteStatement: orgProcedure
    .input(z.object({ statementId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [stmt] = await db.select().from(creditCardStatements).where(eq(creditCardStatements.id, input.statementId)).limit(1);
      if (!stmt) throw new TRPCError({ code: "NOT_FOUND" });
      if (stmt.status === "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Verbuchte Abrechnung kann nicht gel\u00f6scht werden. Zuerst Verbuchung r\u00fcckg\u00e4ngig machen." });
      await deleteCcStatement(input.statementId);
      return { success: true };
    }),
});

// ─── Payroll Router ───────────────────────────────────────────────────────────
const payrollRouter = router({
  getEmployees: orgProcedure.query(({ ctx }) => getEmployees(ctx.organizationId)),

  list: orgProcedure
    .input(z.object({ year: z.number().optional(), employeeId: z.number().optional() }))
    .query(({ input, ctx }) => getPayrollEntries(ctx.organizationId, input.year, input.employeeId)),

  create: orgProcedure
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
        organizationId: ctx.organizationId,
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

  // Annual payroll summary: sum all months for a given employee and year
  annualSummary: orgProcedure
    .input(z.object({ year: z.number(), employeeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(payrollEntries)
        .where(
          and(
            eq(payrollEntries.year, input.year),
            eq(payrollEntries.employeeId, input.employeeId)
          )
        )
        .orderBy(payrollEntries.month);

      // Build month-by-month breakdown
      const months = rows.map(r => {
        const gross = parseFloat(r.grossSalary as string);
        const ahvEmp = parseFloat((r.ahvEmployee as string) ?? "0");
        const ahvEmpr = parseFloat((r.ahvEmployer as string) ?? "0");
        const bvgEmp = parseFloat((r.bvgEmployee as string) ?? "0");
        const bvgEmpr = parseFloat((r.bvgEmployer as string) ?? "0");
        const ktgEmp = parseFloat((r.ktgUvgEmployee as string) ?? "0");
        const ktgEmpr = parseFloat((r.ktgUvgEmployer as string) ?? "0");
        const net = parseFloat(r.netSalary as string);
        // Bruttolohn-Rückrechnung: Netto + AN-Abzüge = Brutto (Kontrolle)
        const grossFromNet = net + ahvEmp + bvgEmp + ktgEmp;
        return {
          id: r.id,
          month: r.month,
          status: r.status,
          grossSalary: gross,
          ahvEmployee: ahvEmp,
          ahvEmployer: ahvEmpr,
          bvgEmployee: bvgEmp,
          bvgEmployer: bvgEmpr,
          ktgUvgEmployee: ktgEmp,
          ktgUvgEmployer: ktgEmpr,
          netSalary: net,
          totalEmployerCost: parseFloat((r.totalEmployerCost as string) ?? "0"),
          // Bruttolohn aus Netto zurückgerechnet (Netto + AN-Abzüge)
          grossFromNet,
          // Total AN-Abzüge
          totalDeductions: ahvEmp + bvgEmp + ktgEmp,
          // Total AG-Kosten über Brutto hinaus
          totalEmployerAdditions: ahvEmpr + bvgEmpr + ktgEmpr,
        };
      });

      // Jahrestotale
      const totals = months.reduce(
        (acc, m) => ({
          grossSalary: acc.grossSalary + m.grossSalary,
          ahvEmployee: acc.ahvEmployee + m.ahvEmployee,
          ahvEmployer: acc.ahvEmployer + m.ahvEmployer,
          bvgEmployee: acc.bvgEmployee + m.bvgEmployee,
          bvgEmployer: acc.bvgEmployer + m.bvgEmployer,
          ktgUvgEmployee: acc.ktgUvgEmployee + m.ktgUvgEmployee,
          ktgUvgEmployer: acc.ktgUvgEmployer + m.ktgUvgEmployer,
          netSalary: acc.netSalary + m.netSalary,
          totalDeductions: acc.totalDeductions + m.totalDeductions,
          totalEmployerCost: acc.totalEmployerCost + m.totalEmployerCost,
          totalEmployerAdditions: acc.totalEmployerAdditions + m.totalEmployerAdditions,
        }),
        { grossSalary: 0, ahvEmployee: 0, ahvEmployer: 0, bvgEmployee: 0, bvgEmployer: 0, ktgUvgEmployee: 0, ktgUvgEmployer: 0, netSalary: 0, totalDeductions: 0, totalEmployerCost: 0, totalEmployerAdditions: 0 }
      );

      return { months, totals, year: input.year, employeeId: input.employeeId };
    }),

  // Sync payroll entries from journal bookings AND bank transactions with Lohn descriptions
  syncFromJournal: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load all employees
      const emps = await getEmployees(ctx.organizationId);

      // ── Load insurance settings for deduction calculation ──
      const allInsurance = await db.select().from(insuranceSettings).where(eq(insuranceSettings.isActive, true));
      const ahvSetting = allInsurance.find(s => s.insuranceType === 'ahv');
      const bvgSetting = allInsurance.find(s => s.insuranceType === 'bvg');
      const ktgSetting = allInsurance.find(s => s.insuranceType === 'ktg' || s.insuranceType === 'uvg');

      // AHV/IV/EO/ALV rates (stored as e.g. 6.4000 meaning 6.4%)
      const ahvEmpRate = ahvSetting ? parseFloat(ahvSetting.employeeRate as string ?? '0') / 100 : 0.064;
      const ahvEmprRate = ahvSetting ? parseFloat(ahvSetting.employerRate as string ?? '0') / 100 : 0.064;
      // BVG: fixed monthly CHF amounts
      const bvgEmpMonthly = bvgSetting?.bvgEmployeeMonthly ? parseFloat(bvgSetting.bvgEmployeeMonthly as string) : 0;
      const bvgEmprMonthly = bvgSetting?.bvgEmployerMonthly ? parseFloat(bvgSetting.bvgEmployerMonthly as string) : 0;
      // KTG/UVG rates
      const ktgEmpRate = ktgSetting ? parseFloat(ktgSetting.employeeRate as string ?? '0') / 100 : 0;
      const ktgEmprRate = ktgSetting ? parseFloat(ktgSetting.employerRate as string ?? '0') / 100 : 0;

      /** Calculate all deductions from a net salary (bottom-up) */
      function calcFromNet(netVal: number) {
        // Brutto = (Netto + BVG_AN_fix) / (1 - AHV_AN_rate - KTG_AN_rate)
        const grossVal = (netVal + bvgEmpMonthly) / (1 - ahvEmpRate - ktgEmpRate);
        const ahvEmp = Math.round(grossVal * ahvEmpRate * 100) / 100;
        const ahvEmpr = Math.round(grossVal * ahvEmprRate * 100) / 100;
        const ktgEmp = Math.round(grossVal * ktgEmpRate * 100) / 100;
        const ktgEmpr = Math.round(grossVal * ktgEmprRate * 100) / 100;
        const totalEmployerCost = grossVal + ahvEmpr + bvgEmprMonthly + ktgEmpr;
        return {
          gross: Math.round(grossVal * 100) / 100,
          ahvEmployee: ahvEmp,
          ahvEmployer: ahvEmpr,
          bvgEmployee: bvgEmpMonthly,
          bvgEmployer: bvgEmprMonthly,
          ktgUvgEmployee: ktgEmp,
          ktgUvgEmployer: ktgEmpr,
          net: netVal,
          totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
        };
      }

      /** Calculate all deductions from a gross salary (top-down) */
      function calcFromGross(grossVal: number) {
        const ahvEmp = Math.round(grossVal * ahvEmpRate * 100) / 100;
        const ahvEmpr = Math.round(grossVal * ahvEmprRate * 100) / 100;
        const ktgEmp = Math.round(grossVal * ktgEmpRate * 100) / 100;
        const ktgEmpr = Math.round(grossVal * ktgEmprRate * 100) / 100;
        const netVal = grossVal - ahvEmp - bvgEmpMonthly - ktgEmp;
        const totalEmployerCost = grossVal + ahvEmpr + bvgEmprMonthly + ktgEmpr;
        return {
          gross: grossVal,
          ahvEmployee: ahvEmp,
          ahvEmployer: ahvEmpr,
          bvgEmployee: bvgEmpMonthly,
          bvgEmployer: bvgEmprMonthly,
          ktgUvgEmployee: ktgEmp,
          ktgUvgEmployer: ktgEmpr,
          net: Math.round(netVal * 100) / 100,
          totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
        };
      }

      const MONTH_NAMES_DE: Record<string, number> = {
        januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
        juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, mai2: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12,
      };

      // Parse employee code and month from description like "Lohn MW März 2026", "Lohn AS-C Januar 2026", "Akontozahlung MW März 2026"
      function parsePayrollDesc(desc: string): { empCode: string | null; month: number | null; year: number | null } {
        // Try multiple patterns:
        // 1. "Lohn MW März 2026" / "Lohn AS-C Januar 2026"
        // 2. "Akontozahlung MW März 2026"
        const patterns = [
          /Lohn\s+([\w-]+)\s+([A-Za-z\u00C0-\u017F]+)\s+(\d{4})/i,
          /Akontozahlung\s+([\w-]+)\s+([A-Za-z\u00C0-\u017F]+)\s+(\d{4})/i,
          /Gehalt\s+([\w-]+)\s+([A-Za-z\u00C0-\u017F]+)\s+(\d{4})/i,
        ];
        for (const pattern of patterns) {
          const m = desc.match(pattern);
          if (!m) continue;
          const empCode = m[1].toLowerCase();
          const monthStr = m[2].toLowerCase();
          const year = parseInt(m[3]);
          const month = MONTH_NAMES_DE[monthStr] ?? null;
          if (month) return { empCode, month, year };
        }
        return { empCode: null, month: null, year: null };
      }

      // ── Source 1: Journal entries (if any exist) ──
      const lohnEntries = await db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.fiscalYear, input.year),
            sql`(${journalEntries.description} LIKE '%Lohn%' OR ${journalEntries.description} LIKE '%Akontozahlung%' OR ${journalEntries.description} LIKE '%Gehalt%')`
          )
        );

      const salaryAccounts = await db.select().from(accounts).where(
        sql`${accounts.number} IN ('4000','4001','4002','4003','4004','4005')`
      );
      const salaryAccIds = new Set(salaryAccounts.map(a => a.id));

      const personalBankAccounts = await db.select().from(accounts).where(
        sql`${accounts.number} IN ('1031','1032','1033','1071','1081','1082','1083')`
      );
      const personalBankAccIds = new Set(personalBankAccounts.map(a => a.id));

      type PayrollKey = string;
      const grouped: Map<PayrollKey, {
        empCode: string; year: number; month: number;
        grossFromSalaryAcc: number; netFromBankAcc: number;
        sourceCount: number; source: 'journal' | 'bank';
      }> = new Map();

      // Process journal entries
      for (const entry of lohnEntries) {
        const { empCode, month, year } = parsePayrollDesc(entry.description ?? "");
        if (!empCode || !month || !year) continue;

        // Fetch all lines for this entry
        const lines = await db.select({ line: journalLines }).from(journalLines).where(eq(journalLines.entryId, entry.id));

        // CRITICAL: Only process entries that have at least one line on a salary account (4000-4005)
        // This filters out bank-to-bank transfers that happen to have "Lohn" in the description
        const hasSalaryAccLine = lines.some(({ line }) => salaryAccIds.has(line.accountId));
        if (!hasSalaryAccLine) continue;

        const key: PayrollKey = `${empCode}-${year}-${month}`;
        if (!grouped.has(key)) {
          grouped.set(key, { empCode, year, month, grossFromSalaryAcc: 0, netFromBankAcc: 0, sourceCount: 0, source: 'journal' });
        }
        const g = grouped.get(key)!;
        g.sourceCount++;

        for (const { line } of lines) {
          const amt = parseFloat(line.amount as string);
          if (line.side === "debit" && salaryAccIds.has(line.accountId)) g.grossFromSalaryAcc += amt;
          if (line.side === "credit" && personalBankAccIds.has(line.accountId)) g.netFromBankAcc += amt;
        }
      }

      // ── Source 2: Bank transactions with Lohn descriptions (ALWAYS check, not just fallback) ──
      {
        const yearStart = `${input.year}-01-01`;
        const yearEnd = `${input.year}-12-31`;
        const lohnTxns = await db.select().from(bankTransactions).where(
          and(
            sql`(${bankTransactions.description} LIKE '%Lohn%' OR ${bankTransactions.description} LIKE '%Akontozahlung%' OR ${bankTransactions.description} LIKE '%Gehalt%')`,
            sql`${bankTransactions.transactionDate} >= ${yearStart}`,
            sql`${bankTransactions.transactionDate} <= ${yearEnd}`
          )
        );

        for (const tx of lohnTxns) {
          const desc = tx.description ?? "";
          const { empCode, month, year } = parsePayrollDesc(desc);
          if (!empCode || !month || !year) continue;

          // Skip transfer transactions (bank-to-bank) – these are not salary payments
          if (tx.isTransfer || tx.status === 'matched') continue;

          // Only consider OUTGOING transactions (negative amount = salary paid out)
          const rawAmt = parseFloat(tx.amount as string);
          if (rawAmt >= 0) continue; // Incoming transactions are not salary payments

          // Only consider transactions for known employees (mw, jm)
          const emp = emps.find(e => e.code?.toLowerCase() === empCode);
          if (!emp) continue;

          const key: PayrollKey = `${empCode}-${year}-${month}`;
          // Only add from bank if we don't already have this from journal
          if (grouped.has(key) && grouped.get(key)!.source === 'journal') continue;

          if (!grouped.has(key)) {
            grouped.set(key, { empCode, year, month, grossFromSalaryAcc: 0, netFromBankAcc: 0, sourceCount: 0, source: 'bank' });
          }
          const g = grouped.get(key)!;
          if (!g.netFromBankAcc) g.sourceCount++;

          const amt = Math.abs(rawAmt);
          g.netFromBankAcc += amt;
        }
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const g of Array.from(grouped.values())) {
        const emp = emps.find(e => e.code?.toLowerCase() === g.empCode);
        if (!emp) { skipped++; continue; }

        let calc;
        if (g.grossFromSalaryAcc > 0 && g.netFromBankAcc > 0) {
          // We have both salary account debit and bank credit
          if (Math.abs(g.grossFromSalaryAcc - g.netFromBankAcc) < 0.01) {
            // Same amount on salary account and bank → the booked amount is actually the NET
            // (single entry: debit salary acc, credit bank for the net payment)
            // Use bottom-up to calculate the real gross
            calc = calcFromNet(g.netFromBankAcc);
          } else if (g.grossFromSalaryAcc > g.netFromBankAcc) {
            // Salary account has more than bank → salary account has gross, bank has net
            calc = calcFromGross(g.grossFromSalaryAcc);
            calc.net = g.netFromBankAcc; // Use actual net from bank
          } else {
            // Unusual: bank > salary account → treat bank as net
            calc = calcFromNet(g.netFromBankAcc);
          }
        } else if (g.grossFromSalaryAcc > 0) {
          // Only salary account → could be gross or net, assume net for safety
          // (most small businesses book net payments to salary accounts)
          calc = calcFromNet(g.grossFromSalaryAcc);
        } else if (g.netFromBankAcc > 0) {
          // Only net salary from bank transactions → bottom-up calculation
          calc = calcFromNet(g.netFromBankAcc);
        } else {
          skipped++;
          continue;
        }

        // Check if payroll entry already exists
        const existing = await db.select().from(payrollEntries).where(
          and(
            eq(payrollEntries.employeeId, emp.id),
            eq(payrollEntries.year, g.year),
            eq(payrollEntries.month, g.month)
          )
        ).limit(1);

        const payrollData = {
          grossSalary: calc.gross.toFixed(2),
          ahvEmployee: calc.ahvEmployee.toFixed(2),
          ahvEmployer: calc.ahvEmployer.toFixed(2),
          bvgEmployee: calc.bvgEmployee.toFixed(2),
          bvgEmployer: calc.bvgEmployer.toFixed(2),
          ktgUvgEmployee: calc.ktgUvgEmployee.toFixed(2),
          ktgUvgEmployer: calc.ktgUvgEmployer.toFixed(2),
          netSalary: calc.net.toFixed(2),
          totalEmployerCost: calc.totalEmployerCost.toFixed(2),
        };

        if (existing.length > 0) {
          // Update existing entry (even if approved, since we're fixing data)
          await db.update(payrollEntries).set({
            ...payrollData,
            notes: `Aktualisiert aus ${g.source === 'journal' ? 'Journal' : 'Banktransaktionen'} (${g.sourceCount} Buchung${g.sourceCount !== 1 ? "en" : ""})`,
          }).where(eq(payrollEntries.id, existing[0].id));
          updated++;
        } else {
          await db.insert(payrollEntries).values({
            organizationId: ctx.organizationId,
            employeeId: emp.id,
            year: g.year,
            month: g.month,
            ...payrollData,
            status: "approved",
            notes: `Aus ${g.source === 'journal' ? 'Journal' : 'Banktransaktionen'} importiert (${g.sourceCount} Buchung${g.sourceCount !== 1 ? "en" : ""})`,
          });
          created++;
        }
      }

      return { created, updated, skipped, total: grouped.size };
    }),

  // Recalculate all payroll entries with current insurance settings
  recalculate: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load insurance settings
      const allInsurance = await db.select().from(insuranceSettings).where(eq(insuranceSettings.isActive, true));
      const ahvSetting = allInsurance.find(s => s.insuranceType === 'ahv');
      const bvgSetting = allInsurance.find(s => s.insuranceType === 'bvg');
      const ktgSetting = allInsurance.find(s => s.insuranceType === 'ktg' || s.insuranceType === 'uvg');

      const ahvEmpRate = ahvSetting ? parseFloat(ahvSetting.employeeRate as string ?? '0') / 100 : 0.064;
      const ahvEmprRate = ahvSetting ? parseFloat(ahvSetting.employerRate as string ?? '0') / 100 : 0.064;
      const bvgEmpMonthly = bvgSetting?.bvgEmployeeMonthly ? parseFloat(bvgSetting.bvgEmployeeMonthly as string) : 0;
      const bvgEmprMonthly = bvgSetting?.bvgEmployerMonthly ? parseFloat(bvgSetting.bvgEmployerMonthly as string) : 0;
      const ktgEmpRate = ktgSetting ? parseFloat(ktgSetting.employeeRate as string ?? '0') / 100 : 0;
      const ktgEmprRate = ktgSetting ? parseFloat(ktgSetting.employerRate as string ?? '0') / 100 : 0;

      // Get all payroll entries for the year
      const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.year, input.year));

      let recalculated = 0;
      for (const entry of entries) {
        const currentNet = parseFloat(entry.netSalary as string);
        const currentGross = parseFloat(entry.grossSalary as string);
        const currentAhv = parseFloat((entry.ahvEmployee as string) ?? '0');

        // Determine if this entry needs recalculation:
        // If deductions are all 0 or gross <= net, recalculate from net
        const needsRecalc = currentAhv === 0 || currentGross <= currentNet;

        if (needsRecalc && currentNet > 0) {
          // Bottom-up: calculate gross from net
          const grossVal = (currentNet + bvgEmpMonthly) / (1 - ahvEmpRate - ktgEmpRate);
          const ahvEmp = Math.round(grossVal * ahvEmpRate * 100) / 100;
          const ahvEmpr = Math.round(grossVal * ahvEmprRate * 100) / 100;
          const ktgEmp = Math.round(grossVal * ktgEmpRate * 100) / 100;
          const ktgEmpr = Math.round(grossVal * ktgEmprRate * 100) / 100;
          const totalEmployerCost = grossVal + ahvEmpr + bvgEmprMonthly + ktgEmpr;

          await db.update(payrollEntries).set({
            grossSalary: (Math.round(grossVal * 100) / 100).toFixed(2),
            ahvEmployee: ahvEmp.toFixed(2),
            ahvEmployer: ahvEmpr.toFixed(2),
            bvgEmployee: bvgEmpMonthly.toFixed(2),
            bvgEmployer: bvgEmprMonthly.toFixed(2),
            ktgUvgEmployee: ktgEmp.toFixed(2),
            ktgUvgEmployer: ktgEmpr.toFixed(2),
            totalEmployerCost: (Math.round(totalEmployerCost * 100) / 100).toFixed(2),
            notes: `Abzüge neu berechnet (AHV ${(ahvEmpRate * 100).toFixed(1)}%, BVG CHF ${bvgEmpMonthly.toFixed(2)}/Mt.)`,
          }).where(eq(payrollEntries.id, entry.id));
          recalculated++;
        }
      }

      return { recalculated, total: entries.length };
    }),

  approve: orgProcedure
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
      const grossAcc = await getAccountByNumber(ctx.organizationId, grossAccNum);
      const ahvAcc = await getAccountByNumber(ctx.organizationId, "4010");
      const bvgAcc = await getAccountByNumber(ctx.organizationId, "4040");
      const ktgAcc = await getAccountByNumber(ctx.organizationId, "4025");
      const bankAcc = await getAccountByNumber(ctx.organizationId, "1032"); // LUKB mw
      const kkAcc = emp.code === "mw"
        ? await getAccountByNumber(ctx.organizationId, "1081")
        : await getAccountByNumber(ctx.organizationId, "1071");

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
        organizationId: ctx.organizationId,
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

  // Get bank transactions linked to a payroll entry (by employee code + month/year)
  getTransactions: orgProcedure
    .input(z.object({ employeeId: z.number(), year: z.number(), month: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get the employee
      const [emp] = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
      if (!emp) return [];

      const empCode = emp.code?.toLowerCase() ?? '';

      // Month names for matching
      const MONTH_NAMES: Record<number, string[]> = {
        1: ['januar', 'jan'], 2: ['februar', 'feb'], 3: ['märz', 'maerz', 'mar'],
        4: ['april', 'apr'], 5: ['mai'], 6: ['juni', 'jun'],
        7: ['juli', 'jul'], 8: ['august', 'aug'], 9: ['september', 'sep'],
        10: ['oktober', 'okt'], 11: ['november', 'nov'], 12: ['dezember', 'dez'],
      };
      const monthNames = MONTH_NAMES[input.month] ?? [];

      // Search bank transactions that match the employee and month
      // Pattern: "Lohn {empCode} {monthName} {year}" in description or suggestedBookingText
      const yearStart = `${input.year}-01-01`;
      const yearEnd = `${input.year}-12-31`;
      const allTxns = await db.select({
        id: bankTransactions.id,
        transactionDate: bankTransactions.transactionDate,
        amount: bankTransactions.amount,
        description: bankTransactions.description,
        suggestedBookingText: bankTransactions.suggestedBookingText,
        counterparty: bankTransactions.counterparty,
        status: bankTransactions.status,
        bankAccountId: bankTransactions.bankAccountId,
      }).from(bankTransactions).where(
        and(
          sql`${bankTransactions.transactionDate} >= ${yearStart}`,
          sql`${bankTransactions.transactionDate} <= ${yearEnd}`,
          sql`(${bankTransactions.description} LIKE ${'%Lohn%'} OR ${bankTransactions.suggestedBookingText} LIKE ${'%Lohn%'})`
        )
      );

      // Filter by employee code and month
      const matched = allTxns.filter(tx => {
        const text = ((tx.description ?? '') + ' ' + (tx.suggestedBookingText ?? '')).toLowerCase();
        // Must contain employee code
        if (!text.includes(empCode)) return false;
        // Must contain month name
        const hasMonth = monthNames.some(m => text.includes(m));
        if (!hasMonth) return false;
        // Must contain year
        if (!text.includes(String(input.year))) return false;
        return true;
      });

      // Enrich with bank account name
      const bankAccs = await db.select().from(bankAccounts);
      const bankAccMap = new Map(bankAccs.map(b => [b.id, b.name]));

      return matched.map(tx => ({
        ...tx,
        bankAccountName: bankAccMap.get(tx.bankAccountId) ?? 'Unbekannt',
      }));
    }),

  generateLohnausweisPdf: orgProcedure
    .input(z.object({ year: z.number(), employeeId: z.number() }))
    .mutation(async ({ input }) => {
      const { PDFDocument } = await import('pdf-lib');
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Fetch employee
      const [emp] = await db.select().from(employees).where(eq(employees.id, input.employeeId));
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Mitarbeiter nicht gefunden' });

      // Fetch company settings
      const [company] = await db.select().from(companySettings);

      // Fetch payroll entries for the year
      const rows = await db.select().from(payrollEntries)
        .where(and(eq(payrollEntries.year, input.year), eq(payrollEntries.employeeId, input.employeeId)))
        .orderBy(payrollEntries.month);

      // Calculate totals
      let totalGross = 0, totalAhvEmp = 0, totalBvgEmp = 0, totalNet = 0;
      for (const r of rows) {
        totalGross += parseFloat(r.grossSalary as string);
        totalAhvEmp += parseFloat((r.ahvEmployee as string) ?? '0');
        totalBvgEmp += parseFloat((r.bvgEmployee as string) ?? '0');
        totalNet += parseFloat(r.netSalary as string);
      }

      // Download the official Lohnausweis Form 11 template PDF from CDN
      // This is an AcroForm PDF with fillable fields
      const templateUrl = 'https://d2xsxph8kpxj0f.cloudfront.net/114467201/g3uYPYRzWxJLqW5bmLAtac/WeibelMarcArlesheim,Lohnausweis2024_14cdeaee.pdf';
      const templateBytes = await fetch(templateUrl).then(r => r.arrayBuffer());
      const pdfDoc = await PDFDocument.load(templateBytes);

      // Get the form and fill in all fields
      const form = pdfDoc.getForm();

      // Format CHF as whole francs (official form uses only whole amounts)
      const chf = (v: number) => String(Math.round(v));

      // Determine employment period
      const startDate = emp.employmentStart ? new Date(emp.employmentStart) : new Date(input.year, 0, 1);
      const endDate = emp.employmentEnd ? new Date(emp.employmentEnd) : new Date(input.year, 11, 31);
      const von = `${String(startDate.getDate()).padStart(2,'0')}.${String(startDate.getMonth()+1).padStart(2,'0')}.${String(startDate.getFullYear()).slice(-2)}`;
      const bis = `${String(endDate.getDate()).padStart(2,'0')}.${String(endDate.getMonth()+1).padStart(2,'0')}.${String(endDate.getFullYear()).slice(-2)}`;

      // === FILL FORM FIELDS ===

      // AHV-Nr (Neue AHV-Nr)
      form.getTextField('C2').setText(emp.ahvNumber ?? '');

      // Year
      form.getTextField('D').setText(String(input.year));

      // Employment period
      form.getTextField('E-von').setText(von);
      form.getTextField('E-bis').setText(bis);

      // Employee name and address
      const empName = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
      form.getTextField('HAnrede').setText(empName);
      form.getTextField('HName').setText(emp.street ?? '');
      const empCity = [emp.zipCode, emp.city].filter(Boolean).join(' ');
      form.getTextField('HAdresse').setText(empCity);
      form.getTextField('HPostfach').setText('');

      // Amount fields
      // Ziffer 1: Lohn/Rente
      form.getTextField('1').setText(chf(totalGross));
      // Ziffer 8: Bruttolohn total
      form.getTextField('8').setText(chf(totalGross));
      // Ziffer 9: AHV/IV/EO/ALV/NBUV
      form.getTextField('9').setText(chf(totalAhvEmp));
      // Ziffer 10.1: BVG ordentliche Beiträge
      form.getTextField('10-1').setText(chf(totalBvgEmp));
      // Total Abzüge (Ziffer 9 + 10)
      const totalDeductions = Math.round(totalAhvEmp) + Math.round(totalBvgEmp);
      form.getTextField('abzuege').setText(String(totalDeductions));
      // Ziffer 11: Nettolohn
      form.getTextField('11').setText(chf(totalNet));

      // Clear unused amount fields to ensure they're empty
      const emptyFields = ['2-1', '2-2', '2-3-1', '2-3-2', '3-1', '3-2', '4-1', '4-2',
        '5', '6', '7-1', '7-1-2', '10-2', '12',
        '13-1-1-2', '13-1-2-1', '13-1-2-2', '13-2-1-2', '13-2-2-2',
        '13-2-3-1', '13-2-3-2', '13-3', '14-1', '14-2'];
      for (const fieldName of emptyFields) {
        try { form.getTextField(fieldName).setText(''); } catch { /* field may not exist */ }
      }

      // Bemerkungen (Ziffer 15)
      if (emp.lohnausweisRemarks) {
        const lines = emp.lohnausweisRemarks.split('\n');
        if (lines[0]) form.getTextField('15-1').setText(lines[0]);
        if (lines[1]) form.getTextField('15-2').setText(lines[1]);
      } else {
        form.getTextField('15-1').setText('');
        form.getTextField('15-2').setText('');
      }

      // Ort und Datum
      const today = new Date();
      const ortDatum = `${company?.city ?? ''}, ${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getFullYear()).slice(-2)}`;
      form.getTextField('OrtDatum').setText(ortDatum);

      // Company info (Unterschrift)
      form.getTextField('Unterschrift1.0').setText(company?.companyName ?? '');
      const contactName = process.env.OWNER_NAME ?? '';
      form.getTextField('Unterschrift1.1').setText(contactName);
      form.getTextField('Unterschrift1.2').setText(company?.street ?? '');
      const companyCity = [company?.zipCode, company?.city].filter(Boolean).join(' ');
      form.getTextField('Unterschrift1.3').setText(companyCity);
      form.getTextField('Unterschrift1.4').setText(company?.phone ? `Tel. ${company.phone}` : '');

      // Checkbox A: Lohnausweis (always checked)
      form.getCheckBox('A').check();

      // Flatten the form so it becomes a static PDF (non-editable)
      form.flatten();

      // Serialize the PDF
      const pdfBytes = await pdfDoc.save();
      const base64 = Buffer.from(pdfBytes).toString('base64');
      return { base64, filename: `Lohnausweis_${emp.code}_${input.year}.pdf` };
    }),
});

// ─── Reports Router ───────────────────────────────────────────────────────────
const reportsRouter = router({
  balanceSheet: orgProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input, ctx }) => getBalanceSheet(ctx.organizationId, input.fiscalYear)),

  incomeStatement: orgProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input, ctx }) => getIncomeStatement(ctx.organizationId, input.fiscalYear)),

  dashboard: orgProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input, ctx }) => getDashboardStats(ctx.organizationId, input.fiscalYear)),
});

// ─── VAT Router ───────────────────────────────────────────────────────────────
const vatRouter = router({
  list: orgProcedure
    .input(z.object({ year: z.number().optional() }))
    .query(({ input, ctx }) => getVatPeriods(ctx.organizationId, input.year)),

  create: orgProcedure
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

      const startDate = toDateStr(input.startDate) as string;
      const endDate = toDateStr(input.endDate) as string;

      // Get company settings to determine VAT method (scoped to this org)
      const [settings] = await db.select().from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId))
        .limit(1);
      const vatMethod = settings?.vatMethod ?? "effective";
      const saldoRate = parseFloat(settings?.vatSaldoRate as string ?? "6.20");

      // Calculate turnover from approved journal entries in the period (scoped)
      const entries = await db.select({
        entryId: journalEntries.id,
        bookingDate: journalEntries.bookingDate,
      }).from(journalEntries)
        .where(and(
          eq(journalEntries.organizationId, ctx.organizationId),
          eq(journalEntries.status, "approved"),
          gte(journalEntries.bookingDate, startDate),
          lte(journalEntries.bookingDate, endDate),
        ));

      if (entries.length === 0) {
        // No entries – insert with zeros
        const [result] = await db.insert(vatPeriods).values({
          organizationId: ctx.organizationId,
          year: input.year,
          period: input.period,
          startDate,
          endDate,
        });
        return { periodId: (result as any).insertId };
      }

      const entryIds = entries.map(e => e.entryId);

      // Get all journal lines for these entries that are on VAT-relevant revenue accounts
      // Revenue accounts have credit-side entries (Haben = Ertrag)
      const vatRevenueAccounts = await db.select({
        id: accounts.id,
        number: accounts.number,
        defaultVatRate: accounts.defaultVatRate,
      }).from(accounts)
        .where(and(
          eq(accounts.isVatRelevant, true),
          eq(accounts.accountType, "revenue"),
        ));

      const vatAccountIds = vatRevenueAccounts.map(a => a.id);

      let totalTurnover = 0;
      let turnover81 = 0;
      let turnover26 = 0;
      let turnover38 = 0;

      if (vatAccountIds.length > 0) {
        // Get all credit-side lines on VAT-relevant revenue accounts for these entries
        const lines = await db.select({
          accountId: journalLines.accountId,
          amount: journalLines.amount,
          side: journalLines.side,
          vatRate: journalLines.vatRate,
        }).from(journalLines)
          .where(and(
            inArray(journalLines.entryId, entryIds),
            inArray(journalLines.accountId, vatAccountIds),
          ));

        for (const line of lines) {
          const amt = parseFloat(line.amount as string);
          // Revenue is on credit side; if debit, it's a reversal
          const signedAmt = line.side === "credit" ? amt : -amt;

          // Determine VAT rate: use line vatRate, or fall back to account defaultVatRate
          const lineVatRate = line.vatRate ? parseFloat(line.vatRate as string) : null;
          const acct = vatRevenueAccounts.find(a => a.id === line.accountId);
          const acctVatRate = acct?.defaultVatRate ? parseFloat(acct.defaultVatRate as string) : null;
          const effectiveRate = lineVatRate ?? acctVatRate ?? 8.1;

          totalTurnover += signedAmt;

          if (effectiveRate >= 7) {
            turnover81 += signedAmt;
          } else if (effectiveRate >= 3) {
            turnover38 += signedAmt;
          } else {
            turnover26 += signedAmt;
          }
        }
      }

      // Calculate VAT due based on method
      let vatDue81 = 0, vatDue26 = 0, vatDue38 = 0;

      if (vatMethod === "saldo") {
        // Saldosteuersatz: one flat rate on total turnover
        // All turnover goes into turnover81 bucket for simplicity
        const totalVat = totalTurnover * (saldoRate / 100);
        turnover81 = totalTurnover;
        turnover26 = 0;
        turnover38 = 0;
        vatDue81 = totalVat;
      } else {
        // Effective method: apply individual rates
        vatDue81 = turnover81 * 0.081;
        vatDue26 = turnover26 * 0.026;
        vatDue38 = turnover38 * 0.038;
      }

      // Input tax (Vorsteuer) – sum of vatAmount on debit-side lines on expense accounts
      let inputTax = 0;
      if (vatMethod === "effective") {
        const expenseAccounts = await db.select({ id: accounts.id }).from(accounts)
          .where(and(
            eq(accounts.isVatRelevant, true),
            eq(accounts.accountType, "expense"),
          ));
        const expenseIds = expenseAccounts.map(a => a.id);
        if (expenseIds.length > 0) {
          const expenseLines = await db.select({
            vatAmount: journalLines.vatAmount,
            side: journalLines.side,
          }).from(journalLines)
            .where(and(
              inArray(journalLines.entryId, entryIds),
              inArray(journalLines.accountId, expenseIds),
            ));
          for (const line of expenseLines) {
            if (line.vatAmount) {
              inputTax += parseFloat(line.vatAmount as string);
            }
          }
        }
      }
      // For Saldosteuersatz: no Vorsteuer deduction

      const netVatPayable = (vatDue81 + vatDue26 + vatDue38) - inputTax;

      const [result] = await db.insert(vatPeriods).values({
        organizationId: ctx.organizationId,
        year: input.year,
        period: input.period,
        startDate,
        endDate,
        turnover81: turnover81.toFixed(2),
        turnover26: turnover26.toFixed(2),
        turnover38: turnover38.toFixed(2),
        vatDue81: vatDue81.toFixed(2),
        vatDue26: vatDue26.toFixed(2),
        vatDue38: vatDue38.toFixed(2),
        inputTax: inputTax.toFixed(2),
        netVatPayable: netVatPayable.toFixed(2),
      });
      return { periodId: (result as any).insertId };
    }),

  detail: publicProcedure
    .input(z.object({ vatPeriodId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get the VAT period
      const [vp] = await db.select().from(vatPeriods).where(eq(vatPeriods.id, input.vatPeriodId));
      if (!vp) throw new TRPCError({ code: "NOT_FOUND", message: "MWST-Periode nicht gefunden" });

      const startDate = vp.startDate;
      const endDate = vp.endDate;

      // Get company settings for VAT method
      const [settings] = await db.select().from(companySettings).limit(1);
      const vatMethod = settings?.vatMethod ?? "effective";
      const saldoRate = parseFloat(settings?.vatSaldoRate as string ?? "6.20");

      // Get all approved journal entries in the date range
      const entries = await db.select({
        entryId: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        bookingDate: journalEntries.bookingDate,
        description: journalEntries.description,
        source: journalEntries.source,
      }).from(journalEntries)
        .where(and(
          eq(journalEntries.status, "approved"),
          gte(journalEntries.bookingDate, startDate),
          lte(journalEntries.bookingDate, endDate),
        ))
        .orderBy(asc(journalEntries.bookingDate));

      if (entries.length === 0) {
        return { period: vp, vatMethod, saldoRate, transactions: [] };
      }

      const entryIds = entries.map(e => e.entryId);

      // Get all journal lines for these entries
      const allLines = await db.select({
        id: journalLines.id,
        entryId: journalLines.entryId,
        accountId: journalLines.accountId,
        side: journalLines.side,
        amount: journalLines.amount,
        description: journalLines.description,
        vatAmount: journalLines.vatAmount,
        vatRate: journalLines.vatRate,
      }).from(journalLines)
        .where(inArray(journalLines.entryId, entryIds));

      // Get all accounts for lookup
      const allAccounts = await db.select({
        id: accounts.id,
        number: accounts.number,
        name: accounts.name,
        accountType: accounts.accountType,
        isVatRelevant: accounts.isVatRelevant,
        defaultVatRate: accounts.defaultVatRate,
      }).from(accounts);

      const accountMap = new Map(allAccounts.map(a => [a.id, a]));

      // Build transaction details
      type VatTransaction = {
        entryId: number;
        entryNumber: string | null;
        bookingDate: string;
        description: string;
        source: string;
        lines: Array<{
          accountNumber: string;
          accountName: string;
          side: string;
          amount: string;
          vatRate: string | null;
          vatAmount: string | null;
          isVatRelevant: boolean;
        }>;
        totalAmount: number;
        vatAmount: number;
        effectiveVatRate: number;
        category: 'revenue' | 'expense' | 'other';
      };

      const transactions: VatTransaction[] = [];

      for (const entry of entries) {
        const entryLines = allLines.filter(l => l.entryId === entry.entryId);
        let entryTotalAmount = 0;
        let entryVatAmount = 0;
        let hasVatRelevantLine = false;
        let category: 'revenue' | 'expense' | 'other' = 'other';

        const lineDetails = entryLines.map(line => {
          const acct = accountMap.get(line.accountId);
          const lineVatRate = line.vatRate ? parseFloat(line.vatRate as string) : null;
          const acctVatRate = acct?.defaultVatRate ? parseFloat(acct.defaultVatRate as string) : null;
          const effectiveRate = lineVatRate ?? acctVatRate;

          if (acct?.isVatRelevant) {
            hasVatRelevantLine = true;
            const amt = parseFloat(line.amount as string);
            if (acct.accountType === 'revenue') {
              category = 'revenue';
              const signedAmt = line.side === 'credit' ? amt : -amt;
              entryTotalAmount += signedAmt;
              // Calculate VAT for this line
              if (vatMethod === 'saldo') {
                entryVatAmount += signedAmt * (saldoRate / 100);
              } else {
                const rate = effectiveRate ?? 8.1;
                entryVatAmount += signedAmt * (rate / 100);
              }
            } else if (acct.accountType === 'expense') {
              category = 'expense';
              const signedAmt = line.side === 'debit' ? amt : -amt;
              entryTotalAmount += signedAmt;
              if (line.vatAmount) {
                entryVatAmount += parseFloat(line.vatAmount as string);
              }
            }
          }

          return {
            accountNumber: acct?.number ?? '?',
            accountName: acct?.name ?? 'Unbekannt',
            side: line.side,
            amount: line.amount as string,
            vatRate: effectiveRate !== null && effectiveRate !== undefined ? effectiveRate.toString() : null,
            vatAmount: line.vatAmount as string | null,
            isVatRelevant: acct?.isVatRelevant ?? false,
          };
        });

        if (hasVatRelevantLine) {
          const effectiveVatRate = entryTotalAmount !== 0
            ? (entryVatAmount / entryTotalAmount) * 100
            : 0;

          transactions.push({
            entryId: entry.entryId,
            entryNumber: entry.entryNumber,
            bookingDate: entry.bookingDate,
            description: entry.description,
            source: entry.source,
            lines: lineDetails,
            totalAmount: entryTotalAmount,
            vatAmount: entryVatAmount,
            effectiveVatRate,
            category,
          });
        }
      }

      return { period: vp, vatMethod, saldoRate, transactions };
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(vatPeriods).where(eq(vatPeriods.id, input.id));
      return { success: true };
    }),
});

// ─── Documents Router ─────────────────────────────────────────────────────────
const documentsRouter = router({
  list: orgProcedure
    .input(z.object({
      journalEntryId: z.number().optional(),
      bankTransactionId: z.number().optional(),
      documentType: z.string().optional(),
      fiscalYear: z.number().optional(),
      limit: z.number().default(200),
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
      if (input.fiscalYear) conditions.push(eqOp(docs.fiscalYear, input.fiscalYear));
      const rows = await db.select().from(docs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(descOp(docs.createdAt))
        .limit(input.limit);
      return rows;
    }),

  getAiMetadata: orgProcedure
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

  linkToEntry: orgProcedure
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

  // Update fiscal year for a document
  updateFiscalYear: orgProcedure
    .input(z.object({
      documentId: z.number(),
      fiscalYear: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      await db.update(docs).set({
        fiscalYear: input.fiscalYear,
      }).where(eqOp(docs.id, input.documentId));
      return { success: true };
    }),

  // Auto-match unmatched documents with pending bank transactions
  autoMatch: orgProcedure
    .input(z.object({ threshold: z.number().default(50) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docsTbl, bankTransactions: txnsTbl } = await import("../drizzle/schema");
      const { and, eq: eqOp, sql: sqlOp } = await import("drizzle-orm");
      // Debug: count what we have
      const unmatchedDocs = await db.select().from(docsTbl)
        .where(and(
          eqOp(docsTbl.organizationId, ctx.organizationId),
          eqOp(docsTbl.matchStatus, 'unmatched'),
          sqlOp`${docsTbl.aiMetadata} IS NOT NULL`,
        ));
      const pendingTxns = await db.select().from(txnsTbl)
        .where(and(
          eqOp(txnsTbl.organizationId, ctx.organizationId),
          eqOp(txnsTbl.status, 'pending'),
        ));
      const matches = await autoMatchDocuments(ctx.organizationId, input.threshold);
      const applied = await applyMatches(matches);
      return { matched: applied, total: matches.length, details: matches, debug: { unmatchedDocs: unmatchedDocs.length, pendingTxns: pendingTxns.length } };
    }),

  // Unmatch a document from a transaction
  unmatch: orgProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      await unmatchDocument(input.documentId);
      return { success: true };
    }),

  // Get match info for a bank transaction (document details + improved suggestion)
  getMatchInfo: orgProcedure
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

  // List unmatched documents for manual matching
  listUnmatched: orgProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { and, eq: eqOp, or, like, desc: descOp, isNull } = await import("drizzle-orm");
      const conditions = [
        or(
          eqOp(docs.matchStatus, 'unmatched'),
          isNull(docs.matchStatus),
        ),
      ];
      if (input.search) {
        const q = `%${input.search}%`;
        conditions.push(
          or(
            like(docs.filename, q),
            like(docs.aiMetadata, q),
            like(docs.notes, q),
          )!
        );
      }
      const rows = await db.select().from(docs)
        .where(and(...conditions))
        .orderBy(descOp(docs.createdAt))
        .limit(input.limit);
      return rows;
    }),

  // Get a single document by ID with full details
  getById: orgProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs, suppliers: suppliersTbl, accounts: acctsTbl } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      const [doc] = await db.select().from(docs).where(eqOp(docs.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden" });
      let metadata = null;
      if (doc.aiMetadata) {
        try { metadata = JSON.parse(doc.aiMetadata); } catch { /* ignore */ }
      }
      // Load linked supplier if exists
      let supplier = null;
      if (doc.supplierId) {
        const [s] = await db.select().from(suppliersTbl).where(eqOp(suppliersTbl.id, doc.supplierId));
        if (s) supplier = s;
      }
      // Get booking suggestion: Auto-Learn rule has PRIORITY, then matched Txn, then LLM suggestion
      let bookingSuggestion: { accountId: number | null; accountNumber: string | null; accountName: string | null; source: string; vatRate: number | null; bookingText: string | null } | null = null;
      const counterpartyName = metadata?.counterparty || supplier?.name;
      
      // 1. Try Auto-Learn rule (highest priority)
      if (counterpartyName) {
        const rule = await findMatchingRule(ctx.organizationId, counterpartyName);
        if (rule) {
          let acctName = null;
          let acctNumber = null;
          const acctId = rule.debitAccountId || rule.creditAccountId;
          if (acctId) {
            const [acct] = await db.select().from(acctsTbl).where(eqOp(acctsTbl.id, acctId));
            if (acct) { acctName = acct.name; acctNumber = acct.number; }
          }
          bookingSuggestion = {
            accountId: acctId || null,
            accountNumber: acctNumber,
            accountName: acctName,
            source: 'auto_learn',
            vatRate: rule.vatRate ? Number(rule.vatRate) : null,
            bookingText: rule.bookingTextTemplate || null,
          };
        }
      }
      
      // 2. Try matched bank transaction's account suggestion (if no auto-learn rule found)
      if (!bookingSuggestion && doc.bankTransactionId) {
        const { bankTransactions: txnsTbl } = await import("../drizzle/schema");
        const [txn] = await db.select().from(txnsTbl).where(eqOp(txnsTbl.id, doc.bankTransactionId));
        if (txn) {
          const sugAcctId = txn.suggestedDebitAccountId || txn.suggestedCreditAccountId;
          if (sugAcctId) {
            const [acct] = await db.select().from(acctsTbl).where(eqOp(acctsTbl.id, sugAcctId));
            if (acct) {
              bookingSuggestion = {
                accountId: acct.id,
                accountNumber: acct.number,
                accountName: acct.name,
                source: 'bank_import',
                vatRate: null,
                bookingText: txn.suggestedBookingText || null,
              };
            }
          }
        }
      }
      
      // 3. Also check via matchedDocumentId (reverse lookup: find txn that has this doc matched)
      if (!bookingSuggestion) {
        const { bankTransactions: txnsTbl } = await import("../drizzle/schema");
        const [matchedTxn] = await db.select().from(txnsTbl).where(eqOp(txnsTbl.matchedDocumentId, doc.id));
        if (matchedTxn) {
          const sugAcctId = matchedTxn.suggestedDebitAccountId || matchedTxn.suggestedCreditAccountId;
          if (sugAcctId) {
            const [acct] = await db.select().from(acctsTbl).where(eqOp(acctsTbl.id, sugAcctId));
            if (acct) {
              bookingSuggestion = {
                accountId: acct.id,
                accountNumber: acct.number,
                accountName: acct.name,
                source: 'bank_import',
                vatRate: null,
                bookingText: matchedTxn.suggestedBookingText || null,
              };
            }
          }
        }
      }
      
      // 4. LLM suggestion as final fallback
      if (!bookingSuggestion && metadata?.suggestedAccount) {
        const acctNum = String(metadata.suggestedAccount);
        const acct = await getAccountByNumber(ctx.organizationId, acctNum);
        bookingSuggestion = {
          accountId: acct?.id || null,
          accountNumber: acctNum,
          accountName: acct?.name || null,
          source: 'llm',
          vatRate: metadata.vatRate || null,
          bookingText: metadata.description || null,
        };
      }
      
      // 5. Load linked bank transaction details for "Verbuchen" tab
      let linkedTransaction: {
        id: number;
        transactionDate: string;
        description: string | null;
        amount: string;
        counterparty: string | null;
        status: string;
        journalEntryId: number | null;
        suggestedDebitAccountId: number | null;
        suggestedCreditAccountId: number | null;
        suggestedBookingText: string | null;
        bankAccountId: number | null;
      } | null = null;
      
      // Check via bankTransactionId on document
      if (doc.bankTransactionId) {
        const { bankTransactions: txnsTbl2 } = await import("../drizzle/schema");
        const [txn] = await db.select().from(txnsTbl2).where(eqOp(txnsTbl2.id, doc.bankTransactionId));
        if (txn) linkedTransaction = {
          id: txn.id,
          transactionDate: txn.transactionDate as string,
          description: txn.description,
          amount: txn.amount as string,
          counterparty: txn.counterparty,
          status: txn.status,
          journalEntryId: txn.journalEntryId,
          suggestedDebitAccountId: txn.suggestedDebitAccountId,
          suggestedCreditAccountId: txn.suggestedCreditAccountId,
          suggestedBookingText: txn.suggestedBookingText,
          bankAccountId: txn.bankAccountId,
        };
      }
      // Also check reverse lookup
      if (!linkedTransaction) {
        const { bankTransactions: txnsTbl3 } = await import("../drizzle/schema");
        const [matchedTxn2] = await db.select().from(txnsTbl3).where(eqOp(txnsTbl3.matchedDocumentId, doc.id));
        if (matchedTxn2) linkedTransaction = {
          id: matchedTxn2.id,
          transactionDate: matchedTxn2.transactionDate as string,
          description: matchedTxn2.description,
          amount: matchedTxn2.amount as string,
          counterparty: matchedTxn2.counterparty,
          status: matchedTxn2.status,
          journalEntryId: matchedTxn2.journalEntryId,
          suggestedDebitAccountId: matchedTxn2.suggestedDebitAccountId,
          suggestedCreditAccountId: matchedTxn2.suggestedCreditAccountId,
          suggestedBookingText: matchedTxn2.suggestedBookingText,
          bankAccountId: matchedTxn2.bankAccountId,
        };
      }
      
      // Load bank account info for the linked transaction
      let linkedBankAccount: { id: number; accountId: number | null; name: string } | null = null;
      if (linkedTransaction?.bankAccountId) {
        const { bankAccounts: baTbl } = await import("../drizzle/schema");
        const [ba] = await db.select().from(baTbl).where(eqOp(baTbl.id, linkedTransaction.bankAccountId));
        if (ba) linkedBankAccount = { id: ba.id, accountId: ba.accountId, name: ba.bank || ba.name || `Konto ${ba.id}` };
      }
      
      // Load journal entry status for direct-booked documents (without linked bank transaction)
      let journalEntryStatus: string | null = null;
      if (doc.journalEntryId && !linkedTransaction) {
        const { journalEntries: jeTbl } = await import("../drizzle/schema");
        const [je] = await db.select({ status: jeTbl.status }).from(jeTbl).where(eqOp(jeTbl.id, doc.journalEntryId)).limit(1);
        if (je) journalEntryStatus = je.status;
      }
      
      return { document: doc, metadata, supplier, bookingSuggestion, linkedTransaction, linkedBankAccount, journalEntryStatus };
    }),

  // Update document metadata (user edits from detail view)
  updateMetadata: orgProcedure
    .input(z.object({
      documentId: z.number(),
      metadata: z.record(z.string(), z.any()).optional(),
      notes: z.string().optional(),
      documentType: z.string().optional(),
      supplierId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      
      // Get current document
      const [doc] = await db.select().from(docs).where(eqOp(docs.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden" });

      const updates: Record<string, any> = {};

      // Merge metadata: keep existing fields, overwrite with new values
      if (input.metadata) {
        let existing: any = {};
        if (doc.aiMetadata) {
          try { existing = JSON.parse(doc.aiMetadata); } catch { /* ignore */ }
        }
        const merged = { ...existing, ...input.metadata };
        updates.aiMetadata = JSON.stringify(merged);
      }

      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.documentType !== undefined) updates.documentType = input.documentType;
      if (input.supplierId !== undefined) updates.supplierId = input.supplierId;

      if (Object.keys(updates).length > 0) {
        await db.update(docs).set(updates).where(eqOp(docs.id, input.documentId));
      }

      // Return updated document
      const [updated] = await db.select().from(docs).where(eqOp(docs.id, input.documentId));
      return { success: true, document: updated };
    }),

  // Re-analyze a document with AI (re-extract metadata)
  reanalyze: orgProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      const [doc] = await db.select().from(docs).where(eqOp(docs.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden" });

      const isPdf = doc.mimeType === "application/pdf";
      const isImage = doc.mimeType.startsWith("image/");
      if (!isPdf && !isImage) throw new TRPCError({ code: "BAD_REQUEST", message: "Nur PDF und Bilder können analysiert werden" });

      const contentPart = isPdf
        ? { type: "file_url" as const, file_url: { url: doc.s3Url, mime_type: "application/pdf" as const } }
        : { type: "image_url" as const, image_url: { url: doc.s3Url, detail: "high" as const } };

      const extractResp = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Du bist ein Schweizer Buchhalter. Extrahiere aus dem Beleg folgende Informationen als JSON:
{
  "documentDate": "YYYY-MM-DD oder null",
  "dueDate": "YYYY-MM-DD oder null (F\u00e4lligkeitsdatum / Zahlungsfrist)",
  "invoiceNumber": "Rechnungsnummer/Belegnummer oder null",
  "totalAmount": Zahl oder null,
  "netAmount": Zahl oder null (Nettobetrag ohne MWST),
  "vatAmount": Zahl oder null,
  "vatRate": Zahl (z.B. 8.1) oder null,
  "currency": "CHF" oder andere,
  "counterparty": "Firmenname oder Person",
  "counterpartyUid": "UID-Nummer (z.B. CHE-123.456.789) oder null",
  "counterpartyVatNumber": "MWST-Nummer oder null",
  "counterpartyStreet": "Strasse und Hausnummer oder null",
  "counterpartyZipCode": "PLZ oder null",
  "counterpartyCity": "Ort oder null",
  "counterpartyCountry": "Land oder null (Standard: Schweiz)",
  "counterpartyIban": "IBAN oder null",
  "qrReference": "QR-Referenz oder SCOR-Referenz oder null",
  "paymentMethod": "qr_bill, bank_transfer, cash, credit_card, direct_debit oder null",
  "referenceNumber": "Referenznummer oder null",
  "description": "Kurzbeschreibung des Belegs (max 100 Zeichen)",
  "documentType": "invoice_in | invoice_out | receipt | bank_statement | credit_card_statement | salary_slip | insurance | other",
  "suggestedAccount": "Kontonummer aus Schweizer KMU-Kontenrahmen oder null (z.B. 6300 für Versicherungen, 5700 für Sozialversicherungsaufwand, 4000 für Materialaufwand)",
  "rawText": "Vollst\u00e4ndiger extrahierter Text des Belegs"
}
Antworte NUR mit dem JSON-Objekt, ohne Erkl\u00e4rungen.`,
          },
          {
            role: "user",
            content: [
              { type: "text" as const, text: "Analysiere diesen Beleg:" },
              contentPart,
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "document_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                documentDate: { type: ["string", "null"] },
                dueDate: { type: ["string", "null"] },
                invoiceNumber: { type: ["string", "null"] },
                totalAmount: { type: ["number", "null"] },
                netAmount: { type: ["number", "null"] },
                vatAmount: { type: ["number", "null"] },
                vatRate: { type: ["number", "null"] },
                currency: { type: ["string", "null"] },
                counterparty: { type: ["string", "null"] },
                counterpartyUid: { type: ["string", "null"] },
                counterpartyVatNumber: { type: ["string", "null"] },
                counterpartyStreet: { type: ["string", "null"] },
                counterpartyZipCode: { type: ["string", "null"] },
                counterpartyCity: { type: ["string", "null"] },
                counterpartyCountry: { type: ["string", "null"] },
                counterpartyIban: { type: ["string", "null"] },
                qrReference: { type: ["string", "null"] },
                paymentMethod: { type: ["string", "null"] },
                referenceNumber: { type: ["string", "null"] },
                description: { type: ["string", "null"] },
                documentType: { type: ["string", "null"] },
                suggestedAccount: { type: ["string", "null"] },
                rawText: { type: ["string", "null"] },
              },
              required: ["documentDate", "dueDate", "invoiceNumber", "totalAmount", "netAmount", "vatAmount", "vatRate", "currency", "counterparty", "counterpartyUid", "counterpartyVatNumber", "counterpartyStreet", "counterpartyZipCode", "counterpartyCity", "counterpartyCountry", "counterpartyIban", "qrReference", "paymentMethod", "referenceNumber", "description", "documentType", "suggestedAccount", "rawText"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = extractResp.choices[0]?.message?.content;
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "KI-Analyse fehlgeschlagen" });

      const aiMetadata = typeof content === "string" ? content : JSON.stringify(content);
      let extractedText: string | null = null;
      try {
        const parsed = JSON.parse(aiMetadata);
        extractedText = parsed.rawText ?? null;
      } catch { /* ignore */ }

      await db.update(docs).set({ aiMetadata, extractedText }).where(eqOp(docs.id, input.documentId));
      const [updated] = await db.select().from(docs).where(eqOp(docs.id, input.documentId));
      let metadata = null;
      if (updated.aiMetadata) {
        try { metadata = JSON.parse(updated.aiMetadata); } catch { /* ignore */ }
      }
      return { success: true, document: updated, metadata };
    }),

  // Batch re-analyze all documents for the current org
  batchReanalyze: orgProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      const allDocs = await db.select().from(docs).where(eqOp(docs.organizationId, ctx.organizationId));
      const results: { id: number; filename: string; success: boolean; error?: string }[] = [];
      for (const doc of allDocs) {
        const isPdf = doc.mimeType === "application/pdf";
        const isImage = doc.mimeType.startsWith("image/");
        if (!isPdf && !isImage) { results.push({ id: doc.id, filename: doc.filename, success: false, error: "Nicht analysierbar" }); continue; }
        try {
          const contentPart = isPdf
            ? { type: "file_url" as const, file_url: { url: doc.s3Url, mime_type: "application/pdf" as const } }
            : { type: "image_url" as const, image_url: { url: doc.s3Url, detail: "high" as const } };
          const extractResp = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `Du bist ein Schweizer Buchhalter. Extrahiere aus dem Beleg folgende Informationen als JSON:
{
  "documentDate": "YYYY-MM-DD oder null",
  "dueDate": "YYYY-MM-DD oder null",
  "invoiceNumber": "Rechnungsnummer oder null",
  "totalAmount": Zahl oder null,
  "netAmount": Zahl oder null,
  "vatAmount": Zahl oder null,
  "vatRate": Zahl oder null,
  "currency": "CHF" oder andere,
  "counterparty": "Firmenname oder Person",
  "counterpartyUid": "UID-Nummer oder null",
  "counterpartyVatNumber": "MWST-Nummer oder null",
  "counterpartyStreet": "Strasse oder null",
  "counterpartyZipCode": "PLZ oder null",
  "counterpartyCity": "Ort oder null",
  "counterpartyCountry": "Land oder null",
  "counterpartyIban": "IBAN oder null",
  "qrReference": "QR-Referenz oder null",
  "paymentMethod": "qr_bill, bank_transfer, cash, credit_card, direct_debit oder null",
  "referenceNumber": "Referenznummer oder null",
  "description": "Kurzbeschreibung (max 100 Zeichen)",
  "documentType": "invoice_in | invoice_out | receipt | bank_statement | credit_card_statement | salary_slip | insurance | other",
  "suggestedAccount": "Kontonummer oder null (z.B. 5700 Sozialversicherungsaufwand, 6300 Versicherungen, 4000 Materialaufwand)",
  "rawText": "Vollst\u00e4ndiger extrahierter Text"
}
WICHTIG: Kreditkartenabrechnungen (Viseca, Mastercard, VISA) = credit_card_statement. Personenversicherung/UVG/BVG = insurance mit Konto 5700. Sachversicherungen = insurance mit Konto 6300.
Antworte NUR mit dem JSON-Objekt.`,
              },
              { role: "user", content: [{ type: "text" as const, text: "Analysiere diesen Beleg:" }, contentPart] },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "document_extraction",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    documentDate: { type: ["string", "null"] }, dueDate: { type: ["string", "null"] },
                    invoiceNumber: { type: ["string", "null"] }, totalAmount: { type: ["number", "null"] },
                    netAmount: { type: ["number", "null"] }, vatAmount: { type: ["number", "null"] },
                    vatRate: { type: ["number", "null"] }, currency: { type: ["string", "null"] },
                    counterparty: { type: ["string", "null"] }, counterpartyUid: { type: ["string", "null"] },
                    counterpartyVatNumber: { type: ["string", "null"] }, counterpartyStreet: { type: ["string", "null"] },
                    counterpartyZipCode: { type: ["string", "null"] }, counterpartyCity: { type: ["string", "null"] },
                    counterpartyCountry: { type: ["string", "null"] }, counterpartyIban: { type: ["string", "null"] },
                    qrReference: { type: ["string", "null"] }, paymentMethod: { type: ["string", "null"] },
                    referenceNumber: { type: ["string", "null"] }, description: { type: ["string", "null"] },
                    documentType: { type: ["string", "null"] }, suggestedAccount: { type: ["string", "null"] },
                    rawText: { type: ["string", "null"] },
                  },
                  required: ["documentDate", "dueDate", "invoiceNumber", "totalAmount", "netAmount", "vatAmount", "vatRate", "currency", "counterparty", "counterpartyUid", "counterpartyVatNumber", "counterpartyStreet", "counterpartyZipCode", "counterpartyCity", "counterpartyCountry", "counterpartyIban", "qrReference", "paymentMethod", "referenceNumber", "description", "documentType", "suggestedAccount", "rawText"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = extractResp.choices[0]?.message?.content;
          if (!content) { results.push({ id: doc.id, filename: doc.filename, success: false, error: "Keine KI-Antwort" }); continue; }
          const aiMetadata = typeof content === "string" ? content : JSON.stringify(content);
          let extractedText: string | null = null;
          try { const parsed = JSON.parse(aiMetadata); extractedText = parsed.rawText ?? null; } catch { /* ignore */ }
          await db.update(docs).set({ aiMetadata, extractedText }).where(eqOp(docs.id, doc.id));
          results.push({ id: doc.id, filename: doc.filename, success: true });
        } catch (e: any) {
          results.push({ id: doc.id, filename: doc.filename, success: false, error: e.message?.slice(0, 100) });
        }
      }
      return { total: allDocs.length, success: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
    }),

  // Manual match: link a document to a bank transaction
  manualMatch: orgProcedure
    .input(z.object({
      documentId: z.number(),
      transactionId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs, bankTransactions: txns } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");

      // Verify document exists
      const [doc] = await db.select().from(docs).where(eqOp(docs.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden" });

      // Verify transaction exists
      const [tx] = await db.select().from(txns).where(eqOp(txns.id, input.transactionId));
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Transaktion nicht gefunden" });

      // Update document
      await db.update(docs)
        .set({
          bankTransactionId: input.transactionId,
          matchStatus: 'manual',
          matchScore: 100,
        })
        .where(eqOp(docs.id, input.documentId));

      // Update bank transaction
      await db.update(txns)
        .set({
          matchedDocumentId: input.documentId,
          matchScore: 100,
        })
        .where(eqOp(txns.id, input.transactionId));

      return { success: true };
    }),

  // Direct booking from document (without bank transaction, e.g. Barauslagen)
  bookDirect: orgProcedure
    .input(z.object({
      documentId: z.number(),
      debitAccountId: z.number(),
      creditAccountId: z.number(),
      amount: z.string(),
      description: z.string().optional(),
      bookingDate: z.string(),
      vatAmount: z.string().optional(),
      vatRate: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { documents: docs } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      
      // Verify document exists
      const [doc] = await db.select().from(docs).where(eqOp(docs.id, input.documentId));
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden" });
      
      const year = new Date(input.bookingDate).getFullYear();
      const lines: Array<{ accountId: number; side: "debit" | "credit"; amount: string; vatAmount?: string; vatRate?: string }> = [
        { accountId: input.debitAccountId, side: "debit", amount: input.amount },
        { accountId: input.creditAccountId, side: "credit", amount: input.amount },
      ];
      // Add VAT info to the expense line if provided
      if (input.vatAmount && input.vatRate) {
        lines[0].vatAmount = input.vatAmount;
        lines[0].vatRate = input.vatRate;
      }
      
      const entryId = await createJournalEntry({
        organizationId: ctx.organizationId,
        bookingDate: input.bookingDate,
        description: input.description || `Beleg: ${doc.filename}`,
        source: "manual",
        fiscalYear: year,
        status: "pending",
        lines,
      });
      
      // Link document to journal entry
      await db.update(docs)
        .set({
          journalEntryId: entryId,
          matchStatus: 'manual',
        })
        .where(eqOp(docs.id, input.documentId));
      
      return { entryId };
    }),
});

// ─── Avatar Chat Router ─────────────────────────────────────────────────────
const avatarChatRouter = router({
  chat: orgProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      conversationHistory: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });

      const orgId = ctx.organizationId;

      // Load avatar settings from DB
      const [avatarCfg] = await db.select().from(avatarSettings)
        .where(eq(avatarSettings.organizationId, orgId))
        .limit(1);
      const cfgMaxSentences = avatarCfg?.maxSentences ?? 2;
      const cfgCustomPrompt = avatarCfg?.customPrompt ?? '';
      const cfgAvatarName = avatarCfg?.avatarName ?? 'Berater';
      const cfgVoiceId = avatarCfg?.voiceId;

      // Gather accounting context
      let contextText = '';
      try {
        // Recent journal entries
        const recentJournals = await db.select({
          id: journalEntries.id,
          description: journalEntries.description,
          bookingDate: journalEntries.bookingDate,
          status: journalEntries.status,
        }).from(journalEntries)
          .where(eq(journalEntries.organizationId, orgId))
          .orderBy(desc(journalEntries.createdAt))
          .limit(5);

        // Active accounts
        const activeAccounts = await db.select({
          number: accounts.number,
          name: accounts.name,
          category: accounts.category,
          accountType: accounts.accountType,
        }).from(accounts)
          .where(and(eq(accounts.organizationId, orgId), eq(accounts.isActive, true)))
          .limit(30);

        // Recent documents (using available schema columns)
        const recentDocs = await db.select({
          id: documents.id,
          filename: documents.filename,
          documentType: documents.documentType,
          matchStatus: documents.matchStatus,
          aiMetadata: documents.aiMetadata,
          createdAt: documents.createdAt,
        }).from(documents)
          .where(eq(documents.organizationId, orgId))
          .orderBy(desc(documents.createdAt))
          .limit(5);

        contextText = `
## Aktuelle Buchhaltungsdaten der Organisation:

### Letzte Journalbuchungen (${recentJournals.length}):
${recentJournals.map(j => `- ${j.bookingDate}: ${j.description} | Status: ${j.status}`).join('\n')}

### Aktive Konten (Auswahl):
${activeAccounts.map(a => `- ${a.number} ${a.name} (${a.accountType})`).join('\n')}

### Letzte Belege (${recentDocs.length}):
${recentDocs.map(d => {
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(d.aiMetadata ?? '{}'); } catch {}
  return `- ${d.filename} | Typ: ${d.documentType} | Match: ${d.matchStatus} | Betrag: CHF ${meta.amount ?? '?'}`;
}).join('\n')}
`;
      } catch (e) {
        console.error('Avatar chat context error:', e);
      }

      const systemPrompt = `Du bist ${cfgAvatarName}, der Buchhaltungsberater der WM Weibel Mueller AG. Antworte IMMER extrem kurz und direkt – maximal ${cfgMaxSentences} Sätze. Keine Einleitungen, kein Smalltalk, kein "Gerne", kein "Natürlich". Nur die Antwort.${cfgCustomPrompt ? '\n' + cfgCustomPrompt : ''}
Kontext: Schweizer Buchhaltung (OR, MWST, Swiss GAAP FER). Software: Belege-KI, Bank-Import (CSV/MT940), Freigaben, QR-Rechnungen, Berichte, MWST-Abrechnung, Kontenplan SKR04.
${contextText}`;

      const history = input.conversationHistory ?? [];
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user' as const, content: input.message },
      ];

      const llmResponse = await invokeLLM({ messages });
       const replyRaw = llmResponse.choices?.[0]?.message?.content ?? 'Entschuldigung, ich konnte keine Antwort generieren.';
      const reply = typeof replyRaw === 'string' ? replyRaw : 'Entschuldigung, ich konnte keine Antwort generieren.';
      // TTS via ElevenLabs (optional) – return as base64 data URL to avoid CORS issues
      let audioUrl: string | undefined;
      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      if (elevenLabsKey && reply) {
        try {
          // Use voiceId from avatar settings, env var, or default to Daniel
          const voiceId = cfgVoiceId ?? process.env.ELEVENLABS_VOICE_ID ?? 'onwK4e9ZLuTAKqWW03F9';
          // Truncate reply to 500 chars for TTS to keep response size manageable
          const ttsText = reply.length > 500 ? reply.substring(0, 497) + '...' : reply;
          const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': elevenLabsKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: ttsText,
              model_id: 'eleven_multilingual_v2',
              voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
            }),
          });
          if (ttsRes.ok) {
            const audioBuffer = await ttsRes.arrayBuffer();
            // Return as base64 data URL so browser can play without CORS issues
            const base64 = Buffer.from(audioBuffer).toString('base64');
            audioUrl = `data:audio/mpeg;base64,${base64}`;
          } else {
            const errText = await ttsRes.text().catch(() => '');
            console.error('ElevenLabs TTS error:', ttsRes.status, errText);
          }
        } catch (e) {
          console.error('ElevenLabs TTS error:', e);
        }
      }
      return { reply, audioUrl };
    }),

  transcribeVoice: protectedProcedure
    .input(z.object({
      audioUrl: z.string().url(),
      language: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await transcribeAudio({
        audioUrl: input.audioUrl,
        language: input.language ?? 'de',
        prompt: 'Buchhaltung Schweiz',
      });
      if ('error' in result) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
      }
      return { text: result.text, language: result.language };
    }),

  // Speak greeting text via ElevenLabs TTS
  speakGreeting: orgProcedure
    .input(z.object({ text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      let audioUrl: string | undefined;
      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      if (elevenLabsKey) {
        try {
          // Load voice ID from avatar settings
          let voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'onwK4e9ZLuTAKqWW03F9';
          if (db) {
            const [cfg] = await db.select().from(avatarSettings)
              .where(eq(avatarSettings.organizationId, ctx.organizationId))
              .limit(1);
            if (cfg?.voiceId) voiceId = cfg.voiceId;
          }
          const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 'xi-api-key': elevenLabsKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: input.text,
              model_id: 'eleven_multilingual_v2',
              voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
            }),
          });
          if (ttsRes.ok) {
            const buf = await ttsRes.arrayBuffer();
            audioUrl = `data:audio/mpeg;base64,${Buffer.from(buf).toString('base64')}`;
          } else {
            console.error('ElevenLabs TTS greeting error:', ttsRes.status);
          }
        } catch (e) {
          console.error('ElevenLabs TTS greeting error:', e);
        }
      }
      return { audioUrl };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
// ─── Avatar Settings Router ──────────────────────────────────────────────────
const avatarSettingsRouter = router({
  get: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(avatarSettings)
      .where(eq(avatarSettings.organizationId, ctx.organizationId))
      .limit(1);
    return row ?? null;
  }),

  save: orgProcedure
    .input(z.object({
      language: z.string().max(10).optional(),
      style: z.enum(["concise", "balanced", "detailed"]).optional(),
      maxSentences: z.number().min(1).max(10).optional(),
      customPrompt: z.string().max(2000).optional(),
      voiceId: z.string().max(100).optional(),
      avatarName: z.string().max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Nur Administratoren können die Avatar-Einstellungen ändern.' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [existing] = await db.select({ id: avatarSettings.id })
        .from(avatarSettings)
        .where(eq(avatarSettings.organizationId, ctx.organizationId))
        .limit(1);
      const data: Record<string, unknown> = { organizationId: ctx.organizationId };
      if (input.language !== undefined) data.language = input.language;
      if (input.style !== undefined) data.style = input.style;
      if (input.maxSentences !== undefined) data.maxSentences = input.maxSentences;
      if (input.customPrompt !== undefined) data.customPrompt = input.customPrompt;
      if (input.voiceId !== undefined) data.voiceId = input.voiceId;
      if (input.avatarName !== undefined) data.avatarName = input.avatarName;
      if (existing) {
        await db.update(avatarSettings).set(data).where(eq(avatarSettings.organizationId, ctx.organizationId));
      } else {
        await db.insert(avatarSettings).values(data as any);
      }
      return { success: true };
    }),
});

// ─── Import Automation Router ───────────────────────────────────────────────
const importAutomationRouter = router({
  get: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(importAutomationSettings)
      .where(eq(importAutomationSettings.organizationId, ctx.organizationId))
      .limit(1);
    // Return defaults if no row exists
    return row ?? {
      autoKiCategorize: true,
      autoGenerateBookingTexts: true,
      autoRefreshLearned: true,
      autoDetectTransfers: true,
      autoMatchDocuments: false,
    };
  }),

  save: orgProcedure
    .input(z.object({
      autoKiCategorize: z.boolean(),
      autoGenerateBookingTexts: z.boolean(),
      autoRefreshLearned: z.boolean(),
      autoDetectTransfers: z.boolean(),
      autoMatchDocuments: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [existing] = await db.select({ id: importAutomationSettings.id })
        .from(importAutomationSettings)
        .where(eq(importAutomationSettings.organizationId, ctx.organizationId))
        .limit(1);
      const data = { ...input, organizationId: ctx.organizationId };
      if (existing) {
        await db.update(importAutomationSettings).set(data)
          .where(eq(importAutomationSettings.organizationId, ctx.organizationId));
      } else {
        await db.insert(importAutomationSettings).values(data);
      }
      return { success: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  accounts: accountsRouter,
  journal: journalRouter,
  bankImport: bankImportRouter,
  creditCard: creditCardRouter,
  payroll: payrollRouter,
  reports: reportsRouter,
  vat: vatRouter,
  documents: documentsRouter,
  settings: settingsRouter,
  globalRules: globalRulesRouter,
  yearEnd: yearEndRouter,
  qrBill: qrBillRouter,
  dsg: dsgRouter,
  suppliers: suppliersRouter,
  timeTracking: timeTrackingRouter,
  customers: customersRouter,
  organizations: organizationsRouter,
  invoices: invoicesRouter,
  reminders: remindersRouter,
  stripe: stripeRouter,
  avatarChat: avatarChatRouter,
  avatarSettings: avatarSettingsRouter,
  importAutomation: importAutomationRouter,
  uidSearch: router({
    search: publicProcedure
      .input(z.object({ name: z.string().min(2).max(200) }))
      .query(async ({ input }) => {
        try {
          const results = await searchCompanies(input.name, 10);
          return results;
        } catch (e) {
          console.error("UID search error:", e);
          return [];
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

