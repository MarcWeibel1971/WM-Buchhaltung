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
  qrSettings,
  organizations,
  documents,
} from "../drizzle/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";
import type { Data } from "swissqrbill/types";
import { storagePut } from "./storage";
import { sendEmail } from "./emailService";
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

// ─── PDF-Renderer ───────────────────────────────────────────────────────────

/** CHF-Format mit Apostroph als Tausendertrenner: 1234.56 → "1'234.56" */
function formatCHF(n: number): string {
  const [int, dec] = n.toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${dec}`;
}

/** QR-Referenz in 5er-Gruppen formatieren. */
function formatQRRef(ref: string): string {
  const parts: string[] = [];
  let i = ref.length;
  while (i > 0) { const start = Math.max(0, i - 5); parts.unshift(ref.slice(start, i)); i = start; }
  return parts.join(" ");
}

/**
 * Rendert eine vollständige PDF-Rechnung mit Briefkopf, Positions-Tabelle,
 * Totalen und QR-Einzahlungsschein. Erwartet alle Daten als strukturierte
 * Objekte (keine DB-Calls). Gibt das PDF als Buffer zurück.
 */
async function renderInvoicePdf(params: {
  org: typeof companySettings.$inferSelect;
  orgLegal?: typeof organizations.$inferSelect | null;
  invoice: typeof invoices.$inferSelect;
  items: Array<typeof invoiceItems.$inferSelect>;
  customer: typeof customers.$inferSelect;
  qr: typeof qrSettings.$inferSelect | null;
}): Promise<Buffer> {
  const { org, orgLegal, invoice, items, customer, qr } = params;

  const pdfDoc = new PDFDocument({
    size: "A4",
    autoFirstPage: true,
    margins: { top: 40, bottom: 40, left: 55, right: 55 },
  });
  const chunks: Buffer[] = [];
  pdfDoc.on("data", (c: Buffer) => chunks.push(c));

  const pageW = 595.28;
  const leftM = 55;
  const rightM = 55;
  const contentW = pageW - leftM - rightM;

  const invoiceDate = new Date(invoice.invoiceDate);
  const dueDate = new Date(invoice.dueDate);
  const dateStr = invoiceDate.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });
  const dueStr  = dueDate.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

  const currency = invoice.currency;
  const subtotal = parseFloat(invoice.subtotal as string);
  const vatTotal = parseFloat(invoice.vatTotal as string);
  const total = parseFloat(invoice.total as string);

  // ── Logo (falls vorhanden) ──
  let briefkopfY = 45;
  if (org.logoUrl) {
    try {
      const logoResp = await fetch(org.logoUrl);
      if (logoResp.ok) {
        const logoBuffer = Buffer.from(await logoResp.arrayBuffer());
        const ct = logoResp.headers.get("content-type") ?? "";
        if (ct.includes("png") || ct.includes("jpg") || ct.includes("jpeg")) {
          pdfDoc.image(logoBuffer, leftM, 38, { fit: [130, 42] });
          briefkopfY = 88;
        }
      }
    } catch { /* Logo-Fetch fehlgeschlagen – ignorieren */ }
  }
  // ── Briefkopf ──
  pdfDoc.fontSize(11).font("Helvetica-Bold");
  pdfDoc.text(org.companyName, leftM, briefkopfY);
  pdfDoc.fontSize(8.5).font("Helvetica").fillColor("#444444");
  if (org.street)  pdfDoc.text(org.street);
  if (org.zipCode || org.city) pdfDoc.text(`${org.zipCode ?? ""} ${org.city ?? ""}`.trim());
  if (org.phone)   pdfDoc.text(`Tel: ${org.phone}`);
  if (org.email)   pdfDoc.text(org.email);
  if (org.website) pdfDoc.text(org.website);
  if (org.vatNumber) pdfDoc.text(`MWST-Nr. ${org.vatNumber}`);

  // ── Empfänger-Adresse ──
  pdfDoc.fillColor("#000000");
  const addrX = 350;
  let addrY = 120;
  const custDisplay = customer.company || customer.name;
  const custLine2  = customer.company && customer.name ? customer.name : null;
  pdfDoc.fontSize(10).font("Helvetica-Bold").text(custDisplay, addrX, addrY); addrY += 14;
  if (custLine2) { pdfDoc.fontSize(9).font("Helvetica").text(custLine2, addrX, addrY); addrY += 14; }
  pdfDoc.fontSize(9).font("Helvetica");
  if (customer.street)  { pdfDoc.text(customer.street, addrX, addrY); addrY += 14; }
  if (customer.zipCode || customer.city) {
    pdfDoc.text(`${customer.zipCode ?? ""} ${customer.city ?? ""}`.trim(), addrX, addrY); addrY += 14;
  }

  // ── Datum + Rechnungsnummer ──
  let yPos = 210;
  pdfDoc.fontSize(9).font("Helvetica").fillColor("#666666");
  pdfDoc.text(`${org.city ?? ""}, ${dateStr}`.replace(/^, /, ""), leftM, yPos, { width: contentW, align: "right" });
  yPos += 14;
  if (invoice.invoiceNumber) {
    pdfDoc.text(`Rechnung ${invoice.invoiceNumber}`, leftM, yPos, { width: contentW, align: "right" });
    yPos += 14;
  }
  yPos += 16;

  // ── Betreff ──
  pdfDoc.fillColor("#000000").fontSize(13).font("Helvetica-Bold");
  pdfDoc.text(invoice.subject ?? `Rechnung ${invoice.invoiceNumber ?? ""}`, leftM, yPos, { width: contentW });
  yPos = pdfDoc.y + 16;

  // ── Anrede + Einleitungstext ──
  pdfDoc.fontSize(10).font("Helvetica");
  if (customer.salutation) {
    pdfDoc.text(customer.salutation, leftM, yPos, { width: contentW });
    yPos = pdfDoc.y + 10;
  }
  if (invoice.introText) {
    pdfDoc.text(invoice.introText, leftM, yPos, { width: contentW });
    yPos = pdfDoc.y + 18;
  }

  // ── Positions-Tabelle Header ──
  pdfDoc.fontSize(8.5).font("Helvetica-Bold").fillColor("#666666");
  pdfDoc.text("Pos.", leftM, yPos, { width: 28 });
  pdfDoc.text("Beschreibung", leftM + 32, yPos, { width: contentW - 260 });
  pdfDoc.text("Menge", leftM + contentW - 225, yPos, { width: 45, align: "right" });
  pdfDoc.text("Einzelpreis", leftM + contentW - 175, yPos, { width: 70, align: "right" });
  pdfDoc.text("MWST", leftM + contentW - 100, yPos, { width: 30, align: "right" });
  pdfDoc.text("Total", leftM + contentW - 65, yPos, { width: 65, align: "right" });
  yPos += 14;
  pdfDoc.moveTo(leftM, yPos).lineTo(leftM + contentW, yPos).lineWidth(0.5).strokeColor("#cccccc").stroke();
  yPos += 6;

  // ── Items ──
  pdfDoc.fillColor("#000000").font("Helvetica").fontSize(9);
  items.forEach((item, idx) => {
    const qty = parseFloat(item.quantity as string);
    const price = parseFloat(item.unitPrice as string);
    const lineTotal = parseFloat(item.lineTotal as string);
    const rowStartY = yPos;
    pdfDoc.text(`${item.position ?? idx + 1}.`, leftM, yPos, { width: 28 });
    pdfDoc.text(item.description, leftM + 32, yPos, { width: contentW - 260 });
    const descEndY = pdfDoc.y;
    pdfDoc.text(`${qty} ${item.unit ?? ""}`.trim(), leftM + contentW - 225, rowStartY, { width: 45, align: "right" });
    pdfDoc.text(formatCHF(price), leftM + contentW - 175, rowStartY, { width: 70, align: "right" });
    pdfDoc.text(`${parseFloat(item.vatRate as string)}%`, leftM + contentW - 100, rowStartY, { width: 30, align: "right" });
    pdfDoc.text(formatCHF(lineTotal), leftM + contentW - 65, rowStartY, { width: 65, align: "right" });
    yPos = Math.max(descEndY, rowStartY + 14) + 4;
  });

  // ── Summen ──
  yPos += 4;
  pdfDoc.moveTo(leftM + contentW - 220, yPos).lineTo(leftM + contentW, yPos).lineWidth(0.5).strokeColor("#cccccc").stroke();
  yPos += 6;
  pdfDoc.fontSize(9.5).font("Helvetica");
  pdfDoc.text("Nettobetrag", leftM + contentW - 220, yPos, { width: 140 });
  pdfDoc.text(`${currency} ${formatCHF(subtotal)}`, leftM + contentW - 80, yPos, { width: 80, align: "right" });
  yPos += 14;
  if (vatTotal > 0) {
    pdfDoc.text("MWST", leftM + contentW - 220, yPos, { width: 140 });
    pdfDoc.text(`${currency} ${formatCHF(vatTotal)}`, leftM + contentW - 80, yPos, { width: 80, align: "right" });
    yPos += 14;
  }
  pdfDoc.moveTo(leftM + contentW - 220, yPos).lineTo(leftM + contentW, yPos).lineWidth(1).strokeColor("#000000").stroke();
  yPos += 6;
  pdfDoc.fontSize(11).font("Helvetica-Bold");
  pdfDoc.text("Total", leftM + contentW - 220, yPos, { width: 140 });
  pdfDoc.text(`${currency} ${formatCHF(total)}`, leftM + contentW - 80, yPos, { width: 80, align: "right" });
  yPos += 24;

  // ── Zahlungsbedingungen ──
  pdfDoc.fontSize(9).font("Helvetica").fillColor("#666666");
  pdfDoc.text(`Zahlbar innert ${invoice.paymentTermDays} Tagen bis ${dueStr}.`, leftM, yPos, { width: contentW });
  yPos = pdfDoc.y + 16;

  // ── Fusszeile ──
  if (invoice.footerText) {
    pdfDoc.fillColor("#000000").fontSize(10).font("Helvetica");
    pdfDoc.text(invoice.footerText, leftM, yPos, { width: contentW });
  }

  // ── QR-Einzahlungsschein (falls IBAN konfiguriert und CHF/EUR) ──
  if (qr && qr.iban) {
    const cleanIban = qr.iban.replace(/\s/g, "");
    const iid = parseInt(cleanIban.substring(4, 9));
    const isQrIban = iid >= 30000 && iid <= 31999;

    const data: Data = {
      amount: total,
      currency: currency as "CHF" | "EUR",
      creditor: {
        account: cleanIban,
        name: org.companyName,
        address: org.street ?? "",
        zip: parseInt(org.zipCode ?? "0"),
        city: org.city ?? "",
        country: "CH",
      },
      debtor: {
        name: customer.company || customer.name,
        address: customer.street ?? "",
        zip: parseInt(customer.zipCode ?? "0"),
        city: customer.city ?? "",
        country: customer.country === "Schweiz" ? "CH" : (customer.country ?? "CH").slice(0, 2).toUpperCase(),
      },
    };

    // Referenz: QRR nur mit QR-IBAN, sonst SCOR, oder invoice.qrReference wenn gesetzt
    const effectiveRefType = isQrIban ? (qr.referenceType || "QRR") : "SCOR";
    if (effectiveRefType === "QRR" && isQrIban) {
      const ref = invoice.qrReference || generateQRReference(invoice.id, invoice.fiscalYear ?? invoiceDate.getFullYear());
      data.reference = formatQRRef(ref);
    } else if (effectiveRefType === "SCOR") {
      const refBody = String(invoice.id).padStart(11, "0");
      const numericStr = refBody + "2715" + "00";
      let remainder = 0;
      for (const ch of numericStr) remainder = (remainder * 10 + parseInt(ch)) % 97;
      const checkDigits = String(98 - remainder).padStart(2, "0");
      data.reference = `RF${checkDigits}${refBody}`;
    }

    const qrBill = new SwissQRBill(data);
    qrBill.attachTo(pdfDoc);
  }

  const pdfPromise = new Promise<Buffer>((resolve) => {
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  pdfDoc.end();
  return pdfPromise;
}

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

       const customer = invoice.customerId
        ? (await db.select().from(customers)
          .where(and(eq(customers.organizationId, ctx.organizationId), eq(customers.id, invoice.customerId)))
          .limit(1))[0] ?? null
        : null;
      return { ...invoice, items, customer };
    }),

  // ─── SAVE FROM QR GENERATOR (Draft ohne zwingenden Kunden) ─────────────────
  // Speichert eine Rechnung aus dem QrBillGenerator als Entwurf.
  // customerId ist optional (kann null sein wenn kein Kunde gewählt).
  // Wenn eine invoiceId mitgegeben wird, wird der bestehende Entwurf aktualisiert.
  saveFromQrGenerator: orgProcedure
    .input(z.object({
      invoiceId: z.number().optional(), // Wenn gesetzt: Update statt Insert
      customerId: z.number().optional(),
      recipientName: z.string(),
      recipientStreet: z.string(),
      recipientZip: z.string(),
      recipientCity: z.string(),
      invoiceDate: z.string(),
      paymentTermDays: z.number().int().min(0).default(30),
      subject: z.string().optional(),
      introText: z.string().optional(),
      footerText: z.string().optional(),
      currency: z.enum(["CHF", "EUR"]).default("CHF"),
      items: z.array(z.object({
        description: z.string(),
        amount: z.number(),
      })).min(1),
      vatRate: z.number().min(0).max(100).default(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Totale berechnen
      let subtotal = 0;
      for (const it of input.items) {
        subtotal += round2(it.amount);
      }
      subtotal = round2(subtotal);
      const vatTotal = round2(subtotal * input.vatRate / 100);
      const total = round2(subtotal + vatTotal);

      const fiscalYear = new Date(input.invoiceDate).getFullYear();
      const dueDate = new Date(input.invoiceDate);
      dueDate.setDate(dueDate.getDate() + input.paymentTermDays);
      const dueDateStr = dueDate.toISOString().slice(0, 10);

      // Notiz mit Empfängeradresse (da kein Kunde-FK)
      const recipientNote = input.customerId
        ? undefined
        : `${input.recipientName}, ${input.recipientStreet}, ${input.recipientZip} ${input.recipientCity}`;

      let invoiceId: number;

      if (input.invoiceId) {
        // Update bestehenden Entwurf
        const [existing] = await db.select({ id: invoices.id, status: invoices.status })
          .from(invoices)
          .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.invoiceId)))
          .limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Rechnung nicht gefunden" });
        if (existing.status !== "draft") throw new TRPCError({ code: "FORBIDDEN", message: "Nur Entwürfe können aktualisiert werden" });

        await db.update(invoices).set({
          customerId: input.customerId ?? null,
          invoiceDate: input.invoiceDate,
          dueDate: dueDateStr,
          paymentTermDays: input.paymentTermDays,
          subject: input.subject ?? null,
          introText: input.introText ?? null,
          footerText: input.footerText ?? null,
          currency: input.currency,
          subtotal: subtotal.toFixed(2),
          vatTotal: vatTotal.toFixed(2),
          total: total.toFixed(2),
          fiscalYear,
          notes: recipientNote ?? input.notes ?? null,
        }).where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.invoiceId)));

        // Positionen neu schreiben
        await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, input.invoiceId));
        invoiceId = input.invoiceId;
      } else {
        // Neuen Entwurf erstellen
        const [result] = await db.insert(invoices).values({
          organizationId: ctx.organizationId,
          customerId: input.customerId ?? null,
          invoiceDate: input.invoiceDate,
          dueDate: dueDateStr,
          paymentTermDays: input.paymentTermDays,
          status: "draft",
          subject: input.subject ?? null,
          introText: input.introText ?? null,
          footerText: input.footerText ?? null,
          currency: input.currency,
          subtotal: subtotal.toFixed(2),
          vatTotal: vatTotal.toFixed(2),
          total: total.toFixed(2),
          fiscalYear,
          notes: recipientNote ?? input.notes ?? null,
        });
        invoiceId = (result as any).insertId as number;
      }

      // Positionen einfügen
      for (let i = 0; i < input.items.length; i++) {
        const it = input.items[i];
        const lineNet = round2(it.amount);
        const lineVat = round2(lineNet * input.vatRate / 100);
        await db.insert(invoiceItems).values({
          invoiceId,
          position: i + 1,
          description: it.description,
          quantity: "1",
          unit: "Pauschal",
          unitPrice: lineNet.toFixed(2),
          vatRate: input.vatRate.toFixed(2),
          lineSubtotal: lineNet.toFixed(2),
          lineVat: lineVat.toFixed(2),
          lineTotal: (lineNet + lineVat).toFixed(2),
        });
      }

      return { id: invoiceId, status: "draft" as const };
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
      vatAccountNumber: z.string().default("2040"),
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

  // ─── GENERATE PDF ─────────────────────────────────────────────────────────
  // Rendert das Rechnungs-PDF (mit QR-Einzahlungsschein falls konfiguriert),
  // lädt es nach S3, speichert die URL im invoice-Record und legt ausserdem
  // einen documents-Eintrag für das interne Dokumenten-Archiv an.
  generatePdf: orgProcedure
    .input(z.object({
      id: z.number(),
      regenerate: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invoice] = await db.select().from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Rechnung nicht gefunden" });

      // Gecachtes PDF zurückgeben, wenn vorhanden und kein Regenerate-Flag
      if (!input.regenerate && invoice.pdfS3Key && invoice.pdfS3Url) {
        return {
          url: invoice.pdfS3Url,
          s3Key: invoice.pdfS3Key,
          cached: true,
          filename: `Rechnung_${invoice.invoiceNumber ?? invoice.id}.pdf`,
        };
      }

      const items = await db.select().from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoice.id))
        .orderBy(asc(invoiceItems.position));
      if (items.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Rechnung hat keine Positionen" });
      }

      if (!invoice.customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Rechnung hat keinen Kunden – bitte zuerst einen Kunden zuweisen" });
      const [customer] = await db.select().from(customers)
        .where(and(eq(customers.organizationId, ctx.organizationId), eq(customers.id, invoice.customerId)))
        .limit(1);
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Kunde nicht gefunden" });
      const [org] = await db.select().from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId)).limit(1);
      if (!org) throw new TRPCError({ code: "BAD_REQUEST", message: "Firmeneinstellungen fehlen" });

      const [orgLegal] = await db.select().from(organizations)
        .where(eq(organizations.id, ctx.organizationId)).limit(1);

      // QR-Settings sind optional – wenn nicht konfiguriert, wird kein
      // Einzahlungsschein angehängt (die Rechnung ist dann nur das Brief-PDF).
      const [qr] = await db.select().from(qrSettings)
        .where(eq(qrSettings.organizationId, ctx.organizationId)).limit(1);

      const pdfBuffer = await renderInvoicePdf({
        org, orgLegal: orgLegal ?? null,
        invoice, items, customer,
        qr: qr ?? null,
      });

      // Nach S3 hochladen (org-gescopt + invoice-ID als eindeutiger Key)
      const timestamp = Date.now();
      const cleanNumber = (invoice.invoiceNumber ?? `draft-${invoice.id}`).replace(/[^a-zA-Z0-9_-]/g, "-");
      const filename = `Rechnung_${cleanNumber}.pdf`;
      const s3Key = `invoices/${ctx.organizationId}/${cleanNumber}-${timestamp}.pdf`;
      const { url } = await storagePut(s3Key, pdfBuffer, "application/pdf");

      // In Invoice-Record speichern (für Caching)
      await db.update(invoices).set({
        pdfS3Key: s3Key,
        pdfS3Url: url,
      }).where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, invoice.id)));

      // Als Document registrieren (fürs interne Archiv, GeBüV)
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
          notes: `Auto-generiert aus Rechnung ${invoice.invoiceNumber ?? `#${invoice.id}`}`,
        });
      } catch (e) {
        // Dokumenten-Eintrag ist nicht kritisch – PDF wurde erfolgreich erstellt.
        console.warn("[invoices.generatePdf] document insert failed:", e);
      }

      return { url, s3Key, cached: false, filename };
    }),

  // ─── SEND EMAIL ───────────────────────────────────────────────────────────
  // Sendet die Rechnung als Email mit PDF-Anhang via Resend. Generiert das
  // PDF falls noch nicht vorhanden. Default-Empfänger ist customer.email,
  // kann aber überschrieben werden. Nach erfolgreichem Versand wird der
  // Status auf "sent" gesetzt (falls noch draft – aber Email nur sinnvoll
  // für issued invoices).
  sendEmail: orgProcedure
    .input(z.object({
      id: z.number(),
      to: z.string().email().optional(),
      cc: z.array(z.string().email()).optional(),
      subject: z.string().optional(),
      bodyText: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invoice] = await db.select().from(invoices)
        .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, input.id)))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Rechnung nicht gefunden" });
      if (invoice.status === "draft") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Bitte Rechnung zuerst verbuchen, bevor sie per E-Mail versandt wird." });
      }

      // Empfänger ermitteln
      if (!invoice.customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Rechnung hat keinen Kunden – E-Mail-Versand nicht möglich" });
      const [customer] = await db.select().from(customers)
        .where(and(eq(customers.organizationId, ctx.organizationId), eq(customers.id, invoice.customerId)))
        .limit(1);
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Kunde nicht gefunden" });
      const recipient = input.to ?? customer.email;;
      if (!recipient) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Keine E-Mail-Adresse: Bitte Empfänger angeben oder Kunden-E-Mail hinterlegen.",
        });
      }

      // PDF generieren/cachen
      const items = await db.select().from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoice.id))
        .orderBy(asc(invoiceItems.position));
      const [org] = await db.select().from(companySettings)
        .where(eq(companySettings.organizationId, ctx.organizationId)).limit(1);
      if (!org) throw new TRPCError({ code: "BAD_REQUEST", message: "Firmeneinstellungen fehlen" });
      const [qr] = await db.select().from(qrSettings)
        .where(eq(qrSettings.organizationId, ctx.organizationId)).limit(1);

      const pdfBuffer = await renderInvoicePdf({
        org, orgLegal: null,
        invoice, items, customer, qr: qr ?? null,
      });

      const cleanNumber = (invoice.invoiceNumber ?? `draft-${invoice.id}`).replace(/[^a-zA-Z0-9_-]/g, "-");
      const filename = `Rechnung_${cleanNumber}.pdf`;
      const subject = input.subject
        ?? `Rechnung ${invoice.invoiceNumber ?? ""} – ${invoice.subject ?? org.companyName}`;
      const greeting = customer.salutation
        ?? `Sehr geehrte Damen und Herren`;
      const bodyText = input.bodyText
        ?? `${greeting}

im Anhang finden Sie unsere Rechnung ${invoice.invoiceNumber ?? ""}${invoice.subject ? " für \"" + invoice.subject + "\"" : ""}.

Zahlbar bis ${new Date(invoice.dueDate).toLocaleDateString("de-CH")}.

Bei Fragen stehen wir gerne zur Verfügung.

Freundliche Grüsse
${org.companyName}`;

      // Simple HTML-Version (Plain-Text → <br>)
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
        attachments: [{
          filename,
          content: pdfBuffer.toString("base64"),
          contentType: "application/pdf",
        }],
      });

      // sentAt setzen, damit im UI sichtbar ist, dass Email raus ist
      if (!invoice.sentAt) {
        await db.update(invoices).set({ sentAt: new Date() })
          .where(and(eq(invoices.organizationId, ctx.organizationId), eq(invoices.id, invoice.id)));
      }

      return { success: true, messageId, to: recipient };
    }),
});
