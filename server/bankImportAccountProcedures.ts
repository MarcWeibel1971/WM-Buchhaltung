import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { bankAccounts, bankTransactions } from "../drizzle/schema";
import { getBankAccounts, getBankTransactionsByStatus, getDb, getPendingBankTransactions } from "./db";
import { orgProcedure } from "./_core/trpc";

export const bankImportAccountProcedures = {
  getBankAccounts: orgProcedure.query(({ ctx }) => getBankAccounts(ctx.organizationId)),
  updateBankAccount: orgProcedure.input(z.object({ id: z.number(), name: z.string().optional(), iban: z.string().nullable().optional(), bank: z.string().nullable().optional() })).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const updateData: Record<string, string | null> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.iban !== undefined) updateData.iban = input.iban;
    if (input.bank !== undefined) updateData.bank = input.bank;
    await db.update(bankAccounts).set(updateData).where(and(eq(bankAccounts.id, input.id), eq(bankAccounts.organizationId, ctx.organizationId)));
    return { success: true };
  }),
  getPendingTransactions: orgProcedure.input(z.object({ bankAccountId: z.number().optional() })).query(({ input, ctx }) => getPendingBankTransactions(ctx.organizationId, input.bankAccountId)),
  getTransactionsByStatus: orgProcedure.input(z.object({ status: z.enum(["pending", "matched", "all"]), bankAccountId: z.number().optional(), fiscalYear: z.number().optional() })).query(async ({ input, ctx }) => {
    const txs = await getBankTransactionsByStatus(ctx.organizationId, input.status, input.bankAccountId, input.fiscalYear);
    const db = await getDb(); if (!db) return txs;
    const transfers = txs.filter(tx => tx.transferPartnerId); if (!transfers.length) return txs;
    const partnerIds = transfers.map(tx => tx.transferPartnerId!);
    const partners = await db.select({ id: bankTransactions.id, bankAccountId: bankTransactions.bankAccountId }).from(bankTransactions).where(and(inArray(bankTransactions.id, partnerIds), eq(bankTransactions.organizationId, ctx.organizationId)));
    const accountIds = Array.from(new Set([...transfers.map(tx => tx.bankAccountId), ...partners.map(tx => tx.bankAccountId)]));
    const accountRows = await db.select({ id: bankAccounts.id, name: bankAccounts.name, accountId: bankAccounts.accountId }).from(bankAccounts).where(and(inArray(bankAccounts.id, accountIds), eq(bankAccounts.organizationId, ctx.organizationId)));
    const partnerMap = new Map(partners.map(partner => [partner.id, accountRows.find(account => account.id === partner.bankAccountId)]));
    const ownMap = new Map(accountRows.map(account => [account.id, account]));
    return txs.map(tx => {
      if (!tx.isTransfer || !tx.transferPartnerId) return { ...tx, transferPartnerBankName: null };
      const partner = partnerMap.get(tx.transferPartnerId); const own = ownMap.get(tx.bankAccountId); const amount = parseFloat(tx.amount as string);
      return { ...tx, transferPartnerBankName: partner?.name ?? null, suggestedDebitAccountId: (amount >= 0 ? own?.accountId : partner?.accountId) ?? tx.suggestedDebitAccountId, suggestedCreditAccountId: (amount < 0 ? own?.accountId : partner?.accountId) ?? tx.suggestedCreditAccountId };
    });
  }),
};
