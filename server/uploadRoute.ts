import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { documents } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { findOrCreateSupplierFromMetadata } from "./suppliersRouter";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Nur PDF, JPEG, PNG und WEBP erlaubt"));
  },
});

export const uploadRouter = Router();

// ─── POST /api/upload/document ────────────────────────────────────────────────
uploadRouter.post("/document", upload.single("file"), async (req, res) => {
  let user;
  try {
    user = await sdk.authenticateRequest(req as any);
  } catch {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }
  try {

    if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen" });

    const { journalEntryId, bankTransactionId, documentType, notes, fiscalYear } = req.body;

    // Generate unique S3 key
    const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "bin";
    const s3Key = `documents/${user.id}/${nanoid()}.${ext}`;

    // Upload to S3
    const { url } = await storagePut(s3Key, req.file.buffer, req.file.mimetype);

    // Extract text/metadata via LLM for AI categorization
    let extractedText: string | null = null;
    let aiMetadata: string | null = null;
    try {
      const fileUrl = url;
      const isPdf = req.file.mimetype === "application/pdf";
      const isImage = req.file.mimetype.startsWith("image/");

      if (isPdf || isImage) {
        const contentPart = isPdf
          ? { type: "file_url" as const, file_url: { url: fileUrl, mime_type: "application/pdf" as const } }
          : { type: "image_url" as const, image_url: { url: fileUrl, detail: "high" as const } };

        const extractResp = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du bist ein Schweizer Buchhalter. Extrahiere aus dem Beleg folgende Informationen als JSON:
{
  "documentDate": "YYYY-MM-DD oder null",
  "dueDate": "YYYY-MM-DD oder null (Fälligkeitsdatum / Zahlungsfrist)",
  "invoiceNumber": "Rechnungsnummer/Belegnummer oder null",
  "totalAmount": Zahl oder null,
  "netAmount": Zahl oder null (Nettobetrag ohne MWST),
  "vatAmount": Zahl oder null,
  "vatRate": Zahl (z.B. 8.1) oder null,
  "currency": "CHF" oder andere,
  "counterparty": "Firmenname oder Person",
  "counterpartyUid": "UID-Nummer (z.B. CHE-123.456.789) oder null",
  "counterpartyVatNumber": "MWST-Nummer oder null",
  "counterpartyStreet": "Strasse und Hausnummer oder null",
  "counterpartyZipCode": "PLZ oder null",
  "counterpartyCity": "Ort oder null",
  "counterpartyCountry": "Land oder null (Standard: Schweiz)",
  "counterpartyIban": "IBAN des Empfängers/Zahlungsempfängers – WICHTIG: Bei QR-Rechnungen steht die IBAN im Zahlteil unter 'Konto / Zahlbar an' (z.B. CH36 0900 0000 4070 5388 7). Diese IBAN IMMER extrahieren! Niemals null wenn ein Zahlteil/Empfangsschein vorhanden ist.",
  "qrReference": "QR-Referenz (26-27 stellig numerisch) oder SCOR-Referenz (RF...) oder null – aus dem QR-Einzahlungsschein/Zahlteil",
  "paymentMethod": "qr_bill, bank_transfer, cash, credit_card, direct_debit oder null",
  "referenceNumber": "Referenznummer: IMMER die QR-Referenz oder SCOR-Referenz (RF...) aus dem Zahlteil/Empfangsschein übernehmen falls vorhanden, sonst Rechnungsreferenz oder null",
  "description": "Kurzbeschreibung des Belegs (max 100 Zeichen)",
  "documentType": Einer der folgenden Werte (WICHTIG – wähle den passendsten!):
    - "invoice_in" = Eingangsrechnung (Rechnung von einem Lieferanten AN uns, z.B. Hostpoint, Gewerbe-Treuhand, Mobility, AXA Versicherung, Velokurier etc.)
    - "invoice_out" = Ausgangsrechnung (Rechnung VON uns an einen Kunden)
    - "receipt" = Quittung/Kassenbeleg (Barbelege, Kassenbons)
    - "bank_statement" = Kontoauszug einer Bank (Bankauszug, Kontobewegungen)
    - "credit_card_statement" = Kreditkartenabrechnung (VISA, Mastercard, Raiffeisen Kreditkarte, Viseca – enthält einzelne Kreditkarten-Positionen mit Datum/Betrag/Details = Sammelbuchung!)
    - "other" = nur wenn keiner der obigen Typen passt
  WICHTIG: Kreditkartenabrechnungen (Viseca, VISA, Mastercard) sind KEINE Kontoauszüge! Sie enthalten einzelne Positionen und müssen als "credit_card_statement" klassifiziert werden.
  Hinweis: Die meisten Belege in einer KMU-Buchhaltung sind Eingangsrechnungen ("invoice_in").
  "suggestedAccount": "Kontonummer aus Schweizer KMU-Kontenrahmen oder null",
  "rawText": "Vollständiger extrahierter Text des Belegs"
}
Antworte NUR mit dem JSON-Objekt, ohne Erklärungen.`,
            },
            {
              role: "user",
              content: [
                { type: "text" as const, text: "Analysiere diesen Beleg:" },
                contentPart,
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "document_extraction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  documentDate: { type: ["string", "null"] },
                  dueDate: { type: ["string", "null"] },
                  invoiceNumber: { type: ["string", "null"] },
                  totalAmount: { type: ["number", "null"] },
                  netAmount: { type: ["number", "null"] },
                  vatAmount: { type: ["number", "null"] },
                  vatRate: { type: ["number", "null"] },
                  currency: { type: ["string", "null"] },
                  counterparty: { type: ["string", "null"] },
                  counterpartyUid: { type: ["string", "null"] },
                  counterpartyVatNumber: { type: ["string", "null"] },
                  counterpartyStreet: { type: ["string", "null"] },
                  counterpartyZipCode: { type: ["string", "null"] },
                  counterpartyCity: { type: ["string", "null"] },
                  counterpartyCountry: { type: ["string", "null"] },
                  counterpartyIban: { type: ["string", "null"] },
                  qrReference: { type: ["string", "null"] },
                  paymentMethod: { type: ["string", "null"] },
                  referenceNumber: { type: ["string", "null"] },
                  description: { type: ["string", "null"] },
                  documentType: { type: ["string", "null"] },
                  suggestedAccount: { type: ["string", "null"] },
                  rawText: { type: ["string", "null"] },
                },
                required: ["documentDate", "dueDate", "invoiceNumber", "totalAmount", "netAmount", "vatAmount", "vatRate", "currency", "counterparty", "counterpartyUid", "counterpartyVatNumber", "counterpartyStreet", "counterpartyZipCode", "counterpartyCity", "counterpartyCountry", "counterpartyIban", "qrReference", "paymentMethod", "referenceNumber", "description", "documentType", "suggestedAccount", "rawText"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = extractResp.choices[0]?.message?.content;
        if (content) {
          aiMetadata = typeof content === "string" ? content : JSON.stringify(content);
          try {
            const parsed = JSON.parse(aiMetadata);
            extractedText = parsed.rawText ?? null;
          } catch { /* ignore */ }
        }
      }
    } catch (llmErr) {
      console.warn("[Document] LLM extraction failed:", llmErr);
    }

    // Determine document type: use explicit form value, or AI-detected type, or fallback to "other"
    const VALID_DOC_TYPES = ["invoice_in", "invoice_out", "receipt", "bank_statement", "other"];
    let detectedDocType = "other";
    if (documentType && VALID_DOC_TYPES.includes(documentType)) {
      detectedDocType = documentType;
    } else if (aiMetadata) {
      try {
        const parsed = JSON.parse(aiMetadata);
        if (parsed.documentType && VALID_DOC_TYPES.includes(parsed.documentType)) {
          detectedDocType = parsed.documentType;
        }
      } catch { /* ignore */ }
    }

     // Auto-generate a descriptive filename based on AI-extracted content
    let smartFilename = req.file.originalname;
    if (aiMetadata) {
      try {
        const parsed = JSON.parse(aiMetadata);
        const parts: string[] = [];
        if (parsed.counterparty) parts.push(parsed.counterparty.replace(/[^a-zA-Z0-9äöüÄÖÜéèàêâ\s\-\.]/g, '').trim());
        if (parsed.description) parts.push(parsed.description.replace(/[^a-zA-Z0-9äöüÄÖÜéèàêâ\s\-\.]/g, '').trim());
        if (parsed.documentDate) parts.push(parsed.documentDate);
        if (parts.length >= 2) {
          const ext = req.file.originalname.split('.').pop()?.toLowerCase() ?? 'pdf';
          smartFilename = parts.join(' - ').substring(0, 120) + '.' + ext;
        }
      } catch { /* keep original filename */ }
    }

    // Phase 1 Multi-Tenancy: Upload ist an die aktuelle Organisation des
    // Users gebunden. Ohne aktive Org wird der Upload abgelehnt.
    const orgId = user.currentOrganizationId;
    if (orgId == null) {
      return res.status(403).json({
        error: "Keine aktive Organisation. Bitte zuerst eine Organisation einrichten.",
      });
    }

    // Auto-create or link supplier for incoming invoices
    let autoSupplierId: number | undefined = undefined;
    if (detectedDocType === "invoice_in" && aiMetadata) {
      try {
        const tempDb = await getDb();
        if (tempDb) {
          const parsed = JSON.parse(aiMetadata);
          const supplierResult = await findOrCreateSupplierFromMetadata(orgId, parsed, tempDb);
          if (supplierResult) {
            autoSupplierId = supplierResult.supplierId;
            console.log(`[Upload] ${supplierResult.created ? 'Created' : 'Linked'} supplier #${supplierResult.supplierId} for invoice from ${parsed.counterparty}`);
          }
        }
      } catch (supplierErr) {
        console.warn("[Upload] Auto-supplier creation failed:", supplierErr);
      }
    }

    // Save to database
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Datenbank nicht verfügbar" });
    const [result] = await db.insert(documents).values({
      organizationId: orgId,
      filename: smartFilename,
      s3Key,
      s3Url: url,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      documentType: detectedDocType as any,
      journalEntryId: journalEntryId ? parseInt(journalEntryId) : undefined,
      bankTransactionId: bankTransactionId ? parseInt(bankTransactionId) : undefined,
      extractedText,
      aiMetadata,
      notes: notes ?? null,
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
      supplierId: autoSupplierId,
      uploadedBy: user.id,
    });

    const docId = (result as any).insertId;

    // Return the saved document
    const [saved] = await db.select().from(documents).where(eq(documents.id, docId));
    return res.json({ success: true, document: saved });
  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return res.status(500).json({ error: err.message ?? "Upload fehlgeschlagen" });
  }
});

