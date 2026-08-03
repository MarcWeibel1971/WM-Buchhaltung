import { describe, it, expect } from "vitest";
import { isSelfApprovalBlocked, buildReversalLines, type ReversalLine } from "./db";

describe("isSelfApprovalBlocked (Vier-Augen-Prinzip)", () => {
  it("blockiert, wenn Ersteller = Prüfer und Einstellung aktiv", () => {
    expect(isSelfApprovalBlocked(true, 42, 42)).toBe(true);
  });

  it("erlaubt Freigabe durch zweite Person", () => {
    expect(isSelfApprovalBlocked(true, 42, 7)).toBe(false);
  });

  it("erlaubt Selbstfreigabe, wenn Einstellung deaktiviert", () => {
    expect(isSelfApprovalBlocked(false, 42, 42)).toBe(false);
  });

  it("blockiert Legacy-Einträge ohne Ersteller nicht", () => {
    expect(isSelfApprovalBlocked(true, null, 42)).toBe(false);
    expect(isSelfApprovalBlocked(true, undefined, 42)).toBe(false);
  });
});

describe("buildReversalLines (Storno)", () => {
  const lines: ReversalLine[] = [
    { accountId: 1, side: "debit", amount: "100.00", description: "Aufwand" },
    { accountId: 2, side: "credit", amount: "100.00" },
  ];

  it("invertiert Soll und Haben", () => {
    const reversed = buildReversalLines(lines);
    expect(reversed[0].side).toBe("credit");
    expect(reversed[1].side).toBe("debit");
  });

  it("behält Konten, Beträge und Beschreibungen bei", () => {
    const reversed = buildReversalLines(lines);
    expect(reversed[0].accountId).toBe(1);
    expect(reversed[0].amount).toBe("100.00");
    expect(reversed[0].description).toBe("Aufwand");
    expect(reversed[1].accountId).toBe(2);
  });

  it("bleibt bilanziell ausgeglichen (Summe Soll = Summe Haben)", () => {
    const reversed = buildReversalLines(lines);
    const debit = reversed.filter(l => l.side === "debit").reduce((s, l) => s + parseFloat(l.amount), 0);
    const credit = reversed.filter(l => l.side === "credit").reduce((s, l) => s + parseFloat(l.amount), 0);
    expect(debit).toBeCloseTo(credit, 2);
  });

  it("übernimmt MWST-Felder unverändert", () => {
    const withVat: ReversalLine[] = [
      { accountId: 1, side: "debit", amount: "92.70", vatAmount: "7.30", vatRate: "8.1" },
      { accountId: 2, side: "debit", amount: "7.30", vatRate: "8.1" },
      { accountId: 3, side: "credit", amount: "100.00" },
    ];
    const reversed = buildReversalLines(withVat);
    expect(reversed[0]).toMatchObject({ side: "credit", vatAmount: "7.30", vatRate: "8.1" });
    expect(reversed[1].side).toBe("credit");
    expect(reversed[2].side).toBe("debit");
  });

  it("verändert das Eingabe-Array nicht", () => {
    const original = JSON.parse(JSON.stringify(lines));
    buildReversalLines(lines);
    expect(lines).toEqual(original);
  });
});
