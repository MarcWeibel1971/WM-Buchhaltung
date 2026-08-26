import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CompanyDetailsCard", () => {
  it("keeps company master data editing outside Settings", () => {
    const component = readFileSync(new URL("../client/src/components/CompanyDetailsCard.tsx", import.meta.url), "utf8");
    const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");
    expect(component).toContain('input("companyName", "Firmenname"');
    expect(component).toContain('input("hrNumber", "Handelsregisternummer"');
    expect(component).toContain('input("uid", "UID"');
    expect(component).toContain('input("vatNumber", "MWST-Nummer"');
    expect(settings).toContain('import { CompanyDetailsCard } from "@/components/CompanyDetailsCard"');
    expect(settings).toContain("<CompanyDetailsCard editing={editing} value={val} onValueChange={set} />");
  });
});
