import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/components/SupplierDocumentImportResult.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");

describe("SupplierDocumentImportResult", () => {
  it("keeps document import outcomes visible in the active suppliers tab", () => {
    expect(component).toContain("Rechnungs-Import abgeschlossen");
    expect(component).toContain("result.details");
    expect(settings).toContain("<SupplierDocumentImportResult result={importFromDocsMut.data}");
  });
});
