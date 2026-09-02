/**
 * AP4.5: Kanonischer KMU-Kontenplan – Konsistenz-Regeln.
 * Verhindert ein Wieder-Auseinanderlaufen der Seeds (Versprechen vs. Ergebnis).
 */
import { describe, expect, it } from "vitest";
import {
  KMU_ACCOUNTS_MINIMAL,
  KMU_ACCOUNTS_VOLL,
  KMU_KONTENPLAN_VERSION,
  KMU_MINIMAL_NUMBERS,
  STANDARD_ACCOUNTS,
  getKmuAccounts,
} from "./kmuKontenplan";

describe("AP4.5 Kanonischer KMU-Kontenplan", () => {
  it("ist versioniert", () => {
    expect(Number.isInteger(KMU_KONTENPLAN_VERSION)).toBe(true);
    expect(KMU_KONTENPLAN_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("Voll: 63 Konten, eindeutige Nummern", () => {
    expect(KMU_ACCOUNTS_VOLL).toHaveLength(63);
    const numbers = KMU_ACCOUNTS_VOLL.map((a) => a.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("Minimal: 14 Konten, identische Untermenge von Voll (kein Divergieren)", () => {
    expect(KMU_ACCOUNTS_MINIMAL).toHaveLength(14);
    const vollByNumber = new Map(KMU_ACCOUNTS_VOLL.map((a) => [a.number, a]));
    for (const min of KMU_ACCOUNTS_MINIMAL) {
      // identische Objekt-Referenz = per Konstruktion keine Abweichung möglich
      expect(vollByNumber.get(min.number)).toBe(min);
    }
    expect(KMU_ACCOUNTS_MINIMAL.map((a) => a.number)).toEqual([...KMU_MINIMAL_NUMBERS]);
  });

  it("Standard-Konten-Zuordnung ist in beiden Varianten vorhanden", () => {
    for (const list of [KMU_ACCOUNTS_MINIMAL, KMU_ACCOUNTS_VOLL]) {
      const numbers = new Set(list.map((a) => a.number));
      for (const [key, number] of Object.entries(STANDARD_ACCOUNTS)) {
        expect(numbers.has(number), `${key} (${number}) fehlt`).toBe(true);
      }
    }
  });

  it("normalBalance passt zum Kontentyp (Aktiven/Aufwand=Soll, sonst Haben)", () => {
    for (const a of KMU_ACCOUNTS_VOLL) {
      const expected = a.accountType === "asset" || a.accountType === "expense" ? "debit" : "credit";
      expect(a.normalBalance, `${a.number} ${a.name}`).toBe(expected);
    }
  });

  it("MWST-Flags: Erlöse und vorsteuerfähige Aufwände markiert, Personalaufwand nicht", () => {
    const byNumber = new Map(KMU_ACCOUNTS_VOLL.map((a) => [a.number, a]));
    expect(byNumber.get("3000")?.isVatRelevant).toBe(true);   // Dienstleistungserlöse
    expect(byNumber.get("4000")?.isVatRelevant).toBe(true);   // Materialaufwand
    expect(byNumber.get("6500")?.isVatRelevant).toBe(true);   // Verwaltungsaufwand
    expect(byNumber.get("5000")?.isVatRelevant ?? false).toBe(false); // Löhne
    expect(byNumber.get("5700")?.isVatRelevant ?? false).toBe(false); // Sozialversicherungen
    expect(byNumber.get("6800")?.isVatRelevant ?? false).toBe(false); // Abschreibungen
  });

  it("getKmuAccounts liefert je Variante die kanonische Liste", () => {
    expect(getKmuAccounts("minimal")).toBe(KMU_ACCOUNTS_MINIMAL);
    expect(getKmuAccounts("voll")).toBe(KMU_ACCOUNTS_VOLL);
  });
});
