import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/SuppliersList.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("SuppliersList", () => {
  it("keeps supplier details and row actions in the active tab", () => {
    expect(component).toContain("Keine Lieferanten erfasst");
    expect(component).toContain("onDeactivate(supplier)");
    expect(settings).toContain("<SuppliersList suppliers={suppliersList ?? []}");
  });
});