// ─── DELETE /api/upload/document/:id ─────────────────────────────────────────
uploadRouter.delete("/document/:id", async (req, res) => {
  let user;
  try {
    user = await sdk.authenticateRequest(req as any);
  } catch {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }
  try {

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Datenbank nicht verfügbar" });

    const docId = parseInt(req.params.id);
    await db.delete(documents).where(eq(documents.id, docId));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/upload/bank-statement-pdf ─────────────────────────────────────
// Accepts a PDF bank statement, extracts transactions via LLM, returns them
// as ParsedTransaction objects for the frontend to review and import.
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Nur PDF-Dateien erlaubt"));
  },
});

uploadRouter.post("/bank-statement-pdf", pdfUpload.single("file"), async (req, res) => {
  let user;
  try {
    user = await sdk.authenticateRequest(req as any);
  } catch {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }

  if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen" });

  try {
    // Upload PDF to S3 to get a URL for LLM processing
    const fileKey = `bank-statements/${user.id}-${nanoid()}.pdf`;
    const { url: fileUrl } = await storagePut(fileKey, req.file.buffer, "application/pdf");

    // Extract transactions via LLM (vision model reads the PDF)
    const extractResp = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Du bist ein Schweizer Buchhalter und analysierst Bankauszüge der Luzerner Kantonalbank (LUKB).
Extrahiere ALLE Transaktionen aus dem Kontoauszug.
Jede Transaktion hat:
- transactionDate: "YYYY-MM-DD" (Buchungsdatum, zwingend)
- valueDate: "YYYY-MM-DD" oder null
- amount: Zahl (positiv = Gutschrift/Eingang, negativ = Belastung/Ausgang)
- currency: "CHF"
- description: Buchungstext (max 200 Zeichen)
- reference: Referenznummer oder null
- counterparty: Name Auftraggeber/Empfänger oder null
- counterpartyIban: IBAN oder null
Antworte NUR mit JSON: { "transactions": [...], "accountNumber": "IBAN", "statementPeriod": "z.B. Januar 2026" }`,
        },
        {
          role: "user",
          content: [
            { type: "text" as const, text: "Extrahiere alle Transaktionen aus diesem Kontoauszug:" },
            { type: "file_url" as const, file_url: { url: fileUrl, mime_type: "application/pdf" as const } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bank_statement_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              transactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    transactionDate: { type: "string" },
                    valueDate: { type: ["string", "null"] },
                    amount: { type: "number" },
                    currency: { type: "string" },
                    description: { type: "string" },
                    reference: { type: ["string", "null"] },
                    counterparty: { type: ["string", "null"] },
                    counterpartyIban: { type: ["string", "null"] },
                  },
                  required: ["transactionDate", "valueDate", "amount", "currency", "description", "reference", "counterparty", "counterpartyIban"],
                  additionalProperties: false,
                },
              },
              accountNumber: { type: ["string", "null"] },
              statementPeriod: { type: ["string", "null"] },
            },
            required: ["transactions", "accountNumber", "statementPeriod"],
            additionalProperties: false,
          },
        },
      },
    });

    const msgContent = extractResp.choices[0]?.message?.content;
    if (!msgContent) return res.status(500).json({ error: "KI-Extraktion fehlgeschlagen" });

    const parsed = typeof msgContent === "string" ? JSON.parse(msgContent) : msgContent;

    // Normalise dates using the same function as the CSV/CAMT parser
    const { normaliseDate } = await import("../shared/bankParser.js");
    const transactions = (parsed.transactions ?? [])
      .map((tx: any) => ({
        transactionDate: normaliseDate(String(tx.transactionDate ?? "")),
        valueDate: tx.valueDate ? normaliseDate(String(tx.valueDate)) : null,
        amount: typeof tx.amount === "number" ? tx.amount.toFixed(2) : String(tx.amount ?? "0"),
        currency: tx.currency || "CHF",
        description: tx.description || "PDF Import",
        reference: tx.reference || null,
        counterparty: tx.counterparty || null,
        counterpartyIban: tx.counterpartyIban || null,
      }))
      .filter((tx: any) => tx.transactionDate !== null);

    return res.json({
      success: true,
      transactions,
      accountNumber: parsed.accountNumber ?? null,
      statementPeriod: parsed.statementPeriod ?? null,
      totalExtracted: transactions.length,
      fileKey,
      fileUrl,
    });
  } catch (err: any) {
    console.error("[PDF Bank Import] Error:", err);
    return res.status(500).json({ error: err.message ?? "PDF-Verarbeitung fehlgeschlagen" });
  }
});

// ─── PDF Chart of Accounts Import ──────────────────────────────────────────────
const chartPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Nur PDF- oder Bild-Dateien erlaubt"));
  },
});

uploadRouter.post("/chart-of-accounts-pdf", chartPdfUpload.single("file"), async (req, res) => {
  let user;
  try {
    user = await sdk.authenticateRequest(req as any);
  } catch {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }

  if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen" });

  try {
    // Upload to S3 to get a URL for LLM processing
    const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "pdf";
    const fileKey = `chart-of-accounts/${user.id}-${nanoid()}.${ext}`;
    const { url: fileUrl } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);

    const isPdf = req.file.mimetype === "application/pdf";
    const isImage = req.file.mimetype.startsWith("image/");

    // Extract chart of accounts via LLM
    const extractResp = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Du bist ein Schweizer Buchhalter und extrahierst einen Kontenplan aus einem Dokument.
Extrahiere ALLE Konten (keine Gruppen/Überschriften, nur buchbare Konten mit 4-stelliger Nummer).
Jedes Konto hat:
- number: Kontonummer als String (z.B. "1000", "4000")
- name: Kontobezeichnung (z.B. "Kasse", "Materialaufwand")
- accountType: Einer von: "asset" (Aktiv, 1000-1999), "liability" (Passiv, 2000-2799), "equity" (Eigenkapital, 2800-2999 und 9000+), "revenue" (Ertrag, 3000-3999), "expense" (Aufwand, 4000-8999)

Regeln:
- Nur Konten mit mindestens 4-stelliger Nummer extrahieren (keine Gruppen wie 1, 10, 100)
- Kontonummern müssen numerisch sein
- Ignoriere Gruppenüberschriften, Summenzeilen und Leerzeilen
- Wenn das Dokument Spalten wie "Soll" oder "Haben" mit Beträgen hat, ignoriere die Beträge

Antworte NUR mit JSON: { "accounts": [...], "totalFound": number, "documentTitle": "string oder null" }`,
        },
        {
          role: "user",
          content: [
            { type: "text" as const, text: "Extrahiere alle Konten aus diesem Kontenplan:" },
            isPdf
              ? { type: "file_url" as const, file_url: { url: fileUrl, mime_type: "application/pdf" as const } }
              : { type: "image_url" as const, image_url: { url: fileUrl, detail: "high" as const } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "chart_of_accounts_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              accounts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    number: { type: "string" },
                    name: { type: "string" },
                    accountType: { type: "string", enum: ["asset", "liability", "equity", "revenue", "expense"] },
                  },
                  required: ["number", "name", "accountType"],
                  additionalProperties: false,
                },
              },
              totalFound: { type: "number" },
              documentTitle: { type: ["string", "null"] },
            },
            required: ["accounts", "totalFound", "documentTitle"],
            additionalProperties: false,
          },
        },
      },
    });

    const msgContent = extractResp.choices[0]?.message?.content;
    if (!msgContent) return res.status(500).json({ error: "KI-Extraktion fehlgeschlagen" });

    const parsed = typeof msgContent === "string" ? JSON.parse(msgContent) : msgContent;

    // Validate and clean accounts
    const accounts = (parsed.accounts ?? [])
      .filter((a: any) => {
        const num = parseInt(a.number);
        return !isNaN(num) && num >= 1000 && a.name && a.name.trim().length > 0;
      })
      .map((a: any) => ({
        number: String(a.number).trim(),
        name: String(a.name).trim(),
        accountType: a.accountType || "expense",
      }));

    return res.json({
      success: true,
      accounts,
      totalFound: accounts.length,
      documentTitle: parsed.documentTitle ?? null,
    });
  } catch (err: any) {
    console.error("[PDF Chart Import] Error:", err);
    return res.status(500).json({ error: err.message ?? "PDF-Verarbeitung fehlgeschlagen" });
  }
});

