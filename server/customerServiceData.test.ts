import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const helper = readFileSync(new URL("../client/src/lib/customerServiceData.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("customerServiceData", () => {
  it("keeps service payload generation active in the customers tab", () => {
    expect(helper).toContain("buildCustomerServicePayload");
    expect(helper).toContain("revenueAccountId");
    expect(settings).toContain("buildCustomerServicePayload({ customerId: selectedCustomerId!");
  });
});
