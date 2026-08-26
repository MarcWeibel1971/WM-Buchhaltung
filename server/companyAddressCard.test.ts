import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CompanyAddressCard", () => {
  it("keeps every address field outside Settings while retaining its editable value contract", () => {
    const component = readFileSync(new URL("../client/src/components/CompanyAddressCard.tsx", import.meta.url), "utf8");
    const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");
    expect(component).toContain('field("street", "Strasse", "col-span-2")');
    expect(component).toContain('field("zipCode", "PLZ")');
    expect(component).toContain('field("city", "Ort")');
    expect(component).toContain('field("canton", "Kanton")');
    expect(component).toContain('field("country", "Land")');
    expect(settings).toContain('import { CompanyAddressCard } from "@/components/CompanyAddressCard"');
    expect(settings).toContain("<CompanyAddressCard editing={editing} value={val} onValueChange={set} />");
  });
});
