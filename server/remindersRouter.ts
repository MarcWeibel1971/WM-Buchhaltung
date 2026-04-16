/**
 * Reminders / Mahnwesen Router (Phase 2e + Phase 3b)
 *
 * 3-stufiges Mahnwesen über invoice_reminders:
 *   Level 1: Zahlungserinnerung (Default ab 15 Tage überfällig, keine Gebühr)
 *   Level 2: 1. Mahnung          (Default ab 30 Tage überfällig, CHF 20)
 *   Level 3: 2. Mahnung          (Default ab 60 Tage überfällig, CHF 40)
 *
 * Phase 3b: Die Policy (Schwellwerte, Gebühren, Nachfrist) ist pro Organisation
 * konfigurierbar und wird aus `organizations.reminderLevel{1,2,3}{Days,Fee,Grace}`
 * geladen. Als Fallback-Default dient `REMINDER_POLICY` weiter (wenn eine Org-Row
 * nicht geladen werden kann, z.B. in Tests).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orgProcedure, router } from "./_core/trpc";
import {
  invoices, invoiceReminders, customers, companySettings, documents,
  organizations, userOrganizations,
} from "../drizzle/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { storagePut } from "./storage";
import { sendEmail } from "./emailService";
import { getDb } from "./db";

function formatCHF(n: number): string {
  const [int, dec] = n.toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${dec}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Rendert ein Mahn-PDF: Briefkopf, Empfänger, Mahn-Text, Rechnungsdetails,
 *  Mahngebühr, neuer Total inkl. Frist. Kein QR-Slip (Referenz bleibt die
 *  Original-Rechnungs-QR, das Original-PDF liegt dem Mahnbrief idealerweise
 *  beim Versand als zweiter Anhang bei – wird vom Sender-Flow abgedeckt). */
