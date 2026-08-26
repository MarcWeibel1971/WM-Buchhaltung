import { describe, expect, it } from "vitest";
import { buildDebitorOpenItemsCsv } from "./openItemsExport";

describe("buildDebitorOpenItemsCsv", () => {
  it("exports residual amounts and overdue information per invoice", () => {
    const csv = buildDebitorOpenItemsCsv([{ invoiceNumber: "R-2026-00001", customerName: "Muster AG", invoiceDate: "2026-01-01", dueDate: "2026-01-31", total: "100.00", paidAmount: "25.00", currency: "CHF", isOverdue: true, daysOverdue: 12 }]);
    expect(csv).toContain('"75.00"');
    expect(csv).toContain('"Ja";"12"');
  });
});