// ─── POST /api/upload/opening-balance-pdf ──────────────────────────────────────
// Accepts a PDF or image of an opening balance sheet, extracts account balances via LLM
const openingBalancePdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Nur PDF- oder Bild-Dateien erlaubt"));
  },
});

uploadRouter.post("/opening-balance-pdf", openingBalancePdfUpload.single("file"), async (req, res) => {
  let user;
  try {
    user = await sdk.authenticateRequest(req as any);
  } catch {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }

  if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen" });

  try {
    const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "pdf";
    const fileKey = `opening-balances/${user.id}-${nanoid()}.${ext}`;
    const { url: fileUrl } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);

    const isPdf = req.file.mimetype === "application/pdf";

    const extractResp = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Du bist ein Schweizer Buchhalter und extrahierst Eröffnungssalden aus einer Bilanz oder Eröffnungsbilanz.
Extrahiere ALLE Konten mit ihren Salden.
Jedes Konto hat:
- number: Kontonummer als String (z.B. "1000", "2000")
- name: Kontobezeichnung (z.B. "Kasse", "Bankguthaben")
- balance: Saldo als Zahl (immer positiv, auch für Passivkonten)
- accountType: Einer von: "asset" (Aktiven, 1000-1999), "liability" (Fremdkapital, 2000-2799), "equity" (Eigenkapital, 2800-2999 und 9000+)

Regeln:
- Nur Konten mit Kontonummer extrahieren (mindestens 3-stellig)
- Konten mit Saldo 0 können weggelassen werden
- Ignoriere Summenzeilen und Gruppenüberschriften
- Beträge in CHF, ohne Tausendertrennzeichen

Antworte NUR mit JSON: { "balances": [...], "totalAssets": number, "totalLiabilities": number, "fiscalYear": "YYYY oder null" }`,
        },
        {
          role: "user",
          content: [
            { type: "text" as const, text: "Extrahiere alle Eröffnungssalden aus dieser Bilanz:" },
            isPdf
              ? { type: "file_url" as const, file_url: { url: fileUrl, mime_type: "application/pdf" as const } }
              : { type: "image_url" as const, image_url: { url: fileUrl, detail: "high" as const } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "opening_balance_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              balances: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    number: { type: "string" },
                    name: { type: "string" },
                    balance: { type: "number" },
                    accountType: { type: "string", enum: ["asset", "liability", "equity"] },
                  },
                  required: ["number", "name", "balance", "accountType"],
                  additionalProperties: false,
                },
              },
              totalAssets: { type: "number" },
              totalLiabilities: { type: "number" },
              fiscalYear: { type: ["string", "null"] },
            },
            required: ["balances", "totalAssets", "totalLiabilities", "fiscalYear"],
            additionalProperties: false,
          },
        },
      },
    });

    const msgContent = extractResp.choices[0]?.message?.content;
    if (!msgContent) return res.status(500).json({ error: "KI-Extraktion fehlgeschlagen" });

    const parsed = typeof msgContent === "string" ? JSON.parse(msgContent) : msgContent;

    const balances = (parsed.balances ?? [])
      .filter((b: any) => b.number && b.name && typeof b.balance === "number" && b.balance !== 0)
      .map((b: any) => ({
        number: String(b.number).trim(),
        name: String(b.name).trim(),
        balance: Math.abs(b.balance),
        accountType: b.accountType || "asset",
      }));

    return res.json({
      success: true,
      balances,
      totalFound: balances.length,
      totalAssets: parsed.totalAssets ?? 0,
      totalLiabilities: parsed.totalLiabilities ?? 0,
      fiscalYear: parsed.fiscalYear ?? null,
    });
  } catch (err: any) {
    console.error("[PDF Opening Balance Import] Error:", err);
    return res.status(500).json({ error: err.message ?? "PDF-Verarbeitung fehlgeschlagen" });
  }
});

// ─── POST /api/upload/voice ────────────────────────────────────────────────────
// Accepts audio files for voice transcription (max 16MB)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accept any audio/* MIME type (including audio/webm;codecs=opus)
    if (file.mimetype.startsWith("audio/")) cb(null, true);
    else cb(new Error("Nur Audio-Dateien erlaubt"));
  },
});

uploadRouter.post("/voice", audioUpload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Keine Audio-Datei hochgeladen" });
    }
    const ext = req.file.mimetype.includes("webm") ? "webm"
      : req.file.mimetype.includes("wav") ? "wav"
      : req.file.mimetype.includes("ogg") ? "ogg"
      : req.file.mimetype.includes("mp4") || req.file.mimetype.includes("m4a") ? "m4a"
      : "mp3";
    const key = `voice-recordings/${nanoid()}.${ext}`;
    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
    return res.json({ url, key });
  } catch (err: any) {
    console.error("[Voice Upload] Error:", err);
    return res.status(500).json({ error: err.message ?? "Audio-Upload fehlgeschlagen" });
  }
});

// ─── POST /api/upload/transcribe ──────────────────────────────────────────────
// Accepts audio files and transcribes them DIRECTLY via Whisper API (no S3 roundtrip)
uploadRouter.post("/transcribe", audioUpload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Keine Audio-Datei hochgeladen" });
    }

    const { ENV } = await import("./_core/env.js");

    const ext = req.file.mimetype.includes("webm") ? "webm"
      : req.file.mimetype.includes("wav") ? "wav"
      : req.file.mimetype.includes("ogg") ? "ogg"
      : req.file.mimetype.includes("mp4") || req.file.mimetype.includes("m4a") ? "m4a"
      : "mp3";

    // Build multipart form for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
    formData.append("file", audioBlob, `audio.${ext}`);
    formData.append("model", "whisper-1");
    formData.append("response_format", "json");
    formData.append("language", "de");
    formData.append("prompt", "Buchhaltung Schweiz MWST Buchung Konto");

    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    const whisperUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

    console.log("[Transcribe] Sending audio to Whisper:", whisperUrl, "size:", req.file.size);

    const response = await fetch(whisperUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[Transcribe] Whisper error:", response.status, errorText);
      return res.status(500).json({ error: `Transkription fehlgeschlagen: ${response.status} ${errorText}` });
    }

    const result = await response.json() as { text: string };
    console.log("[Transcribe] Result:", result.text?.substring(0, 100));
    return res.json({ text: result.text ?? "" });
  } catch (err: any) {
    console.error("[Transcribe] Error:", err);
    return res.status(500).json({ error: err.message ?? "Transkription fehlgeschlagen" });
  }
});
