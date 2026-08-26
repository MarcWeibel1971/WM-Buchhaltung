import { describe, expect, it } from "vitest";
import { generateQrReference, isValidQrReference } from "../shared/qrReference";

function hasValidRecursiveModulo10CheckDigit(reference: string): boolean {
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const character of reference) {
    carry = table[(carry + Number.parseInt(character, 10)) % 10];
  }
  return carry === 0;
}

describe("QR-Referenz", () => {
  it("erzeugt eine numerische Referenz mit 27 Stellen und Modulo-10-Prüfziffer", () => {
    const reference = generateQrReference(42, 2026);
    expect(reference).toMatch(/^\d{27}$/);
    expect(hasValidRecursiveModulo10CheckDigit(reference)).toBe(true);
  });

  it("liefert für gleiche Eingaben dieselbe Referenz", () => {
    expect(generateQrReference(42, 2026)).toBe(generateQrReference(42, 2026));
  });

  it("akzeptiert nur manuelle Referenzen mit gültiger Prüfziffer", () => {
    const reference = generateQrReference(42, 2026);
    expect(isValidQrReference(reference)).toBe(true);
    expect(isValidQrReference(`${reference.slice(0, -1)}9`)).toBe(false);
  });
});
