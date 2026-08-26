import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { bankTransactions, creditCardStatements, journalEntries, journalLines } from "../drizzle/schema";
import { buildReversalLines, createJournalEntry, deleteJournalEntry, getDb, revertBankTransaction, revertCcStatement, updateJournalEntryLines } from "./db";
import { orgProcedure } from "./_core/trpc";
import { toDateStr } from "./accountingDate";
import { assertPendingJournalEntry } from "./journalGuards";
import { journalEntryIdSchema, journalReverseInputSchema, journalUpdateInputSchema } from "./journalSchemas";

export const journalMutationProcedures = {
  revert: orgProcedure.input(journalEntryIdSchema).mutation(async () => {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Verbuchte Journaleinträge sind unveränderlich. Bitte erstellen Sie eine Stornobuchung.",
    });
  }),
  reverse: orgProcedure.input(journalReverseInputSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const bookingDate = toDateStr(input.bookingDate);
    if (!bookingDate) throw new TRPCError({ code: "BAD_REQUEST", message: "Ungültiges Stornodatum." });
    const [original] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, input.entryId), eq(journalEntries.organizationId, ctx.organizationId))).limit(1);
    if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "Journal-Eintrag nicht gefunden." });
    if (original.status !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "Nur genehmigte Buchungen können storniert werden." });
    const sourceRef = `reversal-${original.id}`;
    const [existing] = await db.select({ id: journalEntries.id }).from(journalEntries).where(and(eq(journalEntries.organizationId, ctx.organizationId), eq(journalEntries.sourceRef, sourceRef))).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Für diese Buchung existiert bereits ein Stornovorschlag." });
    const lines = await db.select().from(journalLines).where(eq(journalLines.entryId, original.id));
    if (!lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Die Originalbuchung enthält keine Buchungszeilen." });
    const entryId = await createJournalEntry({ organizationId: ctx.organizationId, bookingDate, valueDate: bookingDate, description: `Storno ${original.entryNumber ?? `Buchung #${original.id}`}${input.reason ? ` – ${input.reason}` : ""}`, source: "manual", sourceRef, status: "pending", createdBy: ctx.user.id, lines: buildReversalLines(lines) });
    return { entryId };
  }),
  update: orgProcedure.input(journalUpdateInputSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await assertPendingJournalEntry(input.entryId, ctx.organizationId);
    const updateData: Record<string, unknown> = {};
    if (input.description) updateData.description = input.description;
    if (input.bookingDate) updateData.bookingDate = toDateStr(input.bookingDate);
    if (Object.keys(updateData).length) await db.update(journalEntries).set(updateData).where(and(eq(journalEntries.id, input.entryId), eq(journalEntries.organizationId, ctx.organizationId)));
    if (input.lines) await updateJournalEntryLines(input.entryId, input.lines);
    return { success: true };
  }),
  delete: orgProcedure.input(journalEntryIdSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await assertPendingJournalEntry(input.entryId, ctx.organizationId);
    for (const tx of await db.select().from(bankTransactions).where(eq(bankTransactions.journalEntryId, input.entryId))) await revertBankTransaction(tx.id);
    for (const statement of await db.select().from(creditCardStatements).where(eq(creditCardStatements.journalEntryId, input.entryId))) await revertCcStatement(statement.id);
    await deleteJournalEntry(input.entryId);
    return { success: true };
  }),
};
