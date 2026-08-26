import { describe, expect, it } from "vitest";
import { deriveFiscalYearFromBookingDate } from "./db";

describe("Geschäftsjahr aus Buchungsdatum", () => {
  it("leitet das Geschäftsjahr aus einem gültigen ISO-Buchungsdatum ab", () => {
    expect(deriveFiscalYearFromBookingDate("2025-12-31")).toBe(2025);
    expect(deriveFiscalYearFromBookingDate("2026-01-01")).toBe(2026);
  });

  it("weist ungültige Datumsformate und nicht existente Kalendertage zurück", () => {
    expect(() => deriveFiscalYearFromBookingDate("31.12.2025")).toThrow("Format JJJJ-MM-TT");
    expect(() => deriveFiscalYearFromBookingDate("2026-02-29")).toThrow("Buchungsdatum ist ungültig");
  });
});