async function renderReminderPdf(params: {
  org: typeof companySettings.$inferSelect;
  invoice: typeof invoices.$inferSelect;
  customer: typeof customers.$inferSelect;
  reminder: typeof invoiceReminders.$inferSelect;
}): Promise<Buffer> {
  const { org, invoice, customer, reminder } = params;

  const levelLabels: Record<number, string> = {
    1: "Zahlungserinnerung",
    2: "1. Mahnung",
    3: "2. Mahnung",
  };
  const levelLabel = levelLabels[reminder.level] ?? `Mahnung Stufe ${reminder.level}`;

  const pdfDoc = new PDFDocument({
    size: "A4", autoFirstPage: true,
    margins: { top: 40, bottom: 40, left: 55, right: 55 },
  });
  const chunks: Buffer[] = [];
  pdfDoc.on("data", (c: Buffer) => chunks.push(c));

  const pageW = 595.28;
  const leftM = 55;
  const contentW = pageW - leftM - 55;

  const invoiceTotal = parseFloat(invoice.total as string);
  const invoicePaid = parseFloat(invoice.paidAmount as string);
  const invoiceOpen = Math.round((invoiceTotal - invoicePaid) * 100) / 100;
  const fee = parseFloat(reminder.feeAmount as string);
  const grandTotal = Math.round((invoiceOpen + fee) * 100) / 100;

  // Briefkopf
  pdfDoc.fontSize(11).font("Helvetica-Bold");
  pdfDoc.text(org.companyName, leftM, 45);
  pdfDoc.fontSize(8.5).font("Helvetica").fillColor("#444444");
  if (org.street) pdfDoc.text(org.street);
  if (org.zipCode || org.city) pdfDoc.text(`${org.zipCode ?? ""} ${org.city ?? ""}`.trim());
  if (org.phone) pdfDoc.text(`Tel: ${org.phone}`);
  if (org.email) pdfDoc.text(org.email);
  if (org.vatNumber) pdfDoc.text(`MWST-Nr. ${org.vatNumber}`);

  // Empfänger
  pdfDoc.fillColor("#000000");
  const addrX = 350;
  let addrY = 120;
  const custDisplay = customer.company || customer.name;
  const custLine2 = customer.company && customer.name ? customer.name : null;
  pdfDoc.fontSize(10).font("Helvetica-Bold").text(custDisplay, addrX, addrY); addrY += 14;
  if (custLine2) { pdfDoc.fontSize(9).font("Helvetica").text(custLine2, addrX, addrY); addrY += 14; }
  pdfDoc.fontSize(9).font("Helvetica");
  if (customer.street) { pdfDoc.text(customer.street, addrX, addrY); addrY += 14; }
  if (customer.zipCode || customer.city) {
    pdfDoc.text(`${customer.zipCode ?? ""} ${customer.city ?? ""}`.trim(), addrX, addrY); addrY += 14;
  }

  // Datum + Mahn-Titel
  let yPos = 210;
  pdfDoc.fontSize(9).font("Helvetica").fillColor("#666666");
  pdfDoc.text(`${org.city ?? ""}, ${formatDate(reminder.reminderDate)}`.replace(/^, /, ""),
    leftM, yPos, { width: contentW, align: "right" });
  yPos += 26;

  pdfDoc.fillColor("#000000").fontSize(16).font("Helvetica-Bold");
  pdfDoc.text(reminder.subject ?? `${levelLabel} – Rechnung ${invoice.invoiceNumber ?? ""}`,
    leftM, yPos, { width: contentW });
  yPos = pdfDoc.y + 18;

  // Anrede
  pdfDoc.fontSize(10).font("Helvetica");
  if (customer.salutation) {
    pdfDoc.text(customer.salutation, leftM, yPos, { width: contentW });
    yPos = pdfDoc.y + 10;
  }

  // Einleitungstext
  if (reminder.introText) {
    pdfDoc.text(reminder.introText, leftM, yPos, { width: contentW });
    yPos = pdfDoc.y + 18;
  }

  // Rechnungs-Detail-Box
  pdfDoc.moveTo(leftM, yPos).lineTo(leftM + contentW, yPos)
    .lineWidth(0.5).strokeColor("#cccccc").stroke();
  yPos += 10;
  pdfDoc.fontSize(9.5).font("Helvetica").fillColor("#000000");

  const labelW = 200;
  const drawRow = (label: string, value: string, bold = false) => {
    pdfDoc.font(bold ? "Helvetica-Bold" : "Helvetica");
    pdfDoc.text(label, leftM, yPos, { width: labelW });
    pdfDoc.text(value, leftM + labelW, yPos, { width: contentW - labelW, align: "right" });
    yPos += 16;
  };

  drawRow("Rechnungsnummer", invoice.invoiceNumber ?? `#${invoice.id}`);
  drawRow("Rechnungsdatum", formatDate(invoice.invoiceDate));
  drawRow("Ursprüngliche Fälligkeit", formatDate(invoice.dueDate));
  if (invoice.subject) drawRow("Betreff", invoice.subject);
  yPos += 4;

  drawRow("Rechnungsbetrag", `${invoice.currency} ${formatCHF(invoiceTotal)}`);
  if (invoicePaid > 0.01) {
    drawRow("Bereits bezahlt", `${invoice.currency} ${formatCHF(invoicePaid)}`);
  }
  drawRow("Offener Betrag", `${invoice.currency} ${formatCHF(invoiceOpen)}`, true);

  if (fee > 0) {
    yPos += 4;
    drawRow(`Mahngebühr (${levelLabel})`, `${invoice.currency} ${formatCHF(fee)}`);
  }

  yPos += 4;
  pdfDoc.moveTo(leftM, yPos).lineTo(leftM + contentW, yPos)
    .lineWidth(1).strokeColor("#000000").stroke();
  yPos += 8;
  pdfDoc.fontSize(12).font("Helvetica-Bold");
  drawRow("Gesamtforderung", `${invoice.currency} ${formatCHF(grandTotal)}`, true);
  yPos += 4;

  // Neue Frist
  pdfDoc.fontSize(10).font("Helvetica").fillColor("#b00020");
  pdfDoc.text(
    `Wir bitten Sie, den Gesamtbetrag bis spätestens ${formatDate(reminder.newDueDate)} zu begleichen.`,
    leftM, yPos, { width: contentW },
  );
  yPos = pdfDoc.y + 18;

  // Fusszeile
  if (reminder.footerText) {
    pdfDoc.fillColor("#000000").fontSize(10).font("Helvetica");
    pdfDoc.text(reminder.footerText, leftM, yPos, { width: contentW });
  } else {
    pdfDoc.fillColor("#444444").fontSize(9).font("Helvetica");
    pdfDoc.text(
      "Bitte beachten Sie: Sollte Ihre Zahlung bereits erfolgt sein, betrachten Sie dieses Schreiben als gegenstandslos.",
      leftM, yPos, { width: contentW },
    );
  }

  const pdfPromise = new Promise<Buffer>((resolve) => {
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  pdfDoc.end();
  return pdfPromise;
}

// ─── Mahn-Policy (Default-Fallback) ────────────────────────────────────────
/**
 * Fallback-Defaults, falls noch keine Organisation geladen wurde.
 * Die tatsächlich wirksame Policy kommt seit Phase 3b aus der Datenbank
 * (Tabelle `organizations`, Felder `reminderLevelNDays/Fee/Grace`).
 */
export const REMINDER_POLICY = {
  level1: { minDaysOverdue: 15, feeAmount: 0,  gracePeriodDays: 10, label: "Zahlungserinnerung" },
  level2: { minDaysOverdue: 30, feeAmount: 20, gracePeriodDays: 10, label: "1. Mahnung" },
  level3: { minDaysOverdue: 60, feeAmount: 40, gracePeriodDays: 7,  label: "2. Mahnung" },
} as const;

const LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: "Zahlungserinnerung",
  2: "1. Mahnung",
  3: "2. Mahnung",
};

type Level = 1 | 2 | 3;

export type ReminderPolicy = {
  level1: { minDaysOverdue: number; feeAmount: number; gracePeriodDays: number; label: string };
  level2: { minDaysOverdue: number; feeAmount: number; gracePeriodDays: number; label: string };
  level3: { minDaysOverdue: number; feeAmount: number; gracePeriodDays: number; label: string };
};

/**
 * Lädt die Mahn-Policy der Organisation aus der DB. Fällt auf die Defaults
 * aus `REMINDER_POLICY` zurück, wenn die Org-Row nicht gefunden wird.
 */
async function loadPolicy(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, organizationId: number): Promise<ReminderPolicy> {
  const [org] = await db.select({
    l1d: organizations.reminderLevel1Days,
    l1f: organizations.reminderLevel1Fee,
    l1g: organizations.reminderLevel1Grace,
    l2d: organizations.reminderLevel2Days,
    l2f: organizations.reminderLevel2Fee,
    l2g: organizations.reminderLevel2Grace,
    l3d: organizations.reminderLevel3Days,
    l3f: organizations.reminderLevel3Fee,
    l3g: organizations.reminderLevel3Grace,
  }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return REMINDER_POLICY as unknown as ReminderPolicy;
  const toNum = (v: unknown) => typeof v === "string" ? parseFloat(v) : (v as number);
  return {
    level1: { minDaysOverdue: org.l1d, feeAmount: toNum(org.l1f), gracePeriodDays: org.l1g, label: LEVEL_LABELS[1] },
    level2: { minDaysOverdue: org.l2d, feeAmount: toNum(org.l2f), gracePeriodDays: org.l2g, label: LEVEL_LABELS[2] },
    level3: { minDaysOverdue: org.l3d, feeAmount: toNum(org.l3f), gracePeriodDays: org.l3g, label: LEVEL_LABELS[3] },
  };
}

function policyLevel(policy: ReminderPolicy, level: Level) {
  switch (level) {
    case 1: return policy.level1;
    case 2: return policy.level2;
    case 3: return policy.level3;
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
function suggestLevel(policy: ReminderPolicy, daysOverdue: number, maxExistingLevel: number): Level | null {
  let suggested: Level | null = null;
  if (daysOverdue >= policy.level3.minDaysOverdue) suggested = 3;
  else if (daysOverdue >= policy.level2.minDaysOverdue) suggested = 2;
  else if (daysOverdue >= policy.level1.minDaysOverdue) suggested = 1;
  if (suggested == null) return null;
  // Nur empfehlen, was noch nicht gesandt wurde.
  if (maxExistingLevel >= suggested) {
    const next = (maxExistingLevel + 1) as Level;
    return next <= 3 ? next : null;
  }
  return suggested;
}

/** Prüft, ob der aktuelle User owner/admin der aktiven Org ist. */
async function requireOwnerOrAdmin(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  organizationId: number,
): Promise<void> {
  const [mem] = await db.select({ role: userOrganizations.role }).from(userOrganizations)
    .where(and(
      eq(userOrganizations.userId, userId),
      eq(userOrganizations.organizationId, organizationId),
    ))
    .limit(1);
  if (!mem || (mem.role !== "owner" && mem.role !== "admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Nur Owner/Admin darf die Mahn-Policy ändern." });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const remindersRouter = router({
  /**
   * Liefert die aktive Mahn-Policy der Organisation (aus DB, mit Fallback
   * auf die eingebauten Defaults). Das Frontend nutzt das u.a. um
   * Schwellwerte/Gebühren im OP-Listen-Dialog vorzuschlagen.
   */
  getPolicy: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return loadPolicy(db, ctx.organizationId);
  }),

  /**
   * Aktualisiert die Mahn-Policy der Organisation. Nur Owner/Admin.
   * Alle Felder optional – nur gesetzte werden übernommen.
   */
  updatePolicy: orgProcedure
    .input(z.object({
      level1Days:  z.number().int().min(0).max(365).optional(),
      level1Fee:   z.number().min(0).max(10000).optional(),
      level1Grace: z.number().int().min(0).max(90).optional(),
      level2Days:  z.number().int().min(0).max(365).optional(),
      level2Fee:   z.number().min(0).max(10000).optional(),
      level2Grace: z.number().int().min(0).max(90).optional(),
      level3Days:  z.number().int().min(0).max(365).optional(),
      level3Fee:   z.number().min(0).max(10000).optional(),
      level3Grace: z.number().int().min(0).max(90).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireOwnerOrAdmin(db, ctx.user.id, ctx.organizationId);

      const update: Record<string, unknown> = {};
      if (input.level1Days  !== undefined) update.reminderLevel1Days  = input.level1Days;
      if (input.level1Fee   !== undefined) update.reminderLevel1Fee   = input.level1Fee.toFixed(2);
      if (input.level1Grace !== undefined) update.reminderLevel1Grace = input.level1Grace;
      if (input.level2Days  !== undefined) update.reminderLevel2Days  = input.level2Days;
      if (input.level2Fee   !== undefined) update.reminderLevel2Fee   = input.level2Fee.toFixed(2);
      if (input.level2Grace !== undefined) update.reminderLevel2Grace = input.level2Grace;
      if (input.level3Days  !== undefined) update.reminderLevel3Days  = input.level3Days;
      if (input.level3Fee   !== undefined) update.reminderLevel3Fee   = input.level3Fee.toFixed(2);
      if (input.level3Grace !== undefined) update.reminderLevel3Grace = input.level3Grace;

      // Plausibilität: Schwellwerte müssen aufsteigend sein (gemerged mit DB).
      const current = await loadPolicy(db, ctx.organizationId);
      const eff = {
        l1d: (update.reminderLevel1Days as number | undefined) ?? current.level1.minDaysOverdue,
        l2d: (update.reminderLevel2Days as number | undefined) ?? current.level2.minDaysOverdue,
        l3d: (update.reminderLevel3Days as number | undefined) ?? current.level3.minDaysOverdue,
      };
      if (!(eff.l1d <= eff.l2d && eff.l2d <= eff.l3d)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Die Schwellwerte müssen aufsteigend sein: Stufe 1 ≤ Stufe 2 ≤ Stufe 3.",
        });
      }

      if (Object.keys(update).length > 0) {
        await db.update(organizations).set(update).where(eq(organizations.id, ctx.organizationId));
      }
      return loadPolicy(db, ctx.organizationId);
    }),

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

      const policy = await loadPolicy(db, ctx.organizationId);

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
        const suggested = isOverdue ? suggestLevel(policy, daysOverdue, maxLevel) : null;

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
          suggestedFee: suggested ? policyLevel(policy, suggested).feeAmount : 0,
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

      const orgPolicy = await loadPolicy(db, ctx.organizationId);
      const levelPolicy = policyLevel(orgPolicy, input.level as Level);
      const reminderDate = input.reminderDate ?? today();
      const grace = input.gracePeriodDays ?? levelPolicy.gracePeriodDays;
      const newDueDate = addDaysISO(reminderDate, grace);
      const feeAmount = input.feeAmount ?? levelPolicy.feeAmount;

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
        label: levelPolicy.label,
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

  /**
   * Rendert das Mahn-PDF, lädt es nach S3 und gibt die URL zurück.
   * Cached über pdfS3Key/Url im invoice_reminders-Record. Legt ausserdem
   * einen documents-Eintrag an (GeBüV-konforme Archivierung der Korrespondenz).
   */
  generatePdf: orgProcedure
    .input(z.object({
      id: z.number(),
      regenerate: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [reminder] = await db.select().from(invoiceReminders)
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          eq(invoiceReminders.id, input.id),
        ))
        .limit(1);
      if (!reminder) throw new TRPCError({ code: "NOT_FOUND", message: "Mahnung nicht gefunden" });

      if (!input.regenerate && reminder.pdfS3Key && reminder.pdfS3Url) {
        return {
          url: reminder.pdfS3Url,
          s3Key: reminder.pdfS3Key,
          cached: true,
          filename: `Mahnung_${reminder.level}_${reminder.id}.pdf`,
        };
      }

      const [invoice] = await db.select().from(invoices)
        .where(and(
          eq(invoices.organizationId, ctx.organizationId),
          eq(invoices.id, reminder.invoiceId),
        ))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: "BAD_REQUEST", message: "Rechnung nicht gefunden" });

      const [customer] = await db.select().from(customers)
        .where(and(
          eq(customers.organizationId, ctx.organizationId),
          eq(customers.id, invoice.customerId),
        ))
        .limit(1);
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Kunde nicht gefunden" });

      const [org] = await db.select().from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId)).limit(1);
      if (!org) throw new TRPCError({ code: "BAD_REQUEST", message: "Firmeneinstellungen fehlen" });

      const pdfBuffer = await renderReminderPdf({ org, invoice, customer, reminder });

      const timestamp = Date.now();
      const cleanInvoiceNum = (invoice.invoiceNumber ?? `${invoice.id}`).replace(/[^a-zA-Z0-9_-]/g, "-");
      const levelTag = reminder.level === 1 ? "Erinnerung" : `Mahnung${reminder.level - 1}`;
      const filename = `${levelTag}_${cleanInvoiceNum}.pdf`;
      const s3Key = `reminders/${ctx.organizationId}/${cleanInvoiceNum}-${levelTag}-${timestamp}.pdf`;
      const { url } = await storagePut(s3Key, pdfBuffer, "application/pdf");

      await db.update(invoiceReminders).set({ pdfS3Key: s3Key, pdfS3Url: url })
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          eq(invoiceReminders.id, reminder.id),
        ));

      try {
        await db.insert(documents).values({
          organizationId: ctx.organizationId,
          filename,
          s3Key,
          s3Url: url,
          mimeType: "application/pdf",
          fileSize: pdfBuffer.byteLength,
          documentType: "invoice_out",
          fiscalYear: invoice.fiscalYear ?? null,
          uploadedBy: ctx.user.id,
          matchStatus: "matched",
          notes: `Auto-generiert: ${levelTag} für Rechnung ${invoice.invoiceNumber ?? `#${invoice.id}`}`,
        });
      } catch (e) {
        console.warn("[reminders.generatePdf] document insert failed:", e);
      }

      return { url, s3Key, cached: false, filename };
    }),

  /**
   * Sendet die Mahnung per E-Mail mit Mahn-PDF + Original-Rechnungs-PDF als
   * zwei Anhängen. Nach erfolgreichem Versand wird sentAt gesetzt.
   */
  sendEmail: orgProcedure
    .input(z.object({
      id: z.number(),
      to: z.string().email().optional(),
      cc: z.array(z.string().email()).optional(),
      subject: z.string().optional(),
      bodyText: z.string().optional(),
      includeInvoicePdf: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [reminder] = await db.select().from(invoiceReminders)
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          eq(invoiceReminders.id, input.id),
        ))
        .limit(1);
      if (!reminder) throw new TRPCError({ code: "NOT_FOUND" });

      const [invoice] = await db.select().from(invoices)
        .where(and(
          eq(invoices.organizationId, ctx.organizationId),
          eq(invoices.id, reminder.invoiceId),
        ))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: "BAD_REQUEST", message: "Rechnung nicht gefunden" });

      const [customer] = await db.select().from(customers)
        .where(and(
          eq(customers.organizationId, ctx.organizationId),
          eq(customers.id, invoice.customerId),
        ))
        .limit(1);
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Kunde nicht gefunden" });

      const recipient = input.to ?? customer.email;
      if (!recipient) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Keine E-Mail-Adresse: Bitte Empfänger angeben oder Kunden-E-Mail hinterlegen.",
        });
      }

      const [org] = await db.select().from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId)).limit(1);
      if (!org) throw new TRPCError({ code: "BAD_REQUEST", message: "Firmeneinstellungen fehlen" });

      // Mahn-PDF rendern
      const reminderPdf = await renderReminderPdf({ org, invoice, customer, reminder });
      const cleanInvoiceNum = (invoice.invoiceNumber ?? `${invoice.id}`).replace(/[^a-zA-Z0-9_-]/g, "-");
      const levelTag = reminder.level === 1 ? "Erinnerung" : `Mahnung${reminder.level - 1}`;
      const attachments = [{
        filename: `${levelTag}_${cleanInvoiceNum}.pdf`,
        content: reminderPdf.toString("base64"),
        contentType: "application/pdf",
      }];

      // Optional: Original-Rechnungs-PDF mitsenden (damit der Kunde es sicher hat)
      if (input.includeInvoicePdf && invoice.pdfS3Url) {
        try {
          const resp = await fetch(invoice.pdfS3Url);
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            attachments.push({
              filename: `Rechnung_${cleanInvoiceNum}.pdf`,
              content: buf.toString("base64"),
              contentType: "application/pdf",
            });
          }
        } catch (e) {
          console.warn("[reminders.sendEmail] invoice PDF fetch failed:", e);
        }
      }

      const levelLabels: Record<number, string> = {
        1: "Zahlungserinnerung",
        2: "1. Mahnung",
        3: "2. Mahnung",
      };
      const subject = input.subject
        ?? `${levelLabels[reminder.level] ?? "Mahnung"} – Rechnung ${invoice.invoiceNumber ?? ""}`;
      const greeting = customer.salutation ?? "Sehr geehrte Damen und Herren";
      const bodyText = input.bodyText
        ?? `${greeting}

anbei erhalten Sie die ${levelLabels[reminder.level] ?? "Mahnung"} zur Rechnung ${invoice.invoiceNumber ?? ""}.
Die Gesamtforderung (inkl. Mahngebühr) ist bis ${new Date(reminder.newDueDate).toLocaleDateString("de-CH")} zu begleichen.

Sollte Ihre Zahlung zwischenzeitlich erfolgt sein, betrachten Sie dieses Schreiben bitte als gegenstandslos.

Freundliche Grüsse
${org.companyName}`;

      const html = `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.5;">${bodyText
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")}</div>`;

      const messageId = await sendEmail({
        to: recipient,
        cc: input.cc,
        subject,
        html,
        text: bodyText,
        replyTo: org.email ?? undefined,
        attachments,
      });

      await db.update(invoiceReminders).set({ sentAt: new Date() })
        .where(and(
          eq(invoiceReminders.organizationId, ctx.organizationId),
          eq(invoiceReminders.id, reminder.id),
        ));

      return { success: true, messageId, to: recipient };
    }),
});
