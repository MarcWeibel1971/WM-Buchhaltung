import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/SupplierImportDialog.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("SupplierImportDialog", () => {
  it("keeps the supplier preview and active import action wired", () => {
    expect(component).toContain("Lieferanten importieren");
    expect(component).toContain("paymentTermDays");
    expect(settings).toContain("<SupplierImportDialog");
    expect(settings).toContain("suppliers: importPreview");
  });
});
