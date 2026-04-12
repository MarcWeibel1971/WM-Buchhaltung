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

    const { journalEntryId, bankTransactionId, documentType, notes } = req.body;

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
  "documentType": "invoice_in" (Eingangsrechnung) | "invoice_out" (Ausgangsrechnung) | "receipt" | "other",
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

    // Save to database
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Datenbank nicht verfügbar" });

    const [result] = await db.insert(documents).values({
      filename: req.file.originalname,
      s3Key,
      s3Url: url,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      documentType: (documentType as any) ?? "other",
      journalEntryId: journalEntryId ? parseInt(journalEntryId) : undefined,
      bankTransactionId: bankTransactionId ? parseInt(bankTransactionId) : undefined,
      extractedText,
      aiMetadata,
      notes: notes ?? null,
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
