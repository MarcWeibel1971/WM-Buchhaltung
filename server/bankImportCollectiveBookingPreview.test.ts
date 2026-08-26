import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportCollectiveBookingPreview", () => {
  it("keeps debit-credit and VAT preview calculations outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportCollectiveBookingPreview.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("populatedLines");
    expect(component).toContain("vatAmount");
    expect(component).toContain("Soll");
    expect(component).toContain("Haben");
    expect(page).toContain('import { BankImportCollectiveBookingPreview } from "@/components/BankImportCollectiveBookingPreview"');
    expect(page).toContain("<BankImportCollectiveBookingPreview lines={collectiveLines}");
  });
});
