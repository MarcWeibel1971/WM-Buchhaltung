import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/CustomersToolbar.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("CustomersToolbar", () => {
  it("keeps customer search and primary actions wired", () => {
    expect(component).toContain("CSV/Excel Import");
    expect(component).toContain("Neuer Kunde");
    expect(settings).toContain("<CustomersToolbar");
    expect(settings).toContain("onCreate={openCreateCust}");
  });
});
