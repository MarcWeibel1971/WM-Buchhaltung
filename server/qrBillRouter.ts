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
import { qrSettings, companySettings, employees, payrollEntries, bankAccounts, accounts } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
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

      // Build reference
      let reference: string | undefined = input.reference;
      if (!reference && qr.referenceType === "QRR") {
        reference = generateQRReference(input.journalEntryId ?? Date.now() % 100000, new Date().getFullYear());
      }

      // Build QR-Bill data
      const data: Data = {
        amount: input.amount,
        currency: input.currency,
        creditor: {
          account: qr.iban.replace(/\s/g, ""),
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

      if (reference && qr.referenceType === "QRR") {
        data.reference = formatQRRef(reference);
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
        amount: z.number().positive(),
        currency: z.string().default("CHF"),
        reference: z.string().optional(),
        remittanceInfo: z.string().optional(),
      })).optional(),
      // Execution date
      executionDate: z.string().optional(),
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
          <Nm>${escapeXml(p.creditorName)}</Nm>${p.creditorAddress ? `
          <PstlAdr>
            <StrtNm>${escapeXml(p.creditorAddress)}</StrtNm>${p.creditorZip ? `
            <PstCd>${escapeXml(p.creditorZip)}</PstCd>` : ""}${p.creditorCity ? `
            <TwnNm>${escapeXml(p.creditorCity)}</TwnNm>` : ""}
            <Ctry>CH</Ctry>
          </PstlAdr>` : ""}
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

      return {
        xml,
        filename,
        summary: {
          nbOfTxs,
          ctrlSum: parseFloat(ctrlSum),
          executionDate: execDate,
        },
      };
    }),
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
