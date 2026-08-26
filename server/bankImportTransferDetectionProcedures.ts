import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { bankTransactions } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure } from "./_core/trpc";

export const bankImportTransferDetectionProcedures = { detectTransfers: orgProcedure.mutation(async ({ ctx }) => {
  if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" }); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const pending = await db.select({ id: bankTransactions.id, bankAccountId: bankTransactions.bankAccountId, transactionDate: bankTransactions.transactionDate, amount: bankTransactions.amount }).from(bankTransactions).where(and(eq(bankTransactions.organizationId, ctx.organizationId), eq(bankTransactions.status, "pending")));
  const pairs: Array<{ idA: number; idB: number; amount: number }> = []; const used = new Set<number>();
  for (let i = 0; i < pending.length; i++) for (let j = i + 1; j < pending.length; j++) { const a = pending[i], b = pending[j]; if (used.has(a.id) || used.has(b.id) || a.bankAccountId === b.bankAccountId) continue; const aa = parseFloat(a.amount), bb = parseFloat(b.amount); const days = Math.abs(new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()) / 86400000; if (Math.abs(Math.abs(aa) - Math.abs(bb)) > 0.01 || Math.sign(aa) === Math.sign(bb) || days > 2) continue; pairs.push({ idA: a.id, idB: b.id, amount: Math.abs(aa) }); used.add(a.id); used.add(b.id); }
  for (const pair of pairs) { await db.update(bankTransactions).set({ isTransfer: true, transferPartnerId: pair.idB }).where(and(eq(bankTransactions.id, pair.idA), eq(bankTransactions.organizationId, ctx.organizationId))); await db.update(bankTransactions).set({ isTransfer: true, transferPartnerId: pair.idA }).where(and(eq(bankTransactions.id, pair.idB), eq(bankTransactions.organizationId, ctx.organizationId))); }
  return { found: pairs.length, marked: pairs.length * 2, pairs };
}) };
