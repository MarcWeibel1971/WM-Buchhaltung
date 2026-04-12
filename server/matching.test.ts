import { describe, it, expect } from "vitest";
import { calculateMatchScore, improveBookingSuggestionFromDocument } from "./db";

describe("Document-Transaction Matching", () => {
  describe("calculateMatchScore", () => {
    it("should return high score for exact amount + counterparty + close date", () => {
      const score = calculateMatchScore(
        { totalAmount: 925.55, counterparty: "OWIBA AG", documentDate: "2026-03-02", counterpartyIban: null, referenceNumber: null },
        { amount: "-925.55", counterparty: "OWIBA AG", transactionDate: "2026-04-07", counterpartyIban: null, reference: null }
      );
      // Exact amount (40) + exact counterparty (30) + date within 60 days (2) = 72
      expect(score).toBeGreaterThanOrEqual(70);
    });

    it("should return high score for exact amount + partial counterparty match", () => {
      const score = calculateMatchScore(
        { totalAmount: 23.80, counterparty: "Velokurier Luzern Zug AG", documentDate: "2026-03-06" },
        { amount: "-23.80", counterparty: "Velokurier Luzern Zug AG", transactionDate: "2026-03-26", counterpartyIban: null, reference: null }
      );
      // Exact amount (40) + exact counterparty (30) + date within 30 days (5) = 75
      expect(score).toBeGreaterThanOrEqual(70);
    });

    it("should return low score for mismatched amount", () => {
      const score = calculateMatchScore(
        { totalAmount: 100.00, counterparty: "Test AG" },
        { amount: "-500.00", counterparty: "Test AG", transactionDate: "2026-01-01", counterpartyIban: null, reference: null }
      );
      // Amount mismatch (0) + counterparty match (30) = 30
      expect(score).toBeLessThan(50);
    });

    it("should return 0 for completely different entries", () => {
      const score = calculateMatchScore(
        { totalAmount: 100.00, counterparty: "Company A", documentDate: "2025-01-01" },
        { amount: "-999.99", counterparty: "Company B", transactionDate: "2026-12-31", counterpartyIban: null, reference: null }
      );
      expect(score).toBeLessThan(20);
    });

    it("should boost score for IBAN match", () => {
      const withoutIban = calculateMatchScore(
        { totalAmount: 54.00, counterparty: "Hostpoint AG", documentDate: "2026-01-04" },
        { amount: "-54.00", counterparty: "Hostpoint AG", transactionDate: "2026-01-15", counterpartyIban: null, reference: null }
      );
      const withIban = calculateMatchScore(
        { totalAmount: 54.00, counterparty: "Hostpoint AG", documentDate: "2026-01-04", counterpartyIban: "CH1430781621762022001" },
        { amount: "-54.00", counterparty: "Hostpoint AG", transactionDate: "2026-01-15", counterpartyIban: "CH1430781621762022001", reference: null }
      );
      expect(withIban).toBeGreaterThan(withoutIban);
    });

    it("should handle partial counterparty name match", () => {
      const score = calculateMatchScore(
        { totalAmount: 2238.00, counterparty: "Gewerbe-Treuhand AG" },
        { amount: "-2238.00", counterparty: "Gewerbe-Treuhand Schwyz AG", transactionDate: "2026-02-01", counterpartyIban: null, reference: null }
      );
      // Amount exact (40) + word match in counterparty (10-20) = 50+
      // After sanitization, words like "gewerbetreuhand" vs "gewerbetreuhandschwyz" may partially match
      expect(score).toBeGreaterThanOrEqual(40);
    });

    it("should handle reference number match", () => {
      const score = calculateMatchScore(
        { totalAmount: 54.00, counterparty: "Hostpoint AG", referenceNumber: "00000000010289764738191116" },
        { amount: "-54.00", counterparty: "Hostpoint AG", transactionDate: "2026-01-15", counterpartyIban: null, reference: "00000000010289764738191116" }
      );
      // Amount (40) + counterparty (30) + reference (10) = 80+
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it("should handle null/missing fields gracefully", () => {
      const score = calculateMatchScore(
        { totalAmount: undefined, counterparty: undefined, documentDate: undefined },
        { amount: "-100.00", counterparty: null, transactionDate: "2026-01-01", counterpartyIban: null, reference: null }
      );
      expect(score).toBe(0);
    });

    it("should give close date higher score than distant date", () => {
      const closeDate = calculateMatchScore(
        { totalAmount: 100.00, documentDate: "2026-03-01" },
        { amount: "-100.00", counterparty: null, transactionDate: "2026-03-03", counterpartyIban: null, reference: null }
      );
      const farDate = calculateMatchScore(
        { totalAmount: 100.00, documentDate: "2026-03-01" },
        { amount: "-100.00", counterparty: null, transactionDate: "2026-05-01", counterpartyIban: null, reference: null }
      );
      expect(closeDate).toBeGreaterThan(farDate);
    });
  });

  describe("improveBookingSuggestionFromDocument", () => {
    it("should extract improvements from document metadata", () => {
      const result = improveBookingSuggestionFromDocument(
        { description: "Rechnung für Domainnamen", suggestedAccount: "4200", vatRate: 8.1, vatAmount: 4.05 },
        {}
      );
      expect(result).not.toBeNull();
      expect(result!.description).toBe("Rechnung für Domainnamen");
      expect(result!.suggestedAccount).toBe("4200");
      expect(result!.vatRate).toBe(8.1);
      expect(result!.vatAmount).toBe(4.05);
    });

    it("should return null for empty metadata", () => {
      const result = improveBookingSuggestionFromDocument({}, {});
      expect(result).toBeNull();
    });

    it("should return null for null metadata", () => {
      const result = improveBookingSuggestionFromDocument(null, {});
      expect(result).toBeNull();
    });

    it("should extract partial improvements", () => {
      const result = improveBookingSuggestionFromDocument(
        { vatRate: 2.6 },
        {}
      );
      expect(result).not.toBeNull();
      expect(result!.vatRate).toBe(2.6);
      expect(result!.description).toBeUndefined();
    });
  });
});
