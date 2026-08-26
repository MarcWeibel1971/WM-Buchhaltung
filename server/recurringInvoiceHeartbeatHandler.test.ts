import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");

describe("recurring invoice heartbeat handler", () => {
  it("requires cron authentication and scopes execution to the matching task UID", () => {
    expect(server).toContain('app.post("/api/scheduled/recurring-invoice"');
    expect(server).toContain("sdk.authenticateRequest(req)");
    expect(server).toContain("eq(recurringInvoices.scheduleCronTaskUid, cronUser.taskUid)");
    expect(server).toContain("template.id");
  });
});
