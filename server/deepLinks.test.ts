import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const bankSource = readFileSync(resolve(root, "client/src/pages/BankImport.tsx"), "utf8");
const journalSource = readFileSync(resolve(root, "client/src/pages/Journal.tsx"), "utf8");
const appSource = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");

describe("Audit P0 Deep-Links", () => {
  it("öffnet den Bankimport für den Legacy-Parameter action=bank-import", () => {
    expect(bankSource).toContain('urlParams.get("action")');
    expect(bankSource).toContain('urlAction === "bank-import"');
  });

  it("öffnet die Freigaben für den Legacy-Parameter tab=approvals", () => {
    expect(journalSource).toContain('urlParams.get("tab")');
    expect(journalSource).toContain('urlTab === "approvals"');
  });

  it("bewahrt Suchparameter beim Redirect alter Routen", () => {
    expect(appSource).toContain('`/freigaben${window.location.search}`');
    expect(appSource).toContain('`/bank${window.location.search}`');
  });
});
