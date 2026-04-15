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

      // Build a set of document IDs that are matched to bank transactions
      // A document is considered "paid" if it has a matched bank transaction
      // (regardless of whether the transaction is already verbucht/journalEntryId)
      const paidDocIds = new Set(
        allTxs
          .filter(tx => tx.matchedDocumentId && tx.matchedDocumentId > 0)
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
        // - matched to a bank transaction (matchedDocumentId in bank_transactions)
        // - document matchStatus is 'matched' (auto-matched or manually matched)
        // - manually marked as paid (matchStatus = 'manual')
        // - included in a pain.001 export (matchStatus = 'pain001')
        const isPaid = paidDocIds.has(doc.id) || doc.matchStatus === "matched" || doc.matchStatus === "manual" || doc.matchStatus === "pain001";

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
  // Layout matches WMRechnungBeratung2025_Vorlagemw.pdf exactly
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
      const fontkit = await import('@pdf-lib/fontkit');
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
      const [yyyy, mmPart, dd] = input.invoiceDate.split('-').map(Number);
      const invDate = new Date(yyyy, mmPart - 1, dd);
      const dateStr = invDate.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });
      const dueDate = new Date(yyyy, mmPart - 1, dd);
      dueDate.setDate(dueDate.getDate() + input.paymentDays);

      // ═══════════════════════════════════════════════════════════════════════════
      // PDF CREATION – Pixel-perfect layout matching WMRechnungBeratung2025
      // ═══════════════════════════════════════════════════════════════════════════
      const pdfDoc = await PDFLib.create();
      pdfDoc.registerFontkit(fontkit);
      const page = pdfDoc.addPage([595.28, 841.89]); // A4

      // Load ZwoOT fonts from CDN
      const FONT_BOLD_URL = "https://d2xsxph8kpxj0f.cloudfront.net/114467201/g3uYPYRzWxJLqW5bmLAtac/ZwoOT-Bold_67c9f790.otf";
      const FONT_LIGHT_URL = "https://d2xsxph8kpxj0f.cloudfront.net/114467201/g3uYPYRzWxJLqW5bmLAtac/ZwoOT-Light_04794056.otf";

      let fontBold: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
      let fontLight: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
      try {
        const [boldRes, lightRes] = await Promise.all([fetch(FONT_BOLD_URL), fetch(FONT_LIGHT_URL)]);
        const [boldBytes, lightBytes] = await Promise.all([boldRes.arrayBuffer(), lightRes.arrayBuffer()]);
        fontBold = await pdfDoc.embedFont(new Uint8Array(boldBytes));
        fontLight = await pdfDoc.embedFont(new Uint8Array(lightBytes));
      } catch {
        fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        fontLight = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }

      // ── Measurements from Briefblatt_Vermassung.pdf ──
      // 1mm = 2.8346pt, A4 = 595.28 x 841.89 pt
      const mm = 2.8346;
      const pageH = 841.89;
      const pageW = 595.28;
      const leftM = 25 * mm;   // 25mm left margin = 70.87pt
      const rightEdge = pageW - 20 * mm; // right text boundary
      const contentW = rightEdge - leftM;

      type FontType = typeof fontBold;
      // Dark charcoal matching the WM brand (from logo)
      const darkColor: [number, number, number] = [0.24, 0.27, 0.30];
      const lightGray: [number, number, number] = [0.45, 0.47, 0.49];

      // Helper: draw text (yFromTop = mm from top of page)
      const drawT = (text: string, x: number, yMm: number, opts: { font?: FontType, size?: number, color?: [number, number, number] } = {}) => {
        const font = opts.font ?? fontLight;
        const size = opts.size ?? 10;
        const color = opts.color ?? darkColor;
        page.drawText(text, { x, y: pageH - yMm * mm, size, font, color: rgb(color[0], color[1], color[2]) });
      };

      // Helper: draw right-aligned text
      const drawTR = (text: string, yMm: number, opts: { font?: FontType, size?: number, color?: [number, number, number] } = {}) => {
        const font = opts.font ?? fontLight;
        const size = opts.size ?? 10;
        const w = font.widthOfTextAtSize(text, size);
        drawT(text, rightEdge - w, yMm, opts);
      };

      // Helper: draw centered text
      const drawTC = (text: string, yMm: number, opts: { font?: FontType, size?: number, color?: [number, number, number] } = {}) => {
        const font = opts.font ?? fontLight;
        const size = opts.size ?? 10;
        const w = font.widthOfTextAtSize(text, size);
        drawT(text, (pageW - w) / 2, yMm, opts);
      };

      // Helper: draw a horizontal line
      const drawLine = (x1: number, x2: number, yMm: number, thickness = 0.5, color: [number, number, number] = [0.7, 0.7, 0.7]) => {
        page.drawLine({
          start: { x: x1, y: pageH - yMm * mm },
          end: { x: x2, y: pageH - yMm * mm },
          thickness,
          color: rgb(color[0], color[1], color[2]),
        });
      };

      // ═══ 1. LOGO – centered at top, within 46.5mm area ═══
      if (comp.logoUrl) {
        try {
          const logoResponse = await fetch(comp.logoUrl);
          const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
          const isPng = comp.logoUrl.toLowerCase().includes('.png');
          const logoImage = isPng
            ? await pdfDoc.embedPng(logoBytes)
            : await pdfDoc.embedJpg(logoBytes);

          // Logo should be ~160pt wide, centered, starting ~12mm from top
          const maxLogoW = 180;
          const maxLogoH = 70;
          const scale = Math.min(maxLogoW / logoImage.width, maxLogoH / logoImage.height);
          const logoW = logoImage.width * scale;
          const logoH = logoImage.height * scale;

          page.drawImage(logoImage, {
            x: (pageW - logoW) / 2,
            y: pageH - 10 * mm - logoH,
            width: logoW,
            height: logoH,
          });
        } catch {
          // Logo loading failed, continue without
        }
      }

      // ═══ 2. RECIPIENT ADDRESS – left side, starting at ~50mm from top ═══
      // Per Briefblatt: address window at 46.5mm from top, left margin 25mm
      let addrY = 50; // mm from top
      if (input.recipientTitle) {
        drawT(input.recipientTitle, leftM, addrY);
        addrY += 5; // 14pt ≈ 5mm
      }
      drawT(input.recipientName, leftM, addrY);
      addrY += 5;
      drawT(input.recipientStreet, leftM, addrY);
      addrY += 5;
      drawT(`${input.recipientZip} ${input.recipientCity}`, leftM, addrY);

      // ═══ 3. DATE – left-aligned, ~85mm from top ═══
      const city = comp.city ?? 'Luzern';
      drawT(`${city}, ${dateStr}`, leftM, 85);

      // ═══ 4. SUBJECT LINE – bold, ~100mm from top ═══
      drawT(input.invoiceSubject, leftM, 100, { font: fontBold, size: 12 });

      // ═══ 5. PERSONAL GREETING – ~110mm from top ═══
      let bodyY = 110; // mm from top
      if (input.salutation) {
        drawT(input.salutation, leftM, bodyY);
        bodyY += 7;
      }

      // ═══ 6. INTRO TEXT – word-wrapped, 10pt, 14pt leading (~5mm) ═══
      const introLines = wrapText(input.introText, fontLight, 10, contentW);
      for (const line of introLines) {
        drawT(line, leftM, bodyY);
        bodyY += 5; // 14pt ≈ 5mm
      }
      bodyY += 4;

      // ═══ 7. LINE ITEMS – matching original template exactly ═══
      // Format: "Description" left, "CHF" + amount right-aligned
      // Amount column: right-aligned at rightEdge
      // Currency column: ~25mm before amount right edge
      const amtColRight = rightEdge; // right edge for amounts
      const curColRight = rightEdge - 55; // "CHF" column

      for (let i = 0; i < input.lineItems.length; i++) {
        const item = input.lineItems[i];
        drawT(item.description, leftM, bodyY);
        drawTR(formatCHF(item.amount), bodyY);
        // Draw "CHF" before the amount
        drawT(input.currency, curColRight, bodyY);
        bodyY += 5;
      }

      // ═══ 8. VAT LINE ═══
      if (input.vatRate > 0) {
        const vatLabel = `Mehrwertsteuer ${input.vatRate}% (MWST-Nr. ${comp.uid ?? 'CHE-101.177.334'})`;
        drawT(vatLabel, leftM, bodyY);
        drawT(input.currency, curColRight, bodyY);
        drawTR(formatCHF(vatAmount), bodyY);
        // Underline below VAT amount
        bodyY += 1.5;
        drawLine(curColRight - 5, rightEdge, bodyY, 0.5, darkColor);
        bodyY += 4;
      }

      // ═══ 9. TOTAL LINE – "Saldo zu unseren Gunsten" bold ═══
      drawT("Saldo zu unseren Gunsten", leftM, bodyY, { font: fontBold });
      drawT(input.currency, curColRight, bodyY, { font: fontBold });
      drawTR(formatCHF(total), bodyY, { font: fontBold });
      // Double underline below total
      bodyY += 1.5;
      drawLine(curColRight - 5, rightEdge, bodyY, 0.8, darkColor);
      drawLine(curColRight - 5, rightEdge, bodyY + 0.8, 0.8, darkColor);
      bodyY += 6;

      // ═══ 10. CLOSING TEXT with IBAN ═══
      // Format IBAN with spaces for readability
      const ibanFormatted = cleanIban.replace(/(.{4})/g, '$1 ').trim();
      // Build closing text that includes IBAN reference like the original template
      const closingWithIban = input.closingText.includes('IBAN')
        ? input.closingText
        : `Ich bitte Dich, diesen Betrag auf unser Konto, IBAN ${ibanFormatted}, zu überweisen. ${input.closingText}`;
      const closingLines = wrapText(closingWithIban, fontLight, 10, contentW);
      for (const line of closingLines) {
        drawT(line, leftM, bodyY);
        bodyY += 5;
      }
      bodyY += 6;

      // ═══ 11. GREETING & SIGNATURE ═══
      drawT(input.greeting, leftM, bodyY);
      bodyY += 7;
      // Company name line (like "WM Weibel Mueller AG")
      drawT(comp.companyName, leftM, bodyY);
      bodyY += 12;
      // Signer name + title
      drawT(input.signerName, leftM, bodyY);
      if (input.signerTitle) {
        bodyY += 5;
        drawT(input.signerTitle, leftM, bodyY);
      }

      // ═══ 12. QR CODE IMAGE – centered, near bottom ═══
      const QR_CODE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/114467201/g3uYPYRzWxJLqW5bmLAtac/QRCodeMW_d48c71fc.png";
      try {
        const qrResponse = await fetch(QR_CODE_URL);
        const qrBytes = new Uint8Array(await qrResponse.arrayBuffer());
        const qrImage = await pdfDoc.embedPng(qrBytes);
        const qrSize = 70; // 70pt ≈ 25mm
        page.drawImage(qrImage, {
          x: (pageW - qrSize) / 2,
          y: pageH - 255 * mm,
          width: qrSize,
          height: qrSize,
        });
      } catch {
        // QR code loading failed, skip
      }

      // ═══ 13. FOOTER – centered with divider line ═══
      const footerY = 275; // mm from top
      // Divider line
      drawLine(leftM + 80, rightEdge - 80, footerY - 3, 0.5, lightGray);
      // Footer line 1: Company name + description + address
      const footerLine1 = `${comp.companyName}, Finanzberatung, ${comp.street ?? 'Grendelstrasse 2'}, ${comp.zipCode ?? '6004'} ${city}`;
      drawTC(footerLine1, footerY, { size: 7, color: darkColor });
      // Footer line 2: Phone + email + website
      const footerParts2: string[] = [];
      if (comp.phone) footerParts2.push(comp.phone);
      if (comp.email) footerParts2.push(comp.email);
      if (comp.website) footerParts2.push(comp.website);
      const footerLine2 = footerParts2.join(', ');
      if (footerLine2) {
        drawTC(footerLine2, footerY + 3.5, { size: 7, color: lightGray });
      }

      // Save the first page as bytes
      const invoiceBytes = await pdfDoc.save();

      // ═══ PAGE 2: QR PAYMENT SLIP (swissqrbill) ═══
      const qrData: Data = {
        amount: total,
        currency: input.currency,
        creditor: {
          account: cleanIban,
          name: comp.companyName,
          address: comp.street ?? "",
          zip: parseInt(comp.zipCode ?? "0"),
          city: city,
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

  // ─── CAMT.054 Import & Reconciliation ────────────────────────────────────

  importCamt054: protectedProcedure
    .input(z.object({
      xmlContent: z.string(),
      filename: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { parseCAMT054, isCAMT054 } = await import("../shared/camt054Parser");
      
      if (!isCAMT054(input.xmlContent)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Die Datei ist keine gültige CAMT.054 Datei" });
      }
      
      const notification = parseCAMT054(input.xmlContent);
      
      if (notification.entries.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Keine Zahlungsbestätigungen in der Datei gefunden" });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      let matched = 0;
      let unmatched = 0;
      const matchResults: Array<{
        endToEndId: string | undefined;
        amount: number;
        creditorName: string | undefined;
        bookingDate: string;
        status: "matched" | "unmatched";
        documentId?: number;
      }> = [];
      
      for (const entry of notification.entries) {
        if (entry.creditDebitIndicator !== "DBIT") continue;
        
        let wasMatched = false;
        
        // Get all pending pain.001 documents
        const pendingDocs = await db.select().from(documents)
          .where(and(
            eq(documents.matchStatus, "pain001"),
            eq(documents.documentType, "invoice_in")
          ));
        
        // Match by amount (within 0.02 tolerance) and optionally creditor name
        for (const doc of pendingDocs) {
          // Extract amount and counterparty from aiMetadata JSON
          let docAmount = 0;
          let docCounterparty = "";
          if (doc.aiMetadata) {
            try {
              const meta = JSON.parse(doc.aiMetadata);
              docAmount = Math.abs(Number(meta.amount || meta.totalAmount || 0));
              docCounterparty = meta.counterparty || meta.senderName || "";
            } catch {}
          }
          const entryAmount = Math.abs(entry.amount);
          
          const amountMatches = Math.abs(docAmount - entryAmount) < 0.02;
          const nameMatches = !entry.creditorName || !docCounterparty || 
            docCounterparty.toLowerCase().includes(entry.creditorName.toLowerCase()) ||
            entry.creditorName.toLowerCase().includes(docCounterparty.toLowerCase());
          
          if (amountMatches && nameMatches) {
            await db.update(documents).set({
              matchStatus: "matched",
            }).where(eq(documents.id, doc.id));
            
            matched++;
            wasMatched = true;
            matchResults.push({
              endToEndId: entry.endToEndId,
              amount: entry.amount,
              creditorName: entry.creditorName,
              bookingDate: entry.bookingDate,
              status: "matched",
              documentId: doc.id,
            });
            break;
          }
        }
        
        if (!wasMatched) {
          unmatched++;
          matchResults.push({
            endToEndId: entry.endToEndId,
            amount: entry.amount,
            creditorName: entry.creditorName,
            bookingDate: entry.bookingDate,
            status: "unmatched",
          });
        }
      }
      
      return {
        messageId: notification.messageId,
        totalEntries: notification.entries.length,
        debitEntries: notification.entries.filter(e => e.creditDebitIndicator === "DBIT").length,
        matched,
        unmatched,
        results: matchResults,
      };
    }),

  getReconciliationStatus: protectedProcedure
    .input(z.object({
      fiscalYear: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const conditions: any[] = [eq(documents.documentType, "invoice_in")];
      if (input.fiscalYear) conditions.push(eq(documents.fiscalYear, input.fiscalYear));
      
      const docs = await db.select({
        matchStatus: documents.matchStatus,
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`COUNT(*)`,
      }).from(documents)
        .where(and(...conditions))
        .groupBy(documents.matchStatus);
      
      return docs.map(d => ({
        status: d.matchStatus,
        count: Number(d.count),
        totalAmount: Number(d.totalAmount),
      }));
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
