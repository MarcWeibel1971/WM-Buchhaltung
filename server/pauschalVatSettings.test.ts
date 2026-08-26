import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Pauschalsteuersatz-Einstellungen", () => {
  it("persists the approved rate and activity and renders both fields in company settings", () => {
    const router = readFileSync(new URL("./settingsRouter.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/Settings.tsx", import.meta.url), "utf8");
    expect(router).toContain("vatPauschalRate: z.string().max(10).optional()");
    expect(router).toContain("vatPauschalActivity: z.string().max(100).optional()");
    expect(router).toContain("vatPauschalRate: input.vatPauschalRate");
    expect(router).toContain("vatPauschalActivity: input.vatPauschalActivity");
    expect(page).toContain("Bewilligter Pauschalsteuersatz (%)");
    expect(page).toContain("Bewilligte Tätigkeit");
    expect(page).toContain("vatPauschalRate: form.vatPauschalRate || undefined");
    expect(page).toContain("vatPauschalActivity: form.vatPauschalActivity || undefined");
  });
});
