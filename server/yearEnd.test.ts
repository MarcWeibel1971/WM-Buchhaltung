/**
 * Audit: Tests für die Idempotenz-Schlüssel der Jahresabschluss-Vorschläge.
 * Keine Datenbank nötig.
 */
import { describe, it, expect } from "vitest";
import { suggestionKey } from "./yearEndRouter";

describe("suggestionKey (Jahresabschluss-Idempotenz)", () => {
  it("Abschreibung: ein Schlüssel pro Anlagekonto, unabhängig von Betrag/Aufwandskonto", () => {
    const a = suggestionKey({ bookingType: "abschreibung", debitAccountId: 10, creditAccountId: 77, amount: "100.00" });
    const b = suggestionKey({ bookingType: "abschreibung", debitAccountId: 11, creditAccountId: 77, amount: "250.00" });
    const c = suggestionKey({ bookingType: "abschreibung", debitAccountId: 10, creditAccountId: 78, amount: "100.00" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("Abgrenzung: gleicher Typ, Kontenpaar, Betrag und Quelle → gleicher Schlüssel", () => {
    const a = suggestionKey({
      bookingType: "transitorische_passiven", debitAccountId: 5, creditAccountId: 6,
      amount: "1200.5", sourceJournalEntryId: 42, sourceDocumentId: null,
    });
    const b = suggestionKey({
      bookingType: "transitorische_passiven", debitAccountId: 5, creditAccountId: 6,
      amount: "1200.50", sourceJournalEntryId: 42,
    });
    expect(a).toBe(b);
  });

  it("Abgrenzung: andere Quelle oder anderer Betrag → anderer Schlüssel", () => {
    const base = { bookingType: "kreditoren", debitAccountId: 5, creditAccountId: 6, amount: "100.00" };
    const a = suggestionKey({ ...base, sourceDocumentId: 1 });
    const b = suggestionKey({ ...base, sourceDocumentId: 2 });
    const c = suggestionKey({ ...base, sourceDocumentId: 1, amount: "100.01" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("verschiedene Buchungstypen mit identischen Konten kollidieren nicht", () => {
    const a = suggestionKey({ bookingType: "transitorische_aktiven", debitAccountId: 1, creditAccountId: 2, amount: "10.00" });
    const b = suggestionKey({ bookingType: "transitorische_passiven", debitAccountId: 1, creditAccountId: 2, amount: "10.00" });
    expect(a).not.toBe(b);
  });
});
