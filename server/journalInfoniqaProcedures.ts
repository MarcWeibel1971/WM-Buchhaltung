import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { accounts, journalEntries, journalLines } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure } from "./_core/trpc";
import { getInfoniqaTaxId } from "./infoniqaTax";
import { journalExportInputSchema } from "./journalSchemas";

export const journalInfoniqaProcedures = {
  exportInfoniqa: orgProcedure.input(journalExportInputSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const conditions = [eq(journalEntries.organizationId, ctx.organizationId), eq(journalEntries.fiscalYear, input.fiscalYear)];
    if (input.statusFilter === "approved") conditions.push(eq(journalEntries.status, "approved"));
    if (input.startDate) conditions.push(gte(journalEntries.bookingDate, input.startDate));
    if (input.endDate) conditions.push(lte(journalEntries.bookingDate, input.endDate));
    const entries = await db.select().from(journalEntries).where(and(...conditions)).orderBy(asc(journalEntries.bookingDate), asc(journalEntries.id));
    if (!entries.length) throw new TRPCError({ code: "NOT_FOUND", message: "Keine Buchungen für den Export gefunden" });
    const lines = await db.select().from(journalLines).where(inArray(journalLines.entryId, entries.map(entry => entry.id)));
    const accountMap = new Map((await db.select().from(accounts).where(eq(accounts.organizationId, ctx.organizationId))).map(account => [account.id, account]));
    const rows = ['BlgNr,Date,AccId,Grp,Orig,MType,Type,CAcc,TaxId,TIdx,CIdx,BType,Code,ValNt,ValTx,ValFW,Text,Text2,PkKey,OpId,Flags,DocId'];
    const esc = (value: string) => !value ? '""' : /[,"; ]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    let number = 1;
    for (const entry of entries) {
      const entryLines = lines.filter(line => line.entryId === entry.id); if (!entryLines.length) continue;
      const [yyyy, month, day] = entry.bookingDate.split("-"); const date = `${day}.${month}.${yyyy.slice(2)}`;
      const debit = entryLines.filter(line => line.side === "debit"); const credit = entryLines.filter(line => line.side === "credit");
      const push = (line: typeof entryLines[number], type: number, counterpart: string, mType: number, description: string) => {
        const account = accountMap.get(line.accountId); rows.push([number, date, account?.number ?? "0", '""', 0, mType, type, counterpart, getInfoniqaTaxId(account, line), 0, 0, 0, '""', parseFloat(line.amount as string).toFixed(2), "0.00", "0.00", esc(description), '""', 0, '""', 0, '""'].join(","));
      };
      if (entryLines.length > 2 && credit.length === 1 && debit.length >= 2) {
        const counter = accountMap.get(credit[0].accountId)?.number ?? "0"; push(credit[0], 1, "div", 2, entry.description); debit.forEach(line => push(line, 0, counter, 2, line.description || entry.description));
      } else if (entryLines.length > 2 && debit.length === 1 && credit.length >= 2) {
        const counter = accountMap.get(debit[0].accountId)?.number ?? "0"; push(debit[0], 0, "div", 2, entry.description); credit.forEach(line => push(line, 1, counter, 2, line.description || entry.description));
      } else if (entryLines.length > 2) {
        entryLines.forEach(line => push(line, line.side === "debit" ? 0 : 1, "div", 2, line.description || entry.description));
      } else if (debit[0] && credit[0]) {
        const debitNumber = accountMap.get(debit[0].accountId)?.number ?? "0"; const creditNumber = accountMap.get(credit[0].accountId)?.number ?? "0"; push(debit[0], 0, creditNumber, 1, entry.description); push(credit[0], 1, debitNumber, 1, entry.description);
      }
      number++;
    }
    return { csv: `${rows.join("\n")}\n`, filename: `sfbbuch_${input.fiscalYear}.csv`, entryCount: entries.length };
  }),
};
