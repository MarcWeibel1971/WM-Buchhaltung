import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { accounts, documents, journalEntries, journalLines } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure } from "./_core/trpc";
import { buildJournalCsvExport } from "./journalCsvExport";
import { journalExportInputSchema } from "./journalSchemas";
import { buildGebuevArchiveManifest } from "./gebuevArchiveManifest";

export const journalCsvProcedures = {
  exportCsv: orgProcedure.input(journalExportInputSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const conditions = [eq(journalEntries.organizationId, ctx.organizationId), eq(journalEntries.fiscalYear, input.fiscalYear)];
    if (input.statusFilter === "approved") conditions.push(eq(journalEntries.status, "approved"));
    if (input.startDate) conditions.push(gte(journalEntries.bookingDate, input.startDate));
    if (input.endDate) conditions.push(lte(journalEntries.bookingDate, input.endDate));
    const entries = await db.select().from(journalEntries).where(and(...conditions)).orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));
    if (!entries.length) throw new TRPCError({ code: "NOT_FOUND", message: "Keine Buchungen für den Export gefunden" });
    const allLines = await db.select().from(journalLines).where(inArray(journalLines.entryId, entries.map(entry => entry.id)));
    const allAccounts = await db.select().from(accounts).where(eq(accounts.organizationId, ctx.organizationId));
    return buildJournalCsvExport(entries, allLines, allAccounts, input.fiscalYear);
  }),
  exportGebuevManifest: orgProcedure.input(z.object({ fiscalYear: z.number() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const entries = await db.select().from(journalEntries).where(and(eq(journalEntries.organizationId, ctx.organizationId), eq(journalEntries.fiscalYear, input.fiscalYear), eq(journalEntries.status, "approved"))).orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));
    if (!entries.length) throw new TRPCError({ code: "NOT_FOUND", message: "Keine genehmigten Buchungen für das Archiv gefunden" });
    const lines = await db.select().from(journalLines).where(inArray(journalLines.entryId, entries.map(entry => entry.id)));
    const allAccounts = await db.select().from(accounts).where(eq(accounts.organizationId, ctx.organizationId));
    const journal = buildJournalCsvExport(entries, lines, allAccounts, input.fiscalYear);
    const documentRows = await db.select({ id: documents.id, filename: documents.filename, s3Key: documents.s3Key, mimeType: documents.mimeType, fileSize: documents.fileSize }).from(documents).where(and(eq(documents.organizationId, ctx.organizationId), eq(documents.fiscalYear, input.fiscalYear)));
    return { journal, manifest: buildGebuevArchiveManifest({ fiscalYear: input.fiscalYear, journalCsv: journal.csv, documentCount: documentRows.length, accountLedgerCount: allAccounts.length }), documents: documentRows };
  }),
};
