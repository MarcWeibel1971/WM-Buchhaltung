import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("./recurringInvoicesRouter.ts", import.meta.url), "utf8");
const processor = readFileSync(new URL("./recurringInvoiceProcessor.ts", import.meta.url), "utf8");
const appRouter = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("recurring invoices router", () => {
  it("exposes organization-scoped template creation and activation", () => {
    expect(router).toContain("nextRunDate: z.string().date()");
    expect(router).toContain("eq(recurringInvoices.organizationId, ctx.organizationId)");
    expect(router).toContain("setActive");
    expect(appRouter).toContain("recurringInvoices: recurringInvoicesRouter");
    expect(router).toContain("createHeartbeatJob");
    expect(router).toContain("scheduleCronTaskUid: job.taskUid");
    expect(router).toContain("updateHeartbeatJob(template.scheduleCronTaskUid, { enable: input.isActive }");
    expect(router).toContain("deleteHeartbeatJob(template.scheduleCronTaskUid, session)");
    expect(router).toContain("db.delete(recurringInvoices)");
  });

  it("creates only due draft invoices and advances the template date", () => {
    expect(router).toContain("runDue");
    expect(router).toContain("processDueRecurringInvoices(db, ctx.organizationId, asOf)");
    expect(processor).toContain("lte(recurringInvoices.nextRunDate, asOf)");
    expect(processor).toContain("nextRecurringRunDate(template.nextRunDate, template.interval)");
    expect(processor).toContain("Automatisch aus Vorlage");
  });
});
