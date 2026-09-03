// Audit: DB-freie Regressionstests für die Mandantentrennungs-/GeBüV-Härtung
// in server/db.ts. Prüft die reinen Hilfsfunktionen und die Signaturen der
// org-gebundenen Mutations-Helfer (orgId MUSS erster Parameter sein).
import { describe, it, expect } from "vitest";
import {
  assertJournalLinesBalanced,
  readInsertId,
  approveJournalEntry,
  rejectJournalEntry,
  assertJournalEntryEditable,
  updateJournalEntryLines,
  deleteJournalEntry,
  revertBankTransaction,
  revertCcStatement,
  approveBankTransaction,
  updateBankTransaction,
  deleteCcStatement,
  unmatchDocument,
  getMatchedDocument,
  applyMatches,
  validateJournalLines,
} from "./db";

describe("assertJournalLinesBalanced (Rappen-genaue Soll/Haben-Prüfung)", () => {
  it("akzeptiert eine ausgeglichene Buchung", () => {
    expect(() => assertJournalLinesBalanced([
      { accountId: 1, side: "debit", amount: "100.00" },
      { accountId: 2, side: "credit", amount: "100.00" },
    ])).not.toThrow();
  });

  it("vergleicht in Rappen – 0.1 + 0.2 entspricht 0.3", () => {
    expect(() => assertJournalLinesBalanced([
      { accountId: 1, side: "debit", amount: "0.1" },
      { accountId: 1, side: "debit", amount: "0.2" },
      { accountId: 2, side: "credit", amount: "0.3" },
    ])).not.toThrow();
  });

  it("lehnt eine Abweichung von einem Rappen ab (früher: 0.01-Toleranz)", () => {
    expect(() => assertJournalLinesBalanced([
      { accountId: 1, side: "debit", amount: "100.00" },
      { accountId: 2, side: "credit", amount: "100.01" },
    ])).toThrow(/Double-Entry-Fehler/);
  });

  it("lehnt nicht-numerische, unendliche, negative und Null-Beträge ab", () => {
    for (const bad of ["abc", "", "NaN", "Infinity", "-5", "0", "0.00"]) {
      expect(() => assertJournalLinesBalanced([
        { accountId: 1, side: "debit", amount: bad },
        { accountId: 2, side: "credit", amount: bad },
      ]), `Betrag "${bad}"`).toThrow(/Ungültiger Betrag/);
    }
  });

  it("akzeptiert keine Teilzahl-Strings mehr (parseFloat-Verhalten entfernt)", () => {
    expect(() => assertJournalLinesBalanced([
      { accountId: 1, side: "debit", amount: "12abc" },
      { accountId: 2, side: "credit", amount: "12" },
    ])).toThrow(/Ungültiger Betrag/);
  });
});

describe("readInsertId (Belegnummern-Allokation aus ResultSetHeader)", () => {
  it("liest number und bigint", () => {
    expect(readInsertId({ insertId: 42 })).toBe(42);
    expect(readInsertId({ insertId: 7n })).toBe(7);
  });

  it("liefert 0 bei fehlendem/ungültigem Header (→ Aufrufer wirft)", () => {
    expect(readInsertId(undefined)).toBe(0);
    expect(readInsertId(null)).toBe(0);
    expect(readInsertId({})).toBe(0);
    expect(readInsertId({ insertId: "3" })).toBe(0);
    expect(readInsertId([])).toBe(0);
  });
});

describe("org-gebundene Helfer verlangen orgId als ersten Parameter", () => {
  // Regressionsschutz: Wird ein Helfer wieder auf eine id-only-Signatur
  // zurückgebaut, schlägt dieser Test fehl.
  const expectedArity: Array<[string, (...args: never[]) => unknown, number]> = [
    ["approveJournalEntry", approveJournalEntry, 3],
    ["rejectJournalEntry", rejectJournalEntry, 2],
    ["assertJournalEntryEditable", assertJournalEntryEditable, 2],
    ["updateJournalEntryLines", updateJournalEntryLines, 3],
    ["deleteJournalEntry", deleteJournalEntry, 2],
    ["revertBankTransaction", revertBankTransaction, 2],
    ["revertCcStatement", revertCcStatement, 2],
    ["approveBankTransaction", approveBankTransaction, 3],
    ["updateBankTransaction", updateBankTransaction, 3],
    ["deleteCcStatement", deleteCcStatement, 2],
    ["unmatchDocument", unmatchDocument, 2],
    ["getMatchedDocument", getMatchedDocument, 2],
    ["applyMatches", applyMatches, 2],
    ["validateJournalLines", validateJournalLines, 2],
  ];

  for (const [name, fn, arity] of expectedArity) {
    it(`${name} hat ${arity} Parameter (orgId zuerst)`, () => {
      expect(fn.length).toBe(arity);
    });
  }

  it("Helfer werfen ohne DB einen klaren Fehler statt still zu arbeiten", async () => {
    // Ohne DATABASE_URL liefert getDb() null → Mutations-Helfer müssen werfen.
    delete process.env.DATABASE_URL;
    await expect(deleteJournalEntry(1, 1)).rejects.toThrow(/Database not available/);
    await expect(revertBankTransaction(1, 1)).rejects.toThrow(/Database not available/);
    await expect(unmatchDocument(1, 1)).rejects.toThrow(/Database not available/);
    await expect(approveBankTransaction(1, 1, 1)).rejects.toThrow(/Database not available/);
  });
});
