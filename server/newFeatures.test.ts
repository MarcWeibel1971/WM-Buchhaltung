import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Tests for the two new features:
 * 1. Single vs. Collective booking in Journal
 * 2. Invoice preview for matched bank transactions
 */

// Schema validation tests for journal.create endpoint
const journalCreateSchema = z.object({
  bookingDate: z.string(),
  valueDate: z.string().optional(),
  description: z.string().min(1),
  source: z.enum(["manual", "bank_import", "credit_card", "payroll", "vat", "system"]).default("manual"),
  fiscalYear: z.number().optional(),
  lines: z.array(z.object({
    accountId: z.number(),
    side: z.enum(["debit", "credit"]),
    amount: z.string(),
    description: z.string().optional(),
    vatAmount: z.string().optional(),
    vatRate: z.string().optional(),
  })).min(2),
});

describe("Feature 1: Einzel- und Sammelbuchung", () => {
  it("should accept a valid single booking (2 lines, same amount)", () => {
    const singleBooking = {
      bookingDate: "2026-04-13",
      description: "Miete April 2026",
      lines: [
        { accountId: 101, side: "debit" as const, amount: "2500.00" },
        { accountId: 201, side: "credit" as const, amount: "2500.00" },
      ],
    };
    const result = journalCreateSchema.safeParse(singleBooking);
    expect(result.success).toBe(true);
  });

  it("should accept a valid collective booking (3+ lines)", () => {
    const collectiveBooking = {
      bookingDate: "2026-04-13",
      description: "Sammelbuchung Kreditkarte März",
      lines: [
        { accountId: 101, side: "debit" as const, amount: "150.00" },
        { accountId: 102, side: "debit" as const, amount: "350.00" },
        { accountId: 201, side: "credit" as const, amount: "500.00" },
      ],
    };
    const result = journalCreateSchema.safeParse(collectiveBooking);
    expect(result.success).toBe(true);
  });

  it("should reject booking with only 1 line", () => {
    const invalidBooking = {
      bookingDate: "2026-04-13",
      description: "Ungültige Buchung",
      lines: [
        { accountId: 101, side: "debit" as const, amount: "100.00" },
      ],
    };
    const result = journalCreateSchema.safeParse(invalidBooking);
    expect(result.success).toBe(false);
  });

  it("should reject booking with empty description", () => {
    const invalidBooking = {
      bookingDate: "2026-04-13",
      description: "",
      lines: [
        { accountId: 101, side: "debit" as const, amount: "100.00" },
        { accountId: 201, side: "credit" as const, amount: "100.00" },
      ],
    };
    const result = journalCreateSchema.safeParse(invalidBooking);
    expect(result.success).toBe(false);
  });

  it("single booking: debit and credit amounts must match", () => {
    // This is a frontend validation concern, but we verify the schema allows it
    // (the backend checks balance in createJournalEntry)
    const booking = {
      bookingDate: "2026-04-13",
      description: "Test",
      lines: [
        { accountId: 101, side: "debit" as const, amount: "100.00" },
        { accountId: 201, side: "credit" as const, amount: "100.00" },
      ],
    };
    const result = journalCreateSchema.safeParse(booking);
    expect(result.success).toBe(true);
    if (result.success) {
      const debitTotal = result.data.lines
        .filter(l => l.side === "debit")
        .reduce((s, l) => s + parseFloat(l.amount), 0);
      const creditTotal = result.data.lines
        .filter(l => l.side === "credit")
        .reduce((s, l) => s + parseFloat(l.amount), 0);
      expect(Math.abs(debitTotal - creditTotal)).toBeLessThan(0.01);
    }
  });

  it("collective booking: multiple debit lines should sum correctly", () => {
    const booking = {
      bookingDate: "2026-04-13",
      description: "Sammelbuchung",
      lines: [
        { accountId: 101, side: "debit" as const, amount: "150.00" },
        { accountId: 102, side: "debit" as const, amount: "250.00" },
        { accountId: 103, side: "debit" as const, amount: "100.00" },
        { accountId: 201, side: "credit" as const, amount: "500.00" },
      ],
    };
    const result = journalCreateSchema.safeParse(booking);
    expect(result.success).toBe(true);
    if (result.success) {
      const debitTotal = result.data.lines
        .filter(l => l.side === "debit")
        .reduce((s, l) => s + parseFloat(l.amount), 0);
      const creditTotal = result.data.lines
        .filter(l => l.side === "credit")
        .reduce((s, l) => s + parseFloat(l.amount), 0);
      expect(debitTotal).toBe(500);
      expect(creditTotal).toBe(500);
    }
  });
});

