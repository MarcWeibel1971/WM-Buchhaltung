/**
 * Settings Router – Einstellungen-Bereich
 * Handles: company settings, insurance settings, bank accounts (IBAN), employees, booking rules
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  companySettings, insuranceSettings, employees, bankAccounts, bankTransactions, bookingRules, accounts,
  openingBalances, journalEntries, journalLines, fiscalYears, templates
} from "../drizzle/schema";
import { storagePut } from "./storage";
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
  logoUrl: z.string().max(500).optional(),
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
        street: "Grendelstrasse 2",
        zipCode: "6004",
        city: "Luzern",
        canton: "LU",
        country: "Schweiz",
        uid: "CHE-101.177.334",
        vatNumber: "CHE-101.177.334 MWST",
        vatMethod: "effective" as const,
        vatSaldoRate: "6.20",
        vatPeriod: "quarterly" as const,
        fiscalYearStartMonth: 1,
        phone: "+41 41 417 44 44",
        email: "marc.weibel@weibel-mueller.ch",
        website: "weibel-mueller.ch",
        hrNumber: null,
        logoUrl: null,
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
          logoUrl: input.logoUrl,
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
            logoUrl: input.logoUrl,
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
      // Only return active accounts (or accounts that have a non-zero opening balance)
      const allAccounts = await db.select().from(accounts).orderBy(asc(accounts.number));
      const obs = await db.select().from(openingBalances)
        .where(eq(openingBalances.fiscalYear, input.fiscalYear));
      return allAccounts
        .filter(acc => acc.isActive || obs.some(o => o.accountId === acc.id && parseFloat(o.balance as string) !== 0))
        .map(acc => {
          const ob = obs.find(o => o.accountId === acc.id);
          return {
            accountId: acc.id,
            accountNumber: acc.number,
            accountName: acc.name,
            accountType: acc.accountType,
            category: acc.category,
            subCategory: acc.subCategory,
            isActive: acc.isActive,
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

      // Auto-create bank account entry if isBankAccount is true
      if (input.isBankAccount) {
        const existing = await db.select().from(bankAccounts).where(eq(bankAccounts.accountId, result.id)).limit(1);
        if (existing.length === 0) {
          await db.insert(bankAccounts).values({
            accountId: result.id,
            name: input.name,
            currency: "CHF",
            isActive: true,
          });
        }
      }

      return { success: true, id: result.id, bankAccountCreated: !!input.isBankAccount };
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

      // Sync bank account when isBankAccount changes
      if (input.isBankAccount !== undefined) {
        const existingBA = await db.select().from(bankAccounts).where(eq(bankAccounts.accountId, id)).limit(1);
        if (input.isBankAccount && existingBA.length === 0) {
          // Create bank account entry
          const [acct] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
          await db.insert(bankAccounts).values({
            accountId: id,
            name: acct?.name ?? `Konto ${id}`,
            currency: "CHF",
            isActive: true,
          });
          return { success: true, bankAccountCreated: true };
        } else if (!input.isBankAccount && existingBA.length > 0) {
          // Check if bank account has transactions before removing
          const [txCount] = await db.select({ count: sql`COUNT(*)` })
            .from(bankTransactions).where(eq(bankTransactions.bankAccountId, existingBA[0].id));
          if (Number(txCount?.count) === 0) {
            await db.delete(bankAccounts).where(eq(bankAccounts.id, existingBA[0].id));
            return { success: true, bankAccountRemoved: true };
          }
          // If transactions exist, keep bank account but update the flag
          return { success: true, bankAccountKept: true, reason: "Bankkonto hat Transaktionen und kann nicht entfernt werden" };
        }
      }

      // Also sync name changes to bank account
      if (input.name) {
        const existingBA = await db.select().from(bankAccounts).where(eq(bankAccounts.accountId, id)).limit(1);
        if (existingBA.length > 0) {
          await db.update(bankAccounts).set({ name: input.name }).where(eq(bankAccounts.id, existingBA[0].id));
        }
      }

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
      // Also clean up bankAccounts if this was a bank account
      const [acct] = await db.select().from(accounts).where(eq(accounts.id, input.id));
      if (acct?.isBankAccount) {
        await db.delete(bankAccounts).where(eq(bankAccounts.accountId, input.id));
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

  // ─── Bulk Import Accounts ─────────────────────────────────────────────────
  bulkImportAccounts: protectedProcedure
    .input(z.object({
      accounts: z.array(z.object({
        number: z.string().min(1).max(10),
        name: z.string().min(1).max(200),
        accountType: z.enum(["asset", "liability", "expense", "revenue", "equity"]),
        category: z.string().max(100).optional(),
        subCategory: z.string().max(100).optional(),
      })),
      mode: z.enum(["merge", "replace"]).default("merge"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let created = 0;
      let updated = 0;
      let skipped = 0;

      if (input.mode === "replace") {
        // Check which accounts have journal lines
        const usedAccounts = await db.select({ accountId: journalLines.accountId })
          .from(journalLines)
          .groupBy(journalLines.accountId);
        const usedIds = new Set(usedAccounts.map(u => u.accountId));

        // Delete unused accounts
        const allAccs = await db.select().from(accounts);
        for (const acc of allAccs) {
          if (!usedIds.has(acc.id)) {
            await db.delete(accounts).where(eq(accounts.id, acc.id));
          }
        }
      }

      for (const acc of input.accounts) {
        const normalBalance = (acc.accountType === "liability" || acc.accountType === "revenue" || acc.accountType === "equity") ? "credit" : "debit";
        const existing = await db.select().from(accounts).where(eq(accounts.number, acc.number)).limit(1);

        if (existing.length > 0) {
          if (input.mode === "merge") {
            // Update name and categories if changed
            await db.update(accounts).set({
              name: acc.name,
              category: acc.category ?? null,
              subCategory: acc.subCategory ?? null,
            }).where(eq(accounts.id, existing[0].id));
            updated++;
          } else {
            skipped++;
          }
        } else {
          await db.insert(accounts).values({
            number: acc.number,
            name: acc.name,
            accountType: acc.accountType,
            normalBalance,
            category: acc.category ?? null,
            subCategory: acc.subCategory ?? null,
            isActive: true,
            sortOrder: parseInt(acc.number) || 0,
          });
          created++;
        }
      }

      return { success: true, created, updated, skipped };
    }),

  // ─── KMU-Kontenplan Template ──────────────────────────────────────────────
  getKmuTemplate: protectedProcedure.query(async () => {
    // Standard Swiss KMU chart of accounts based on Käfer-Kontenrahmen
    return {
      name: "Schweizer KMU-Kontenrahmen (Käfer)",
      description: "Standardkontenplan für kleine und mittlere Unternehmen in der Schweiz, basierend auf dem Käfer-Kontenrahmen.",
      accounts: [
        // 1 - Aktiven
        // 10 - Umlaufvermögen
        { number: "1000", name: "Kasse", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Flüssige Mittel" },
        { number: "1010", name: "Post", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Flüssige Mittel" },
        { number: "1020", name: "Bank", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Flüssige Mittel" },
        { number: "1100", name: "Debitoren (Forderungen aus L+L)", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Forderungen" },
        { number: "1109", name: "Delkredere", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Forderungen" },
        { number: "1170", name: "Vorsteuer (Vorsteuer auf Materialaufwand)", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Forderungen" },
        { number: "1171", name: "Vorsteuer (Vorsteuer auf Investitionen)", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Forderungen" },
        { number: "1176", name: "Verrechnungssteuer", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Forderungen" },
        { number: "1200", name: "Warenvorrat / Handelswaren", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Vorräte" },
        { number: "1210", name: "Rohmaterial", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Vorräte" },
        { number: "1300", name: "Aktive Rechnungsabgrenzung", accountType: "asset" as const, category: "Umlaufvermögen", subCategory: "Transitorische Aktiven" },
        // 14-15 - Anlagevermögen
        { number: "1400", name: "Wertschriften", accountType: "asset" as const, category: "Anlagevermögen", subCategory: "Finanzanlagen" },
        { number: "1440", name: "Darlehen", accountType: "asset" as const, category: "Anlagevermögen", subCategory: "Finanzanlagen" },
        { number: "1500", name: "Maschinen und Apparate", accountType: "asset" as const, category: "Anlagevermögen", subCategory: "Mobile Sachanlagen" },
        { number: "1510", name: "Mobiliar und Einrichtungen", accountType: "asset" as const, category: "Anlagevermögen", subCategory: "Mobile Sachanlagen" },
        { number: "1520", name: "Büromaschinen / Informatik", accountType: "asset" as const, category: "Anlagevermögen", subCategory: "Mobile Sachanlagen" },
        { number: "1530", name: "Fahrzeuge", accountType: "asset" as const, category: "Anlagevermögen", subCategory: "Mobile Sachanlagen" },
        { number: "1600", name: "Immobilien", accountType: "asset" as const, category: "Anlagevermögen", subCategory: "Immobile Sachanlagen" },
        // 2 - Passiven
        // 20 - Fremdkapital
        { number: "2000", name: "Kreditoren (Verbindlichkeiten aus L+L)", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital" },
        { number: "2030", name: "Kontokorrent Sozialversicherungen", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital" },
        { number: "2100", name: "Bankverbindlichkeiten kurzfristig", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital" },
        { number: "2200", name: "Geschuldete MWST", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital" },
        { number: "2206", name: "Verrechnungssteuer", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Kurzfristiges Fremdkapital" },
        { number: "2300", name: "Passive Rechnungsabgrenzung", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Transitorische Passiven" },
        { number: "2400", name: "Bankverbindlichkeiten langfristig", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Langfristiges Fremdkapital" },
        { number: "2450", name: "Hypotheken", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Langfristiges Fremdkapital" },
        { number: "2500", name: "Rückstellungen", accountType: "liability" as const, category: "Fremdkapital", subCategory: "Langfristiges Fremdkapital" },
        // 28 - Eigenkapital
        { number: "2800", name: "Aktienkapital / Stammkapital", accountType: "equity" as const, category: "Eigenkapital", subCategory: "Eigenkapital" },
        { number: "2900", name: "Gesetzliche Reserven", accountType: "equity" as const, category: "Eigenkapital", subCategory: "Reserven" },
        { number: "2950", name: "Gewinnvortrag / Verlustvortrag", accountType: "equity" as const, category: "Eigenkapital", subCategory: "Reserven" },
        { number: "2979", name: "Jahresgewinn / Jahresverlust", accountType: "equity" as const, category: "Eigenkapital", subCategory: "Reserven" },
        // 3 - Ertrag
        { number: "3000", name: "Produktionserlöse / Dienstleistungserlöse", accountType: "revenue" as const, category: "Dienstleistungsertrag", subCategory: "Betriebsertrag" },
        { number: "3200", name: "Handelserlöse", accountType: "revenue" as const, category: "Dienstleistungsertrag", subCategory: "Betriebsertrag" },
        { number: "3400", name: "Übrige Erlöse", accountType: "revenue" as const, category: "Dienstleistungsertrag", subCategory: "Betriebsertrag" },
        { number: "3800", name: "Erlösminderungen", accountType: "revenue" as const, category: "Dienstleistungsertrag", subCategory: "Erlösminderungen" },
        { number: "3900", name: "Eigenleistungen / Eigenverbrauch", accountType: "revenue" as const, category: "Dienstleistungsertrag", subCategory: "Eigenleistungen" },
        // 4 - Aufwand
        { number: "4000", name: "Materialaufwand / Warenaufwand", accountType: "expense" as const, category: "Drittaufwand", subCategory: "Materialaufwand" },
        { number: "4200", name: "Handelswarenaufwand", accountType: "expense" as const, category: "Drittaufwand", subCategory: "Materialaufwand" },
        { number: "4400", name: "Drittleistungen", accountType: "expense" as const, category: "Drittaufwand", subCategory: "Drittleistungen" },
        // 5 - Personalaufwand
        { number: "5000", name: "Löhne", accountType: "expense" as const, category: "Personalaufwand", subCategory: "Löhne" },
        { number: "5700", name: "Sozialversicherungsaufwand", accountType: "expense" as const, category: "Personalaufwand", subCategory: "Sozialleistungen" },
        { number: "5800", name: "Übriger Personalaufwand", accountType: "expense" as const, category: "Personalaufwand", subCategory: "Übriger Personalaufwand" },
        { number: "5810", name: "Aus- und Weiterbildung", accountType: "expense" as const, category: "Personalaufwand", subCategory: "Übriger Personalaufwand" },
        { number: "5820", name: "Spesen", accountType: "expense" as const, category: "Personalaufwand", subCategory: "Übriger Personalaufwand" },
        // 6 - Übriger Betriebsaufwand
        { number: "6000", name: "Raumaufwand / Miete", accountType: "expense" as const, category: "Mietaufwand", subCategory: "Raumaufwand" },
        { number: "6100", name: "Unterhalt und Reparaturen", accountType: "expense" as const, category: "Unterhalt und Reparatur", subCategory: "Unterhalt" },
        { number: "6200", name: "Fahrzeugaufwand", accountType: "expense" as const, category: "Unterhalt und Reparatur", subCategory: "Fahrzeuge" },
        { number: "6300", name: "Versicherungen", accountType: "expense" as const, category: "Versicherungen", subCategory: "Sachversicherungen" },
        { number: "6400", name: "Energie- und Entsorgungsaufwand", accountType: "expense" as const, category: "Betriebs- und Hilfsmaterial", subCategory: "Energie" },
        { number: "6500", name: "Verwaltungsaufwand", accountType: "expense" as const, category: "Verwaltungsaufwand", subCategory: "Büroaufwand" },
        { number: "6510", name: "Telefon / Internet", accountType: "expense" as const, category: "Verwaltungsaufwand", subCategory: "Kommunikation" },
        { number: "6520", name: "Buchführung / Beratung", accountType: "expense" as const, category: "Verwaltungsaufwand", subCategory: "Beratung" },
        { number: "6570", name: "Informatikaufwand", accountType: "expense" as const, category: "Verwaltungsaufwand", subCategory: "Informatik" },
        { number: "6600", name: "Werbeaufwand", accountType: "expense" as const, category: "Werbeaufwand", subCategory: "Werbung" },
        { number: "6700", name: "Übriger Betriebsaufwand", accountType: "expense" as const, category: "Übriger Aufwand", subCategory: "Diverses" },
        // 68 - Abschreibungen
        { number: "6800", name: "Abschreibungen auf Sachanlagen", accountType: "expense" as const, category: "Abschreibungen", subCategory: "Sachanlagen" },
        { number: "6900", name: "Finanzaufwand", accountType: "expense" as const, category: "Zinsaufwand", subCategory: "Finanzaufwand" },
        { number: "6950", name: "Finanzertrag", accountType: "revenue" as const, category: "Kapitalertrag", subCategory: "Finanzertrag" },
        // 7/8 - Betriebsfremder Aufwand/Ertrag
        { number: "7000", name: "Betriebsfremder Aufwand", accountType: "expense" as const, category: "Übriger Aufwand", subCategory: "Betriebsfremd" },
        { number: "7500", name: "Ausserordentlicher Aufwand", accountType: "expense" as const, category: "Übriger Aufwand", subCategory: "Ausserordentlich" },
        { number: "8000", name: "Betriebsfremder Ertrag", accountType: "revenue" as const, category: "Übriger Ertrag", subCategory: "Betriebsfremd" },
        { number: "8500", name: "Ausserordentlicher Ertrag", accountType: "revenue" as const, category: "Übriger Ertrag", subCategory: "Ausserordentlich" },
        { number: "9000", name: "Eröffnungsbilanz", accountType: "equity" as const, category: "Eigenkapital", subCategory: "Eröffnung" },
      ],
    };
  }),

  // ── Company Logo Upload ──────────────────────────────────────────────────────

  uploadCompanyLogo: protectedProcedure
    .input(z.object({
      base64: z.string(),
      filename: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import('./storage');
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Decode base64 to buffer
      const buffer = Buffer.from(input.base64, 'base64');

      // Upload to S3 with unique key
      const ext = input.filename.split('.').pop() || 'png';
      const key = `company-logo/logo-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Update company settings with logo URL
      const existing = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
      if (existing.length === 0) {
        await db.insert(companySettings).values({
          companyName: 'WM Weibel Mueller AG',
          logoUrl: url,
        });
      } else {
        await db.update(companySettings)
          .set({ logoUrl: url })
          .where(eq(companySettings.id, existing[0].id));
      }

      return { url };
    }),

  deleteCompanyLogo: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const existing = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
      if (existing.length > 0) {
        await db.update(companySettings)
          .set({ logoUrl: null })
          .where(eq(companySettings.id, existing[0].id));
      }

      return { success: true };
    }),

  // ─── Templates ───────────────────────────────────────────────────────────────

  listTemplates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    return db.select().from(templates).orderBy(asc(templates.templateType), asc(templates.name));
  }),

  uploadTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      templateType: z.enum(["invoice", "letter", "contract", "other"]),
      description: z.string().optional(),
      fileData: z.string(), // base64
      fileName: z.string(),
      mimeType: z.string(),
      fileSize: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const buffer = Buffer.from(input.fileData, "base64");
      const key = `templates/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const [result] = await db.insert(templates).values({
        name: input.name,
        templateType: input.templateType,
        description: input.description || null,
        s3Key: key,
        s3Url: url,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });
      return { id: result.insertId, url };
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(templates).where(eq(templates.id, input.id));
      return { success: true };
    }),

  setDefaultTemplate: protectedProcedure
    .input(z.object({ id: z.number(), templateType: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      // Unset all defaults for this type
      await db.update(templates).set({ isDefault: false }).where(eq(templates.templateType, input.templateType as any));
      // Set this one as default
      await db.update(templates).set({ isDefault: true }).where(eq(templates.id, input.id));
      return { success: true };
    }),
});
