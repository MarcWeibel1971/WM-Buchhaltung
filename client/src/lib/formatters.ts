/** Formatiert Geldbeträge konsistent nach Schweizer Schreibweise. */
export function formatCHF(value: string | number): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
