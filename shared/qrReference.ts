/**
 * Zentrale QR-Referenz-Utilities (QR-Rechnung, SIX Swiss QR-bill Standard).
 *
 * Konsolidiert die bisher duplizierten Implementierungen aus
 * server/qrBillRouter.ts und server/invoicesRouter.ts (Audit 2.6) und
 * ergänzt Normalisierung + Validierung für den Debitoren-Zahlungsabgleich
 * via CAMT (Audit 2.1) sowie die QRR-Prüfziffer-Validierung (Audit 2.7).
 *
 * Referenztypen (SIX):
 * - QRR: 27 numerische Stellen, letzte Stelle = Modulo-10-rekursiv-Prüfziffer
 * - SCOR: ISO-11649-Referenz, "RF" + 2 Prüfziffern + bis zu 21 alphanumerische Stellen
 * - NON: keine Referenz
 */

// ─── Modulo 10 rekursiv (QRR-Prüfziffer) ────────────────────────────────────

const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

/** Berechnet die Modulo-10-rekursiv-Prüfziffer für eine Ziffernfolge. */
export function mod10RecursiveCheckDigit(base: string): string {
  let carry = 0;
  for (const ch of base) {
    carry = MOD10_TABLE[(carry + parseInt(ch, 10)) % 10];
  }
  return String((10 - carry) % 10);
}

/** Prüft, ob eine 27-stellige QRR-Referenz eine gültige Prüfziffer hat. */
export function isValidQRR(reference: string): boolean {
  if (!/^\d{27}$/.test(reference)) return false;
  return mod10RecursiveCheckDigit(reference.slice(0, 26)) === reference[26];
}

// ─── Generierung ────────────────────────────────────────────────────────────

/**
 * Generiert eine QRR-Referenz (27 Stellen) aus Beleg-ID + Geschäftsjahr.
 * Format: YYMMDD-artig "YY" + "0000" + 20-stellig zero-padded ID + Prüfziffer.
 * (Bisheriger WM-Formatstandard – bitte nicht ändern, bestehende Referenzen
 * in Umlauf!)
 */
export function generateQRReference(id: number, year: number): string {
  const base = String(year).slice(-2) + "0000" + String(id).padStart(20, "0");
  return base + mod10RecursiveCheckDigit(base);
}

// ─── Formatierung ───────────────────────────────────────────────────────────

/** Formatiert für Anzeige/Druck: rechtsbündige 5er-Gruppen, z. B. "21 00000 00000 00000 00000 00001 7". */
export function formatQRReference(ref: string): string {
  const parts: string[] = [];
  let i = ref.length;
  while (i > 0) {
    const start = Math.max(0, i - 5);
    parts.unshift(ref.slice(start, i));
    i = start;
  }
  return parts.join(" ");
}

// ─── Normalisierung & Validierung (Zahlungsabgleich) ───────────────────────

/**
 * Normalisiert eine Referenz aus einem Bank-Import (CAMT <Ref>, Zahlungsgrund
 * oder manuelle Eingabe) zur kanonischen Form ohne Leerzeichen.
 *
 * Rückgabe:
 * - 27-stellige Ziffernfolge mit gültiger Prüfziffer → QRR (kanonisch)
 * - "RF…"-Referenz (ISO 11649, Grossbuchstaben) → SCOR (kanonisch)
 * - sonst null (keine verwertbare QR-Referenz)
 */
export function normalizeQRReference(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Leerzeichen entfernen (Banken liefern teils 5er-Gruppen)
  const compact = raw.replace(/\s+/g, "");

  if (/^\d{27}$/.test(compact)) {
    return isValidQRR(compact) ? compact : null;
  }

  // SCOR: RF + 2 Ziffern + 1–21 alphanumerisch (ISO 11649)
  const upper = compact.toUpperCase();
  if (/^RF\d{2}[A-Z0-9]{1,21}$/.test(upper)) {
    return isValidISO11649(upper) ? upper : null;
  }

  return null;
}

/** ISO-11649-Prüfziffernvalidierung (Modulo 97, wie IBAN). */
export function isValidISO11649(reference: string): boolean {
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(reference)) return false;
  // Umstellen: Referenz ohne "RFxx" + "RF" + Prüfziffer ans Ende
  const rearranged = reference.slice(4) + reference.slice(0, 4);
  // Buchstaben → Zahlen (A=10 … Z=35)
  let numeric = "";
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    numeric += code >= 65 ? String(code - 55) : ch;
  }
  // Mod 97 ohne BigInt-Overflow: stückweise
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
  }
  return remainder === 1;
}

/**
 * Validierung für manuell eingegebene Referenzen (z. B. im BankImport-Edit-Dialog).
 * Freitext ist erlaubt; was wie eine strukturierte Referenz aussieht
 * (QRR: 26–27 Ziffern, SCOR: RF + 2 Prüfziffern), muss eine gültige
 * Prüfziffer haben.
 *
 * Rückgabe:
 * - valid=true, canonical gesetzt → strukturierte Referenz, kanonische Form
 * - valid=true, canonical null    → Freitext (keine Prüfziffer-Validierung)
 * - valid=false                   → sieht strukturiert aus, Prüfziffer falsch
 */
export function validateManualReference(raw: string): {
  valid: boolean;
  canonical: string | null;
  reason?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, canonical: null };

  const normalized = normalizeQRReference(trimmed);
  if (normalized) return { valid: true, canonical: normalized };

  const compact = trimmed.replace(/\s+/g, "");
  if (/^\d{26,27}$/.test(compact)) {
    return {
      valid: false,
      canonical: null,
      reason: "Ungültige QR-Referenz: Die Prüfziffer (Modulo 10 rekursiv) stimmt nicht.",
    };
  }
  if (/^RF/i.test(compact)) {
    return {
      valid: false,
      canonical: null,
      reason: "Ungültige SCOR-Referenz: Die Prüfziffer (ISO 11649 / Modulo 97) stimmt nicht.",
    };
  }
  return { valid: true, canonical: null };
}
