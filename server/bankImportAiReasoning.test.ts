import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BankImportAiReasoning", () => {
  it("keeps optional AI reasoning display outside the import page", () => {
    const component = readFileSync(new URL("../client/src/components/BankImportAiReasoning.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/BankImport.tsx", import.meta.url), "utf8");
    expect(component).toContain("KI-Begründung");
    expect(component).toContain("if (!reasoning) return null");
    expect(page).toContain('import { BankImportAiReasoning } from "@/components/BankImportAiReasoning"');
    expect(page).toContain('<BankImportAiReasoning reasoning={editTx.aiReasoning} />');
  });
});
