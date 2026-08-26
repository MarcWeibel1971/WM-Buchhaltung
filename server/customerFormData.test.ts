import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const helper = readFileSync(new URL("../client/src/lib/customerFormData.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("customerFormData", () => {
  it("keeps the customer save payload assembly active", () => {
    expect(helper).toContain("buildCustomerPayload");
    expect(helper).toContain("customerNumber");
    expect(settings).toContain("buildCustomerPayload({ customerNumber: cCustNr");
  });
});