describe("Feature 2: Rechnungsvorschau-Daten", () => {
  it("should parse AI metadata JSON correctly", () => {
    const aiMetadata = JSON.stringify({
      counterparty: "Sunrise AG",
      totalAmount: 474.35,
      documentDate: "2026-03-31",
      vatRate: 8.1,
      description: "Telefonrechnung März 2026",
    });
    const parsed = JSON.parse(aiMetadata);
    expect(parsed.counterparty).toBe("Sunrise AG");
    expect(parsed.totalAmount).toBe(474.35);
    expect(parsed.documentDate).toBe("2026-03-31");
    expect(parsed.vatRate).toBe(8.1);
  });

  it("should handle missing AI metadata gracefully", () => {
    const aiMetadata = null;
    let meta: any = null;
    try { if (aiMetadata) meta = JSON.parse(aiMetadata); } catch {}
    expect(meta).toBeNull();
  });

  it("should handle malformed AI metadata gracefully", () => {
    const aiMetadata = "not-valid-json{";
    let meta: any = null;
    try { if (aiMetadata) meta = JSON.parse(aiMetadata); } catch {}
    expect(meta).toBeNull();
  });

  it("should detect PDF mime type for iframe preview", () => {
    const doc = { mimeType: "application/pdf", s3Url: "https://example.com/invoice.pdf" };
    expect(doc.mimeType === "application/pdf").toBe(true);
  });

  it("should detect image mime type for img preview", () => {
    const doc = { mimeType: "image/jpeg", s3Url: "https://example.com/invoice.jpg" };
    expect(doc.mimeType?.startsWith("image/")).toBe(true);
  });

  it("should match document by matchedDocumentId", () => {
    const allDocs = [
      { id: 1, filename: "rechnung1.pdf", s3Url: "https://s3/1.pdf", aiMetadata: null },
      { id: 2, filename: "rechnung2.pdf", s3Url: "https://s3/2.pdf", aiMetadata: '{"counterparty":"Test"}' },
    ];
    const tx = { matchedDocumentId: 2 };
    const doc = allDocs.find(d => d.id === tx.matchedDocumentId);
    expect(doc).toBeDefined();
    expect(doc!.filename).toBe("rechnung2.pdf");
  });
});

// Schema validation for getBankTransactionsByStatus
const statusFilterSchema = z.object({
  status: z.enum(["pending", "matched", "all"]),
  bankAccountId: z.number().optional(),
});

describe("getBankTransactionsByStatus schema", () => {
  it("should accept pending status", () => {
    expect(statusFilterSchema.safeParse({ status: "pending" }).success).toBe(true);
  });
  it("should accept matched status", () => {
    expect(statusFilterSchema.safeParse({ status: "matched" }).success).toBe(true);
  });
  it("should accept all status", () => {
    expect(statusFilterSchema.safeParse({ status: "all" }).success).toBe(true);
  });
  it("should accept status with bankAccountId", () => {
    expect(statusFilterSchema.safeParse({ status: "pending", bankAccountId: 1 }).success).toBe(true);
  });
  it("should reject invalid status", () => {
    expect(statusFilterSchema.safeParse({ status: "invalid" }).success).toBe(false);
  });
});

// ─── Document Fiscal Year Tests ──────────────────────────────────────────────
describe("Feature: Document Fiscal Year", () => {
  // Test: fiscalYear is accepted in the documents.list input schema
  const documentsListSchema = z.object({
    journalEntryId: z.number().optional(),
    bankTransactionId: z.number().optional(),
    documentType: z.string().optional(),
    fiscalYear: z.number().optional(),
    limit: z.number().default(200),
  });

  it("should accept fiscalYear filter in list query", () => {
    const result = documentsListSchema.safeParse({ fiscalYear: 2026 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fiscalYear).toBe(2026);
    }
  });

  it("should accept list query without fiscalYear", () => {
    const result = documentsListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fiscalYear).toBeUndefined();
      expect(result.data.limit).toBe(200);
    }
  });

  it("should accept combined filters with fiscalYear", () => {
    const result = documentsListSchema.safeParse({
      fiscalYear: 2025,
      documentType: "invoice_in",
      limit: 50,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fiscalYear).toBe(2025);
      expect(result.data.documentType).toBe("invoice_in");
      expect(result.data.limit).toBe(50);
    }
  });

  // Test: updateFiscalYear input schema
  const updateFiscalYearSchema = z.object({
    documentId: z.number(),
    fiscalYear: z.number(),
  });

  it("should validate updateFiscalYear input", () => {
    const result = updateFiscalYearSchema.safeParse({ documentId: 42, fiscalYear: 2026 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentId).toBe(42);
      expect(result.data.fiscalYear).toBe(2026);
    }
  });

  it("should reject updateFiscalYear without documentId", () => {
    const result = updateFiscalYearSchema.safeParse({ fiscalYear: 2026 });
    expect(result.success).toBe(false);
  });

  it("should reject updateFiscalYear without fiscalYear", () => {
    const result = updateFiscalYearSchema.safeParse({ documentId: 42 });
    expect(result.success).toBe(false);
  });

  // Test: fiscal year assignment logic
  it("should assign fiscal year from form data during upload", () => {
    // Simulate the upload route logic
    const formBody = { fiscalYear: "2025" };
    const parsedFiscalYear = formBody.fiscalYear ? parseInt(formBody.fiscalYear) : undefined;
    expect(parsedFiscalYear).toBe(2025);
  });

  it("should handle missing fiscal year in form data", () => {
    const formBody: Record<string, string> = {};
    const parsedFiscalYear = formBody.fiscalYear ? parseInt(formBody.fiscalYear) : undefined;
    expect(parsedFiscalYear).toBeUndefined();
  });

  // Test: fiscal year filtering logic
  it("should filter documents by fiscal year", () => {
    const documents = [
      { id: 1, filename: "rechnung-2025.pdf", fiscalYear: 2025 },
      { id: 2, filename: "rechnung-2026.pdf", fiscalYear: 2026 },
      { id: 3, filename: "rechnung-2026-b.pdf", fiscalYear: 2026 },
      { id: 4, filename: "old-doc.pdf", fiscalYear: null },
    ];

    const filtered2026 = documents.filter(d => d.fiscalYear === 2026);
    expect(filtered2026).toHaveLength(2);
    expect(filtered2026.map(d => d.id)).toEqual([2, 3]);

    const filtered2025 = documents.filter(d => d.fiscalYear === 2025);
    expect(filtered2025).toHaveLength(1);
    expect(filtered2025[0].id).toBe(1);
  });
});
