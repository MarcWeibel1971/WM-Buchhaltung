import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { suppliers, accounts } from "../drizzle/schema";
import { eq, and, desc, asc, sql, like } from "drizzle-orm";
import { getDb } from "./db";

export const suppliersRouter = router({
  list: protectedProcedure
    .input(z.object({
      includeInactive: z.boolean().optional().default(false),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const conditions = [];
      if (!input?.includeInactive) {
        conditions.push(eq(suppliers.isActive, true));
      }
      if (input?.search) {
        conditions.push(
          sql`(${suppliers.name} LIKE ${'%' + input.search + '%'} OR ${suppliers.city} LIKE ${'%' + input.search + '%'} OR ${suppliers.iban} LIKE ${'%' + input.search + '%'})`
        );
      }
      const result = await db
        .select()
        .from(suppliers)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(suppliers.name));

      // Fetch account names for defaultDebitAccountId
      const accountIds = result.filter(s => s.defaultDebitAccountId).map(s => s.defaultDebitAccountId!);
      let accountMap: Record<number, { number: string; name: string }> = {};
      if (accountIds.length > 0) {
        const accs = await db
          .select({ id: accounts.id, number: accounts.number, name: accounts.name })
          .from(accounts)
          .where(sql`${accounts.id} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`);
        accountMap = Object.fromEntries(accs.map(a => [a.id, { number: a.number, name: a.name }]));
      }

      return result.map(s => ({
        ...s,
        defaultDebitAccount: s.defaultDebitAccountId ? accountMap[s.defaultDebitAccountId] : null,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, input.id));
      if (!supplier) throw new Error("Lieferant nicht gefunden");
      return supplier;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      street: z.string().optional(),
      zipCode: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      iban: z.string().optional(),
      bic: z.string().optional(),
      paymentTermDays: z.number().optional(),
      contactPerson: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      defaultDebitAccountId: z.number().optional(),
      matchPattern: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const [result] = await db.insert(suppliers).values({
        name: input.name,
        street: input.street || null,
        zipCode: input.zipCode || null,
        city: input.city || null,
        country: input.country || "Schweiz",
        iban: input.iban || null,
        bic: input.bic || null,
        paymentTermDays: input.paymentTermDays ?? 30,
        contactPerson: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        notes: input.notes || null,
        defaultDebitAccountId: input.defaultDebitAccountId || null,
        matchPattern: input.matchPattern || null,
      });
      return { id: result.insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      street: z.string().optional(),
      zipCode: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      iban: z.string().optional(),
      bic: z.string().optional(),
      paymentTermDays: z.number().optional(),
      contactPerson: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      defaultDebitAccountId: z.number().nullable().optional(),
      matchPattern: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const { id, ...data } = input;
      await db.update(suppliers).set(data).where(eq(suppliers.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      // Soft delete - set isActive to false
      await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, input.id));
      return { success: true };
    }),
});
