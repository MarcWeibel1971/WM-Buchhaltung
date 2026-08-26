import { describe, expect, it } from "vitest";
import { buildAccountLedgerCsv } from "./accountLedgerExport";

describe("buildAccountLedgerCsv", () => {
  it("exports a running balance from opening balance through debit and credit entries", () => {
    const result = buildAccountLedgerCsv({ accountNumber: "1020", accountName: "Bank", fiscalYear: 2026, openingBalance: 100, lines: [{ bookingDate: "2026-01-02", entryNumber: "2026-1", description: "Einzahlung", side: "debit", amount: "25" }, { bookingDate: "2026-01-03", entryNumber: "2026-2", description: "Ausgabe", side: "credit", amount: "10" }] });
    expect(result.filename).toBe("Kontenblatt_1020_2026.csv");
    expect(result.csv).toContain('"125.00"');
    expect(result.csv).toContain('"115.00"');
  });
});
