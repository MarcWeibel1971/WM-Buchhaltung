import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportTransactionActionBar", () => {
  it("keeps the transaction editor footer container outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportTransactionActionBar.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("DialogFooter");
    expect(component).toContain("children");
    expect(page).toContain('import { BankImportTransactionActionBar } from "@/components/BankImportTransactionActionBar"');
    expect(page).toContain("<BankImportTransactionActionBar>");
  });
});
