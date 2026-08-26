import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportCreditCardDialog", () => {
  it("keeps upload, account allocation, and double-entry approval controls outside BankImport", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportCreditCardDialog.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("Kreditkartenabrechnung (PDF) hochladen");
    expect(component).toContain("onItemAccountChange(index, value)");
    expect(component).toContain("KK-Abrechnung verbuchen (2 Buchungen)");
    expect(page).toContain('import { BankImportCreditCardDialog } from "@/components/BankImportCreditCardDialog"');
    expect(page).toContain("<BankImportCreditCardDialog");
    expect(page).toContain("approveCcFromBankImportMutation.mutate");
  });
});
