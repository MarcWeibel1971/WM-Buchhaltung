import { describe, expect, it } from "vitest";
import { buildReversalLines } from "./db";

describe("Geführte Stornobuchung", () => {
  it("spiegelt jede Buchungszeile und erhält Betrag sowie MWST-Informationen", () => {
    expect(buildReversalLines([
      { accountId: 1020, side: "debit", amount: "108.10", description: "Bank", vatAmount: "8.10", vatRate: "8.10" },
      { accountId: 4000, side: "credit", amount: "108.10", description: "Aufwand" },
    ])).toEqual([
      { accountId: 1020, side: "credit", amount: "108.10", description: "Bank", vatAmount: "8.10", vatRate: "8.10" },
      { accountId: 4000, side: "debit", amount: "108.10", description: "Aufwand", vatAmount: undefined, vatRate: undefined },
    ]);
  });
});
