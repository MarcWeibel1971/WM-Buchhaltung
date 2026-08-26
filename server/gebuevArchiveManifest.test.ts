import { describe, expect, it } from "vitest";
import { buildGebuevArchiveManifest } from "./gebuevArchiveManifest";

describe("buildGebuevArchiveManifest", () => {
  it("records the fiscal year, journal file and a stable integrity digest", () => {
    const manifest = JSON.parse(buildGebuevArchiveManifest({ fiscalYear: 2026, journalCsv: "Beleg;Datum\n1;01.01.2026\n", documentCount: 2, accountLedgerCount: 4 }));
    expect(manifest.fiscalYear).toBe(2026);
    expect(manifest.contents[0].path).toBe("journal/Journal_2026.csv");
    expect(manifest.contents[0].sha256).toHaveLength(64);
    expect(manifest.contents[1].count).toBe(2);
    expect(manifest.contents[2]).toEqual({ path: "account-ledgers/", count: 4 });
  });
});
