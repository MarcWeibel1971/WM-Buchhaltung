import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { bankTransactions } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure } from "./_core/trpc";

type SnapshotTransaction = {
  id: number; description: string | null; suggestedDebitAccountId: number | null; suggestedCreditAccountId: number | null;
  aiConfidence: number | null; aiReasoning: string | null; suggestedBookingText: string | null; isTransfer: boolean | null;
  transferPartnerId: number | null; manuallyEdited: boolean | null; matchedDocumentId: number | null; matchScore: number | null; status: "pending" | "matched" | "ignored";
};
type Snapshot = { id: string; actionName: string; timestamp: number; transactions: SnapshotTransaction[] };
const snapshots = new Map<number, Snapshot>();

export const bankImportSnapshotProcedures = {
  createSnapshot: orgProcedure.input(z.object({ actionName: z.string() })).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const pending = await db.select().from(bankTransactions).where(and(eq(bankTransactions.status, "pending"), eq(bankTransactions.organizationId, ctx.organizationId)));
    const id = `snap_${Date.now()}`;
    snapshots.set(ctx.user.id, { id, actionName: input.actionName, timestamp: Date.now(), transactions: pending.map(tx => ({ id: tx.id, description: tx.description, suggestedDebitAccountId: tx.suggestedDebitAccountId, suggestedCreditAccountId: tx.suggestedCreditAccountId, aiConfidence: tx.aiConfidence, aiReasoning: tx.aiReasoning, suggestedBookingText: tx.suggestedBookingText, isTransfer: tx.isTransfer, transferPartnerId: tx.transferPartnerId, manuallyEdited: tx.manuallyEdited, matchedDocumentId: tx.matchedDocumentId, matchScore: tx.matchScore, status: tx.status })) });
    return { snapshotId: id, count: pending.length };
  }),
  getSnapshot: orgProcedure.query(({ ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" }); const snapshot = snapshots.get(ctx.user.id);
    return snapshot ? { id: snapshot.id, actionName: snapshot.actionName, timestamp: snapshot.timestamp, transactionCount: snapshot.transactions.length } : null;
  }),
  restoreSnapshot: orgProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" }); const snapshot = snapshots.get(ctx.user.id);
    if (!snapshot) throw new TRPCError({ code: "NOT_FOUND", message: "Kein Snapshot vorhanden" });
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); let restored = 0;
    for (const tx of snapshot.transactions) {
      await db.update(bankTransactions).set({ description: tx.description, suggestedDebitAccountId: tx.suggestedDebitAccountId, suggestedCreditAccountId: tx.suggestedCreditAccountId, aiConfidence: tx.aiConfidence, aiReasoning: tx.aiReasoning, suggestedBookingText: tx.suggestedBookingText, isTransfer: tx.isTransfer ?? false, transferPartnerId: tx.transferPartnerId, manuallyEdited: tx.manuallyEdited ?? false, matchedDocumentId: tx.matchedDocumentId, matchScore: tx.matchScore, status: tx.status }).where(and(eq(bankTransactions.id, tx.id), eq(bankTransactions.organizationId, ctx.organizationId))); restored++;
    }
    snapshots.delete(ctx.user.id); return { restored, actionName: snapshot.actionName };
  }),
  clearSnapshot: orgProcedure.mutation(({ ctx }) => { if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" }); snapshots.delete(ctx.user.id); return { success: true }; }),
};
