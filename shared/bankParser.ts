/**
 * Bank statement parsers for CAMT.053, MT940, and CSV formats.
 * Used server-side to parse uploaded bank statements.
 */

export interface ParsedTransaction {
  transactionDate: string;  // ISO date string
  valueDate?: string;
  amount: string;           // Positive = credit, negative = debit
  currency: string;
  description: string;
  reference?: string;
  counterparty?: string;
  counterpartyIban?: string;
}

// ─── CAMT.053 XML Parser ──────────────────────────────────────────────────────
export function parseCAMT053(xmlContent: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Extract all Ntry (entry) blocks
  const entryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xmlContent)) !== null) {
    const entry = entryMatch[1];

    // Amount
    const amtMatch = entry.match(/<Amt Ccy="([^"]+)">([\d.]+)<\/Amt>/);
    if (!amtMatch) continue;
    const currency = amtMatch[1];
    let amount = parseFloat(amtMatch[2]);

    // Credit/Debit indicator
    const cdtDbtMatch = entry.match(/<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/);
    if (cdtDbtMatch && cdtDbtMatch[1] === "DBIT") amount = -amount;

    // Booking date
    const bookingDateMatch = entry.match(/<BookgDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);
    const valueDateMatch = entry.match(/<ValDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);

    if (!bookingDateMatch) continue;

    // Description (Addtl info or Rmtinf)
    const addtlInfoMatch = entry.match(/<AddtlNtryInf>(.*?)<\/AddtlNtryInf>/);
    const ustrdMatch = entry.match(/<Ustrd>(.*?)<\/Ustrd>/);
    const description = addtlInfoMatch?.[1] ?? ustrdMatch?.[1] ?? "Bankbuchung";

    // Reference
    const endToEndMatch = entry.match(/<EndToEndId>(.*?)<\/EndToEndId>/);

    // Counterparty
    const creditorNameMatch = entry.match(/<Cdtr>[\s\S]*?<Nm>(.*?)<\/Nm>/);
    const debtorNameMatch = entry.match(/<Dbtr>[\s\S]*?<Nm>(.*?)<\/Nm>/);
    const counterparty = creditorNameMatch?.[1] ?? debtorNameMatch?.[1];

    // Counterparty IBAN
    const creditorIbanMatch = entry.match(/<CdtrAcct>[\s\S]*?<Id>[\s\S]*?<IBAN>(.*?)<\/IBAN>/);
    const debtorIbanMatch = entry.match(/<DbtrAcct>[\s\S]*?<Id>[\s\S]*?<IBAN>(.*?)<\/IBAN>/);
    const counterpartyIban = creditorIbanMatch?.[1] ?? debtorIbanMatch?.[1];

    transactions.push({
      transactionDate: bookingDateMatch[1],
      valueDate: valueDateMatch?.[1],
      amount: amount.toFixed(2),
      currency,
      description: description.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
      reference: endToEndMatch?.[1],
      counterparty: counterparty?.trim(),
      counterpartyIban: counterpartyIban?.trim(),
    });
  }

  return transactions;
}

