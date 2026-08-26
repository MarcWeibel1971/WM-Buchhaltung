import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportBookingModeToggle", () => {
  it("keeps booking mode controls and the collective difference indicator outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportBookingModeToggle.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("Einzelbuchung");
    expect(component).toContain("Sammelbuchung");
    expect(component).toContain("Diff.");
    expect(component).toContain("onModeChange");
    expect(page).toContain('import { BankImportBookingModeToggle } from "@/components/BankImportBookingModeToggle"');
    expect(page).toContain("<BankImportBookingModeToggle mode={editMode}");
  });
});
