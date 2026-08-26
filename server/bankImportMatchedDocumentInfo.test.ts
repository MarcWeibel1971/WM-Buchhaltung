import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportMatchedDocumentInfo", () => {
  it("keeps document metadata, document opening, and credit-card handoff outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportMatchedDocumentInfo.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("Gematchte Rechnung");
    expect(component).toContain("Verbuchungsvorschlag aufrufen");
    expect(component).toContain("onLaunchCreditCard");
    expect(page).toContain('import { BankImportMatchedDocumentInfo } from "@/components/BankImportMatchedDocumentInfo"');
    expect(page).toContain("<BankImportMatchedDocumentInfo transaction={editTx}");
  });
});
