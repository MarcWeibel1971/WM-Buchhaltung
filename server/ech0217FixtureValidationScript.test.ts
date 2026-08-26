import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("eCH-0217 fixture validation script", () => {
  it("validates every supported-method fixture against the synchronized schema root", () => {
    const script = readFileSync(new URL("../scripts/validateEch0217Fixtures.sh", import.meta.url), "utf8");
    const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    expect(script).toContain("ech0217-effective-all-rates-fixture.xml");
    expect(script).toContain("ech0217-net-tax-rate-fixture.xml");
    expect(script).toContain("ech0217-flat-tax-rate-fixture.xml");
    expect(script).toContain("eCH-0217-2-0-0.xsd");
    expect(packageJson).toContain('"validate:ech0217": "bash scripts/validateEch0217Fixtures.sh"');
  });
});
