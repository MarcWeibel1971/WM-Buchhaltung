import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportSortIcon", () => {
  it("separates inactive and directional sort indicators from the transaction page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportSortIcon.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("activeColumn !== column");
    expect(component).toContain('direction === "asc"');
    expect(component).toContain("ArrowUpDown");
    expect(page).toContain('import { BankImportSortIcon } from "@/components/BankImportSortIcon"');
    expect(page).toContain("<BankImportSortIcon column={col} activeColumn={sortCol} direction={sortDir} />");
  });
});
