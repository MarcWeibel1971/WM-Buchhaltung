import { describe, it, expect } from "vitest";
import {
  generateQRReference,
  mod10RecursiveCheckDigit,
  isValidQRR,
  isValidISO11649,
  normalizeQRReference,
  validateManualReference,
  formatQRReference,
  isQrIban,
  iso11649CheckDigits,
  generateSCORReference,
  generateInvoiceReference,
} from "../shared/qrReference";

describe("QR-Referenz (shared/qrReference)", () => {
  describe("generateQRReference", () => {
    it("erzeugt 27-stellige Referenz mit gültiger Prüfziffer", () => {
      const ref = generateQRReference(1, 2026);
      expect(ref).toHaveLength(27);
      expect(isValidQRR(ref)).toBe(true);
    });

    it("ist stabil (gleiche Eingabe → gleiche Referenz)", () => {
      expect(generateQRReference(42, 2026)).toBe(generateQRReference(42, 2026));
    });

    it("Format: YY + 0000 + 20-stellige ID + Prüfziffer", () => {
      const ref = generateQRReference(123, 2026);
      expect(ref.startsWith("260000")).toBe(true);
      expect(ref.slice(6, 26)).toBe("00000000000000000123");
    });
  });

  describe("isValidQRR", () => {
    it("akzeptiert gültige QRR", () => {
      expect(isValidQRR(generateQRReference(7, 2025))).toBe(true);
    });

    it("lehnt falsche Prüfziffer ab", () => {
      const ref = generateQRReference(7, 2025);
      const tampered = ref.slice(0, 26) + (ref[26] === "0" ? "1" : "0");
      expect(isValidQRR(tampered)).toBe(false);
    });

    it("lehnt falsche Länge ab", () => {
      expect(isValidQRR("12345")).toBe(false);
      expect(isValidQRR(generateQRReference(7, 2025) + "0")).toBe(false);
    });
  });

  describe("normalizeQRReference", () => {
    it("normalisiert QRR mit Leerzeichen (5er-Gruppen aus CAMT)", () => {
      const ref = generateQRReference(99, 2026);
      const spaced = formatQRReference(ref);
      expect(normalizeQRReference(spaced)).toBe(ref);
    });

    it("normalisiert QRR ohne Leerzeichen", () => {
      const ref = generateQRReference(100, 2026);
      expect(normalizeQRReference(ref)).toBe(ref);
    });

    it("lehnt QRR mit ungültiger Prüfziffer ab", () => {
      const ref = generateQRReference(100, 2026);
      const bad = ref.slice(0, 26) + (ref[26] === "5" ? "6" : "5");
      expect(normalizeQRReference(bad)).toBeNull();
    });

    it("akzeptiert gültige SCOR/ISO-11649-Referenz", () => {
      // Bekanntes gültiges ISO-11649-Beispiel
      expect(normalizeQRReference("RF18 5390 0754 7034")).toBe("RF18539007547034");
    });

    it("lehnt SCOR mit falscher Prüfziffer ab", () => {
      expect(normalizeQRReference("RF19 5390 0754 7034")).toBeNull();
    });

    it("lehnt Freitext ab", () => {
      expect(normalizeQRReference("Rechnung März 2026")).toBeNull();
      expect(normalizeQRReference("")).toBeNull();
      expect(normalizeQRReference(null)).toBeNull();
      expect(normalizeQRReference(undefined)).toBeNull();
    });
  });

  describe("isValidISO11649", () => {
    it("validiert Mod-97 korrekt", () => {
      expect(isValidISO11649("RF18539007547034")).toBe(true);
      expect(isValidISO11649("RF18539007547035")).toBe(false);
    });
  });

  describe("mod10RecursiveCheckDigit", () => {
    it("stimmt mit generateQRReference überein", () => {
      const base = "260000" + String(5).padStart(20, "0");
      expect(base + mod10RecursiveCheckDigit(base)).toBe(generateQRReference(5, 2026));
    });
  });
});

