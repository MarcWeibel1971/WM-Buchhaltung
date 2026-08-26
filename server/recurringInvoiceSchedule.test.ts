import { describe, expect, it } from "vitest";
import { nextRecurringRunDate } from "./recurringInvoiceSchedule";

describe("nextRecurringRunDate", () => {
  it("preserves invoice-day intent while clamping shorter months", () => {
    expect(nextRecurringRunDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextRecurringRunDate("2024-01-31", "monthly")).toBe("2024-02-29");
  });
  it("advances quarterly and yearly templates deterministically", () => {
    expect(nextRecurringRunDate("2026-01-15", "quarterly")).toBe("2026-04-15");
    expect(nextRecurringRunDate("2024-02-29", "yearly")).toBe("2025-02-28");
  });
});
