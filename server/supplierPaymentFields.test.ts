import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/SupplierPaymentFields.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("SupplierPaymentFields", () => {
  it("keeps payment terms, accounts, bank matching and notes actively wired", () => {
    expect(component).toContain("Zahlungsfrist (Tage)");
    expect(component).toContain("Match-Pattern (für Bankimport)");
    expect(component).toContain("Notizen");
    expect(settings).toContain("<SupplierPaymentFields paymentDays={formPaymentDays}");
  });
});
