import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportCollectiveBankAccountLine", () => {
  it("keeps the fixed bank account booking side and amount display outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportCollectiveBankAccountLine.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("SOLL (Belastung)");
    expect(component).toContain("HABEN (Belastung)");
    expect(component).toContain("Bankkonto");
    expect(page).toContain('import { BankImportCollectiveBankAccountLine } from "@/components/BankImportCollectiveBankAccountLine"');
    expect(page).toContain("<BankImportCollectiveBankAccountLine isIncoming={isIncoming}");
  });
});
