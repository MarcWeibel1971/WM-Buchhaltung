import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { bankTransactions, creditCardStatements, journalEntries } from "../drizzle/schema";
import { approveJournalEntry, deleteJournalEntry, getDb, revertBankTransaction, revertCcStatement } from "./db";
import { orgProcedure } from "./_core/trpc";
import { assertPendingJournalEntry } from "./journalGuards";
import { journalBulkEntryIdsSchema } from "./journalSchemas";

export const journalBulkProcedures = {
  bulkApprove: orgProcedure.input(journalBulkEntryIdsSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    let approved = 0; let skipped = 0;
    for (const id of input.entryIds) {
      const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.organizationId, ctx.organizationId))).limit(1);
      if (!entry || entry.status !== "pending") { skipped++; continue; }
      await approveJournalEntry(id, ctx.user.id); approved++;
    }
    return { approved, skipped };
  }),
  bulkDelete: orgProcedure.input(journalBulkEntryIdsSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    let deleted = 0; let skipped = 0;
    for (const id of input.entryIds) {
      try {
        await assertPendingJournalEntry(id, ctx.organizationId);
        for (const tx of await db.select().from(bankTransactions).where(eq(bankTransactions.journalEntryId, id))) await revertBankTransaction(tx.id);
        for (const statement of await db.select().from(creditCardStatements).where(eq(creditCardStatements.journalEntryId, id))) await revertCcStatement(statement.id);
        await deleteJournalEntry(id); deleted++;
      } catch { skipped++; }
    }
    return { deleted, skipped };
  }),
  bulkRevert: orgProcedure.input(journalBulkEntryIdsSchema).mutation(async () => {
    throw new TRPCError({ code: "FORBIDDEN", message: "Verbuchte Journaleinträge sind unveränderlich. Bitte erstellen Sie je Buchung eine Stornobuchung." });
  }),
};
