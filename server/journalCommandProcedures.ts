import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { approveJournalEntry, createJournalEntry, rejectJournalEntry } from "./db";
import { orgProcedure } from "./_core/trpc";
import { toDateStr } from "./accountingDate";
import { assertPendingJournalEntry } from "./journalGuards";
import { journalCreateInputSchema, journalEditableLineSchema, journalEntryIdSchema } from "./journalSchemas";

export const journalCommandProcedures = {
  create: orgProcedure.input(journalCreateInputSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const entryId = await createJournalEntry({ organizationId: ctx.organizationId, bookingDate: toDateStr(input.bookingDate) as string, valueDate: toDateStr(input.valueDate), description: input.description, source: input.source, status: "pending", createdBy: ctx.user.id, lines: input.lines });
    return { entryId };
  }),
  approve: orgProcedure.input(z.object({ entryId: z.number(), lines: z.array(journalEditableLineSchema).optional() })).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    await assertPendingJournalEntry(input.entryId, ctx.organizationId);
    if (input.lines) {
      const { updateJournalEntryLines } = await import("./db");
      await updateJournalEntryLines(input.entryId, input.lines);
    }
    await approveJournalEntry(input.entryId, ctx.user.id);
    return { success: true };
  }),
  reject: orgProcedure.input(journalEntryIdSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    await assertPendingJournalEntry(input.entryId, ctx.organizationId);
    await rejectJournalEntry(input.entryId);
    return { success: true };
  }),
};
