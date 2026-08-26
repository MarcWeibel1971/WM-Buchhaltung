import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/CustomerImportDialog.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("CustomerImportDialog", () => {
  it("binds the active customer import state and mutation", () => {
    expect(component).toContain("export function CustomerImportDialog");
    expect(component).toContain("fileRef.current?.click()");
    expect(settings).toContain("<CustomerImportDialog");
    expect(settings).toContain("importFromListMut.mutate({ customers: importPreview })");
  });
});
