import { TRPCError } from "@trpc/server";
import { and, eq, like } from "drizzle-orm";
import { journalEntries } from "../drizzle/schema";
import { getDb, getJournalEntries, getJournalEntryWithLines } from "./db";
import { orgProcedure } from "./_core/trpc";
import { journalEntryIdSchema, journalIdFilterInputSchema, journalListInputSchema } from "./journalSchemas";

export const journalQueryProcedures = {
  list: orgProcedure.input(journalListInputSchema)
    .query(({ input, ctx }) => getJournalEntries(ctx.organizationId, input)),

  getWithLines: orgProcedure.input(journalEntryIdSchema)
    .query(({ input, ctx }) => getJournalEntryWithLines(ctx.organizationId, input.entryId)),

  getAllIds: orgProcedure.input(journalIdFilterInputSchema)
    .query(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [eq(journalEntries.organizationId, ctx.organizationId)];
      if (input.status) conditions.push(eq(journalEntries.status, input.status));
      if (input.fiscalYear) conditions.push(eq(journalEntries.fiscalYear, input.fiscalYear));
      if (input.search) conditions.push(like(journalEntries.description, `%${input.search}%`));
      const rows = await db.select({ id: journalEntries.id }).from(journalEntries).where(and(...conditions));
      return { ids: rows.map(row => row.id) };
    }),
};
