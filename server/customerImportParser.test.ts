import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const parser = readFileSync(new URL("../client/src/lib/customerImportParser.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("customerImportParser", () => {
  it("keeps header and positional customer import parsing active", () => {
    expect(parser).toContain("parseCustomerImportRows");
    expect(parser).toContain("Kunden-Nr.");
    expect(settings).toContain("parseCustomerImportRows(rawRows)");
  });
});
