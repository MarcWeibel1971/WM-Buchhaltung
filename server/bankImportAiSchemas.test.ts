import { describe, expect, it } from "vitest";
import { bankImportBookingSuggestionSchema, bankImportDocumentMatchMetadataSchema } from "./bankImportAiSchemas";

describe("bankImportBookingSuggestionSchema", () => {
  it("accepts only bounded, structurally complete booking suggestions", () => {
    expect(bankImportBookingSuggestionSchema.parse({ debitAccountNumber: "1020", creditAccountNumber: "3200", confidence: 88, reasoning: "Rechnungsausgleich" }).confidence).toBe(88);
    expect(() => bankImportBookingSuggestionSchema.parse({ debitAccountNumber: "1020", creditAccountNumber: "3200", confidence: 101, reasoning: "Ungültig" })).toThrow();
  });

  it("accepts positive monetary document metadata and rejects invalid amounts", () => {
    expect(bankImportDocumentMatchMetadataSchema.parse({ totalAmount: "125.50" }).totalAmount).toBe(125.5);
    expect(() => bankImportDocumentMatchMetadataSchema.parse({ totalAmount: "NaN" })).toThrow();
  });
});
