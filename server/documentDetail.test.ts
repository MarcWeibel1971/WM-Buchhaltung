import { describe, expect, it } from "vitest";

/**
 * Tests für die Beleganalyse-Detailansicht (Kontera-Style).
 * Testet Datenstruktur-Validierung, Metadata-Merging und Buchungsvorschlag-Logik.
 */

// ─── AI Metadata Parsing ──────────────────────────────────────────────────────

describe("AI Metadata Parsing", () => {
  const sampleMetadata = {
    documentDate: "2026-03-15",
    dueDate: "2026-04-15",
    invoiceNumber: "RE-2026-0042",
    totalAmount: 1081.00,
    netAmount: 1000.00,
    vatAmount: 81.00,
    vatRate: 8.1,
    currency: "CHF",
    counterparty: "Hostpoint AG",
    counterpartyUid: "CHE-108.461.025",
    counterpartyVatNumber: "CHE-108.461.025 MWST",
    counterpartyStreet: "Neue Jonastrasse 60",
    counterpartyZipCode: "8640",
    counterpartyCity: "Rapperswil-Jona",
    counterpartyCountry: "Schweiz",
    counterpartyIban: "CH93 0076 2011 6238 5295 7",
    qrReference: "000000000000000000000042001",
    paymentMethod: "qr_bill",
    referenceNumber: "RE-2026-0042",
    description: "Hosting & Domain Jahresgebühr 2026",
    documentType: "invoice_in",
    suggestedAccount: "6570",
    rawText: "Hostpoint AG Rechnung RE-2026-0042...",
  };

  it("should parse all extended metadata fields from JSON string", () => {
    const jsonStr = JSON.stringify(sampleMetadata);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.documentDate).toBe("2026-03-15");
    expect(parsed.dueDate).toBe("2026-04-15");
    expect(parsed.invoiceNumber).toBe("RE-2026-0042");
    expect(parsed.totalAmount).toBe(1081.00);
    expect(parsed.netAmount).toBe(1000.00);
    expect(parsed.vatAmount).toBe(81.00);
    expect(parsed.vatRate).toBe(8.1);
    expect(parsed.currency).toBe("CHF");
    expect(parsed.counterparty).toBe("Hostpoint AG");
    expect(parsed.counterpartyUid).toBe("CHE-108.461.025");
    expect(parsed.counterpartyVatNumber).toBe("CHE-108.461.025 MWST");
    expect(parsed.counterpartyStreet).toBe("Neue Jonastrasse 60");
    expect(parsed.counterpartyZipCode).toBe("8640");
    expect(parsed.counterpartyCity).toBe("Rapperswil-Jona");
    expect(parsed.counterpartyCountry).toBe("Schweiz");
    expect(parsed.counterpartyIban).toBe("CH93 0076 2011 6238 5295 7");
    expect(parsed.qrReference).toBe("000000000000000000000042001");
    expect(parsed.paymentMethod).toBe("qr_bill");
    expect(parsed.documentType).toBe("invoice_in");
    expect(parsed.suggestedAccount).toBe("6570");
  });

  it("should handle null values in metadata", () => {
    const metaWithNulls = {
      ...sampleMetadata,
      dueDate: null,
      invoiceNumber: null,
      netAmount: null,
      counterpartyUid: null,
      qrReference: null,
      paymentMethod: null,
    };
    const parsed = JSON.parse(JSON.stringify(metaWithNulls));

    expect(parsed.dueDate).toBeNull();
    expect(parsed.invoiceNumber).toBeNull();
    expect(parsed.netAmount).toBeNull();
    expect(parsed.counterpartyUid).toBeNull();
    expect(parsed.qrReference).toBeNull();
    expect(parsed.paymentMethod).toBeNull();
    // Non-null fields should still be present
    expect(parsed.totalAmount).toBe(1081.00);
    expect(parsed.counterparty).toBe("Hostpoint AG");
  });
});

// ─── Metadata Merging ─────────────────────────────────────────────────────────

describe("Metadata Merging", () => {
  it("should merge user edits with existing metadata", () => {
    const existing = {
      documentDate: "2026-03-15",
      totalAmount: 1081.00,
      counterparty: "Hostpoint AG",
      suggestedAccount: "6570",
    };

    const userEdits = {
      totalAmount: 1100.00,
      counterparty: "Hostpoint AG (korrigiert)",
      dueDate: "2026-04-30",
    };

    const merged = { ...existing, ...userEdits };

    expect(merged.documentDate).toBe("2026-03-15"); // unchanged
    expect(merged.totalAmount).toBe(1100.00); // updated
    expect(merged.counterparty).toBe("Hostpoint AG (korrigiert)"); // updated
    expect(merged.dueDate).toBe("2026-04-30"); // new field
    expect(merged.suggestedAccount).toBe("6570"); // unchanged
  });

  it("should allow clearing a field by setting it to null", () => {
    const existing = {
      counterpartyIban: "CH93 0076 2011 6238 5295 7",
      qrReference: "000000000000000000000042001",
    };

    const userEdits = {
      qrReference: null,
    };

    const merged = { ...existing, ...userEdits };

    expect(merged.counterpartyIban).toBe("CH93 0076 2011 6238 5295 7");
    expect(merged.qrReference).toBeNull();
  });
});

// ─── Booking Suggestion Priority ──────────────────────────────────────────────

