import { describe, expect, it } from "vitest";
import { assertSupportedAccountingCurrency } from "./accountingCurrency";

describe("Fremdwährungs-Sperre", () => {
  it("akzeptiert CHF für Buchungen", () => {
    expect(() => assertSupportedAccountingCurrency("CHF")).not.toThrow();
  });

  it("blockiert EUR ohne hinterlegte Kurs- und Umrechnungslogik", () => {
    expect(() => assertSupportedAccountingCurrency("EUR")).toThrow(/Fremdwährungen/i);
  });
});
