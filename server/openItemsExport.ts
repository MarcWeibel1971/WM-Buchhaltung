export type DebitorOpenItem = { invoiceNumber: string | null; customerName: string; invoiceDate: string; dueDate: string; total: string | number; paidAmount: string | number; currency: string; isOverdue: boolean; daysOverdue: number };

export function buildDebitorOpenItemsCsv(items: DebitorOpenItem[]) {
  const rows = ["Rechnungsnummer;Kunde;Rechnungsdatum;Fälligkeitsdatum;Rechnungsbetrag;Bezahlt;Offener Betrag;Währung;Überfällig;Tage überfällig"];
  for (const item of items) {
    const openAmount = Number(item.total) - Number(item.paidAmount);
    rows.push([item.invoiceNumber ?? "", item.customerName, item.invoiceDate, item.dueDate, Number(item.total).toFixed(2), Number(item.paidAmount).toFixed(2), openAmount.toFixed(2), item.currency, item.isOverdue ? "Ja" : "Nein", String(item.daysOverdue)].map(value => `"${value.replaceAll('"', '""')}"`).join(";"));
  }
  return `${rows.join("\n")}\n`;
}
