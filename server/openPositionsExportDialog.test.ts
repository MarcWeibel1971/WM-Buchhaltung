import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../client/src/pages/OpenPositions.tsx", import.meta.url), "utf8");

describe("open positions export action", () => {
  it("keeps the active CSV download action wired to the invoice export", () => {
    expect(page).toContain("exportOpenItemsCsv");
    expect(page).toContain("Offene Posten CSV");
    expect(page).toContain("offene Debitorenposten exportiert");
  });
});
