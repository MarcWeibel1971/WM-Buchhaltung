import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../scripts/syncEchSchemas.mjs", import.meta.url), "utf8");

describe("eCH schema sync tool", () => {
  it("starts at eCH-0217 and recursively records external schema locations", () => {
    expect(script).toContain("eCH-0217-2-0-0.xsd");
    expect(script).toContain("schemaLocation");
    expect(script).toContain('"catalog.json"');
  });
});
