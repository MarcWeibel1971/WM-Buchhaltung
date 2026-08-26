import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportTransactionEditDialog", () => {
  it("keeps the transaction editor dialog shell outside the import page and preserves both layout modes", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportTransactionEditDialog.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain('editMode === "collective"');
    expect(component).toContain("Transaktion bearbeiten");
    expect(component).toContain("Alle Felder der Transaktion anpassen");
    expect(page).toContain('import { BankImportTransactionEditDialog } from "@/components/BankImportTransactionEditDialog"');
    expect(page).toContain("<BankImportTransactionEditDialog open={!!editTx} editMode={editMode}");
  });
});
