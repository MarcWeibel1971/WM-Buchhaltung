import { describe, expect, it } from "vitest";
import { inferOpeningBalanceAccountType } from "../client/src/components/OpeningBalancesImportDialog";

describe("OpeningBalancesImportDialog", () => {
  it("ordnet Schweizer Kontonummern den erwarteten Bilanztypen zu", () => {
    expect(inferOpeningBalanceAccountType("1020")).toBe("asset");
    expect(inferOpeningBalanceAccountType("2000")).toBe("liability");
    expect(inferOpeningBalanceAccountType("2799")).toBe("liability");
    expect(inferOpeningBalanceAccountType("2800")).toBe("equity");
  });
});
