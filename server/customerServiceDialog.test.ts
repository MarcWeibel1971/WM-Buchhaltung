import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/CustomerServiceDialog.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("CustomerServiceDialog", () => {
  it("binds account selection and the active service mutation", () => {
    expect(component).toContain("Ertragskonto");
    expect(component).toContain("Primäre Dienstleistung");
    expect(settings).toContain("<CustomerServiceDialog");
    expect(settings).toContain("onSave={handleSaveService}");
  });
});
