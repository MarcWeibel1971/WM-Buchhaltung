import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/SuppliersToolbar.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("SuppliersToolbar", () => {
  it("keeps search, inactive filtering and supplier actions wired", () => {
    expect(component).toContain("Inaktive anzeigen");
    expect(component).toContain("onImportFromDocuments");
    expect(settings).toContain("<SuppliersToolbar search={search}");
  });
});
