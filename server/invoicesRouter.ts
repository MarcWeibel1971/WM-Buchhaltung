/**
 * Invoices Router (Phase 2e)
 *
 * Vollständiges Rechnungsmodul mit Nummernkreis, Positionen, MWST,
 * Zahlungsstatus und Anbindung an Journal + QR-Rechnung.
 *
 * Workflow:
 *   1. create  → Draft (status="draft", keine Nummer, kein Journal)
 *   2. update  → ändert Draft (mit Neuberechnung der Totale)
 *   3. issue   → vergibt Nummer + QR-Ref + erstellt Journal-Entry (status="sent")
 *   4. markPaid/recordPartialPayment → Status-Updates
 *   5. cancel/writeOff → Gegenbuchung + Status-Update
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orgProcedure, router } from "./_core/trpc";
import {
  invoices,
  invoiceItems,
  customers,
  accounts,
  journalEntries,
  companySettings,
} from "../drizzle/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import {
  getDb,
  allocateInvoiceNumber,
  createJournalEntry,
  approveJournalEntry,
} from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generiert eine QR-Referenz (26 Ziffern + 1 Prüfziffer) aus einer Invoice-ID.
 * Format: YYMMDD + 20-stellig zero-padded ID + Modulo-10-Prüfziffer.
 * Kopie aus qrBillRouter – eine Extraktion in ein shared module steht
 * als kleine Aufräum-Aufgabe in der Roadmap.
 */
function generateQRReference(invoiceId: number, fiscalYear: number): string {
  const base = String(fiscalYear).slice(-2) + "0000" + String(invoiceId).padStart(20, "0");
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const ch of base) {
    carry = table[(carry + parseInt(ch)) % 10];
  }
  const check = (10 - carry) % 10;
  return base + String(check);
}

/** Rundet auf 2 Dezimalstellen (Rappen). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Berechnet die Summen einer Invoice aus ihren Positionen. */
function calcTotals(items: Array<{ quantity: string | number; unitPrice: string | number; vatRate: string | number }>) {
  let subtotal = 0;
  let vatTotal = 0;
  for (const it of items) {
    const qty = typeof it.quantity === "string" ? parseFloat(it.quantity) : it.quantity;
    const price = typeof it.unitPrice === "string" ? parseFloat(it.unitPrice) : it.unitPrice;
    const rate = typeof it.vatRate === "string" ? parseFloat(it.vatRate) : it.vatRate;
    const lineNet = round2(qty * price);
    const lineVat = round2(lineNet * rate / 100);
    subtotal += lineNet;
    vatTotal += lineVat;
  }
  subtotal = round2(subtotal);
  vatTotal = round2(vatTotal);
  return { subtotal, vatTotal, total: round2(subtotal + vatTotal) };
}

