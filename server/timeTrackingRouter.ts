import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { timeEntries, services, customers, customerServices, accounts } from "../drizzle/schema";
import { eq, and, asc, desc, sql, gte, lte } from "drizzle-orm";
import { getDb } from "./db";

export const timeTrackingRouter = router({
  // ─── Services (Dienstleistungskatalog) ──────────────────────────────────────

  listServices: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const svcs = await db.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.sortOrder));
    const accountIds = svcs.filter(s => s.revenueAccountId).map(s => s.revenueAccountId!);
    let accountMap: Record<number, { number: string; name: string }> = {};
    if (accountIds.length > 0) {
      const accs = await db
        .select({ id: accounts.id, number: accounts.number, name: accounts.name })
        .from(accounts)
        .where(sql`${accounts.id} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`);
      accountMap = Object.fromEntries(accs.map(a => [a.id, { number: a.number, name: a.name }]));
    }
    return svcs.map(s => ({
      ...s,
      revenueAccount: s.revenueAccountId ? accountMap[s.revenueAccountId] : null,
    }));
  }),

  createService: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      defaultHourlyRate: z.number().optional(),
      revenueAccountId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await db.select({ maxSort: sql<number>`COALESCE(MAX(${services.sortOrder}), 0)` }).from(services);
      const [result] = await db.insert(services).values({
        name: input.name,
        description: input.description || null,
        defaultHourlyRate: input.defaultHourlyRate ? String(input.defaultHourlyRate) : "0",
        revenueAccountId: input.revenueAccountId || null,
        sortOrder: (existing[0]?.maxSort ?? 0) + 1,
      });
      return { id: result.insertId };
    }),

  updateService: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      defaultHourlyRate: z.number().optional(),
      revenueAccountId: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.defaultHourlyRate !== undefined) updateData.defaultHourlyRate = String(data.defaultHourlyRate);
      if (data.revenueAccountId !== undefined) updateData.revenueAccountId = data.revenueAccountId;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      await db.update(services).set(updateData).where(eq(services.id, id));
      return { success: true };
    }),

  // ─── Time Entries ───────────────────────────────────────────────────────────

  listEntries: protectedProcedure
    .input(z.object({
      fiscalYear: z.number().optional(),
      customerId: z.number().optional(),
      serviceId: z.number().optional(),
      status: z.enum(["open", "invoiced"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const conditions: any[] = [];
      if (input?.fiscalYear) conditions.push(eq(timeEntries.fiscalYear, input.fiscalYear));
      if (input?.customerId) conditions.push(eq(timeEntries.customerId, input.customerId));
      if (input?.serviceId) conditions.push(eq(timeEntries.serviceId, input.serviceId));
      if (input?.status) conditions.push(sql`${timeEntries.status} = ${input.status}`);
      if (input?.dateFrom) conditions.push(gte(timeEntries.date, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(timeEntries.date, input.dateTo));

      const entries = await db
        .select()
        .from(timeEntries)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(timeEntries.date), desc(timeEntries.id));

      // Enrich with customer and service names
      const customerIds = Array.from(new Set(entries.filter(e => e.customerId).map(e => e.customerId)));
      const serviceIds = Array.from(new Set(entries.filter(e => e.serviceId).map(e => e.serviceId)));

      let customerMap: Record<number, string> = {};
      if (customerIds.length > 0) {
        const custs = await db
          .select({ id: customers.id, name: customers.name })
          .from(customers)
          .where(sql`${customers.id} IN (${sql.join(customerIds.map(id => sql`${id}`), sql`, `)})`);
        customerMap = Object.fromEntries(custs.map(c => [c.id, c.name]));
      }

      let serviceMap: Record<number, string> = {};
      if (serviceIds.length > 0) {
        const svcs = await db
          .select({ id: services.id, name: services.name })
          .from(services)
          .where(sql`${services.id} IN (${sql.join(serviceIds.map(id => sql`${id}`), sql`, `)})`);
        serviceMap = Object.fromEntries(svcs.map(s => [s.id, s.name]));
      }

      return entries.map(e => ({
        ...e,
        customerName: e.customerId ? customerMap[e.customerId] : null,
        serviceName: e.serviceId ? serviceMap[e.serviceId] : null,
      }));
    }),

  createEntry: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      serviceId: z.number().optional(),
      date: z.string(),
      hours: z.number().min(0.01),
      description: z.string().optional(),
      hourlyRate: z.number(),
      fiscalYear: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(timeEntries).values({
        customerId: input.customerId,
        serviceId: input.serviceId || 0,
        date: input.date,
        hours: String(input.hours),
        description: input.description || null,
        hourlyRate: String(input.hourlyRate),
        status: "open",
        fiscalYear: input.fiscalYear,
        userId: ctx.user.id,
      });
      return { id: result.insertId };
    }),

  updateEntry: protectedProcedure
    .input(z.object({
      id: z.number(),
      customerId: z.number().optional(),
      serviceId: z.number().optional(),
      date: z.string().optional(),
      hours: z.number().optional(),
      description: z.string().optional(),
      hourlyRate: z.number().optional(),
      status: z.enum(["open", "invoiced"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: any = {};
      if (data.customerId !== undefined) updateData.customerId = data.customerId;
      if (data.serviceId !== undefined) updateData.serviceId = data.serviceId || null;
      if (data.date !== undefined) updateData.date = data.date;
      if (data.hours !== undefined) updateData.hours = String(data.hours);
      if (data.description !== undefined) updateData.description = data.description;
      if (data.hourlyRate !== undefined) updateData.hourlyRate = String(data.hourlyRate);
      if (data.status !== undefined) updateData.status = data.status;
      await db.update(timeEntries).set(updateData).where(eq(timeEntries.id, id));
      return { success: true };
    }),

  deleteEntry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, input.id));
      if (entry && entry.status === "invoiced") {
        throw new Error("Bereits verrechnete Einträge können nicht gelöscht werden");
      }
      await db.delete(timeEntries).where(eq(timeEntries.id, input.id));
      return { success: true };
    }),

  // Get summary for invoice creation
  getInvoiceSummary: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      entryIds: z.array(z.number()).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions: any[] = [
        eq(timeEntries.customerId, input.customerId),
        sql`${timeEntries.status} = 'open'`,
      ];

      const entries = await db
        .select()
        .from(timeEntries)
        .where(and(...conditions))
        .orderBy(asc(timeEntries.date));

      // Group by service
      const byService: Record<string, { serviceName: string; hours: number; rate: number; total: number; entries: typeof entries }> = {};
      for (const e of entries) {
        const key = e.serviceId ? String(e.serviceId) : "other";
        if (!byService[key]) {
          byService[key] = { serviceName: "", hours: 0, rate: Number(e.hourlyRate), total: 0, entries: [] };
        }
        byService[key].hours += Number(e.hours);
        byService[key].total += Number(e.hours) * Number(e.hourlyRate);
        byService[key].entries.push(e);
      }

      // Get service names
      const serviceIds = entries.filter(e => e.serviceId).map(e => e.serviceId!);
      if (serviceIds.length > 0) {
        const uniqueIds = Array.from(new Set(serviceIds));
        const svcs = await db
          .select({ id: services.id, name: services.name })
          .from(services)
          .where(sql`${services.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`);
        const svcMap = Object.fromEntries(svcs.map(s => [s.id, s.name]));
        for (const key of Object.keys(byService)) {
          if (key !== "other") {
            byService[key].serviceName = svcMap[parseInt(key)] || "Unbekannt";
          } else {
            byService[key].serviceName = "Sonstige Leistungen";
          }
        }
      }

      // Get customer info
      const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId));

      return {
        customer,
        services: Object.values(byService),
        totalHours: entries.reduce((sum, e) => sum + Number(e.hours), 0),
        totalAmount: entries.reduce((sum, e) => sum + Number(e.hours) * Number(e.hourlyRate), 0),
        entryCount: entries.length,
      };
    }),

  // Get customers with their services for dropdowns
  getCustomersWithServices: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const custs = await db.select().from(customers).where(eq(customers.isActive, true)).orderBy(asc(customers.name));
    const result = [];
    for (const c of custs) {
      const svcs = await db
        .select()
        .from(customerServices)
        .where(eq(customerServices.customerId, c.id))
        .orderBy(asc(customerServices.sortOrder));
      result.push({ ...c, services: svcs });
    }
    return result;
  }),
});
