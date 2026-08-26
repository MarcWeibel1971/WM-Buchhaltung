/**
 * Until exchange rates and FX revaluation are implemented, ledger postings
 * must be denominated in CHF. Presentation-only documents can retain EUR.
 */
export function assertSupportedAccountingCurrency(currency: string | null | undefined): void {
  if ((currency ?? "CHF").trim().toUpperCase() !== "CHF") {
    throw new Error("Fremdwährungen können erst nach Hinterlegung eines Wechselkurses verbucht werden. Bitte CHF verwenden.");
  }
}
