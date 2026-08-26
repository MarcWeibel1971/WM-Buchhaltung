import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const journalPage = readFileSync(new URL("../client/src/pages/Journal.tsx", import.meta.url), "utf8");

describe("GeBüV archive dialog", () => {
  it("keeps the manifest download option bound to the journal archive procedure", () => {
    expect(journalPage).toContain("exportGebuevManifest");
    expect(journalPage).toContain("GeBüV-Archivmanifest");
    expect(journalPage).toContain("GeBueV_Archiv_${fiscalYear}_manifest.json");
  });
});
