/**
 * Betrags-Parsing für Schweizer Eingaben (Audit).
 *
 * `parseFloat("1'234.50")` liefert 1 – de-CH-Tausendertrennzeichen (Apostroph,
 * Leerzeichen) und Komma als Dezimaltrenner müssen vorher normalisiert werden.
 * Gibt `null` zurück, wenn die Eingabe keine gültige Zahl ist, damit Formulare
 * den Submit sperren können statt Roh-Strings an den Server zu schicken.
 */
export function parseSwissAmount(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = input.trim();
  if (!s) return null;
  // Währungskürzel und Leerzeichen/Apostrophe (Tausender) entfernen
  s = s.replace(/^(CHF|EUR|USD)\s*/i, "").replace(/[\s'’]/g, "");
  // Nachgestelltes Minus ("1234.50-")
  let negative = false;
  if (s.endsWith("-")) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith("-")) { negative = !negative; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  // Dezimaltrenner: Komma → Punkt, wenn kein Punkt vorhanden oder Komma nach dem Punkt
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Betrag als String mit zwei Dezimalstellen für tRPC-Inputs (`amount: z.string()`). */
export function toAmountString(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}
