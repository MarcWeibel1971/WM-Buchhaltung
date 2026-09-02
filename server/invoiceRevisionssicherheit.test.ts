/**
 * AP4.3 Revisionssicherheit: Das «Admin: Löschen» gebuchter Rechnungen wurde
 * entfernt. Gebuchte Rechnungen sind produktiv nicht löschbar, nur stornierbar
 * (cancel erstellt eine Gegenbuchung). Dieser Test sichert gegen Wieder-
 * einführung ab.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSrc = readFileSync(new URL("./invoicesRouter.ts", import.meta.url), "utf8");

describe("AP4.3 Revisionssicherheit – Rechnungen", () => {
  it("kein adminDelete / adminBulkDelete mehr im Router", () => {
    expect(routerSrc).not.toContain("adminDelete:");
    expect(routerSrc).not.toContain("adminBulkDelete:");
  });

  it("delete ist auf Entwürfe beschränkt (mit Storno-Hinweis)", () => {
    expect(routerSrc).toContain("Nur Entwürfe können gelöscht werden");
    expect(routerSrc).toContain("bitte stornieren");
  });

  it("cancel erstellt Storno-Gegenbuchung (GeBüV-konform)", () => {
    expect(routerSrc).toContain("Storno Rechnung");
    expect(routerSrc).toContain("cancelJournalEntryId");
  });

  it("Client hat keine Admin-Lösch-UI mehr", () => {
    const clientSrc = readFileSync(
      new URL("../client/src/pages/Invoices.tsx", import.meta.url), "utf8");
    expect(clientSrc).not.toContain("adminDelete");
    expect(clientSrc).not.toContain("adminBulkDelete");
    expect(clientSrc).not.toContain("Admin: Löschen");
    // Storno bleibt als Standard-Funktion erhalten
    expect(clientSrc).toContain("Stornieren");
  });
});
