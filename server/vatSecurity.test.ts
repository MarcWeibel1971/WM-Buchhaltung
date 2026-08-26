import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const vatRouterSource = readFileSync(resolve(import.meta.dirname, "vatRouter.ts"), "utf8");

describe("MWST-Detailzugriff", () => {
  it("erfordert einen organisationsgebundenen Benutzerkontext", () => {
    expect(vatRouterSource).toContain("detail: orgProcedure");
    expect(vatRouterSource).not.toContain("detail: publicProcedure");
  });

  it("grenzt Periode, Firmeneinstellungen, Journal und Konten auf die Organisation ein", () => {
    expect(vatRouterSource).toContain("eq(vatPeriods.organizationId, ctx.organizationId)");
    expect(vatRouterSource).toContain("eq(companySettings.organizationId, ctx.organizationId)");
    expect(vatRouterSource).toContain("eq(journalEntries.organizationId, ctx.organizationId)");
    expect(vatRouterSource).toContain("eq(accounts.organizationId, ctx.organizationId)");
  });
});
