/**
 * Settings Router – Einstellungen-Bereich
 * Handles: company settings, insurance settings, bank accounts (IBAN), employees, booking rules
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  companySettings, insuranceSettings, employees, bankAccounts, bookingRules, accounts
} from "../drizzle/schema";
import { eq, asc, desc } from "drizzle-orm";

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
      const { id, employeeRate, employerRate, maxInsuredSalary, minInsuredSalary, ...rest } = input;
      const data = {
        ...rest,
        employeeRate: employeeRate !== undefined ? String(employeeRate) : undefined,
        employerRate: employerRate !== undefined ? String(employerRate) : undefined,
        maxInsuredSalary: maxInsuredSalary !== undefined ? String(maxInsuredSalary) : undefined,
        minInsuredSalary: minInsuredSalary !== undefined ? String(minInsuredSalary) : undefined,
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
});
