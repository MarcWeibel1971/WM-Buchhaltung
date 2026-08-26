import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CompanyLogoUpload", () => {
  it("keeps image validation and organization-scoped settings mutations outside Settings", () => {
    const component = readFileSync(new URL("../client/src/components/CompanyLogoUpload.tsx", import.meta.url), "utf8");
    const settings = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");
    expect(component).toContain("trpc.settings.uploadCompanyLogo.useMutation");
    expect(component).toContain("trpc.settings.deleteCompanyLogo.useMutation");
    expect(component).toContain("file.size > 5 * 1024 * 1024");
    expect(component).toContain("file.type.startsWith");
    expect(settings).toContain('import { CompanyLogoUpload } from "@/components/CompanyLogoUpload"');
    expect(settings).not.toContain("function CompanyLogoUpload(");
  });
});
