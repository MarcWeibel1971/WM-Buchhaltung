import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportCollectiveBookingLines", () => {
  it("keeps collective line account, amount, VAT, add, and remove controls outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportCollectiveBookingLines.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("Gegenpositionen");
    expect(component).toContain("Zeile hinzufügen");
    expect(component).toContain("onChange(index, { vatRate");
    expect(component).toContain("onRemove(index)");
    expect(page).toContain('import { BankImportCollectiveBookingLines } from "@/components/BankImportCollectiveBookingLines"');
    expect(page).toContain("<BankImportCollectiveBookingLines");
  });
});