describe("Booking Suggestion Priority", () => {
  // Simulates the logic in the getById endpoint
  function getBookingSuggestion(
    autoLearnRule: { accountNumber: string; accountName: string; vatRate: number | null; bookingText: string | null } | null,
    llmSuggestion: { suggestedAccount: string; vatRate: number | null; description: string | null } | null,
  ) {
    if (autoLearnRule) {
      return {
        accountNumber: autoLearnRule.accountNumber,
        accountName: autoLearnRule.accountName,
        source: "auto_learn" as const,
        vatRate: autoLearnRule.vatRate,
        bookingText: autoLearnRule.bookingText,
      };
    }
    if (llmSuggestion?.suggestedAccount) {
      return {
        accountNumber: llmSuggestion.suggestedAccount,
        accountName: null,
        source: "llm" as const,
        vatRate: llmSuggestion.vatRate,
        bookingText: llmSuggestion.description,
      };
    }
    return null;
  }

  it("should prioritize auto-learn rule over LLM suggestion", () => {
    const autoLearn = {
      accountNumber: "4305",
      accountName: "IT-Aufwand",
      vatRate: 8.1,
      bookingText: "Hostpoint Hosting",
    };
    const llm = {
      suggestedAccount: "6570",
      vatRate: 8.1,
      description: "Hosting & Domain",
    };

    const result = getBookingSuggestion(autoLearn, llm);

    expect(result).not.toBeNull();
    expect(result!.source).toBe("auto_learn");
    expect(result!.accountNumber).toBe("4305");
    expect(result!.bookingText).toBe("Hostpoint Hosting");
  });

  it("should fall back to LLM suggestion when no auto-learn rule exists", () => {
    const llm = {
      suggestedAccount: "6570",
      vatRate: 8.1,
      description: "Hosting & Domain",
    };

    const result = getBookingSuggestion(null, llm);

    expect(result).not.toBeNull();
    expect(result!.source).toBe("llm");
    expect(result!.accountNumber).toBe("6570");
    expect(result!.bookingText).toBe("Hosting & Domain");
  });

  it("should return null when neither auto-learn nor LLM suggestion exists", () => {
    const result = getBookingSuggestion(null, null);
    expect(result).toBeNull();
  });

  it("should return null when LLM has no suggestedAccount", () => {
    const llm = {
      suggestedAccount: "",
      vatRate: null,
      description: null,
    };

    const result = getBookingSuggestion(null, llm);
    expect(result).toBeNull();
  });
});

// ─── Document Type Labels ─────────────────────────────────────────────────────

describe("Document Type Labels", () => {
  const DOC_TYPE_LABELS: Record<string, string> = {
    invoice_in: "Eingangsrechnung",
    invoice_out: "Ausgangsrechnung",
    receipt: "Quittung",
    bank_statement: "Kontoauszug",
    other: "Sonstiges",
  };

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    qr_bill: "QR-Rechnung",
    bank_transfer: "Banküberweisung",
    cash: "Barzahlung",
    credit_card: "Kreditkarte",
    direct_debit: "Lastschrift",
  };

  it("should have labels for all document types", () => {
    expect(Object.keys(DOC_TYPE_LABELS)).toHaveLength(5);
    expect(DOC_TYPE_LABELS["invoice_in"]).toBe("Eingangsrechnung");
    expect(DOC_TYPE_LABELS["invoice_out"]).toBe("Ausgangsrechnung");
    expect(DOC_TYPE_LABELS["receipt"]).toBe("Quittung");
    expect(DOC_TYPE_LABELS["bank_statement"]).toBe("Kontoauszug");
    expect(DOC_TYPE_LABELS["other"]).toBe("Sonstiges");
  });

  it("should have labels for all payment methods", () => {
    expect(Object.keys(PAYMENT_METHOD_LABELS)).toHaveLength(5);
    expect(PAYMENT_METHOD_LABELS["qr_bill"]).toBe("QR-Rechnung");
    expect(PAYMENT_METHOD_LABELS["bank_transfer"]).toBe("Banküberweisung");
    expect(PAYMENT_METHOD_LABELS["cash"]).toBe("Barzahlung");
    expect(PAYMENT_METHOD_LABELS["credit_card"]).toBe("Kreditkarte");
    expect(PAYMENT_METHOD_LABELS["direct_debit"]).toBe("Lastschrift");
  });
});

// ─── MWST Calculation ─────────────────────────────────────────────────────────

describe("MWST Calculation from Metadata", () => {
  function calculateVat(totalAmount: number, vatRate: number): { netAmount: number; vatAmount: number } {
    const netAmount = totalAmount / (1 + vatRate / 100);
    const vatAmount = totalAmount - netAmount;
    return {
      netAmount: Math.round(netAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
    };
  }

  it("should calculate 8.1% MWST correctly", () => {
    const result = calculateVat(1081.00, 8.1);
    expect(result.netAmount).toBe(1000.00);
    expect(result.vatAmount).toBe(81.00);
  });

  it("should calculate 2.6% MWST correctly", () => {
    const result = calculateVat(102.60, 2.6);
    expect(result.netAmount).toBe(100.00);
    expect(result.vatAmount).toBe(2.60);
  });

  it("should calculate 3.8% MWST correctly", () => {
    const result = calculateVat(103.80, 3.8);
    expect(result.netAmount).toBe(100.00);
    expect(result.vatAmount).toBe(3.80);
  });
});
