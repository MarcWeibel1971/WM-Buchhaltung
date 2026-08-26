export type AccountLedgerExportLine = { bookingDate: string; entryNumber: string | null; description: string; side: "debit" | "credit"; amount: string | number };

export function buildAccountLedgerCsv({ accountNumber, accountName, fiscalYear, openingBalance, lines }: { accountNumber: string; accountName: string; fiscalYear: number; openingBalance: number; lines: AccountLedgerExportLine[] }) {
  let balance = openingBalance;
  const rows = ["Datum;Belegnummer;Beschreibung;Soll;Haben;Saldo"];
  for (const line of lines) {
    const amount = Number(line.amount);
    balance += line.side === "debit" ? amount : -amount;
    rows.push([line.bookingDate, line.entryNumber ?? "", line.description, line.side === "debit" ? amount.toFixed(2) : "", line.side === "credit" ? amount.toFixed(2) : "", balance.toFixed(2)].map(value => `\"${value.replaceAll("\"", "\"\"")}\"`).join(";"));
  }
  return { filename: `Kontenblatt_${accountNumber}_${fiscalYear}.csv`, csv: `Kontenblatt ${accountNumber} ${accountName};Eröffnungssaldo;${openingBalance.toFixed(2)}\n${rows.join("\n")}\n` };
}
