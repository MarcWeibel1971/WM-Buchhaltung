import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const helper = readFileSync(new URL("../client/src/lib/customerFormState.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("customerFormState", () => {
  it("keeps customer reset defaults and edit prefill active", () => {
    expect(helper).toContain("emptyCustomerFormState");
    expect(helper).toContain("customerFormStateFromRecord");
    expect(settings).toContain("applyCustomerFormState(emptyCustomerFormState())");
    expect(settings).toContain("applyCustomerFormState(customerFormStateFromRecord(c))");
  });
});