/** Zod-Schema für Invoice-Items (wird in create + update verwendet). */
const invoiceItemInput = z.object({
  position: z.number().int().min(1),
  serviceId: z.number().optional(),
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().max(20).optional(),
  unitPrice: z.number(),
  vatRate: z.number().min(0).max(100).default(0),
  revenueAccountId: z.number().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const invoicesRouter = router({
  // ─── LIST / FILTER ────────────────────────────────────────────────────────
  list: orgProcedure
    .input(z.object({
      status: z.enum(["draft", "sent", "partially_paid", "paid", "cancelled", "written_off", "overdue", "open"]).optional(),
      customerId: z.number().optional(),
      fiscalYear: z.number().optional(),
      search: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const today = new Date().toISOString().slice(0, 10);

      const conditions: any[] = [eq(invoices.organizationId, ctx.organizationId)];
      if (input?.customerId) conditions.push(eq(invoices.customerId, input.customerId));
      if (input?.fiscalYear) conditions.push(eq(invoices.fiscalYear, input.fiscalYear));
      if (input?.status === "open") {
        // alle offenen Rechnungen (sent + partially_paid) – unabhängig von Fälligkeit
        conditions.push(inArray(invoices.status, ["sent", "partially_paid"]));
      } else if (input?.status === "overdue") {
        // überfällig = sent/partially_paid UND dueDate < heute
        conditions.push(inArray(invoices.status, ["sent", "partially_paid"]));
        conditions.push(sql`${invoices.dueDate} < ${today}`);
      } else if (input?.status) {
        conditions.push(eq(invoices.status, input.status as any));
      }
      if (input?.search) {
        conditions.push(sql`(${invoices.invoiceNumber} LIKE ${"%" + input.search + "%"} OR ${invoices.subject} LIKE ${"%" + input.search + "%"})`);
      }

      const rows = await db.select({
        invoice: invoices,
        customerName: customers.name,
        customerCompany: customers.company,
      })
        .from(invoices)
        .leftJoin(customers, eq(invoices.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(desc(invoices.invoiceDate), desc(invoices.id))
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);

      return rows.map(r => {
        const inv = r.invoice;
        const isOverdue = (inv.status === "sent" || inv.status === "partially_paid") && inv.dueDate < today;
        return {
          ...inv,
          customerName: r.customerName ?? "—",
          customerCompany: r.customerCompany ?? null,
          isOverdue,
          daysOverdue: isOverdue ? Math.floor((Date.parse(today) - Date.parse(inv.dueDate)) / 86400000) : 0,
          openAmount: round2(parseFloat(inv.total as string) - parseFloat(inv.paidAmount as string)),
        };
      });
    }),

  // ─── GET BY ID (mit Positionen) ───────────────────────────────────────────
  getById: orgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [invoice] = await db.select().from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Rechnung nicht gefunden" });

      const items = await db.select().from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, input.id))
        .orderBy(asc(invoiceItems.position));

      const [customer] = await db.select().from(customers)
        .where(and(eq(customers.organizationId, ctx.organizationId), eq(customers.id, invoice.customerId)))
        .limit(1);

      return { ...invoice, items, customer };
    }),

  // ─── CREATE (Draft) ───────────────────────────────────────────────────────
  create: orgProcedure
    .input(z.object({
      customerId: z.number(),
      invoiceDate: z.string(),
      paymentTermDays: z.number().int().min(0).default(30),
      subject: z.string().optional(),
      introText: z.string().optional(),
      footerText: z.string().optional(),
      currency: z.enum(["CHF", "EUR"]).default("CHF"),
      items: z.array(invoiceItemInput).min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Customer-Ownership prüfen
      const [customer] = await db.select().from(customers)
        .where(and(eq(customers.organizationId, ctx.organizationId), eq(customers.id, input.customerId)))
        .limit(1);
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Kunde nicht gefunden" });

      const totals = calcTotals(input.items);
      const fiscalYear = new Date(input.invoiceDate).getFullYear();
      // Fälligkeitsdatum = invoiceDate + paymentTermDays
      const dueDate = new Date(input.invoiceDate);
      dueDate.setDate(dueDate.getDate() + input.paymentTermDays);
      const dueDateStr = dueDate.toISOString().slice(0, 10);

      const [result] = await db.insert(invoices).values({
        organizationId: ctx.organizationId,
        customerId: input.customerId,
        invoiceDate: input.invoiceDate,
        dueDate: dueDateStr,
        paymentTermDays: input.paymentTermDays,
        status: "draft",
        subject: input.subject ?? null,
        introText: input.introText ?? null,
        footerText: input.footerText ?? null,
        currency: input.currency,
        subtotal: totals.subtotal.toFixed(2),
        vatTotal: totals.vatTotal.toFixed(2),
        total: totals.total.toFixed(2),
        fiscalYear,
        notes: input.notes ?? null,
      });
      const invoiceId = (result as any).insertId as number;

      // Positionen einfügen
      for (const it of input.items) {
        const lineNet = round2(it.quantity * it.unitPrice);
        const lineVat = round2(lineNet * it.vatRate / 100);
        await db.insert(invoiceItems).values({
          invoiceId,
          position: it.position,
          serviceId: it.serviceId ?? null,
          description: it.description,
          quantity: String(it.quantity),
          unit: it.unit ?? "Stk",
          unitPrice: it.unitPrice.toFixed(2),
          vatRate: it.vatRate.toFixed(2),
          revenueAccountId: it.revenueAccountId ?? null,
          lineSubtotal: lineNet.toFixed(2),
          lineVat: lineVat.toFixed(2),
          lineTotal: (lineNet + lineVat).toFixed(2),
        });
      }

      return { id: invoiceId, status: "draft" as const };
    }),

  // ─── UPDATE (nur Drafts) ──────────────────────────────────────────────────
  update: orgProcedure
    .input(z.object({
      id: z.number(),
      invoiceDate: z.string().optional(),
      paymentTermDays: z.number().int().min(0).optional(),
      subject: z.string().optional(),
      introText: z.string().optional(),
      footerText: z.string().optional(),
      currency: z.enum(["CHF", "EUR"]).optional(),
      items: z.array(invoiceItemInput).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db.select().from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Rechnung nicht gefunden" });
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nur Entwürfe können bearbeitet werden. Für bezahlte/versandte Rechnungen bitte stornieren und neu erstellen.",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.invoiceDate !== undefined) {
        updateData.invoiceDate = input.invoiceDate;
        updateData.fiscalYear = new Date(input.invoiceDate).getFullYear();
      }
      if (input.paymentTermDays !== undefined) updateData.paymentTermDays = input.paymentTermDays;
      if (input.subject !== undefined) updateData.subject = input.subject;
      if (input.introText !== undefined) updateData.introText = input.introText;
      if (input.footerText !== undefined) updateData.footerText = input.footerText;
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.notes !== undefined) updateData.notes = input.notes;

      // Fälligkeit neu berechnen wenn Datum oder Term sich geändert haben
      const finalInvoiceDate = input.invoiceDate ?? existing.invoiceDate;
      const finalTerm = input.paymentTermDays ?? existing.paymentTermDays;
      if (input.invoiceDate !== undefined || input.paymentTermDays !== undefined) {
        const due = new Date(finalInvoiceDate as string);
        due.setDate(due.getDate() + finalTerm);
        updateData.dueDate = due.toISOString().slice(0, 10);
      }

      // Positionen neu schreiben wenn geändert
      if (input.items) {
        await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, input.id));
        for (const it of input.items) {
          const lineNet = round2(it.quantity * it.unitPrice);
          const lineVat = round2(lineNet * it.vatRate / 100);
          await db.insert(invoiceItems).values({
            invoiceId: input.id,
            position: it.position,
            serviceId: it.serviceId ?? null,
            description: it.description,
            quantity: String(it.quantity),
            unit: it.unit ?? "Stk",
            unitPrice: it.unitPrice.toFixed(2),
            vatRate: it.vatRate.toFixed(2),
            revenueAccountId: it.revenueAccountId ?? null,
            lineSubtotal: lineNet.toFixed(2),
            lineVat: lineVat.toFixed(2),
            lineTotal: (lineNet + lineVat).toFixed(2),
          });
        }
        const totals = calcTotals(input.items);
        updateData.subtotal = totals.subtotal.toFixed(2);
        updateData.vatTotal = totals.vatTotal.toFixed(2);
        updateData.total = totals.total.toFixed(2);
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(invoices).set(updateData)
          .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)));
      }
      return { success: true };
    }),

  // ─── DELETE (nur Drafts) ──────────────────────────────────────────────────
  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ status: invoices.status }).from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nur Entwürfe können gelöscht werden. Für verbuchte Rechnungen bitte stornieren.",
        });
      }
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, input.id));
      await db.delete(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)));
      return { success: true };
    }),

  // ─── ISSUE (Draft → Sent + Nummer + QR-Ref + Journal-Buchung) ─────────────
  issue: orgProcedure
    .input(z.object({
      id: z.number(),
      // Override wenn nötig – ansonsten wird der Default aus settings/account verwendet
      debitorAccountNumber: z.string().default("1100"),
      // Fallback für Positionen ohne eigenes Ertragskonto
      defaultRevenueAccountNumber: z.string().default("3000"),
      vatAccountNumber: z.string().default("2200"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invoice] = await db.select().from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Rechnung nicht gefunden" });
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Nur Entwürfe können verbucht werden." });
      }

      // Positionen laden
      const items = await db.select().from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, input.id))
        .orderBy(asc(invoiceItems.position));
      if (items.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Rechnung hat keine Positionen" });
      }

      // Konten-Lookup (org-scoped)
      const [debitorAcc] = await db.select().from(accounts)
        .where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.number, input.debitorAccountNumber)))
        .limit(1);
      if (!debitorAcc) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Debitorenkonto ${input.debitorAccountNumber} nicht gefunden` });
      }

      const [defaultRevenueAcc] = await db.select().from(accounts)
        .where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.number, input.defaultRevenueAccountNumber)))
        .limit(1);
      if (!defaultRevenueAcc) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Ertragskonto ${input.defaultRevenueAccountNumber} nicht gefunden` });
      }

      let vatAcc: { id: number } | undefined;
      const hasVat = items.some(it => parseFloat(it.vatRate as string) > 0);
      if (hasVat) {
        const [v] = await db.select().from(accounts)
          .where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.number, input.vatAccountNumber)))
          .limit(1);
        if (!v) throw new TRPCError({ code: "BAD_REQUEST", message: `MWST-Konto ${input.vatAccountNumber} nicht gefunden` });
        vatAcc = v;
      }

      // Belegnummer + QR-Referenz vergeben
      const fiscalYear = invoice.fiscalYear ?? new Date(invoice.invoiceDate).getFullYear();
      const invoiceNumber = await allocateInvoiceNumber(ctx.organizationId, fiscalYear);
      const qrReference = generateQRReference(invoice.id, fiscalYear);

      // Journal-Entry Zeilen zusammenbauen
      // Debit: 1100 Debitoren (Total)
      // Credit: Ertragskonto pro Position (Netto)
      // Credit: 2200 MWST (sum VAT) wenn hasVat
      const lines: Array<{ accountId: number; side: "debit" | "credit"; amount: string; description?: string; vatAmount?: string; vatRate?: string }> = [];
      lines.push({
        accountId: debitorAcc.id,
        side: "debit",
        amount: (parseFloat(invoice.total as string)).toFixed(2),
        description: `Debitor ${invoiceNumber}`,
      });
      for (const it of items) {
        const revAcc = it.revenueAccountId ?? defaultRevenueAcc.id;
        lines.push({
          accountId: revAcc,
          side: "credit",
          amount: (parseFloat(it.lineSubtotal as string)).toFixed(2),
          description: it.description.slice(0, 200),
          vatAmount: (parseFloat(it.lineVat as string)).toFixed(2),
          vatRate: (parseFloat(it.vatRate as string)).toFixed(2),
        });
      }
      if (hasVat && vatAcc) {
        const vatSum = items.reduce((s, it) => s + parseFloat(it.lineVat as string), 0);
        lines.push({
          accountId: vatAcc.id,
          side: "credit",
          amount: round2(vatSum).toFixed(2),
          description: `MWST ${invoiceNumber}`,
        });
      }

      // Journal-Entry erstellen und sofort approven (→ Belegnummer wird vergeben)
      const entryId = await createJournalEntry({
        organizationId: ctx.organizationId,
        bookingDate: invoice.invoiceDate,
        valueDate: invoice.invoiceDate,
        description: `Rechnung ${invoiceNumber} – ${invoice.subject ?? "Debitor"}`,
        source: "manual",
        sourceRef: `invoice-${invoice.id}`,
        fiscalYear,
        status: "pending",
        lines,
      });
      await approveJournalEntry(entryId, ctx.user.id);

      // Invoice updaten
      await db.update(invoices).set({
        status: "sent",
        invoiceNumber,
        qrReference,
        journalEntryId: entryId,
        sentAt: new Date(),
      }).where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)));

      return { success: true, invoiceNumber, qrReference, journalEntryId: entryId };
    }),

  // ─── RECORD PAYMENT (voll oder teilweise) ─────────────────────────────────
  recordPayment: orgProcedure
    .input(z.object({
      id: z.number(),
      amount: z.number().positive(),
      paidDate: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [inv] = await db.select().from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)))
        .limit(1);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      if (!(inv.status === "sent" || inv.status === "partially_paid")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Zahlungseingang nicht möglich bei Status "${inv.status}".`,
        });
      }

      const total = parseFloat(inv.total as string);
      const paidSoFar = parseFloat(inv.paidAmount as string);
      const newPaid = round2(paidSoFar + input.amount);
      const openAmount = round2(total - newPaid);

      // Epsilon für Fliesskomma-Toleranz (1 Rappen)
      let newStatus: "sent" | "partially_paid" | "paid" = inv.status as any;
      let paidDate: string | null = inv.paidDate;
      if (openAmount <= 0.01) {
        newStatus = "paid";
        paidDate = input.paidDate;
      } else if (newPaid > 0.01) {
        newStatus = "partially_paid";
      }

      await db.update(invoices).set({
        paidAmount: newPaid.toFixed(2),
        status: newStatus,
        paidDate,
      }).where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)));

      return { success: true, status: newStatus, openAmount };
    }),

  // ─── CANCEL (Gegenbuchung + Status cancelled) ─────────────────────────────
  cancel: orgProcedure
    .input(z.object({
      id: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [inv] = await db.select().from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)))
        .limit(1);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      if (inv.status === "cancelled" || inv.status === "written_off") {
        throw new TRPCError({ code: "FORBIDDEN", message: `Bereits ${inv.status}` });
      }
      if (inv.status === "draft") {
        // Draft → einfach löschen statt stornieren
        await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, input.id));
        await db.delete(invoices).where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)));
        return { success: true, cancelled: false, deleted: true };
      }

      // Gegenbuchung erstellen (Original-Journal gespiegelt)
      if (!inv.journalEntryId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Original-Buchung fehlt" });
      }
      const origLines = await db.select().from(journalEntries)
        .where(eq(journalEntries.id, inv.journalEntryId)).limit(1);
      if (origLines.length === 0) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Original-Buchung nicht gefunden" });
      }

      // Importiere journalLines für das Spiegeln
      const { journalLines } = await import("../drizzle/schema");
      const oldLines = await db.select().from(journalLines).where(eq(journalLines.entryId, inv.journalEntryId));

      const mirroredLines = oldLines.map(l => ({
        accountId: l.accountId,
        side: (l.side === "debit" ? "credit" : "debit") as "debit" | "credit",
        amount: l.amount as string,
        description: `Storno ${inv.invoiceNumber ?? ""}`.trim(),
      }));

      const cancelEntryId = await createJournalEntry({
        organizationId: ctx.organizationId,
        bookingDate: new Date().toISOString().slice(0, 10),
        description: `Storno Rechnung ${inv.invoiceNumber ?? inv.id}${input.reason ? ` – ${input.reason}` : ""}`,
        source: "manual",
        sourceRef: `invoice-cancel-${inv.id}`,
        fiscalYear: inv.fiscalYear ?? new Date().getFullYear(),
        status: "pending",
        lines: mirroredLines,
      });
      await approveJournalEntry(cancelEntryId, ctx.user.id);

      await db.update(invoices).set({
        status: "cancelled",
        cancelJournalEntryId: cancelEntryId,
        cancelledAt: new Date(),
      }).where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)));

      return { success: true, cancelled: true, cancelJournalEntryId: cancelEntryId };
    }),
});
