import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { customers, customerServices, accounts } from "../drizzle/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { getDb } from "./db";

export const customersRouter = router({
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
        conditions.push(eq(customers.isActive, true));
      }
      if (input?.search) {
        conditions.push(
          sql`(${customers.name} LIKE ${'%' + input.search + '%'} OR ${customers.company} LIKE ${'%' + input.search + '%'} OR ${customers.city} LIKE ${'%' + input.search + '%'})`
        );
      }
      const custs = await db
        .select()
        .from(customers)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(customers.name));

      // Fetch services for each customer
      const result = [];
      for (const c of custs) {
        const svcs = await db
          .select()
          .from(customerServices)
          .where(eq(customerServices.customerId, c.id))
          .orderBy(asc(customerServices.sortOrder));

        // Fetch account names for services
        const accountIds = svcs.filter(s => s.revenueAccountId).map(s => s.revenueAccountId!);
        let accountMap: Record<number, { number: string; name: string }> = {};
        if (accountIds.length > 0) {
          const accs = await db
            .select({ id: accounts.id, number: accounts.number, name: accounts.name })
            .from(accounts)
            .where(sql`${accounts.id} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`);
          accountMap = Object.fromEntries(accs.map(a => [a.id, { number: a.number, name: a.name }]));
        }

        result.push({
          ...c,
          services: svcs.map(s => ({
            ...s,
            revenueAccount: s.revenueAccountId ? accountMap[s.revenueAccountId] : null,
          })),
        });
      }
      return result;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const [customer] = await db.select().from(customers).where(eq(customers.id, input.id));
      if (!customer) throw new Error("Kunde nicht gefunden");

      const svcs = await db
        .select()
        .from(customerServices)
        .where(eq(customerServices.customerId, customer.id))
        .orderBy(asc(customerServices.sortOrder));

      return { ...customer, services: svcs };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      company: z.string().optional(),
      street: z.string().optional(),
      zipCode: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      salutation: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const [result] = await db.insert(customers).values({
        name: input.name,
        company: input.company || null,
        street: input.street || null,
        zipCode: input.zipCode || null,
        city: input.city || null,
        country: input.country || "Schweiz",
        email: input.email || null,
        phone: input.phone || null,
        salutation: input.salutation || null,
        notes: input.notes || null,
      });
      return { id: result.insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      street: z.string().optional(),
      zipCode: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      salutation: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const { id, ...data } = input;
      await db.update(customers).set(data).where(eq(customers.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.update(customers).set({ isActive: false }).where(eq(customers.id, input.id));
      return { success: true };
    }),

  // ─── Customer Services ─────────────────────────────────────────────────────

  addService: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      description: z.string().min(1),
      revenueAccountId: z.number(),
      hourlyRate: z.number().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // If this is set as default, unset other defaults for this customer
      if (input.isDefault) {
        await db.update(customerServices)
          .set({ isDefault: false })
          .where(eq(customerServices.customerId, input.customerId));
      }

      // Get max sort order
      const existing = await db
        .select({ maxSort: sql<number>`COALESCE(MAX(${customerServices.sortOrder}), 0)` })
        .from(customerServices)
        .where(eq(customerServices.customerId, input.customerId));
      const nextSort = (existing[0]?.maxSort ?? 0) + 1;

      const [result] = await db.insert(customerServices).values({
        customerId: input.customerId,
        description: input.description,
        revenueAccountId: input.revenueAccountId,
        hourlyRate: input.hourlyRate ? String(input.hourlyRate) : null,
        isDefault: input.isDefault ?? false,
        sortOrder: nextSort,
      });
      return { id: result.insertId };
    }),

  updateService: protectedProcedure
    .input(z.object({
      id: z.number(),
      customerId: z.number(),
      description: z.string().min(1).optional(),
      revenueAccountId: z.number().optional(),
      hourlyRate: z.number().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const { id, customerId, ...data } = input;

      if (data.isDefault) {
        await db.update(customerServices)
          .set({ isDefault: false })
          .where(eq(customerServices.customerId, customerId));
      }

      const updateData: any = {};
      if (data.description !== undefined) updateData.description = data.description;
      if (data.revenueAccountId !== undefined) updateData.revenueAccountId = data.revenueAccountId;
      if (data.hourlyRate !== undefined) updateData.hourlyRate = String(data.hourlyRate);
      if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

      await db.update(customerServices).set(updateData).where(eq(customerServices.id, id));
      return { success: true };
    }),

  deleteService: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(customerServices).where(eq(customerServices.id, input.id));
      return { success: true };
    }),

  // ─── Bulk import customers from CSV/Excel data ─────────────────────────────
  importFromList: protectedProcedure
    .input(z.object({
      customers: z.array(z.object({
        name: z.string().min(1),
        company: z.string().optional(),
        street: z.string().optional(),
        zipCode: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        salutation: z.string().optional(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      let created = 0;
      let skipped = 0;
      const details: Array<{ name: string; action: string }> = [];

      for (const c of input.customers) {
        // Check for duplicate by name (case-insensitive)
        const existing = await db
          .select({ id: customers.id })
          .from(customers)
          .where(sql`LOWER(${customers.name}) = LOWER(${c.name.trim()})`)
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          details.push({ name: c.name, action: "übersprungen (existiert bereits)" });
          continue;
        }

        // Also check by company name if provided
        if (c.company) {
          const companyMatch = await db
            .select({ id: customers.id })
            .from(customers)
            .where(sql`LOWER(${customers.company}) = LOWER(${c.company.trim()})`)
            .limit(1);

          if (companyMatch.length > 0) {
            skipped++;
            details.push({ name: c.name, action: "übersprungen (Firma existiert)" });
            continue;
          }
        }

        await db.insert(customers).values({
          name: c.name.trim(),
          company: c.company || null,
          street: c.street || null,
          zipCode: c.zipCode || null,
          city: c.city || null,
          country: c.country || "Schweiz",
          email: c.email || null,
          phone: c.phone || null,
          salutation: c.salutation || null,
          notes: c.notes || null,
        });

        created++;
        details.push({ name: c.name, action: "erstellt" });
      }

      return { total: input.customers.length, created, skipped, details };
    }),
});
