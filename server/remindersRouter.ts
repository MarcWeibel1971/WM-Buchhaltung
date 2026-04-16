/**
 * Reminders / Mahnwesen Router (Phase 2e, Commit C)
 *
 * 3-stufiges Mahnwesen über invoice_reminders:
 *   Level 1: Zahlungserinnerung (ab 15 Tage überfällig, keine Gebühr)
 *   Level 2: 1. Mahnung         (ab 30 Tage überfällig, CHF 20)
 *   Level 3: 2. Mahnung          (ab 60 Tage überfällig, CHF 40)
 *
 * Die Policy-Werte (Schwellwerte + Gebühren) sind hier als Konstante
 * hinterlegt und können später pro Organisation konfigurierbar gemacht
 * werden (→ reminderPolicy-Tabelle in einem Folge-Commit).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orgProcedure, router } from "./_core/trpc";
import { invoices, invoiceReminders, customers } from "../drizzle/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { getDb } from "./db";

// ─── Mahn-Policy (Default) ────────────────────────────────────────────────
export const REMINDER_POLICY = {
  level1: { minDaysOverdue: 15, feeAmount: 0,  gracePeriodDays: 10, label: "Zahlungserinnerung" },
  level2: { minDaysOverdue: 30, feeAmount: 20, gracePeriodDays: 10, label: "1. Mahnung" },
  level3: { minDaysOverdue: 60, feeAmount: 40, gracePeriodDays: 7,  label: "2. Mahnung" },
} as const;

type Level = 1 | 2 | 3;

function policyFor(level: Level) {
  switch (level) {
    case 1: return REMINDER_POLICY.level1;
    case 2: return REMINDER_POLICY.level2;
    case 3: return REMINDER_POLICY.level3;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);
}

/**
 * Ermittelt das vorgeschlagene Mahn-Level für eine überfällige Rechnung.
 * Berücksichtigt bereits gesandte Reminder: der nächste Level ist mindestens
 * um 1 höher als der zuletzt gesandte.
 */
