import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../client/src/pages/Kreditoren.tsx", import.meta.url), "utf8");

describe("creditor open items export", () => {
  it("keeps the CSV action bound to the existing unpaid invoice list", () => {
    expect(page).toContain("downloadOpenCreditorsCsv");
    expect(page).toContain("Offene_Posten_Kreditoren_${fiscalYear}.csv");
    expect(page).toContain("offene Kreditorenposten exportiert");
  });
});
