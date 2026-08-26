import { describe, expect, it } from "vitest";
import { canApproveJournalEntry } from "./db";

describe("Vier-Augen-Freigabe", () => {
  it("blockiert die Freigabe durch den Ersteller, wenn die Organisationsregel aktiv ist", () => {
    expect(canApproveJournalEntry({ requiresDualApproval: true, createdBy: 12, approverId: 12 })).toBe(false);
  });

  it("erlaubt eine Freigabe durch ein anderes Organisationsmitglied", () => {
    expect(canApproveJournalEntry({ requiresDualApproval: true, createdBy: 12, approverId: 23 })).toBe(true);
  });

  it("behält für historische Einträge ohne Ersteller die bisherige Freigabemöglichkeit bei", () => {
    expect(canApproveJournalEntry({ requiresDualApproval: true, createdBy: null, approverId: 12 })).toBe(true);
  });

  it("erlaubt Eigenfreigaben, wenn die Organisationsregel nicht aktiv ist", () => {
    expect(canApproveJournalEntry({ requiresDualApproval: false, createdBy: 12, approverId: 12 })).toBe(true);
  });
});
