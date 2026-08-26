import { describe, expect, it } from "vitest";
import { getBankImportFilterTitle, isBulkApprovalAvailable } from "../client/src/components/BankImportFilterBar";

describe("BankImportFilterBar", () => {
  it("uses the correct title for each status filter", () => {
    expect(getBankImportFilterTitle("pending")).toBe("Ausstehende Transaktionen");
    expect(getBankImportFilterTitle("matched")).toBe("Verbuchte Transaktionen");
    expect(getBankImportFilterTitle("all")).toBe("Alle Transaktionen");
  });

  it("only exposes bulk approval for selected, ready pending transactions", () => {
    expect(isBulkApprovalAvailable("pending", 1, 1)).toBe(true);
    expect(isBulkApprovalAvailable("pending", 0, 2)).toBe(false);
    expect(isBulkApprovalAvailable("pending", 2, 0)).toBe(false);
    expect(isBulkApprovalAvailable("matched", 2, 2)).toBe(false);
  });
});
