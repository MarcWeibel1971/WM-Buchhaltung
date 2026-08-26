import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { bankAccounts, importHistory } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure } from "./_core/trpc";

export const bankImportHistoryProcedures = {
  getImportHistory: orgProcedure.input(z.object({ bankAccountId: z.number().optional() })).query(async ({ input, ctx }) => {
    const db = await getDb(); if (!db) return [];
    const conditions = [eq(importHistory.organizationId, ctx.organizationId)];
    if (input.bankAccountId) conditions.push(eq(importHistory.bankAccountId, input.bankAccountId));
    const rows = await db.select().from(importHistory).where(and(...conditions)).orderBy(desc(importHistory.createdAt)).limit(50);
    const accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.organizationId, ctx.organizationId));
    const nameById = Object.fromEntries(accounts.map(account => [account.id, account.name]));
    return rows.map(row => ({ ...row, bankAccountName: nameById[row.bankAccountId] ?? "Unbekannt" }));
  }),
  getLastImport: orgProcedure.input(z.object({ bankAccountId: z.number() })).query(async ({ input, ctx }) => {
    const db = await getDb(); if (!db) return null;
    const [row] = await db.select().from(importHistory).where(and(eq(importHistory.organizationId, ctx.organizationId), eq(importHistory.bankAccountId, input.bankAccountId))).orderBy(desc(importHistory.createdAt)).limit(1);
    return row ?? null;
  }),
};
