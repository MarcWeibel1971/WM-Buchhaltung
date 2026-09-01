import { describe, it, expect } from "vitest";
import { suggestLevel } from "./remindersRouter";

// Standard-Policy: L1 ab 15 Tage, L2 ab 30, L3 ab 60
const policy = {
  level1: { minDaysOverdue: 15, feeAmount: 0, gracePeriodDays: 10, label: "Zahlungserinnerung" },
  level2: { minDaysOverdue: 30, feeAmount: 20, gracePeriodDays: 10, label: "1. Mahnung" },
  level3: { minDaysOverdue: 60, feeAmount: 40, gracePeriodDays: 7, label: "2. Mahnung" },
};

describe("suggestLevel (Audit P2-2, sequentielle Mahnstufen)", () => {
  it("schlägt bei 113 Tagen ohne Vorstufe die Zahlungserinnerung vor", () => {
    expect(suggestLevel(policy, 113, 0)).toBe(1);
  });

  it("überspringt keine Stufe, auch wenn höhere Schwellen erreicht sind", () => {
    expect(suggestLevel(policy, 65, 0)).toBe(1);
    expect(suggestLevel(policy, 35, 0)).toBe(1);
  });

  it("schlägt nichts vor, wenn die Schwelle für Stufe 1 nicht erreicht ist", () => {
    expect(suggestLevel(policy, 10, 0)).toBeNull();
  });

  it("schlägt Stufe 2 erst nach versendeter Stufe 1 vor", () => {
    expect(suggestLevel(policy, 113, 1)).toBe(2);
    expect(suggestLevel(policy, 35, 1)).toBe(2);
  });

  it("schlägt Stufe 3 erst nach versendeter Stufe 2 vor", () => {
    expect(suggestLevel(policy, 113, 2)).toBe(3);
    expect(suggestLevel(policy, 65, 2)).toBe(3);
  });

  it("schlägt nichts vor, wenn Stufe 2 versendet, aber Schwelle für Stufe 3 offen ist", () => {
    expect(suggestLevel(policy, 45, 2)).toBeNull();
  });

  it("schlägt nach Stufe 3 nichts mehr vor", () => {
    expect(suggestLevel(policy, 200, 3)).toBeNull();
  });
});
