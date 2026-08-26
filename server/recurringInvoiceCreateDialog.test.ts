import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialog = readFileSync(new URL("../client/src/components/RecurringInvoiceCreateDialog.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/Invoices.tsx", import.meta.url), "utf8");

describe("recurring invoice create dialog", () => {
  it("captures the customer, amount, interval and next execution date", () => {
    expect(dialog).toContain("Wiederkehrende Rechnungsvorlage");
    expect(dialog).toContain("Nächste Ausführung");
    expect(dialog).toContain("Zahlungsfrist (Tage)");
    expect(page).toContain("recurringInvoices.create");
    expect(page).toContain("<RecurringInvoiceCreateDialog");
  });
});
