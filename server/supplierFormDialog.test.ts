import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/SupplierFormDialog.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("SupplierFormDialog", () => {
  it("keeps the supplier form actions and active integration intact", () => {
    expect(component).toContain("Lieferant bearbeiten");
    expect(component).toContain("onSave");
    expect(settings).toContain("<SupplierFormDialog");
    expect(settings).toContain("isPending={createMut.isPending || updateMut.isPending}");
  });
});