describe("validateManualReference (manuelle Referenz-Eingabe)", () => {
  it("akzeptiert Freitext-Referenzen ohne Prüfziffer-Validierung", () => {
    expect(validateManualReference("Rechnung März 2026")).toEqual({ valid: true, canonical: null });
    expect(validateManualReference("12345")).toEqual({ valid: true, canonical: null });
  });

  it("akzeptiert leere Eingabe", () => {
    expect(validateManualReference("")).toEqual({ valid: true, canonical: null });
    expect(validateManualReference("   ")).toEqual({ valid: true, canonical: null });
  });

  it("normalisiert gültige QRR (mit Leerzeichen) in kanonische Form", () => {
    const raw = "21 00000 00003 13947 14300 09017";
    const check = validateManualReference(raw);
    expect(check.valid).toBe(true);
    expect(check.canonical).toBe("210000000003139471430009017");
  });

  it("weist QRR mit falscher Prüfziffer zurück", () => {
    const check = validateManualReference("21000000003139471430009018");
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("Modulo 10");
  });

  it("weist QRR-ähnliche Ziffernfolgen mit falscher Prüfziffer auch mit Leerzeichen zurück", () => {
    const check = validateManualReference("21 00000 00003 13947 14300 09018");
    expect(check.valid).toBe(false);
  });

  it("akzeptiert gültige SCOR-Referenz", () => {
    const check = validateManualReference("RF18539007547034");
    expect(check.valid).toBe(true);
    expect(check.canonical).toBe("RF18539007547034");
  });

  it("weist SCOR mit falscher Prüfziffer zurück", () => {
    const check = validateManualReference("RF99539007547034");
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("Modulo 97");
  });
});

describe("SCOR-Referenz (Audit P1-1)", () => {
  it("erkennt QR-IBANs (IID 30000–31999) mit und ohne Leerzeichen", () => {
    expect(isQrIban("CH4431999123000889012")).toBe(true);
    expect(isQrIban("CH44 3199 9123 0008 8901 2")).toBe(true);
    expect(isQrIban("CH1230000123456789012")).toBe(true);
  });

  it("erkennt normale IBANs als Nicht-QR-IBAN", () => {
    expect(isQrIban("CH9300762011623852957")).toBe(false);
    expect(isQrIban("CH5604835012345678009")).toBe(false);
  });

  it("respektiert die IID-Grenzen 30000 und 31999", () => {
    expect(isQrIban("CH0029999012345678901")).toBe(false);
    expect(isQrIban("CH0030000012345678901")).toBe(true);
    expect(isQrIban("CH0031999912345678901")).toBe(true);
    expect(isQrIban("CH0032000012345678901")).toBe(false);
  });

  it("lehnt leere/fehlende IBANs ab", () => {
    expect(isQrIban(null)).toBe(false);
    expect(isQrIban(undefined)).toBe(false);
    expect(isQrIban("")).toBe(false);
    expect(isQrIban("DE89370400440532013000")).toBe(false);
  });

  it("berechnet ISO-11649-Prüfziffern korrekt (Referenzbeispiel ISO 11649)", () => {
    // Bekannter ISO-11649-Testvektor: RF18 5390 0754 7034
    expect(iso11649CheckDigits("539007547034")).toBe("18");
    expect(isValidISO11649("RF18539007547034")).toBe(true);
  });

  it("generiert SCOR-Referenzen mit gültiger Prüfziffer", () => {
    for (const id of [1, 42, 99999999999]) {
      const ref = generateSCORReference(id);
      expect(ref).toMatch(/^RF\d{13}$/);
      expect(isValidISO11649(ref)).toBe(true);
    }
  });

  it("generiert SCOR-Referenz mit 11-stelliger ID (zero-padded)", () => {
    const ref = generateSCORReference(0);
    expect(ref.slice(4)).toBe("00000000000");
    expect(ref).toHaveLength(15);
    expect(isValidISO11649(ref)).toBe(true);
  });

  it("wählt bei QR-IBAN die QRR-Referenz", () => {
    const ref = generateInvoiceReference(7, 2026, "CH44 3199 9123 0008 8901 2");
    expect(ref).toMatch(/^\d{27}$/);
    expect(isValidQRR(ref)).toBe(true);
    expect(ref).toBe(generateQRReference(7, 2026));
  });

  it("wählt bei normaler oder fehlender IBAN die SCOR-Referenz", () => {
    const refNormal = generateInvoiceReference(7, 2026, "CH93 0076 2011 6238 5295 7");
    expect(refNormal).toBe(generateSCORReference(7));
    expect(isValidISO11649(refNormal)).toBe(true);
    const refOhne = generateInvoiceReference(7, 2026, null);
    expect(refOhne).toBe(generateSCORReference(7));
  });
});
