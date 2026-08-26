import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { accounts, companySettings, journalEntries, journalLines, vatPeriods } from "../drizzle/schema";
import { getDb, getVatPeriods } from "./db";
import { toDateStr } from "./accountingDate";
import { orgProcedure, router } from "./_core/trpc";
import { buildEch0217EffectiveXmlDraft, buildEch0217FlatTaxRateXmlDraft, buildEch0217NetTaxRateXmlDraft, buildEstvVatCsv } from "./vatEstvExport";

export const vatRouter = router({
  list: orgProcedure
    .input(z.object({ year: z.number().optional() }))
    .query(({ input, ctx }) => getVatPeriods(ctx.organizationId, input.year)),

  create: orgProcedure
    .input(z.object({ year: z.number(), period: z.string(), startDate: z.string(), endDate: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const startDate = toDateStr(input.startDate) as string;
      const endDate = toDateStr(input.endDate) as string;

      const [settings] = await db.select().from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId))
        .limit(1);
      const vatMethod = settings?.vatMethod ?? "effective";
      const saldoRate = Number.parseFloat(settings?.vatSaldoRate as string ?? "6.20");

      const entries = await db.select({ entryId: journalEntries.id, bookingDate: journalEntries.bookingDate })
        .from(journalEntries)
        .where(and(
          eq(journalEntries.organizationId, ctx.organizationId),
          eq(journalEntries.status, "approved"),
          gte(journalEntries.bookingDate, startDate),
          lte(journalEntries.bookingDate, endDate),
        ));
      if (entries.length === 0) {
        const [result] = await db.insert(vatPeriods).values({ organizationId: ctx.organizationId, year: input.year, period: input.period, startDate, endDate });
        return { periodId: (result as { insertId: number }).insertId };
      }

      const entryIds = entries.map((entry) => entry.entryId);
      const vatRevenueAccounts = await db.select({ id: accounts.id, number: accounts.number, defaultVatRate: accounts.defaultVatRate })
        .from(accounts)
        .where(and(eq(accounts.isVatRelevant, true), eq(accounts.accountType, "revenue")));
      const vatAccountIds = vatRevenueAccounts.map((account) => account.id);
      let totalTurnover = 0;
      let turnover81 = 0;
      let turnover26 = 0;
      let turnover38 = 0;

      if (vatAccountIds.length > 0) {
        const lines = await db.select({ accountId: journalLines.accountId, amount: journalLines.amount, side: journalLines.side, vatRate: journalLines.vatRate })
          .from(journalLines)
          .where(and(inArray(journalLines.entryId, entryIds), inArray(journalLines.accountId, vatAccountIds)));
        for (const line of lines) {
          const amount = Number.parseFloat(line.amount as string);
          const signedAmount = line.side === "credit" ? amount : -amount;
          const lineVatRate = line.vatRate ? Number.parseFloat(line.vatRate as string) : null;
          const account = vatRevenueAccounts.find((candidate) => candidate.id === line.accountId);
          const accountVatRate = account?.defaultVatRate ? Number.parseFloat(account.defaultVatRate as string) : null;
          const effectiveRate = lineVatRate ?? accountVatRate ?? 8.1;
          totalTurnover += signedAmount;
          if (effectiveRate >= 7) turnover81 += signedAmount;
          else if (effectiveRate >= 3) turnover38 += signedAmount;
          else turnover26 += signedAmount;
        }
      }

      let vatDue81 = 0;
      let vatDue26 = 0;
      let vatDue38 = 0;
      if (vatMethod === "saldo") {
        vatDue81 = totalTurnover * (saldoRate / 100);
        turnover81 = totalTurnover;
        turnover26 = 0;
        turnover38 = 0;
      } else {
        vatDue81 = turnover81 * 0.081;
        vatDue26 = turnover26 * 0.026;
        vatDue38 = turnover38 * 0.038;
      }

      let inputTax = 0;
      if (vatMethod === "effective") {
        const expenseAccounts = await db.select({ id: accounts.id }).from(accounts)
          .where(and(eq(accounts.isVatRelevant, true), eq(accounts.accountType, "expense")));
        const expenseAccountIds = expenseAccounts.map((account) => account.id);
        if (expenseAccountIds.length > 0) {
          const expenseLines = await db.select({ vatAmount: journalLines.vatAmount })
            .from(journalLines)
            .where(and(inArray(journalLines.entryId, entryIds), inArray(journalLines.accountId, expenseAccountIds)));
          for (const line of expenseLines) {
            if (line.vatAmount) inputTax += Number.parseFloat(line.vatAmount as string);
          }
        }
      }

      const netVatPayable = vatDue81 + vatDue26 + vatDue38 - inputTax;
      const [result] = await db.insert(vatPeriods).values({
        organizationId: ctx.organizationId,
        year: input.year,
        period: input.period,
        startDate,
        endDate,
        turnover81: turnover81.toFixed(2),
        turnover26: turnover26.toFixed(2),
        turnover38: turnover38.toFixed(2),
        vatDue81: vatDue81.toFixed(2),
        vatDue26: vatDue26.toFixed(2),
        vatDue38: vatDue38.toFixed(2),
        inputTax: inputTax.toFixed(2),
        netVatPayable: netVatPayable.toFixed(2),
      });
      return { periodId: (result as { insertId: number }).insertId };
    }),

  detail: orgProcedure
    .input(z.object({ vatPeriodId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [period] = await db.select().from(vatPeriods).where(and(
        eq(vatPeriods.id, input.vatPeriodId),
        eq(vatPeriods.organizationId, ctx.organizationId),
      ));
      if (!period) throw new TRPCError({ code: "NOT_FOUND", message: "MWST-Periode nicht gefunden" });

      const [settings] = await db.select().from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId))
        .limit(1);
      const vatMethod = settings?.vatMethod ?? "effective";
      const saldoRate = Number.parseFloat(settings?.vatSaldoRate as string ?? "6.20");
      const entries = await db.select({
        entryId: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        bookingDate: journalEntries.bookingDate,
        description: journalEntries.description,
        source: journalEntries.source,
      }).from(journalEntries)
        .where(and(
          eq(journalEntries.organizationId, ctx.organizationId),
          eq(journalEntries.status, "approved"),
          gte(journalEntries.bookingDate, period.startDate),
          lte(journalEntries.bookingDate, period.endDate),
        ))
        .orderBy(asc(journalEntries.bookingDate));
      if (entries.length === 0) return { period, vatMethod, saldoRate, transactions: [] };

      const entryIds = entries.map((entry) => entry.entryId);
      const allLines = await db.select({
        id: journalLines.id,
        entryId: journalLines.entryId,
        accountId: journalLines.accountId,
        side: journalLines.side,
        amount: journalLines.amount,
        description: journalLines.description,
        vatAmount: journalLines.vatAmount,
        vatRate: journalLines.vatRate,
      }).from(journalLines).where(inArray(journalLines.entryId, entryIds));
      const allAccounts = await db.select({
        id: accounts.id,
        number: accounts.number,
        name: accounts.name,
        accountType: accounts.accountType,
        isVatRelevant: accounts.isVatRelevant,
        defaultVatRate: accounts.defaultVatRate,
      }).from(accounts).where(eq(accounts.organizationId, ctx.organizationId));
      const accountMap = new Map(allAccounts.map((account) => [account.id, account]));

      const transactions = [] as Array<{
        entryId: number;
        entryNumber: string | null;
        bookingDate: string;
        description: string;
        source: string;
        lines: Array<{ accountNumber: string; accountName: string; side: string; amount: string; vatRate: string | null; vatAmount: string | null; isVatRelevant: boolean }>;
        totalAmount: number;
        vatAmount: number;
        effectiveVatRate: number;
        category: "revenue" | "expense" | "other";
      }>;

      for (const entry of entries) {
        const entryLines = allLines.filter((line) => line.entryId === entry.entryId);
        let entryTotalAmount = 0;
        let entryVatAmount = 0;
        let hasVatRelevantLine = false;
        let category: "revenue" | "expense" | "other" = "other";
        const lines = entryLines.map((line) => {
          const account = accountMap.get(line.accountId);
          const lineVatRate = line.vatRate ? Number.parseFloat(line.vatRate as string) : null;
          const accountVatRate = account?.defaultVatRate ? Number.parseFloat(account.defaultVatRate as string) : null;
          const effectiveRate = lineVatRate ?? accountVatRate;
          if (account?.isVatRelevant) {
            hasVatRelevantLine = true;
            const amount = Number.parseFloat(line.amount as string);
            if (account.accountType === "revenue") {
              category = "revenue";
              const signedAmount = line.side === "credit" ? amount : -amount;
              entryTotalAmount += signedAmount;
              entryVatAmount += vatMethod === "saldo"
                ? signedAmount * (saldoRate / 100)
                : signedAmount * ((effectiveRate ?? 8.1) / 100);
            } else if (account.accountType === "expense") {
              category = "expense";
              entryTotalAmount += line.side === "debit" ? amount : -amount;
              if (line.vatAmount) entryVatAmount += Number.parseFloat(line.vatAmount as string);
            }
          }
          return {
            accountNumber: account?.number ?? "?",
            accountName: account?.name ?? "Unbekannt",
            side: line.side,
            amount: line.amount as string,
            vatRate: effectiveRate !== null && effectiveRate !== undefined ? effectiveRate.toString() : null,
            vatAmount: line.vatAmount as string | null,
            isVatRelevant: account?.isVatRelevant ?? false,
          };
        });
        if (hasVatRelevantLine) {
          transactions.push({
            entryId: entry.entryId,
            entryNumber: entry.entryNumber,
            bookingDate: entry.bookingDate,
            description: entry.description,
            source: entry.source,
            lines,
            totalAmount: entryTotalAmount,
            vatAmount: entryVatAmount,
            effectiveVatRate: entryTotalAmount === 0 ? 0 : (entryVatAmount / entryTotalAmount) * 100,
            category,
          });
        }
      }
      return { period, vatMethod, saldoRate, transactions };
    }),

  exportEstvCsv: orgProcedure
    .input(z.object({ vatPeriodId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [period] = await db.select().from(vatPeriods).where(and(eq(vatPeriods.id, input.vatPeriodId), eq(vatPeriods.organizationId, ctx.organizationId))).limit(1);
      if (!period) throw new TRPCError({ code: "NOT_FOUND", message: "MWST-Periode nicht gefunden" });
      const [settings] = await db.select({ companyName: companySettings.companyName, vatNumber: companySettings.vatNumber, vatMethod: companySettings.vatMethod }).from(companySettings).where(eq(companySettings.organizationId, ctx.organizationId)).limit(1);
      const csv = buildEstvVatCsv({ uid: settings?.vatNumber ?? "", organisationName: settings?.companyName ?? "", year: period.year, period: period.period, startDate: period.startDate, endDate: period.endDate, vatMethod: settings?.vatMethod === "saldo" ? "saldo" : "effective", turnover81: period.turnover81 ?? "0", turnover26: period.turnover26 ?? "0", turnover38: period.turnover38 ?? "0", vatDue81: period.vatDue81 ?? "0", vatDue26: period.vatDue26 ?? "0", vatDue38: period.vatDue38 ?? "0", inputTax: period.inputTax ?? "0", netVatPayable: period.netVatPayable ?? "0" });
      return { filename: `ESTV_MWST_${period.period}_${period.year}.csv`, csv };
    }),

  exportEstvXmlDraft: orgProcedure
    .input(z.object({ vatPeriodId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [period] = await db.select().from(vatPeriods).where(and(eq(vatPeriods.id, input.vatPeriodId), eq(vatPeriods.organizationId, ctx.organizationId))).limit(1);
      if (!period) throw new TRPCError({ code: "NOT_FOUND", message: "MWST-Periode nicht gefunden" });
      const [settings] = await db.select({ companyName: companySettings.companyName, vatNumber: companySettings.vatNumber, vatMethod: companySettings.vatMethod, vatSaldoRate: companySettings.vatSaldoRate, vatPauschalRate: companySettings.vatPauschalRate, vatPauschalActivity: companySettings.vatPauschalActivity }).from(companySettings).where(eq(companySettings.organizationId, ctx.organizationId)).limit(1);
      const common = { uid: settings?.vatNumber ?? "", organisationName: settings?.companyName ?? "", year: period.year, period: period.period, startDate: period.startDate, endDate: period.endDate, netVatPayable: period.netVatPayable ?? "0", businessReferenceId: `WM-VAT-${period.year}-${period.period}`, formOfReporting: 1 as const, generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), applicationManufacturer: "WM Weibel Mueller AG", applicationProduct: "WM Buchhaltung", applicationVersion: "1.0" };
      const totalTurnover = Number(period.turnover81 ?? 0) + Number(period.turnover26 ?? 0) + Number(period.turnover38 ?? 0);
      const xml = settings?.vatMethod === "saldo"
        ? buildEch0217NetTaxRateXmlDraft({ ...common, supplies: [{ taxRate: settings.vatSaldoRate ?? "0", turnover: totalTurnover }] })
        : settings?.vatMethod === "pauschal"
          ? buildEch0217FlatTaxRateXmlDraft({ ...common, activity: settings.vatPauschalActivity ?? "", taxRate: settings.vatPauschalRate ?? "0", turnover: totalTurnover })
          : buildEch0217EffectiveXmlDraft({ ...common, vatMethod: "effective", turnover81: period.turnover81 ?? "0", turnover26: period.turnover26 ?? "0", turnover38: period.turnover38 ?? "0", vatDue81: period.vatDue81 ?? "0", vatDue26: period.vatDue26 ?? "0", vatDue38: period.vatDue38 ?? "0", inputTax: period.inputTax ?? "0" });
      return { filename: `ESTV_MWST_${period.period}_${period.year}_ENTWURF.xml`, xml, warning: "XML-Entwurf: Vor ESTV-Upload gegen vollständigen eCH-0217:2025-XSD-Satz validieren." };
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(vatPeriods).where(and(
        eq(vatPeriods.id, input.id),
        eq(vatPeriods.organizationId, ctx.organizationId),
      ));
      return { success: true };
    }),
});
