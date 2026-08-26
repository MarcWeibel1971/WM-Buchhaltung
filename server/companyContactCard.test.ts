import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CompanyContactCard", () => {
  it("keeps phone, email, and website fields outside Settings while retaining editable values", () => {
    const component = readFileSync(new URL("../client/src/components/CompanyContactCard.tsx", import.meta.url), "utf8");
    const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");
    expect(component).toContain('field("phone", "Telefon")');
    expect(component).toContain('field("email", "E-Mail")');
    expect(component).toContain('field("website", "Website", "col-span-2")');
    expect(component).toContain("onValueChange(key, event.target.value)");
    expect(settings).toContain('import { CompanyContactCard } from "@/components/CompanyContactCard"');
    expect(settings).toContain("<CompanyContactCard editing={editing} value={val} onValueChange={set} />");
  });
});
