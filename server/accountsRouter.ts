import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { accounts, journalEntries, journalLines, openingBalances } from "../drizzle/schema";
import { getAccountBalance, getAllAccounts, getDb } from "./db";
import { orgProcedure, router } from "./_core/trpc";
import { buildAccountLedgerCsv } from "./accountLedgerExport";

export const accountsRouter = router({
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
        const openingBalanceRows = await db.select().from(openingBalances)
          .where(and(
            eq(openingBalances.organizationId, ctx.organizationId),
            eq(openingBalances.accountId, input.accountId),
            eq(openingBalances.fiscalYear, input.fiscalYear),
          ))
          .limit(1);
        if (openingBalanceRows[0]) openingBalance = Number.parseFloat(openingBalanceRows[0].balance as string);
      }

      const lines = await db.select({ line: journalLines, entry: journalEntries })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalEntries.organizationId, ctx.organizationId),
          eq(journalLines.accountId, input.accountId),
          eq(journalEntries.status, "approved"),
          input.fiscalYear ? eq(journalEntries.fiscalYear, input.fiscalYear) : sql`1=1`,
        ))
        .orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));

      return { account, lines, openingBalance };
    }),
  exportLedgerCsv: orgProcedure
    .input(z.object({ accountId: z.number(), fiscalYear: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [account] = await db.select().from(accounts).where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.id, input.accountId))).limit(1);
      if (!account) throw new Error("Konto nicht gefunden");
      const [opening] = await db.select().from(openingBalances).where(and(eq(openingBalances.organizationId, ctx.organizationId), eq(openingBalances.accountId, input.accountId), eq(openingBalances.fiscalYear, input.fiscalYear))).limit(1);
      const lines = await db.select({ line: journalLines, entry: journalEntries }).from(journalLines).innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id)).where(and(eq(journalEntries.organizationId, ctx.organizationId), eq(journalLines.accountId, input.accountId), eq(journalEntries.status, "approved"), eq(journalEntries.fiscalYear, input.fiscalYear))).orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));
      return buildAccountLedgerCsv({ accountNumber: account.number, accountName: account.name, fiscalYear: input.fiscalYear, openingBalance: Number(opening?.balance ?? 0), lines: lines.map(({ line, entry }) => ({ bookingDate: entry.bookingDate, entryNumber: entry.entryNumber, description: line.description ?? entry.description, side: line.side, amount: line.amount })) });
    }),
});
