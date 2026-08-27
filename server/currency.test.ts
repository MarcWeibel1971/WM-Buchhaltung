import { describe, it, expect } from "vitest";
import {
  SUPPORTED_BOOKING_CURRENCIES,
  isSupportedBookingCurrency,
  unsupportedBookingCurrencyMessage,
} from "../shared/currency";

describe("isSupportedBookingCurrency (Phase 2.5 Fremdwährungs-Guard)", () => {
  it("unterstützt CHF", () => {
    expect(isSupportedBookingCurrency("CHF")).toBe(true);
  });

  it("normalisiert Gross-/Kleinschreibung und Leerzeichen", () => {
    expect(isSupportedBookingCurrency("chf")).toBe(true);
    expect(isSupportedBookingCurrency(" Chf ")).toBe(true);
  });

  it("behandelt null/undefined/leer als CHF-Default", () => {
    expect(isSupportedBookingCurrency(null)).toBe(true);
    expect(isSupportedBookingCurrency(undefined)).toBe(true);
    expect(isSupportedBookingCurrency("")).toBe(true);
    expect(isSupportedBookingCurrency("   ")).toBe(true);
  });

  it("blockiert EUR und andere Fremdwährungen", () => {
    expect(isSupportedBookingCurrency("EUR")).toBe(false);
    expect(isSupportedBookingCurrency("eur")).toBe(false);
    expect(isSupportedBookingCurrency("USD")).toBe(false);
    expect(isSupportedBookingCurrency("GBP")).toBe(false);
  });

  it("listet aktuell nur CHF als unterstützt", () => {
    expect(SUPPORTED_BOOKING_CURRENCIES).toEqual(["CHF"]);
  });
});

describe("unsupportedBookingCurrencyMessage", () => {
  it("nennt die Währung und den CHF-Zwang", () => {
    const msg = unsupportedBookingCurrencyMessage("EUR");
    expect(msg).toContain("EUR");
    expect(msg).toContain("CHF");
    expect(msg).toContain("Kursumrechnung");
  });

  it("normalisiert die Währung in der Meldung", () => {
    expect(unsupportedBookingCurrencyMessage(" eur ")).toContain("EUR");
  });

  it("hat einen Fallback für unbekannte Währung", () => {
    expect(unsupportedBookingCurrencyMessage(null)).toContain("unbekannt");
  });
});
