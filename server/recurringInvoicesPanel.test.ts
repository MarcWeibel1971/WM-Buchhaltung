import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("../client/src/components/RecurringInvoicesPanel.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/Invoices.tsx", import.meta.url), "utf8");

describe("recurring invoices panel", () => {
  it("keeps active template status and pause controls wired to the invoices page", () => {
    expect(panel).toContain("Wiederkehrende Rechnungen");
    expect(panel).toContain("Pausieren");
    expect(panel).toContain("Fällige ausführen");
    expect(page).toContain("<RecurringInvoicesPanel");
    expect(page).toContain("recurringInvoices.setActive");
    expect(page).toContain("recurringInvoices.runDue");
  });
});
