import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CompanyApprovalCard", () => {
  it("keeps the four-eyes control separated while preserving its organization update callback", () => {
    const component = readFileSync(new URL("../client/src/components/CompanyApprovalCard.tsx", import.meta.url), "utf8");
    const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");
    expect(component).toContain("Vier-Augen-Freigabe verlangen");
    expect(component).toContain("onCheckedChange={onChange}");
    expect(settings).toContain('import { CompanyApprovalCard } from "@/components/CompanyApprovalCard"');
    expect(settings).toContain("updateOrganization.mutate({ requiresDualApproval })");
    expect(settings).not.toContain("function CompanyApprovalCard(");
  });
});
