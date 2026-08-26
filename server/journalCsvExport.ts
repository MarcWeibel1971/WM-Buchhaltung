type JournalEntryExportRow = {
  id: number;
  entryNumber: string | null;
  bookingDate: string;
  description: string;
  source: string;
  status: string;
};

type JournalLineExportRow = {
  id: number;
  entryId: number;
  accountId: number;
  side: "debit" | "credit";
  amount: string | number;
  description: string | null;
  vatRate: string | number | null;
  vatAmount: string | number | null;
};

type AccountExportRow = { id: number; number: string; name: string };

export function buildJournalCsvExport(
  entries: JournalEntryExportRow[],
  lines: JournalLineExportRow[],
  accounts: AccountExportRow[],
  fiscalYear: number,
) {
  const accountMap = new Map(accounts.map(account => [account.id, account]));
  const rows: string[] = [
    "Belegnummer;Datum;Konto;Kontoname;Gegenkonto;Gegenkontoname;Soll;Haben;Beschreibung;MWST-Satz;MWST-Betrag;Quelle;Status",
  ];

  for (const entry of entries) {
    const entryLines = lines.filter(line => line.entryId === entry.id);
    for (const line of entryLines) {
      const account = accountMap.get(line.accountId);
      const counterLine = entryLines.find(other => other.id !== line.id && other.side !== line.side);
      const counterAccount = counterLine ? accountMap.get(counterLine.accountId) : null;
      const [year, month, day] = entry.bookingDate.split("-");

      rows.push([
        entry.entryNumber || "", `${day}.${month}.${year}`, account?.number || "", account?.name || "",
        counterAccount?.number || "", counterAccount?.name || "",
        line.side === "debit" ? Number(line.amount).toFixed(2) : "",
        line.side === "credit" ? Number(line.amount).toFixed(2) : "",
        (line.description || entry.description).replace(/;/g, ","),
        line.vatRate ? `${line.vatRate}%` : "",
        line.vatAmount ? Number(line.vatAmount).toFixed(2) : "",
        entry.source, entry.status,
      ].join(";"));
    }
  }

  return { csv: `${rows.join("\n")}\n`, filename: `Journal_${fiscalYear}.csv`, entryCount: entries.length };
}
