/** Formatiert einen CHF-Betrag mit Apostroph als Tausendertrenner. */
export function formatCHF(amount: number): string {
  const [integer, decimals] = amount.toFixed(2).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${decimals}`;
}

/** Formatiert QR-Referenzen rechtsbündig in Gruppen zu fünf Ziffern. */
export function formatQRRef(reference: string): string {
  const parts: string[] = [];
  for (let end = reference.length; end > 0; end -= 5) {
    parts.unshift(reference.slice(Math.max(0, end - 5), end));
  }
  return parts.join(" ");
}
