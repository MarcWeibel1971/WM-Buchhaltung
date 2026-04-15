import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { documents } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

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
  "totalAmount": Zahl oder null,
  "vatAmount": Zahl oder null,
  "vatRate": Zahl (z.B. 8.1) oder null,
  "currency": "CHF" oder andere,
  "counterparty": "Firmenname oder Person",
  "counterpartyIban": "IBAN oder null",
  "referenceNumber": "Referenznummer oder null",
  "description": "Kurzbeschreibung des Belegs (max 100 Zeichen)",
  "documentType": Einer der folgenden Werte (WICHTIG – wähle den passendsten!):
    - "invoice_in" = Eingangsrechnung (Rechnung von einem Lieferanten AN uns, z.B. Hostpoint, Gewerbe-Treuhand, Mobility, AXA, Velokurier etc.)
    - "invoice_out" = Ausgangsrechnung (Rechnung VON uns an einen Kunden)
    - "receipt" = Quittung/Kassenbeleg (Barbelege, Kassenbons)
    - "bank_statement" = Kontoauszug/Kreditkartenabrechnung (VISA, Bankauszug, Kreditkartenabrechnung)
    - "other" = nur wenn keiner der obigen Typen passt
  Hinweis: Die meisten Belege in einer KMU-Buchhaltung sind Eingangsrechnungen ("invoice_in") oder Kreditkartenabrechnungen ("bank_statement").
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
                  totalAmount: { type: ["number", "null"] },
                  vatAmount: { type: ["number", "null"] },
                  vatRate: { type: ["number", "null"] },
                  currency: { type: ["string", "null"] },
                  counterparty: { type: ["string", "null"] },
                  counterpartyIban: { type: ["string", "null"] },
                  referenceNumber: { type: ["string", "null"] },
                  description: { type: ["string", "null"] },
                  documentType: { type: ["string", "null"] },
                  suggestedAccount: { type: ["string", "null"] },
                  rawText: { type: ["string", "null"] },
                },
                required: ["documentDate", "totalAmount", "vatAmount", "vatRate", "currency", "counterparty", "counterpartyIban", "referenceNumber", "description", "documentType", "suggestedAccount", "rawText"],
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

    // Save to database
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Datenbank nicht verfügbar" });
    const [result] = await db.insert(documents).values({
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
