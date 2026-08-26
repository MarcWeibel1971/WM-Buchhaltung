import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportSingleBookingFields", () => {
  it("keeps counterparty, reference, and debit-credit account controls outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportSingleBookingFields.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("Lieferant (Kreditor) / Kunde (Debitor)");
    expect(component).toContain("IBAN Gegenpartei");
    expect(component).toContain("Soll-Konto");
    expect(component).toContain("Haben-Konto");
    expect(page).toContain('import { BankImportSingleBookingFields } from "@/components/BankImportSingleBookingFields"');
    expect(page).toContain("<BankImportSingleBookingFields form={editForm} accounts={accounts}");
  });
});