// ─── MT940 Parser ─────────────────────────────────────────────────────────────
export function parseMT940(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = content.split("\n").map(l => l.trim());

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // :61: Transaction line
    // Format: :61:YYMMDD[MMDD]C/D[R]Amount[N]TRN[//Reference]
    if (line.startsWith(":61:")) {
      const txLine = line.substring(4);
      // Parse date (YYMMDD)
      const dateMatch = txLine.match(/^(\d{6})(\d{4})?([CD]R?)(\d+,\d+)/);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        const year = parseInt(dateStr.substring(0, 2)) + 2000;
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        const isoDate = `${year}-${month}-${day}`;

        const isDebit = dateMatch[3].startsWith("D");
        const amountStr = dateMatch[4].replace(",", ".");
        let amount = parseFloat(amountStr);
        if (isDebit) amount = -amount;

        // Look for :86: description line
        let description = "MT940 Buchung";
        let reference = "";
        let counterparty = "";
        if (i + 1 < lines.length && lines[i + 1].startsWith(":86:")) {
          const descLine = lines[i + 1].substring(4);
          // MT940 :86: format: ?20...?21...?30...?31...?32...
          const parts = descLine.split(/\?(\d{2})/);
          const descMap: Record<string, string> = {};
          for (let j = 1; j < parts.length; j += 2) {
            descMap[parts[j]] = parts[j + 1] ?? "";
          }
          description = [descMap["20"], descMap["21"], descMap["22"]].filter(Boolean).join(" ").trim() || descLine;
          reference = descMap["20"] ?? "";
          counterparty = [descMap["32"], descMap["33"]].filter(Boolean).join(" ").trim();
        }

        transactions.push({
          transactionDate: isoDate,
          amount: amount.toFixed(2),
          currency: "CHF",
          description,
          reference,
          counterparty: counterparty || undefined,
        });
      }
    }
    i++;
  }

  return transactions;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
export function parseCSV(content: string, options?: {
  delimiter?: string;
  dateColumn?: string | number;
  amountColumn?: string | number;
  descriptionColumn?: string | number;
  currencyColumn?: string | number;
  counterpartyColumn?: string | number;
}): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const delimiter = options?.delimiter ?? ";";
  const lines = content.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  // Auto-detect columns
  const findCol = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateCol = typeof options?.dateColumn === "number" ? options.dateColumn :
    findCol(["datum", "date", "buchungsdatum", "valuta"]);
  const amountCol = typeof options?.amountColumn === "number" ? options.amountColumn :
    findCol(["betrag", "amount", "umsatz", "saldo"]);
  const descCol = typeof options?.descriptionColumn === "number" ? options.descriptionColumn :
    findCol(["verwendungszweck", "beschreibung", "description", "text", "buchungstext", "zahlungsgrund"]);
  const currencyCol = typeof options?.currencyColumn === "number" ? options.currencyColumn :
    findCol(["währung", "currency", "wahrung"]);
  const counterpartyCol = typeof options?.counterpartyColumn === "number" ? options.counterpartyColumn :
    findCol(["auftraggeber", "empfänger", "counterparty", "name", "gegenpartei"]);

  if (dateCol < 0 || amountCol < 0) return [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < Math.max(dateCol, amountCol) + 1) continue;

    // Parse date (various formats)
    const rawDate = cols[dateCol];
    let isoDate = rawDate;
    const dmyMatch = rawDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    const ymdMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dmyMatch) {
      isoDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
    } else if (ymdMatch) {
      isoDate = rawDate.substring(0, 10);
    }

    // Parse amount (handle Swiss format: 1'234.56 or 1.234,56)
    let rawAmount = cols[amountCol];
    rawAmount = rawAmount.replace(/'/g, "").replace(/,(\d{2})$/, ".$1").replace(/[^\d.-]/g, "");
    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) continue;

    const description = descCol >= 0 ? cols[descCol] : "CSV Import";
    const currency = currencyCol >= 0 ? cols[currencyCol] : "CHF";
    const counterparty = counterpartyCol >= 0 ? cols[counterpartyCol] : undefined;

    transactions.push({
      transactionDate: isoDate,
      amount: amount.toFixed(2),
      currency: currency || "CHF",
      description,
      counterparty: counterparty || undefined,
    });
  }

  return transactions;
}

// ─── Auto-detect and parse ────────────────────────────────────────────────────
export function parseStatement(content: string, filename: string): ParsedTransaction[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xml") || content.includes("<Document") || content.includes("camt.053")) {
    return parseCAMT053(content);
  } else if (content.includes(":61:") || content.includes(":20:")) {
    return parseMT940(content);
  } else {
    return parseCSV(content);
  }
}