function suggestLevel(daysOverdue: number, maxExistingLevel: number): Level | null {
  let suggested: Level | null = null;
  if (daysOverdue >= REMINDER_POLICY.level3.minDaysOverdue) suggested = 3;
  else if (daysOverdue >= REMINDER_POLICY.level2.minDaysOverdue) suggested = 2;
  else if (daysOverdue >= REMINDER_POLICY.level1.minDaysOverdue) suggested = 1;
  if (suggested == null) return null;
  // Nur empfehlen, was noch nicht gesandt wurde.
  if (maxExistingLevel >= suggested) {
    const next = (maxExistingLevel + 1) as Level;
    return next <= 3 ? next : null;
  }
  return suggested;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const remindersRouter = router({
  /**
   * Liefert die Default-Policy für das Frontend (Einstellungs-Anzeige und
   * Vorschau der Schwellwerte).
   */
  getPolicy: orgProcedure.query(() => REMINDER_POLICY),

  /**
   * Offene Posten (OP-Liste): alle sent/partially_paid-Rechnungen mit
   * Alter, Tagen überfällig, bereits gesandten Mahnungen und
   * Mahn-Vorschlag. Sortiert nach Fälligkeit aufsteigend (älteste zuerst).
   */
  openPositions: orgProcedure
    .input(z.object({
      onlyOverdue: z.boolean().default(false),
      customerId: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const t = today();

      const conditions: any[] = [
        eq(invoices.organizationId, ctx.organizationId),
        inArray(invoices.status, ["sent", "partially_paid"]),
      ];
      if (input?.customerId) conditions.push(eq(invoices.customerId, input.customerId));
      if (input?.onlyOverdue) conditions.push(sql`${invoices.dueDate} < ${t}`);

      const rows = await db.select({
        invoice: invoices,
        customerName: customers.name,
        customerCompany: customers.company,
        customerEmail: customers.email,
      })
        .from(invoices)
        .leftJoin(customers, eq(invoices.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(asc(invoices.dueDate));

      if (rows.length === 0) return [];

      // Reminders pro Invoice nachladen
      const invoiceIds = rows.map(r => r.invoice.id);
      const reminders = await db.select().from(invoiceReminders)
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          inArray(invoiceReminders.invoiceId, invoiceIds),
        ));
      const byInvoice = new Map<number, Array<typeof reminders[number]>>();
      for (const r of reminders) {
        const list = byInvoice.get(r.invoiceId) ?? [];
        list.push(r);
        byInvoice.set(r.invoiceId, list);
      }

      return rows.map(r => {
        const inv = r.invoice;
        const total = parseFloat(inv.total as string);
        const paid = parseFloat(inv.paidAmount as string);
        const open = Math.round((total - paid) * 100) / 100;
        const isOverdue = inv.dueDate < t;
        const daysOverdue = isOverdue ? daysBetween(inv.dueDate, t) : 0;

        const myReminders = byInvoice.get(inv.id) ?? [];
        const maxLevel = myReminders.reduce((m, r) => Math.max(m, r.level), 0);
        const suggested = isOverdue ? suggestLevel(daysOverdue, maxLevel) : null;

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          customerId: inv.customerId,
          customerName: r.customerName ?? "—",
          customerCompany: r.customerCompany ?? null,
          customerEmail: r.customerEmail ?? null,
          subject: inv.subject,
          total,
          paid,
          openAmount: open,
          currency: inv.currency,
          daysOverdue,
          isOverdue,
          remindersSent: myReminders
            .sort((a, b) => a.level - b.level)
            .map(m => ({
              id: m.id, level: m.level, reminderDate: m.reminderDate,
              sentAt: m.sentAt, feeAmount: parseFloat(m.feeAmount as string),
            })),
          suggestedLevel: suggested,
          suggestedFee: suggested ? policyFor(suggested).feeAmount : 0,
        };
      });
    }),

  /**
   * Liste der gesandten/angelegten Mahnungen (für Übersicht "Mahnhistorie").
   */
  listReminders: orgProcedure
    .input(z.object({
      invoiceId: z.number().optional(),
      onlyUnsent: z.boolean().default(false),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [eq(invoiceReminders.organizationId, ctx.organizationId)];
      if (input?.invoiceId) conditions.push(eq(invoiceReminders.invoiceId, input.invoiceId));
      if (input?.onlyUnsent) conditions.push(sql`${invoiceReminders.sentAt} IS NULL`);
      const rows = await db.select({
        reminder: invoiceReminders,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        total: invoices.total,
      })
        .from(invoiceReminders)
        .leftJoin(invoices, eq(invoiceReminders.invoiceId, invoices.id))
        .where(and(...conditions))
        .orderBy(desc(invoiceReminders.reminderDate), desc(invoiceReminders.level));
      return rows.map(r => ({
        ...r.reminder,
        invoiceNumber: r.invoiceNumber,
        customerId: r.customerId,
        invoiceTotal: r.total ? parseFloat(r.total as string) : 0,
      }));
    }),

  /**
   * Legt eine neue Mahnung an. Validiert:
   *   - Invoice gehört zur Org
   *   - Invoice-Status ist sent oder partially_paid
   *   - Level noch nicht existiert (Unique-Constraint würde sonst feuern)
   *   - Level ist 1, 2 oder 3
   */
  create: orgProcedure
    .input(z.object({
      invoiceId: z.number(),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      reminderDate: z.string().optional(), // default: heute
      gracePeriodDays: z.number().int().min(0).max(90).optional(),
      feeAmount: z.number().min(0).optional(),
      subject: z.string().optional(),
      introText: z.string().optional(),
      footerText: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [inv] = await db.select().from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.invoiceId)))
        .limit(1);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Rechnung nicht gefunden" });
      if (inv.status !== "sent" && inv.status !== "partially_paid") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Mahnung nicht möglich bei Status "${inv.status}".`,
        });
      }

      // Bestehende Reminder dieses Levels?
      const existing = await db.select({ id: invoiceReminders.id }).from(invoiceReminders)
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          eq(invoiceReminders.invoiceId, input.invoiceId),
          eq(invoiceReminders.level, input.level),
        ))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Für diese Rechnung gibt es bereits eine Mahnung auf Stufe ${input.level}.`,
        });
      }

      const policy = policyFor(input.level as Level);
      const reminderDate = input.reminderDate ?? today();
      const grace = input.gracePeriodDays ?? policy.gracePeriodDays;
      const newDueDate = addDaysISO(reminderDate, grace);
      const feeAmount = input.feeAmount ?? policy.feeAmount;

      const [result] = await db.insert(invoiceReminders).values({
        organizationId: ctx.organizationId,
        invoiceId: input.invoiceId,
        level: input.level,
        reminderDate,
        newDueDate,
        feeAmount: feeAmount.toFixed(2),
        subject: input.subject ?? null,
        introText: input.introText ?? null,
        footerText: input.footerText ?? null,
        createdBy: ctx.user.id,
      });

      return {
        id: (result as any).insertId as number,
        level: input.level,
        reminderDate,
        newDueDate,
        feeAmount,
        label: policy.label,
      };
    }),

  /**
   * Markiert eine Mahnung als versandt (sentAt = jetzt).
   * Das eigentliche Verschicken (Email, Post) passiert ausserhalb der App –
   * diese Mutation dokumentiert nur, dass es passiert ist.
   */
  markSent: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(invoiceReminders)
        .set({ sentAt: new Date() })
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          eq(invoiceReminders.id, input.id),
        ));
      return { success: true };
    }),

  /**
   * Löscht eine noch nicht versandte Mahnung. Versandte Mahnungen sind
   * immutabel – Teil der Mahnhistorie.
   */
  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.select().from(invoiceReminders)
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          eq(invoiceReminders.id, input.id),
        ))
        .limit(1);
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      if (r.sentAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Versandte Mahnungen können nicht gelöscht werden (Mahnhistorie).",
        });
      }
      await db.delete(invoiceReminders)
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          eq(invoiceReminders.id, input.id),
        ));
      return { success: true };
    }),
});
