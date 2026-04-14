/**
 * Settings Router – Einstellungen-Bereich
 * Handles: company settings, insurance settings, bank accounts (IBAN), employees, booking rules
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  companySettings, insuranceSettings, employees, bankAccounts, bookingRules, accounts,
  openingBalances, journalEntries, journalLines, fiscalYears
} from "../drizzle/schema";
import { and, eq, asc, desc, sql } from "drizzle-orm";

// ─── Company Settings ─────────────────────────────────────────────────────────

const companySettingsInput = z.object({
  companyName: z.string().min(1).max(200),
  legalForm: z.string().max(50).optional(),
  street: z.string().max(200).optional(),
  zipCode: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  canton: z.string().max(50).optional(),
  country: z.string().max(50).optional(),
  uid: z.string().max(20).optional(),
  vatNumber: z.string().max(30).optional(),
  vatMethod: z.enum(["effective", "saldo", "pauschal"]).optional(),
  vatSaldoRate: z.string().max(10).optional(),
  vatPeriod: z.enum(["quarterly", "semi-annual"]).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(200).optional(),
  website: z.string().max(200).optional(),
  hrNumber: z.string().max(50).optional(),
});

// ─── Insurance Settings ───────────────────────────────────────────────────────

const insuranceSettingInput = z.object({
  insuranceType: z.enum(["uvg", "ktg", "bvg", "ahv", "fak"]),
  insurerName: z.string().max(200).optional(),
  policyNumber: z.string().max(100).optional(),
  employeeRate: z.number().min(0).max(100).optional(),
  employerRate: z.number().min(0).max(100).optional(),
  maxInsuredSalary: z.number().min(0).optional(),
  minInsuredSalary: z.number().min(0).optional(),
  // BVG: fixed monthly CHF amounts per employee (not percentage)
  bvgEmployeeMonthly: z.number().min(0).optional(),
  bvgEmployerMonthly: z.number().min(0).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Employee Input ───────────────────────────────────────────────────────────

const employeeInput = z.object({
  code: z.string().min(1).max(10),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  ahvNumber: z.string().max(20).optional(),
  address: z.string().optional(),
  // Structured address fields
  street: z.string().max(200).optional(),
  zipCode: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  dateOfBirth: z.string().optional(),
  employmentStart: z.string().optional(),
  employmentEnd: z.string().optional(),
  salaryAccountId: z.number().int().optional(),
  grossSalaryAccountId: z.number().int().optional(),
  // Lohnausweis Ziffer 15: Bemerkungen
  lohnausweisRemarks: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Booking Rule Input ───────────────────────────────────────────────────────

const bookingRuleInput = z.object({
  counterpartyPattern: z.string().min(1).max(300),
  descriptionPattern: z.string().max(500).optional(),
  bookingTextTemplate: z.string().max(500).optional(),
  debitAccountId: z.number().int().optional(),
  creditAccountId: z.number().int().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const settingsRouter = router({

  // ── Company Settings ────────────────────────────────────────────────────────

  getCompanySettings: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    const rows = await db.select().from(companySettings).limit(1);
    if (rows.length === 0) {
      // Return default values if not set
      return {
        id: null,
        companyName: "WM Weibel Mueller AG",
        legalForm: "AG",
        street: null,
        zipCode: null,
        city: null,
        canton: "LU",
        country: "Schweiz",
        uid: null,
        vatNumber: null,
        vatMethod: "effective" as const,
        vatSaldoRate: "6.20",
        vatPeriod: "quarterly" as const,
        fiscalYearStartMonth: 1,
        phone: null,
        email: null,
        website: null,
        hrNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return rows[0];
  }),

  upsertCompanySettings: protectedProcedure
    .input(companySettingsInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const existing = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
      if (existing.length === 0) {
        await db.insert(companySettings).values({
          companyName: input.companyName,
          legalForm: input.legalForm,
          street: input.street,
          zipCode: input.zipCode,
          city: input.city,
          canton: input.canton,
          country: input.country ?? "Schweiz",
          uid: input.uid,
          vatNumber: input.vatNumber,
          vatMethod: input.vatMethod,
          vatSaldoRate: input.vatSaldoRate,
          vatPeriod: input.vatPeriod,
          fiscalYearStartMonth: input.fiscalYearStartMonth,
          phone: input.phone,
          email: input.email,
          website: input.website,
          hrNumber: input.hrNumber,
        });
      } else {
        await db.update(companySettings)
          .set({
            companyName: input.companyName,
            legalForm: input.legalForm,
            street: input.street,
            zipCode: input.zipCode,
            city: input.city,
            canton: input.canton,
            country: input.country ?? "Schweiz",
            uid: input.uid,
            vatNumber: input.vatNumber,
            vatMethod: input.vatMethod,
            vatSaldoRate: input.vatSaldoRate,
            vatPeriod: input.vatPeriod,
            fiscalYearStartMonth: input.fiscalYearStartMonth,
            phone: input.phone,
            email: input.email,
            website: input.website,
            hrNumber: input.hrNumber,
          })
          .where(eq(companySettings.id, existing[0].id));
      }
      return { success: true };
    }),

  // ── Insurance Settings ───────────────────────────────────────────────────────

  getInsuranceSettings: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    return db.select().from(insuranceSettings).orderBy(asc(insuranceSettings.insuranceType));
  }),

  upsertInsuranceSetting: protectedProcedure
    .input(insuranceSettingInput.extend({ id: z.number().int().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const { id, employeeRate, employerRate, maxInsuredSalary, minInsuredSalary, bvgEmployeeMonthly, bvgEmployerMonthly, ...rest } = input;
      const data = {
        ...rest,
        employeeRate: employeeRate !== undefined ? String(employeeRate) : undefined,
        employerRate: employerRate !== undefined ? String(employerRate) : undefined,
        maxInsuredSalary: maxInsuredSalary !== undefined ? String(maxInsuredSalary) : undefined,
        minInsuredSalary: minInsuredSalary !== undefined ? String(minInsuredSalary) : undefined,
        bvgEmployeeMonthly: bvgEmployeeMonthly !== undefined ? String(bvgEmployeeMonthly) : undefined,
        bvgEmployerMonthly: bvgEmployerMonthly !== undefined ? String(bvgEmployerMonthly) : undefined,
      };
      if (id) {
        await db.update(insuranceSettings).set(data).where(eq(insuranceSettings.id, id));
      } else {
        await db.insert(insuranceSettings).values({
          insuranceType: data.insuranceType,
          insurerName: data.insurerName,
          policyNumber: data.policyNumber,
          employeeRate: data.employeeRate,
          employerRate: data.employerRate,
          maxInsuredSalary: data.maxInsuredSalary,
          minInsuredSalary: data.minInsuredSalary,
          bvgEmployeeMonthly: data.bvgEmployeeMonthly,
          bvgEmployerMonthly: data.bvgEmployerMonthly,
          validFrom: data.validFrom,
          validTo: data.validTo,
          notes: data.notes,
          isActive: data.isActive ?? true,
        });
      }
      return { success: true };
    }),

  deleteInsuranceSetting: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(insuranceSettings).where(eq(insuranceSettings.id, input.id));
      return { success: true };
    }),

  // ── Employees ────────────────────────────────────────────────────────────────

  getEmployees: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    return db.select().from(employees).orderBy(asc(employees.lastName));
  }),

  upsertEmployee: protectedProcedure
    .input(employeeInput.extend({ id: z.number().int().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const { id, ...data } = input;
      if (id) {
        await db.update(employees).set(data).where(eq(employees.id, id));
      } else {
        await db.insert(employees).values({
          code: data.code,
          firstName: data.firstName,
          lastName: data.lastName,
          ahvNumber: data.ahvNumber,
          address: data.address,
          street: data.street,
          zipCode: data.zipCode,
          city: data.city,
          dateOfBirth: data.dateOfBirth,
          employmentStart: data.employmentStart,
          employmentEnd: data.employmentEnd,
          salaryAccountId: data.salaryAccountId,
          grossSalaryAccountId: data.grossSalaryAccountId,
          lohnausweisRemarks: data.lohnausweisRemarks,
          isActive: data.isActive ?? true,
        });
      }
      return { success: true };
    }),

  deleteEmployee: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.update(employees)
        .set({ isActive: false })
        .where(eq(employees.id, input.id));
      return { success: true };
    }),

  // ── Bank Accounts ─────────────────────────────────────────────────────────────

  getBankAccounts: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    const bas = await db.select().from(bankAccounts).orderBy(asc(bankAccounts.accountId));
    // Enrich with account name
    const accs = await db.select({ id: accounts.id, number: accounts.number, name: accounts.name })
      .from(accounts);
    return bas.map(ba => {
      const acc = accs.find(a => a.id === ba.accountId);
      return { ...ba, accountNumber: acc?.number, accountName: acc?.name };
    });
  }),

  updateBankAccount: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().max(100).optional(),
      iban: z.string().max(34).optional(),
      bank: z.string().max(100).optional(),
      owner: z.string().max(10).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const { id, ...data } = input;
      await db.update(bankAccounts).set(data).where(eq(bankAccounts.id, id));
      return { success: true };
    }),

  // ── Booking Rules ─────────────────────────────────────────────────────────────

  getBookingRules: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    const rules = await db.select().from(bookingRules)
      .orderBy(desc(bookingRules.priority), desc(bookingRules.usageCount));
    // Enrich with account names
    const accs = await db.select({ id: accounts.id, number: accounts.number, name: accounts.name })
      .from(accounts);
    return rules.map(r => {
      const debit = accs.find(a => a.id === r.debitAccountId);
      const credit = accs.find(a => a.id === r.creditAccountId);
      return {
        ...r,
        debitAccountNumber: debit?.number,
        debitAccountName: debit?.name,
        creditAccountNumber: credit?.number,
        creditAccountName: credit?.name,
      };
    });
  }),

  updateBookingRule: protectedProcedure
    .input(bookingRuleInput.extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const { id, vatRate, ...rest } = input;
      await db.update(bookingRules).set({
        ...rest,
        vatRate: vatRate !== undefined ? String(vatRate) : undefined,
      }).where(eq(bookingRules.id, id));
      return { success: true };
    }),

  deleteBookingRule: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(bookingRules).where(eq(bookingRules.id, input.id));
      return { success: true };
    }),

  toggleBookingRule: protectedProcedure
    .input(z.object({ id: z.number().int(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.update(bookingRules)
        .set({ isActive: input.isActive })
        .where(eq(bookingRules.id, input.id));
      return { success: true };
    }),

  // ── Eröffnungssalden ──────────────────────────────────────────────────────────

  getOpeningBalances: protectedProcedure
    .input(z.object({ fiscalYear: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      // Get all accounts with their opening balances for the given fiscal year
      const allAccounts = await db.select().from(accounts).orderBy(asc(accounts.number));
      const obs = await db.select().from(openingBalances)
        .where(eq(openingBalances.fiscalYear, input.fiscalYear));
      return allAccounts.map(acc => {
        const ob = obs.find(o => o.accountId === acc.id);
        return {
          accountId: acc.id,
          accountNumber: acc.number,
          accountName: acc.name,
          accountType: acc.accountType,
          balance: ob ? parseFloat(ob.balance as string) : 0,
          hasBalance: !!ob,
        };
      });
    }),

  upsertOpeningBalances: protectedProcedure
    .input(z.object({
      fiscalYear: z.number().int(),
      balances: z.array(z.object({
        accountId: z.number().int(),
        balance: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Validate: sum of asset accounts must equal sum of liability+equity accounts
      const allAccounts = await db.select({ id: accounts.id, accountType: accounts.accountType })
        .from(accounts);

      let totalAssets = 0;
      let totalLiabilities = 0;
      for (const b of input.balances) {
        if (b.balance === 0) continue;
        const acc = allAccounts.find(a => a.id === b.accountId);
        if (!acc) continue;
        if (acc.accountType === 'asset') totalAssets += b.balance;
        else if (acc.accountType === 'liability' || acc.accountType === 'equity') totalLiabilities += b.balance;
      }

      const diff = Math.abs(totalAssets - totalLiabilities);
      if (diff > 0.01) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Aktiven (CHF ${totalAssets.toFixed(2)}) müssen gleich Passiven (CHF ${totalLiabilities.toFixed(2)}) sein. Differenz: CHF ${diff.toFixed(2)}`,
        });
      }

      // Upsert each balance
      for (const b of input.balances) {
        const existing = await db.select({ id: openingBalances.id })
          .from(openingBalances)
          .where(and(
            eq(openingBalances.accountId, b.accountId),
            eq(openingBalances.fiscalYear, input.fiscalYear)
          ))
          .limit(1);

        if (b.balance === 0) {
          // Delete zero balances to keep DB clean
          if (existing.length > 0) {
            await db.delete(openingBalances)
              .where(and(
                eq(openingBalances.accountId, b.accountId),
                eq(openingBalances.fiscalYear, input.fiscalYear)
              ));
          }
        } else if (existing.length > 0) {
          await db.update(openingBalances)
            .set({ balance: String(b.balance) })
            .where(eq(openingBalances.id, existing[0].id));
        } else {
          await db.insert(openingBalances).values({
            accountId: b.accountId,
            fiscalYear: input.fiscalYear,
            balance: String(b.balance),
          });
        }
      }

      // Rebuild the Eröffnungsbilanz journal entry for this fiscal year
      // Delete existing Eröffnungsbilanz entry
      // Find existing Eröffnungsbilanz entries (description-based)
      const existingEntries = await db.select({ id: journalEntries.id })
        .from(journalEntries)
        .where(and(
          eq(journalEntries.fiscalYear, input.fiscalYear),
          eq(journalEntries.source, 'system')
        ));

      // Only delete entries that are Eröffnungsbilanz (by description)
      for (const e of existingEntries) {
        const entry = await db.select({ description: journalEntries.description })
          .from(journalEntries).where(eq(journalEntries.id, e.id)).limit(1);
        if (entry[0]?.description?.includes('Eröffnungsbilanz')) {
          await db.delete(journalLines).where(eq(journalLines.entryId, e.id));
          await db.delete(journalEntries).where(eq(journalEntries.id, e.id));
        }
      }

      // Create new Eröffnungsbilanz journal entry
      const nonZeroBalances = input.balances.filter(b => b.balance !== 0);
      if (nonZeroBalances.length > 0) {
        const startDate = `${input.fiscalYear}-01-01`;
        const [newEntry] = await db.insert(journalEntries).values({
          bookingDate: startDate,
          valueDate: startDate,
          description: `Eröffnungsbilanz per 01.01.${input.fiscalYear}`,
          status: 'approved',
          source: 'system',
          fiscalYear: input.fiscalYear,
        }).$returningId();

        for (const b of nonZeroBalances) {
          const acc = allAccounts.find(a => a.id === b.accountId);
          if (!acc) continue;
          // Assets: debit side; Liabilities/Equity: credit side
          const side = acc.accountType === 'asset' ? 'debit' : 'credit';
          await db.insert(journalLines).values({
            entryId: newEntry.id,
            accountId: b.accountId,
            side,
            amount: String(Math.abs(b.balance)),
            description: `Eröffnungssaldo ${b.accountId}`,
          });
        }
      }

      return { success: true, totalAssets, totalLiabilities };
    }),

  // ── Chart of Accounts (Kontenplan) CRUD ────────────────────────────────────────────

  getAllAccounts: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(accounts).orderBy(asc(accounts.number));
  }),

  createAccount: protectedProcedure
    .input(z.object({
      number: z.string().min(1).max(10),
      name: z.string().min(1).max(200),
      accountType: z.enum(["asset", "liability", "expense", "revenue", "equity"]),
      normalBalance: z.enum(["debit", "credit"]),
      category: z.string().max(100).optional(),
      subCategory: z.string().max(100).optional(),
      isBankAccount: z.boolean().optional(),
      isVatRelevant: z.boolean().optional(),
      defaultVatRate: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check for duplicate number
      const existing = await db.select().from(accounts).where(eq(accounts.number, input.number)).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: `Konto ${input.number} existiert bereits` });
      const [result] = await db.insert(accounts).values({
        number: input.number,
        name: input.name,
        accountType: input.accountType,
        normalBalance: input.normalBalance,
        category: input.category ?? null,
        subCategory: input.subCategory ?? null,
        isBankAccount: input.isBankAccount ?? false,
        isVatRelevant: input.isVatRelevant ?? false,
        defaultVatRate: input.defaultVatRate ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      }).$returningId();
      return { success: true, id: result.id };
    }),

  updateAccount: protectedProcedure
    .input(z.object({
      id: z.number(),
      number: z.string().min(1).max(10).optional(),
      name: z.string().min(1).max(200).optional(),
      accountType: z.enum(["asset", "liability", "expense", "revenue", "equity"]).optional(),
      normalBalance: z.enum(["debit", "credit"]).optional(),
      category: z.string().max(100).optional().nullable(),
      subCategory: z.string().max(100).optional().nullable(),
      isBankAccount: z.boolean().optional(),
      isVatRelevant: z.boolean().optional(),
      defaultVatRate: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      // Remove undefined values
      const cleanData: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) cleanData[k] = v;
      }
      if (Object.keys(cleanData).length === 0) return { success: true };
      await db.update(accounts).set(cleanData).where(eq(accounts.id, id));
      return { success: true };
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if account has journal lines
      const [usage] = await db.select({ count: sql`COUNT(*)` })
        .from(journalLines).where(eq(journalLines.accountId, input.id));
      if (Number(usage?.count) > 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Konto hat ${usage.count} Buchungszeilen und kann nicht gelöscht werden. Deaktivieren Sie es stattdessen.` });
      }
      await db.delete(accounts).where(eq(accounts.id, input.id));
      return { success: true };
    }),

  updateAccountSortOrder: protectedProcedure
    .input(z.object({
      updates: z.array(z.object({
        id: z.number(),
        sortOrder: z.number().int(),
        category: z.string().optional(),
        subCategory: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (const u of input.updates) {
        const data: Record<string, any> = { sortOrder: u.sortOrder };
        if (u.category !== undefined) data.category = u.category;
        if (u.subCategory !== undefined) data.subCategory = u.subCategory;
        await db.update(accounts).set(data).where(eq(accounts.id, u.id));
      }
      return { success: true };
    }),

  toggleAccountActive: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(accounts).set({ isActive: input.isActive }).where(eq(accounts.id, input.id));
      return { success: true };
    }),

  updateAccountVat: protectedProcedure
    .input(z.object({
      id: z.number(),
      isVatRelevant: z.boolean(),
      defaultVatRate: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(accounts).set({
        isVatRelevant: input.isVatRelevant,
        defaultVatRate: input.defaultVatRate ?? null,
      }).where(eq(accounts.id, input.id));
      return { success: true };
    }),
});
