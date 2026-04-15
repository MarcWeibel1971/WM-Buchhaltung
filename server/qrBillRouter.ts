/**
 * QR-Bill & ISO 20022 Router
 * - QR-Rechnung (Swiss QR-Bill) PDF generation
 * - QR-Rechnung settings (IBAN, reference type)
 * - ISO 20022 pain.001 XML export for payments
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { qrSettings, companySettings, employees, payrollEntries, bankAccounts, accounts, documents, bankTransactions } from "../drizzle/schema";
import { eq, and, sql, isNotNull, inArray } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";
import type { Data } from "swissqrbill/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format CHF amount: 1234.56 → "1'234.56" */
function formatCHF(n: number): string {
  const [int, dec] = n.toFixed(2).split(".");
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${formatted}.${dec}`;
}

/** Generate a QR-Referenz (26 digits + 1 check digit) from an invoice/entry ID */
function generateQRReference(id: number, year: number): string {
  // Format: YYMMDD + 20-digit zero-padded ID = 26 digits
  const base = String(year).slice(-2) + "0000" + String(id).padStart(20, "0");
  // Modulo 10 recursive check digit (ISO 11649)
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const ch of base) {
    carry = table[(carry + parseInt(ch)) % 10];
  }
  const check = (10 - carry) % 10;
  return base + String(check);
}

/** Format QR reference with spaces: "00 00000 00000 00000 00000 00001 7" */
function formatQRRef(ref: string): string {
  // Right-align in groups of 5, first group may be shorter
  const parts: string[] = [];
  let i = ref.length;
  while (i > 0) {
    const start = Math.max(0, i - 5);
    parts.unshift(ref.slice(start, i));
    i = start;
  }
  return parts.join(" ");
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const qrBillRouter = router({

  // ─── QR Settings CRUD ───────────────────────────────────────────────────────
  getQrSettings: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db.select().from(qrSettings).limit(1);
    return rows[0] ?? null;
  }),

  saveQrSettings: protectedProcedure
    .input(z.object({
      iban: z.string().min(15).max(34),
      referenceType: z.enum(["QRR", "SCOR", "NON"]),
      currency: z.enum(["CHF", "EUR"]),
      additionalInfo: z.string().max(140).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select().from(qrSettings).limit(1);
      if (existing.length > 0) {
        await db.update(qrSettings).set(input).where(eq(qrSettings.id, existing[0].id));
      } else {
        await db.insert(qrSettings).values(input);
      }
      return { success: true };
    }),

  // ─── Generate QR-Rechnung PDF ───────────────────────────────────────────────
  generateQrBill: protectedProcedure
    .input(z.object({
      // Debtor info
      debtorName: z.string().min(1),
      debtorAddress: z.string().min(1),
      debtorZip: z.string().min(1),
      debtorCity: z.string().min(1),
      debtorCountry: z.string().default("CH"),
      // Amount
      amount: z.number().positive(),
      currency: z.enum(["CHF", "EUR"]).default("CHF"),
      // Reference (optional – auto-generated if not provided)
      reference: z.string().optional(),
      // Additional info
      additionalInfo: z.string().optional(),
      // Optional: link to journal entry
      journalEntryId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load QR settings
      const qrRows = await db.select().from(qrSettings).limit(1);
      if (!qrRows.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "QR-Rechnungs-Einstellungen fehlen. Bitte IBAN unter Einstellungen > QR-Rechnung konfigurieren.",
        });
      }
      const qr = qrRows[0];

      // Load company settings
      const compRows = await db.select().from(companySettings).limit(1);
      const comp = compRows[0];
      if (!comp) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Firmeneinstellungen fehlen." });
      }

      // Detect QR-IBAN vs regular IBAN
      const simpleCleanIban = qr.iban.replace(/\s/g, "");
      const simpleIid = parseInt(simpleCleanIban.substring(4, 9));
      const simpleIsQrIban = simpleIid >= 30000 && simpleIid <= 31999;

      // Build reference
      let reference: string | undefined = input.reference;
      if (!reference && simpleIsQrIban && qr.referenceType === "QRR") {
        reference = generateQRReference(input.journalEntryId ?? Date.now() % 100000, new Date().getFullYear());
      }

      // Build QR-Bill data
      const data: Data = {
        amount: input.amount,
        currency: input.currency,
        creditor: {
          account: simpleCleanIban,
          name: comp.companyName,
          address: comp.street ?? "",
          zip: parseInt(comp.zipCode ?? "0"),
          city: comp.city ?? "",
          country: "CH",
        },
        debtor: {
          name: input.debtorName,
          address: input.debtorAddress,
          zip: parseInt(input.debtorZip),
          city: input.debtorCity,
          country: input.debtorCountry,
        },
      };

      if (reference && simpleIsQrIban && qr.referenceType === "QRR") {
        data.reference = formatQRRef(reference);
      } else if (!simpleIsQrIban) {
        // For regular IBANs, use proper SCOR reference (ISO 11649)
        const refBody = String(Date.now() % 100000000000).padStart(11, "0");
        const numStr = refBody + "2715" + "00";
        let rem = 0;
        for (const ch of numStr) { rem = (rem * 10 + parseInt(ch)) % 97; }
        data.reference = `RF${String(98 - rem).padStart(2, "0")}${refBody}`;
      }
      if (input.additionalInfo || qr.additionalInfo) {
        data.message = input.additionalInfo || qr.additionalInfo || undefined;
      }

      // Generate PDF
      const pdfDoc = new PDFDocument({
        size: "A4",
        autoFirstPage: true,
        margin: 50,
      });

      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));

      // Add invoice header
      pdfDoc.fontSize(10).font("Helvetica");
      pdfDoc.text(comp.companyName, 50, 50);
      if (comp.street) pdfDoc.text(comp.street);
      pdfDoc.text(`${comp.zipCode ?? ""} ${comp.city ?? ""}`);
      if (comp.phone) pdfDoc.text(`Tel: ${comp.phone}`);
      if (comp.email) pdfDoc.text(comp.email);
      if (comp.uid) pdfDoc.text(`UID: ${comp.uid}`);

      // Debtor address block (right side)
      pdfDoc.fontSize(10).font("Helvetica");
      pdfDoc.text(input.debtorName, 350, 120);
      pdfDoc.text(input.debtorAddress);
      pdfDoc.text(`${input.debtorZip} ${input.debtorCity}`);

      // Invoice title
      pdfDoc.fontSize(14).font("Helvetica-Bold");
      pdfDoc.text("Rechnung", 50, 220);
      pdfDoc.moveDown(0.5);

      // Invoice details
      pdfDoc.fontSize(10).font("Helvetica");
      const today = new Date();
      pdfDoc.text(`Datum: ${today.toLocaleDateString("de-CH")}`, 50);
      if (input.journalEntryId) {
        pdfDoc.text(`Buchung Nr.: ${input.journalEntryId}`);
      }
      if (reference) {
        pdfDoc.text(`Referenz: ${formatQRRef(reference)}`);
      }
      pdfDoc.moveDown(1);

      // Amount
      pdfDoc.fontSize(12).font("Helvetica-Bold");
      pdfDoc.text(`Betrag: ${input.currency} ${formatCHF(input.amount)}`, 50);
      pdfDoc.moveDown(0.5);

      if (input.additionalInfo) {
        pdfDoc.fontSize(10).font("Helvetica");
        pdfDoc.text(input.additionalInfo);
      }

      // Attach QR-Bill payment section
      const qrBill = new SwissQRBill(data);
      qrBill.attachTo(pdfDoc);

      // Finalize
      const pdfPromise = new Promise<Buffer>((resolve) => {
        pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      });
      pdfDoc.end();
      const pdfBuffer = await pdfPromise;

      return {
        base64: pdfBuffer.toString("base64"),
        filename: `QR-Rechnung_${input.debtorName.replace(/\s+/g, "_")}_${formatCHF(input.amount)}.pdf`,
      };
    }),

  // ─── ISO 20022 pain.001 Export ──────────────────────────────────────────────
  generatePain001: protectedProcedure
    .input(z.object({
      // Type of payment file
      paymentType: z.enum(["salary", "creditor"]),
      // For salary: year and month
      year: z.number().optional(),
      month: z.number().min(1).max(12).optional(),
      // For creditor: list of payment items
      payments: z.array(z.object({
        debtorIban: z.string().optional(), // Source account IBAN
        creditorName: z.string(),
        creditorIban: z.string(),
        creditorAddress: z.string().optional(),
        creditorZip: z.string().optional(),
        creditorCity: z.string().optional(),
        creditorCountry: z.string().optional(),
        amount: z.number().positive(),
        currency: z.string().default("CHF"),
        reference: z.string().optional(),
        remittanceInfo: z.string().optional(),
      })).optional(),
      // Execution date
      executionDate: z.string().optional(),
      // Document IDs of invoices included in this payment (for marking as paid)
      documentIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load company settings
      const compRows = await db.select().from(companySettings).limit(1);
      const comp = compRows[0];
      if (!comp) throw new TRPCError({ code: "BAD_REQUEST", message: "Firmeneinstellungen fehlen." });

      // Load bank accounts for IBAN
      const bankAccs = await db.select().from(bankAccounts).where(eq(bankAccounts.isActive, true));

      let paymentItems: Array<{
        creditorName: string;
        creditorIban: string;
        creditorAddress?: string;
        creditorZip?: string;
        creditorCity?: string;
        creditorCountry?: string;
        amount: number;
        currency: string;
        reference?: string;
        remittanceInfo?: string;
      }> = [];

      if (input.paymentType === "salary" && input.year && input.month) {
        // Build payment items from payroll entries
        const emps = await db.select().from(employees).where(eq(employees.isActive, true));
        const payrolls = await db.select().from(payrollEntries)
          .where(and(
            eq(payrollEntries.year, input.year),
            eq(payrollEntries.month, input.month),
          ));

        for (const pr of payrolls) {
          const emp = emps.find(e => e.id === pr.employeeId);
          if (!emp) continue;
          const netSalary = parseFloat(pr.netSalary ?? "0");
          if (netSalary <= 0) continue;

          // Find employee's bank account IBAN (from salary account link)
          let empIban = "";
          if (emp.salaryAccountId) {
            const ba = bankAccs.find(b => b.accountId === emp.salaryAccountId);
            if (ba?.iban) empIban = ba.iban;
          }

          paymentItems.push({
            creditorName: `${emp.firstName} ${emp.lastName}`,
            creditorIban: empIban,
            creditorAddress: emp.street ?? undefined,
            creditorZip: emp.zipCode ?? undefined,
            creditorCity: emp.city ?? undefined,
            amount: netSalary,
            currency: "CHF",
            remittanceInfo: `Lohn ${input.month}/${input.year} ${emp.firstName} ${emp.lastName}`,
          });
        }
      } else if (input.payments) {
        paymentItems = input.payments;
      }

      if (paymentItems.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Keine Zahlungen zum Exportieren gefunden." });
      }

      // Find source bank account (first active with IBAN)
      const sourceBank = bankAccs.find(b => b.iban && b.owner === "wm");
      const sourceIban = sourceBank?.iban ?? "CH0000000000000000000";

      // Generate pain.001.001.09 XML (Swiss Implementation Guidelines)
      const msgId = `MSG-${Date.now()}`;
      const creDtTm = new Date().toISOString();
      const execDate = input.executionDate ?? new Date().toISOString().slice(0, 10);
      const nbOfTxs = paymentItems.length;
      const ctrlSum = paymentItems.reduce((s, p) => s + p.amount, 0).toFixed(2);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(comp.companyName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${Date.now()}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>
        <Dt>${execDate}</Dt>
      </ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(comp.companyName)}</Nm>
        <PstlAdr>
          <StrtNm>${escapeXml(comp.street ?? "")}</StrtNm>
          <PstCd>${escapeXml(comp.zipCode ?? "")}</PstCd>
          <TwnNm>${escapeXml(comp.city ?? "")}</TwnNm>
          <Ctry>CH</Ctry>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${sourceIban.replace(/\s/g, "")}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BICFI>LUKBCH2260A</BICFI>
        </FinInstnId>
      </DbtrAgt>`;

      for (let i = 0; i < paymentItems.length; i++) {
        const p = paymentItems[i];
        const endToEndId = `E2E-${Date.now()}-${i}`;
        xml += `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${endToEndId}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${p.currency}">${p.amount.toFixed(2)}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>
            <ClrSysMmbId>
              <MmbId>NOTPROVIDED</MmbId>
            </ClrSysMmbId>
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(p.creditorName)}</Nm>
          <PstlAdr>${p.creditorAddress ? `
            <StrtNm>${escapeXml(p.creditorAddress)}</StrtNm>` : ""}${p.creditorZip ? `
            <PstCd>${escapeXml(p.creditorZip)}</PstCd>` : ""}
            <TwnNm>${escapeXml(p.creditorCity || "Unbekannt")}</TwnNm>
            <Ctry>${escapeXml(p.creditorCountry || "CH")}</Ctry>
          </PstlAdr>
        </Cdtr>${p.creditorIban ? `
        <CdtrAcct>
          <Id>
            <IBAN>${p.creditorIban.replace(/\s/g, "")}</IBAN>
          </Id>
        </CdtrAcct>` : ""}${p.remittanceInfo ? `
        <RmtInf>
          <Ustrd>${escapeXml(p.remittanceInfo)}</Ustrd>
        </RmtInf>` : ""}
      </CdtTrfTxInf>`;
      }

      xml += `
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

      const filename = input.paymentType === "salary"
        ? `Lohnzahlung_${input.year}_${String(input.month).padStart(2, "0")}_pain001.xml`
        : `Zahlungsauftrag_${execDate}_pain001.xml`;

      // Mark included invoices as "paid" (matchStatus = 'pain001') when pain.001 is generated
      if (input.documentIds && input.documentIds.length > 0) {
        for (const docId of input.documentIds) {
          await db.update(documents).set({
            matchStatus: "pain001",
          }).where(eq(documents.id, docId));
        }
      }

      return {
        xml,
        filename,
        summary: {
          nbOfTxs,
          ctrlSum: parseFloat(ctrlSum),
          executionDate: execDate,
          markedAsPaid: input.documentIds?.length ?? 0,
        },
      };
    }),  // ─── List unpaid invoices from Documents for ISO 20022 export ─────────────
  listUnpaidInvoices: protectedProcedure
    .input(z.object({
      fiscalYear: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get all incoming invoices (Eingangsrechnungen)
      const conditions: any[] = [eq(documents.documentType, "invoice_in")];
      if (input.fiscalYear) conditions.push(eq(documents.fiscalYear, input.fiscalYear));

      const invoices = await db.select().from(documents)
        .where(and(...conditions))
        .orderBy(documents.createdAt);

      // Get all bank transactions to check which invoices are already paid
      const allTxs = await db.select({
        id: bankTransactions.id,
        matchedDocumentId: bankTransactions.matchedDocumentId,
        counterparty: bankTransactions.counterparty,
        amount: bankTransactions.amount,
        status: bankTransactions.status,
        journalEntryId: bankTransactions.journalEntryId,
      }).from(bankTransactions);

      // Build a set of document IDs that are matched to bank transactions that have been
      // actually processed (verbucht = journalEntryId exists, or status = matched with journal entry)
      // A transaction in the bankimport that is still "pending" does NOT mean the invoice is paid
      const paidDocIds = new Set(
        allTxs
          .filter(tx => tx.matchedDocumentId && tx.matchedDocumentId > 0 && tx.journalEntryId && tx.journalEntryId > 0)
          .map(tx => tx.matchedDocumentId!)
      );

      // Process each invoice
      const results = invoices.map(doc => {
        let metadata: any = {};
        if (doc.aiMetadata) {
          try { metadata = JSON.parse(doc.aiMetadata); } catch { /* ignore */ }
        }

        const totalAmount = parseFloat(metadata.totalAmount || "0");
        const counterparty = metadata.counterparty || "Unbekannt";
        const counterpartyIban = metadata.counterpartyIban || "";
        const referenceNumber = metadata.referenceNumber || "";
        const documentDate = metadata.documentDate || "";
        const currency = metadata.currency || "CHF";
        const description = metadata.description || doc.filename;
        const creditorCity = metadata.creditorCity || metadata.city || "";
        const creditorCountry = metadata.creditorCountry || metadata.country || "CH";
        const creditorAddress = metadata.creditorAddress || metadata.address || metadata.street || "";
        const creditorZip = metadata.creditorZip || metadata.zipCode || metadata.zip || "";

        // Check if paid:
        // - matched to a bank transaction with journalEntryId (verbucht)
        // - manually marked as paid (matchStatus = 'manual')
        // - included in a pain.001 export (matchStatus = 'pain001')
        const isPaid = paidDocIds.has(doc.id) || doc.matchStatus === "manual" || doc.matchStatus === "pain001";

        // Calculate due date: documentDate + 30 days (default payment term)
        let dueDate = "";
        if (documentDate) {
          try {
            const d = new Date(documentDate);
            d.setDate(d.getDate() + 30);
            dueDate = d.toISOString().slice(0, 10);
          } catch { /* ignore */ }
        }

        return {
          id: doc.id,
          filename: doc.filename,
          counterparty,
          counterpartyIban,
          referenceNumber,
          totalAmount,
          currency,
          documentDate,
          dueDate,
          description,
          isPaid,
          matchStatus: doc.matchStatus,
          s3Url: doc.s3Url,
          creditorCity,
          creditorCountry,
          creditorAddress,
          creditorZip,
        };
      });

      return results;
    }),

  // ─── Mark invoice as manually paid ──────────────────────────────────────────
  markInvoicePaid: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      isPaid: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Update match status: "manual" means manually marked as paid, "unmatched" means not paid
      await db.update(documents).set({
        matchStatus: input.isPaid ? "manual" : "unmatched",
      }).where(eq(documents.id, input.documentId));

      return { success: true };
    }),

  // ─── Professional Invoice with QR Payment Slip ─────────────────────────────
  generateInvoiceWithQr: protectedProcedure
    .input(z.object({
      recipientTitle: z.string().optional(),
      recipientName: z.string().min(1),
      recipientStreet: z.string().min(1),
      recipientZip: z.string().min(1),
      recipientCity: z.string().min(1),
      recipientCountry: z.string().default("CH"),
      invoiceDate: z.string(),
      invoiceSubject: z.string(),
      salutation: z.string().optional(),
      introText: z.string(),
      lineItems: z.array(z.object({
        description: z.string(),
        amount: z.number(),
      })),
      vatRate: z.number().min(0).max(100),
      currency: z.enum(["CHF", "EUR"]).default("CHF"),
      closingText: z.string(),
      greeting: z.string(),
      signerName: z.string(),
      signerTitle: z.string().optional(),
      paymentDays: z.number().int().default(30),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load QR settings
      const qrRows = await db.select().from(qrSettings).limit(1);
      if (!qrRows.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "QR-Rechnungs-Einstellungen fehlen. Bitte IBAN unter Einstellungen > QR-Rechnung konfigurieren.",
        });
      }
      const qr = qrRows[0];

      // Load company settings
      const compRows = await db.select().from(companySettings).limit(1);
      const comp = compRows[0];
      if (!comp) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Firmeneinstellungen fehlen." });
      }

      // Calculate totals
      const subtotal = input.lineItems.reduce((s, i) => s + i.amount, 0);
      const vatAmount = subtotal * (input.vatRate / 100);
      const total = subtotal + vatAmount;

      // Generate reference
      const reference = generateQRReference(Date.now() % 100000, new Date().getFullYear());

      // Format invoice date (parse YYYY-MM-DD without timezone offset)
      const [yyyy2, mm2, dd2] = input.invoiceDate.split('-').map(Number);
      const invDate = new Date(yyyy2, mm2 - 1, dd2);
      const dateStr = invDate.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

      // Calculate payment due date
      const dueDate = new Date(yyyy2, mm2 - 1, dd2);
      dueDate.setDate(dueDate.getDate() + input.paymentDays);
      const dueDateStr = dueDate.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

      // Build QR-Bill data
      const cleanIban = qr.iban.replace(/\s/g, "");
      // QR-IBANs have IID 30000-31999 (chars 5-9 of IBAN)
      const iid = parseInt(cleanIban.substring(4, 9));
      const isQrIban = iid >= 30000 && iid <= 31999;
      // Determine reference type: QRR only works with QR-IBAN, SCOR with regular IBAN
      const effectiveRefType = isQrIban ? (qr.referenceType || "QRR") : "SCOR";

      const data: Data = {
        amount: total,
        currency: input.currency,
        creditor: {
          account: cleanIban,
          name: comp.companyName,
          address: comp.street ?? "",
          zip: parseInt(comp.zipCode ?? "0"),
          city: comp.city ?? "",
          country: "CH",
        },
        debtor: {
          name: input.recipientName,
          address: input.recipientStreet,
          zip: parseInt(input.recipientZip),
          city: input.recipientCity,
          country: input.recipientCountry,
        },
      };

      if (effectiveRefType === "QRR" && isQrIban) {
        data.reference = formatQRRef(reference);
      } else if (effectiveRefType === "SCOR") {
        // Generate a proper Creditor Reference (ISO 11649) for regular IBANs
        // RF + 2 check digits + up to 21 alphanumeric chars, max 25 total
        const refBody = String(Date.now() % 100000000000).padStart(11, "0");
        // ISO 11649 check digit calculation: move RF00 to end, replace R=27,F=15, mod 97
        const numericStr = refBody + "2715" + "00";
        // Calculate mod 97 for large numbers using string-based approach
        let remainder = 0;
        for (const ch of numericStr) {
          remainder = (remainder * 10 + parseInt(ch)) % 97;
        }
        const checkDigits = String(98 - remainder).padStart(2, "0");
        data.reference = `RF${checkDigits}${refBody}`;
      }
      // For NON reference type, don't set data.reference at all

      // Generate PDF
      const pdfDoc = new PDFDocument({
        size: "A4",
        autoFirstPage: true,
        margins: { top: 40, bottom: 40, left: 55, right: 55 },
      });

      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));

      const pageW = 595.28;
      const leftM = 55;
      const rightM = 55;
      const contentW = pageW - leftM - rightM;

      // ── Company Header (top left) ──
      pdfDoc.fontSize(11).font("Helvetica-Bold");
      pdfDoc.text(comp.companyName, leftM, 45);
      pdfDoc.fontSize(8.5).font("Helvetica").fillColor("#444444");
      if (comp.street) pdfDoc.text(comp.street);
      pdfDoc.text(`${comp.zipCode ?? ""} ${comp.city ?? ""}`);
      if (comp.phone) pdfDoc.text(`Tel: ${comp.phone}`);
      if (comp.email) pdfDoc.text(comp.email);
      if (comp.website) pdfDoc.text(comp.website);
      if (comp.uid) pdfDoc.text(`MWST-Nr. ${comp.uid}`);

      // ── Recipient Address (right side, window envelope position) ──
      pdfDoc.fillColor("#000000");
      const addrX = 350;
      let addrY = 120;
      if (input.recipientTitle) {
        pdfDoc.fontSize(9).font("Helvetica").text(input.recipientTitle, addrX, addrY);
        addrY += 14;
      }
      pdfDoc.fontSize(10).font("Helvetica-Bold").text(input.recipientName, addrX, addrY);
      addrY += 14;
      pdfDoc.fontSize(9).font("Helvetica").text(input.recipientStreet, addrX, addrY);
      addrY += 14;
      pdfDoc.text(`${input.recipientZip} ${input.recipientCity}`, addrX, addrY);

      // ── Date and Reference (right-aligned) ──
      let yPos = 210;
      pdfDoc.fontSize(9).font("Helvetica").fillColor("#666666");
      pdfDoc.text(`Luzern, ${dateStr}`, leftM, yPos, { width: contentW, align: "right" });
      yPos += 14;
      // Show reference based on type
      if (effectiveRefType === "QRR" && isQrIban) {
        pdfDoc.text(`Referenz: ${formatQRRef(reference)}`, leftM, yPos, { width: contentW, align: "right" });
      } else if (data.reference) {
        pdfDoc.text(`Referenz: ${data.reference}`, leftM, yPos, { width: contentW, align: "right" });
      }
      yPos += 30;

      // ── Subject Line ──
      pdfDoc.fillColor("#000000");
      pdfDoc.fontSize(13).font("Helvetica-Bold");
      pdfDoc.text(input.invoiceSubject, leftM, yPos);
      yPos += 30;

      // ── Salutation & Intro ──
      pdfDoc.fontSize(10).font("Helvetica");
      if (input.salutation) {
        pdfDoc.text(input.salutation, leftM, yPos, { width: contentW });
        yPos += 20;
      }
      pdfDoc.text(input.introText, leftM, yPos, { width: contentW });
      yPos = pdfDoc.y + 20;

      // ── Line Items Table ──
      // Header
      pdfDoc.fontSize(8.5).font("Helvetica-Bold").fillColor("#666666");
      pdfDoc.text("Pos.", leftM, yPos, { width: 30 });
      pdfDoc.text("Beschreibung", leftM + 35, yPos, { width: contentW - 130 });
      pdfDoc.text(`${input.currency}`, leftM + contentW - 80, yPos, { width: 80, align: "right" });
      yPos += 15;
      pdfDoc.moveTo(leftM, yPos).lineTo(leftM + contentW, yPos).lineWidth(0.5).strokeColor("#cccccc").stroke();
      yPos += 8;

      // Items
      pdfDoc.fillColor("#000000").font("Helvetica").fontSize(9.5);
      input.lineItems.forEach((item, idx) => {
        pdfDoc.text(`${idx + 1}.`, leftM, yPos, { width: 30 });
        pdfDoc.text(item.description, leftM + 35, yPos, { width: contentW - 130 });
        pdfDoc.text(formatCHF(item.amount), leftM + contentW - 80, yPos, { width: 80, align: "right" });
        yPos = Math.max(pdfDoc.y, yPos + 16) + 4;
      });

      // Subtotal line
      yPos += 4;
      pdfDoc.moveTo(leftM + contentW - 200, yPos).lineTo(leftM + contentW, yPos).lineWidth(0.5).strokeColor("#cccccc").stroke();
      yPos += 8;

      pdfDoc.fontSize(9).font("Helvetica");
      pdfDoc.text("Zwischensumme", leftM + contentW - 200, yPos, { width: 120 });
      pdfDoc.text(`${input.currency} ${formatCHF(subtotal)}`, leftM + contentW - 80, yPos, { width: 80, align: "right" });
      yPos += 16;

      pdfDoc.text(`MWST ${input.vatRate}%`, leftM + contentW - 200, yPos, { width: 120 });
      pdfDoc.text(`${input.currency} ${formatCHF(vatAmount)}`, leftM + contentW - 80, yPos, { width: 80, align: "right" });
      yPos += 16;

      // Total
      pdfDoc.moveTo(leftM + contentW - 200, yPos).lineTo(leftM + contentW, yPos).lineWidth(1).strokeColor("#000000").stroke();
      yPos += 8;
      pdfDoc.fontSize(11).font("Helvetica-Bold");
      pdfDoc.text("Total", leftM + contentW - 200, yPos, { width: 120 });
      pdfDoc.text(`${input.currency} ${formatCHF(total)}`, leftM + contentW - 80, yPos, { width: 80, align: "right" });
      yPos += 28;

      // ── Payment Terms ──
      pdfDoc.fontSize(9).font("Helvetica").fillColor("#666666");
      pdfDoc.text(`Zahlbar innert ${input.paymentDays} Tagen bis ${dueDateStr}.`, leftM, yPos, { width: contentW });
      yPos += 20;

      // ── Closing Text ──
      pdfDoc.fillColor("#000000").fontSize(10).font("Helvetica");
      pdfDoc.text(input.closingText, leftM, yPos, { width: contentW });
      yPos = pdfDoc.y + 20;

      // ── Greeting & Signature ──
      pdfDoc.text(input.greeting, leftM, yPos);
      yPos += 30;
      pdfDoc.font("Helvetica-Bold").text(input.signerName, leftM, yPos);
      if (input.signerTitle) {
        yPos += 14;
        pdfDoc.font("Helvetica").fontSize(9).text(input.signerTitle, leftM, yPos);
      }

      // ── QR Payment Slip ──
      const qrBill = new SwissQRBill(data);
      qrBill.attachTo(pdfDoc);

      // Finalize
      const pdfPromise = new Promise<Buffer>((resolve) => {
        pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      });
      pdfDoc.end();
      const pdfBuffer = await pdfPromise;

      return {
        base64: pdfBuffer.toString("base64"),
        filename: `Rechnung_${input.recipientName.replace(/\s+/g, "_")}_${invDate.toISOString().slice(0, 10)}.pdf`,
      };
    }),

  // ─── AcroForms-based Professional Invoice (like Lohnausweis) ─────────────────
  generateInvoiceAcroform: protectedProcedure
    .input(z.object({
      recipientTitle: z.string().optional(),
      recipientName: z.string().min(1),
      recipientStreet: z.string().min(1),
      recipientZip: z.string().min(1),
      recipientCity: z.string().min(1),
      recipientCountry: z.string().default("CH"),
      invoiceDate: z.string(),
      invoiceSubject: z.string(),
      salutation: z.string().optional(),
      introText: z.string(),
      lineItems: z.array(z.object({
        description: z.string(),
        amount: z.number(),
      })),
      vatRate: z.number().min(0).max(100),
      currency: z.enum(["CHF", "EUR"]).default("CHF"),
      closingText: z.string(),
      greeting: z.string(),
      signerName: z.string(),
      signerTitle: z.string().optional(),
      paymentDays: z.number().int().default(30),
    }))
    .mutation(async ({ input }) => {
      const { PDFDocument: PDFLib, rgb, StandardFonts } = await import('pdf-lib');
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load QR settings
      const qrRows = await db.select().from(qrSettings).limit(1);
      if (!qrRows.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "QR-Rechnungs-Einstellungen fehlen." });
      }
      const qr = qrRows[0];

      // Load company settings
      const compRows = await db.select().from(companySettings).limit(1);
      const comp = compRows[0];
      if (!comp) throw new TRPCError({ code: "BAD_REQUEST", message: "Firmeneinstellungen fehlen." });

      // Calculate totals
      const subtotal = input.lineItems.reduce((s, i) => s + i.amount, 0);
      const vatAmount = subtotal * (input.vatRate / 100);
      const total = subtotal + vatAmount;

      // Generate reference
      const cleanIban = qr.iban.replace(/\s/g, "");
      const iid = parseInt(cleanIban.substring(4, 9));
      const isQrIban = iid >= 30000 && iid <= 31999;
      const effectiveRefType = isQrIban ? (qr.referenceType || "QRR") : "SCOR";

      let referenceStr = "";
      if (effectiveRefType === "QRR" && isQrIban) {
        const ref = generateQRReference(Date.now() % 100000, new Date().getFullYear());
        referenceStr = formatQRRef(ref);
      } else if (effectiveRefType === "SCOR") {
        const refBody = String(Date.now() % 100000000000).padStart(11, "0");
        const numericStr = refBody + "2715" + "00";
        let remainder = 0;
        for (const ch of numericStr) { remainder = (remainder * 10 + parseInt(ch)) % 97; }
        const checkDigits = String(98 - remainder).padStart(2, "0");
        referenceStr = `RF${checkDigits}${refBody}`;
      }

      // Format dates (parse YYYY-MM-DD without timezone offset)
      const [yyyy, mm, dd] = input.invoiceDate.split('-').map(Number);
      const invDate = new Date(yyyy, mm - 1, dd);
      const dateStr = invDate.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });
      const dueDate = new Date(yyyy, mm - 1, dd);
      dueDate.setDate(dueDate.getDate() + input.paymentDays);
      const dueDateStr = dueDate.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

      // Create PDF from scratch with pdf-lib (pixel-perfect layout matching the WM Rechnung)
      const pdfDoc = await PDFLib.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageH = 841.89;
      const pageW = 595.28;
      const leftM = 56;
      const rightM = 56;
      const contentW = pageW - leftM - rightM;

      // Helper to draw text (y from top)
      const drawText = (text: string, x: number, yFromTop: number, opts: { font?: typeof helvetica, size?: number, color?: [number, number, number], maxWidth?: number } = {}) => {
        const font = opts.font ?? helvetica;
        const size = opts.size ?? 10;
        const color = opts.color ?? [0, 0, 0];
        page.drawText(text, {
          x,
          y: pageH - yFromTop,
          size,
          font,
          color: rgb(color[0], color[1], color[2]),
          maxWidth: opts.maxWidth,
        });
      };

      // Helper to draw right-aligned text
      const drawTextRight = (text: string, rightX: number, yFromTop: number, opts: { font?: typeof helvetica, size?: number, color?: [number, number, number] } = {}) => {
        const font = opts.font ?? helvetica;
        const size = opts.size ?? 10;
        const width = font.widthOfTextAtSize(text, size);
        drawText(text, rightX - width, yFromTop, opts);
      };

      // ═══ LOGO (if available) ═══
      let logoEndY = 42; // Default start for company text if no logo
      if (comp.logoUrl) {
        try {
          const logoResponse = await fetch(comp.logoUrl);
          const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
          const isPng = comp.logoUrl.toLowerCase().includes('.png');
          const logoImage = isPng
            ? await pdfDoc.embedPng(logoBytes)
            : await pdfDoc.embedJpg(logoBytes);

          // Scale logo to fit within 150x45 area
          const maxW = 150;
          const maxH = 45;
          const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
          const logoW = logoImage.width * scale;
          const logoH = logoImage.height * scale;

          page.drawImage(logoImage, {
            x: leftM,
            y: pageH - 42 - logoH,
            width: logoW,
            height: logoH,
          });
          logoEndY = 42 + logoH + 8;
        } catch {
          // Logo loading failed, continue without logo
        }
      }

      // ═══ COMPANY HEADER (below logo) ═══
      let yPos = logoEndY;
      drawText(comp.companyName, leftM, yPos, { font: helveticaBold, size: 11 });
      yPos += 14;
      const compColor: [number, number, number] = [0.27, 0.27, 0.27];
      if (comp.street) { drawText(comp.street, leftM, yPos, { size: 8.5, color: compColor }); yPos += 11; }
      drawText(`${comp.zipCode ?? ''} ${comp.city ?? ''}`, leftM, yPos, { size: 8.5, color: compColor });
      yPos += 11;
      if (comp.phone) { drawText(`Tel: ${comp.phone}`, leftM, yPos, { size: 8.5, color: compColor }); yPos += 11; }
      if (comp.email) { drawText(comp.email, leftM, yPos, { size: 8.5, color: compColor }); yPos += 11; }

      // ═══ RECIPIENT ADDRESS (right side, window envelope position) ═══
      let addrY = 130;
      if (input.recipientTitle) {
        drawText(input.recipientTitle, 320, addrY, { size: 9 });
        addrY += 14;
      }
      drawText(input.recipientName, 320, addrY, { font: helveticaBold, size: 10 });
      addrY += 14;
      drawText(input.recipientStreet, 320, addrY, { size: 9 });
      addrY += 14;
      drawText(`${input.recipientZip} ${input.recipientCity}`, 320, addrY, { size: 9 });

      // ═══ DATE AND REFERENCE (right-aligned) ═══
      const grayColor: [number, number, number] = [0.4, 0.4, 0.4];
      drawTextRight(`${comp.city ?? 'Luzern'}, ${dateStr}`, pageW - rightM, 220, { size: 9, color: grayColor });
      if (referenceStr) {
        drawTextRight(`Referenz: ${referenceStr}`, pageW - rightM, 234, { size: 9, color: grayColor });
      }

      // ═══ SUBJECT LINE ═══
      drawText(input.invoiceSubject, leftM, 270, { font: helveticaBold, size: 14 });

      // ═══ SALUTATION & INTRO ═══
      let textY = 300;
      if (input.salutation) {
        drawText(input.salutation, leftM, textY, { size: 10 });
        textY += 20;
      }
      // Word-wrap intro text
      const introLines = wrapText(input.introText, helvetica, 10, contentW);
      for (const line of introLines) {
        drawText(line, leftM, textY, { size: 10 });
        textY += 14;
      }
      textY += 10;

      // ═══ LINE ITEMS TABLE ═══
      // Header
      drawText("Pos.", leftM, textY, { font: helveticaBold, size: 8.5, color: grayColor });
      drawText("Beschreibung", leftM + 35, textY, { font: helveticaBold, size: 8.5, color: grayColor });
      drawTextRight(input.currency, pageW - rightM, textY, { font: helveticaBold, size: 8.5, color: grayColor });
      textY += 12;
      // Header line
      page.drawLine({
        start: { x: leftM, y: pageH - textY },
        end: { x: pageW - rightM, y: pageH - textY },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      textY += 8;

      // Items
      input.lineItems.forEach((item, idx) => {
        drawText(`${idx + 1}.`, leftM, textY, { size: 9.5 });
        drawText(item.description, leftM + 35, textY, { size: 9.5 });
        drawTextRight(formatCHF(item.amount), pageW - rightM, textY, { size: 9.5 });
        textY += 18;
      });

      // Subtotal separator
      textY += 4;
      page.drawLine({
        start: { x: pageW - rightM - 200, y: pageH - textY },
        end: { x: pageW - rightM, y: pageH - textY },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      textY += 8;

      // Subtotal
      drawText("Zwischensumme", pageW - rightM - 200, textY, { size: 9 });
      drawTextRight(`${input.currency} ${formatCHF(subtotal)}`, pageW - rightM, textY, { size: 9 });
      textY += 16;

      // VAT
      if (input.vatRate > 0) {
        const vatLabel = comp.uid
          ? `MWST ${input.vatRate}% (MWST-Nr. ${comp.uid})`
          : `MWST ${input.vatRate}%`;
        drawText(vatLabel, pageW - rightM - 200, textY, { size: 9 });
        drawTextRight(`${input.currency} ${formatCHF(vatAmount)}`, pageW - rightM, textY, { size: 9 });
        textY += 16;
      }

      // Total separator
      page.drawLine({
        start: { x: pageW - rightM - 200, y: pageH - textY },
        end: { x: pageW - rightM, y: pageH - textY },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      textY += 8;

      // Total
      drawText("Total", pageW - rightM - 200, textY, { font: helveticaBold, size: 11 });
      drawTextRight(`${input.currency} ${formatCHF(total)}`, pageW - rightM, textY, { font: helveticaBold, size: 11 });
      textY += 28;

      // ═══ PAYMENT TERMS ═══
      drawText(`Zahlbar innert ${input.paymentDays} Tagen bis ${dueDateStr}.`, leftM, textY, { size: 9, color: grayColor });
      textY += 20;

      // ═══ CLOSING TEXT ═══
      const closingLines = wrapText(input.closingText, helvetica, 10, contentW);
      for (const line of closingLines) {
        drawText(line, leftM, textY, { size: 10 });
        textY += 14;
      }
      textY += 10;

      // ═══ GREETING & SIGNATURE ═══
      drawText(input.greeting, leftM, textY, { size: 10 });
      textY += 28;
      drawText(comp.companyName, leftM, textY, { font: helveticaBold, size: 10 });
      textY += 16;
      drawText(input.signerName, leftM, textY, { font: helveticaBold, size: 10 });
      if (input.signerTitle) {
        textY += 14;
        drawText(input.signerTitle, leftM, textY, { size: 9 });
      }

      // ═══ FOOTER ═══
      const footerParts = [comp.companyName];
      if (comp.street) footerParts.push(comp.street);
      if (comp.zipCode && comp.city) footerParts.push(`${comp.zipCode} ${comp.city}`);
      const footerLine1 = footerParts.join(', ');
      const footerParts2: string[] = [];
      if (comp.phone) footerParts2.push(comp.phone);
      if (comp.email) footerParts2.push(comp.email);
      if (comp.website) footerParts2.push(comp.website);
      const footerLine2 = footerParts2.join(', ');

      drawText(footerLine1, leftM, pageH - 22, { size: 7, color: grayColor });
      if (footerLine2) {
        drawText(footerLine2, leftM, pageH - 12, { size: 7, color: grayColor });
      }

      // Save the first page as bytes
      const invoiceBytes = await pdfDoc.save();

      // Now generate QR payment slip with pdfkit + swissqrbill
      const qrData: Data = {
        amount: total,
        currency: input.currency,
        creditor: {
          account: cleanIban,
          name: comp.companyName,
          address: comp.street ?? "",
          zip: parseInt(comp.zipCode ?? "0"),
          city: comp.city ?? "",
          country: "CH",
        },
        debtor: {
          name: input.recipientName,
          address: input.recipientStreet,
          zip: parseInt(input.recipientZip),
          city: input.recipientCity,
          country: input.recipientCountry,
        },
      };

      if (effectiveRefType === "QRR" && isQrIban) {
        qrData.reference = referenceStr;
      } else if (effectiveRefType === "SCOR" && referenceStr) {
        qrData.reference = referenceStr;
      }

      // Generate QR slip page with pdfkit
      const qrPdfDoc = new PDFDocument({ size: "A4", autoFirstPage: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      const qrChunks: Buffer[] = [];
      qrPdfDoc.on("data", (chunk: Buffer) => qrChunks.push(chunk));

      const qrBill = new SwissQRBill(qrData);
      qrBill.attachTo(qrPdfDoc);

      const qrPdfPromise = new Promise<Buffer>((resolve) => {
        qrPdfDoc.on("end", () => resolve(Buffer.concat(qrChunks)));
      });
      qrPdfDoc.end();
      const qrPdfBuffer = await qrPdfPromise;

      // Merge: invoice page + QR slip page
      const finalDoc = await PDFLib.load(invoiceBytes);
      const qrDoc = await PDFLib.load(qrPdfBuffer);
      const [qrPage] = await finalDoc.copyPages(qrDoc, [0]);
      finalDoc.addPage(qrPage);

      const finalBytes = await finalDoc.save();

      return {
        base64: Buffer.from(finalBytes).toString("base64"),
        filename: `Rechnung_${input.recipientName.replace(/\s+/g, "_")}_${invDate.toISOString().slice(0, 10)}.pdf`,
      };
    }),

});

// Helper: word-wrap text for pdf-lib
function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
