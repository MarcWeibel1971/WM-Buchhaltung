import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const processor = readFileSync(new URL("./recurringInvoiceProcessor.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./recurringInvoicesRouter.ts", import.meta.url), "utf8");

describe("recurring invoice processor", () => {
  it("shares due-template processing between manual execution and future cron handlers", () => {
    expect(processor).toContain("processDueRecurringInvoices");
    expect(processor).toContain("RecurringInvoiceDb");
    expect(processor).toContain("nextRecurringRunDate");
    expect(processor).toContain("templateId?: number");
    expect(processor).toContain("eq(recurringInvoices.id, templateId)");
    expect(router).toContain("return processDueRecurringInvoices(db, ctx.organizationId, asOf)");
  });
});
