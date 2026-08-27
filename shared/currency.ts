/**
 * Phase 2.5: Fremdwährungs-Guard.
 * Buchungen sind derzeit nur in CHF möglich (keine Kursfelder / Umrechnung).
 * Fremdwährungs-Transaktionen werden weiterhin importiert (kein Datenverlust),
 * aber an der Buchung blockiert, damit keine unumgerechneten Fremdwährungs-
 * beträge 1:1 als CHF ins Journal gelangen.
 */
export const SUPPORTED_BOOKING_CURRENCIES = ["CHF"] as const;

/** Prüft, ob eine Währung für Buchungen unterstützt wird. null/leer = CHF-Default. */
export function isSupportedBookingCurrency(currency: string | null | undefined): boolean {
  if (currency == null || currency.trim() === "") return true;
  return (SUPPORTED_BOOKING_CURRENCIES as readonly string[]).includes(currency.trim().toUpperCase());
}

/** Einheitliche Fehlermeldung für blockierte Fremdwährungs-Buchungen. */
export function unsupportedBookingCurrencyMessage(currency: string | null | undefined): string {
  const c = (currency ?? "").trim().toUpperCase() || "unbekannt";
  return `Fremdwährung ${c}: Buchungen sind derzeit nur in CHF möglich (keine Kursumrechnung). Bitte den Betrag manuell in CHF erfassen.`;
}
