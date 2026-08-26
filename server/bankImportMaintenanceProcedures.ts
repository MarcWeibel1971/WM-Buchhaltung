import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { bankAccounts, bankTransactions, documents, importHistory } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure } from "./_core/trpc";

export const bankImportMaintenanceProcedures = {
  deleteImport: orgProcedure.input(z.object({ importBatchId: z.string() })).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const txns = await db.select({ id: bankTransactions.id, status: bankTransactions.status }).from(bankTransactions).where(and(eq(bankTransactions.organizationId, ctx.organizationId), eq(bankTransactions.importBatchId, input.importBatchId)));
    const booked = txns.filter(tx => tx.status === "matched");
    if (booked.length) throw new TRPCError({ code: "BAD_REQUEST", message: `${booked.length} Transaktion(en) sind bereits verbucht und können nicht gelöscht werden.` });
    const ids = txns.map(tx => tx.id);
    if (ids.length) {
      await db.update(documents).set({ bankTransactionId: null, matchStatus: "unmatched", matchScore: null }).where(and(inArray(documents.bankTransactionId, ids), eq(documents.organizationId, ctx.organizationId)));
      await db.delete(bankTransactions).where(and(eq(bankTransactions.organizationId, ctx.organizationId), eq(bankTransactions.importBatchId, input.importBatchId)));
    }
    await db.delete(importHistory).where(and(eq(importHistory.organizationId, ctx.organizationId), eq(importHistory.importBatchId, input.importBatchId)));
    return { deleted: ids.length };
  }),
  validateImportIban: orgProcedure.input(z.object({ bankAccountId: z.number(), fileIban: z.string() })).query(async ({ input, ctx }) => {
    const db = await getDb(); if (!db) return { valid: true };
    const [account] = await db.select({ iban: bankAccounts.iban }).from(bankAccounts).where(and(eq(bankAccounts.id, input.bankAccountId), eq(bankAccounts.organizationId, ctx.organizationId)));
    if (!account?.iban) return { valid: true };
    const normalize = (iban: string) => iban.replace(/\s/g, "").toUpperCase(); const accountIban = normalize(account.iban); const fileIban = normalize(input.fileIban);
    return { valid: accountIban === fileIban, accountIban, fileIban };
  }),
};
