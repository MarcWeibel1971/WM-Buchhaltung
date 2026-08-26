import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/CustomerFormDialog.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("CustomerFormDialog", () => {
  it("binds the active customer save workflow", () => {
    expect(component).toContain("Kunde bearbeiten");
    expect(component).toContain("onSave");
    expect(settings).toContain("<CustomerFormDialog");
    expect(settings).toContain("onSave={handleSaveCust}");
  });
});
