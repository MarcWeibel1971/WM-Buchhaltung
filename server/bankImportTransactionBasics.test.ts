import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportTransactionBasics", () => {
  it("keeps date, amount, and booking text controls outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportTransactionBasics.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("Datum");
    expect(component).toContain("Betrag CHF");
    expect(component).toContain("Buchungstext");
    expect(component).toContain("onDescriptionChange");
    expect(page).toContain('import { BankImportTransactionBasics } from "@/components/BankImportTransactionBasics"');
    expect(page).toContain("<BankImportTransactionBasics transactionDate={editTx.transactionDate}");
  });
});
