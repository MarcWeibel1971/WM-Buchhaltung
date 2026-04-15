import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { suppliers, accounts, documents } from "../drizzle/schema";
import { eq, and, desc, asc, sql, like, or, isNull } from "drizzle-orm";
import { getDb } from "./db";

// ─── Helper: Find or create supplier from AI metadata ────────────────────────
export async function findOrCreateSupplierFromMetadata(
  metadata: {
    counterparty?: string | null;
    counterpartyIban?: string | null;
    description?: string | null;
  },
  db: any
): Promise<{ supplierId: number; created: boolean } | null> {
  if (!metadata.counterparty || metadata.counterparty.trim().length < 2) return null;

  const name = metadata.counterparty.trim();

  // 1. Try exact name match (case-insensitive)
  const existing = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(sql`LOWER(${suppliers.name}) = LOWER(${name})`)
    .limit(1);

  if (existing.length > 0) {
    return { supplierId: existing[0].id, created: false };
  }

  // 2. Try IBAN match if available
  if (metadata.counterpartyIban) {
    const ibanClean = metadata.counterpartyIban.replace(/\s/g, "").toUpperCase();
    if (ibanClean.length >= 15) {
      const ibanMatch = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(sql`REPLACE(UPPER(${suppliers.iban}), ' ', '') = ${ibanClean}`)
        .limit(1);

      if (ibanMatch.length > 0) {
        return { supplierId: ibanMatch[0].id, created: false };
      }
    }
  }

  // 3. Try fuzzy name match (contains)
  const fuzzyMatch = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(
      or(
        sql`LOWER(${suppliers.name}) LIKE LOWER(${`%${name}%`})`,
        sql`LOWER(${name}) LIKE CONCAT('%', LOWER(${suppliers.name}), '%')`
      )
    )
    .limit(1);

  if (fuzzyMatch.length > 0) {
    return { supplierId: fuzzyMatch[0].id, created: false };
  }

  // 4. Create new supplier
  const [result] = await db.insert(suppliers).values({
    name,
    iban: metadata.counterpartyIban?.replace(/\s/g, "") || null,
    matchPattern: name,
    notes: "Automatisch aus Rechnung erstellt",
    country: "Schweiz",
    paymentTermDays: 30,
  });

  return { supplierId: result.insertId, created: true };
}

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

  // ─── Import suppliers from existing invoice documents ────────────────────────
  importFromDocuments: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Find all invoice_in documents that have AI metadata but no supplier linked
      const docs = await db
        .select({
          id: documents.id,
          aiMetadata: documents.aiMetadata,
          supplierId: documents.supplierId,
        })
        .from(documents)
        .where(
          and(
            eq(documents.documentType, "invoice_in"),
            isNull(documents.supplierId),
          )
        );

      let created = 0;
      let linked = 0;
      let skipped = 0;
      const details: Array<{ documentId: number; supplierName: string; action: string }> = [];

      for (const doc of docs) {
        if (!doc.aiMetadata) {
          skipped++;
          continue;
        }

        let metadata: any;
        try {
          metadata = JSON.parse(doc.aiMetadata);
        } catch {
          skipped++;
          continue;
        }

        const result = await findOrCreateSupplierFromMetadata(metadata, db);
        if (!result) {
          skipped++;
          continue;
        }

        // Link document to supplier
        await db.update(documents)
          .set({ supplierId: result.supplierId })
          .where(eq(documents.id, doc.id));

        if (result.created) {
          created++;
          details.push({ documentId: doc.id, supplierName: metadata.counterparty, action: "erstellt" });
        } else {
          linked++;
          details.push({ documentId: doc.id, supplierName: metadata.counterparty, action: "verknüpft" });
        }
      }

      return {
        total: docs.length,
        created,
        linked,
        skipped,
        details: details.slice(0, 50), // Limit details to 50 for UI
      };
    }),

  // ─── Bulk import suppliers from CSV/Excel data ───────────────────────────────
  importFromList: protectedProcedure
    .input(z.object({
      suppliers: z.array(z.object({
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
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      let created = 0;
      let skipped = 0;
      const details: Array<{ name: string; action: string }> = [];

      for (const s of input.suppliers) {
        // Check for duplicate by name (case-insensitive)
        const existing = await db
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(sql`LOWER(${suppliers.name}) = LOWER(${s.name.trim()})`)
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          details.push({ name: s.name, action: "übersprungen (existiert bereits)" });
          continue;
        }

        // Also check by IBAN if provided
        if (s.iban) {
          const ibanClean = s.iban.replace(/\s/g, "").toUpperCase();
          if (ibanClean.length >= 15) {
            const ibanMatch = await db
              .select({ id: suppliers.id })
              .from(suppliers)
              .where(sql`REPLACE(UPPER(${suppliers.iban}), ' ', '') = ${ibanClean}`)
              .limit(1);

            if (ibanMatch.length > 0) {
              skipped++;
              details.push({ name: s.name, action: "übersprungen (IBAN existiert)" });
              continue;
            }
          }
        }

        await db.insert(suppliers).values({
          name: s.name.trim(),
          street: s.street || null,
          zipCode: s.zipCode || null,
          city: s.city || null,
          country: s.country || "Schweiz",
          iban: s.iban?.replace(/\s/g, "") || null,
          bic: s.bic?.replace(/\s/g, "") || null,
          paymentTermDays: s.paymentTermDays ?? 30,
          contactPerson: s.contactPerson || null,
          email: s.email || null,
          phone: s.phone || null,
          notes: s.notes || null,
          matchPattern: s.name.trim(),
        });

        created++;
        details.push({ name: s.name, action: "erstellt" });
      }

      return { total: input.suppliers.length, created, skipped, details };
    }),
});
