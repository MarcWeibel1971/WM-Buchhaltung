/**
 * Bank statement parsers for CAMT.053, MT940, CSV and PDF formats.
 * Used server-side to parse uploaded bank statements.
 */

export interface ParsedTransaction {
  transactionDate: string;  // ISO date string YYYY-MM-DD (guaranteed valid)
  valueDate?: string;
  amount: string;           // Positive = credit, negative = debit
  currency: string;
  description: string;
  reference?: string;
  counterparty?: string;
  counterpartyIban?: string;
}

/**
 * Normalise any date string to YYYY-MM-DD.
 * Returns null if the date cannot be parsed.
 */
export function normaliseDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // DD.MM.YYYY or D.M.YYYY (Swiss format)
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) {
    const y = dmy[3], m = dmy[2].padStart(2, "0"), d = dmy[1].padStart(2, "0");
    return isValidDate(y, m, d) ? `${y}-${m}-${d}` : null;
  }
  // YYYY-MM-DD (ISO)
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return isValidDate(ymd[1], ymd[2], ymd[3]) ? `${ymd[1]}-${ymd[2]}-${ymd[3]}` : null;
  }
  // YYYYMMDD compact (MT940 style)
  if (/^\d{8}$/.test(s)) {
    const y = s.substring(0, 4), m = s.substring(4, 6), d = s.substring(6, 8);
    return isValidDate(y, m, d) ? `${y}-${m}-${d}` : null;
  }
  // YYMMDD compact (MT940 :61: style)
  if (/^\d{6}$/.test(s)) {
    const y = String(parseInt(s.substring(0, 2)) + 2000);
    const m = s.substring(2, 4), d = s.substring(4, 6);
    return isValidDate(y, m, d) ? `${y}-${m}-${d}` : null;
  }
  // MM/DD/YYYY (US format)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const y = mdy[3], m = mdy[1].padStart(2, "0"), d = mdy[2].padStart(2, "0");
    return isValidDate(y, m, d) ? `${y}-${m}-${d}` : null;
  }
  // DD.MM.YY (2-digit year)
  const dmy2 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (dmy2) {
    const y = String(parseInt(dmy2[3]) + 2000);
    const m = dmy2[2].padStart(2, "0"), d = dmy2[1].padStart(2, "0");
    return isValidDate(y, m, d) ? `${y}-${m}-${d}` : null;
  }
  return null;
}

function isValidDate(y: string, m: string, d: string): boolean {
  const year = parseInt(y), month = parseInt(m), day = parseInt(d);
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

// ─── CAMT.053 XML Parser ──────────────────────────────────────────────────────
export function parseCAMT053(xmlContent: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  const entryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xmlContent)) !== null) {
    const entry = entryMatch[1];

    const amtMatch = entry.match(/<Amt Ccy="([^"]+)">([\d.]+)<\/Amt>/);
    if (!amtMatch) continue;
    const currency = amtMatch[1];
    let amount = parseFloat(amtMatch[2]);

    const cdtDbtMatch = entry.match(/<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/);
    if (cdtDbtMatch && cdtDbtMatch[1] === "DBIT") amount = -amount;

    const bookingDateMatch = entry.match(/<BookgDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);
    const valueDateMatch = entry.match(/<ValDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);

    if (!bookingDateMatch) continue;
    const transactionDate = normaliseDate(bookingDateMatch[1]);
    if (!transactionDate) continue; // Skip if date is invalid

    const addtlInfoMatch = entry.match(/<AddtlNtryInf>(.*?)<\/AddtlNtryInf>/);
    const ustrdMatch = entry.match(/<Ustrd>(.*?)<\/Ustrd>/);
    const description = addtlInfoMatch?.[1] ?? ustrdMatch?.[1] ?? "Bankbuchung";

    const endToEndMatch = entry.match(/<EndToEndId>(.*?)<\/EndToEndId>/);
    const creditorNameMatch = entry.match(/<Cdtr>[\s\S]*?<Nm>(.*?)<\/Nm>/);
    const debtorNameMatch = entry.match(/<Dbtr>[\s\S]*?<Nm>(.*?)<\/Nm>/);
    const counterparty = creditorNameMatch?.[1] ?? debtorNameMatch?.[1];
    const creditorIbanMatch = entry.match(/<CdtrAcct>[\s\S]*?<Id>[\s\S]*?<IBAN>(.*?)<\/IBAN>/);
    const debtorIbanMatch = entry.match(/<DbtrAcct>[\s\S]*?<Id>[\s\S]*?<IBAN>(.*?)<\/IBAN>/);
    const counterpartyIban = creditorIbanMatch?.[1] ?? debtorIbanMatch?.[1];

    transactions.push({
      transactionDate,
      valueDate: normaliseDate(valueDateMatch?.[1]) ?? undefined,
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

    if (line.startsWith(":61:")) {
      const txLine = line.substring(4);
      // Format: YYMMDD[MMDD]C/D[R]Amount[N]TRN
      const dateMatch = txLine.match(/^(\d{6})(\d{4})?([CD]R?)(\d+,\d+)/);
      if (dateMatch) {
        const transactionDate = normaliseDate(dateMatch[1]); // YYMMDD
        if (!transactionDate) { i++; continue; }

        const isDebit = dateMatch[3].startsWith("D");
        const amountStr = dateMatch[4].replace(",", ".");
        let amount = parseFloat(amountStr);
        if (isDebit) amount = -amount;

        let description = "MT940 Buchung";
        let reference = "";
        let counterparty = "";
        if (i + 1 < lines.length && lines[i + 1].startsWith(":86:")) {
          const descLine = lines[i + 1].substring(4);
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
          transactionDate,
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

  // Try semicolon first, then comma
  const rawLines = content.split("\n").filter(l => l.trim());
  if (rawLines.length < 2) return [];

  // Auto-detect delimiter
  const firstLine = rawLines[0];
  const delimiter = options?.delimiter ??
    (firstLine.split(";").length > firstLine.split(",").length ? ";" : ",");

  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const findCol = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateCol = typeof options?.dateColumn === "number" ? options.dateColumn :
    findCol(["buchungsdatum", "datum", "date", "valuta", "buchung"]);
  const amountCol = typeof options?.amountColumn === "number" ? options.amountColumn :
    findCol(["betrag", "amount", "umsatz", "gutschrift", "belastung"]);
  const descCol = typeof options?.descriptionColumn === "number" ? options.descriptionColumn :
    findCol(["verwendungszweck", "buchungstext", "beschreibung", "description", "text", "zahlungsgrund", "mitteilung"]);
  const currencyCol = typeof options?.currencyColumn === "number" ? options.currencyColumn :
    findCol(["währung", "currency", "wahrung", "whrg"]);
  const counterpartyCol = typeof options?.counterpartyColumn === "number" ? options.counterpartyColumn :
    findCol(["auftraggeber", "empfänger", "beguenstigter", "counterparty", "name", "gegenpartei"]);

  if (dateCol < 0 || amountCol < 0) return [];

  for (let i = 1; i < rawLines.length; i++) {
    const cols = rawLines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < Math.max(dateCol, amountCol) + 1) continue;

    // Parse and validate date
    const transactionDate = normaliseDate(cols[dateCol]);
    if (!transactionDate) continue; // Skip rows with invalid dates

    // Parse amount (Swiss format: 1'234.56 or 1.234,56 or -1234.56)
    let rawAmount = cols[amountCol];
    rawAmount = rawAmount.replace(/'/g, "").replace(/\s/g, "");
    // Handle European format: 1.234,56 → 1234.56
    if (/\d+\.\d{3},\d{2}$/.test(rawAmount)) {
      rawAmount = rawAmount.replace(/\./g, "").replace(",", ".");
    } else {
      // Swiss format: 1'234.56 or plain 1234.56
      rawAmount = rawAmount.replace(/,(\d{2})$/, ".$1").replace(/[^\d.-]/g, "");
    }
    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) continue;

    const description = descCol >= 0 ? cols[descCol] : "CSV Import";
    const currency = currencyCol >= 0 && cols[currencyCol] ? cols[currencyCol] : "CHF";
    const counterparty = counterpartyCol >= 0 ? cols[counterpartyCol] : undefined;

    transactions.push({
      transactionDate,
      amount: amount.toFixed(2),
      currency: currency || "CHF",
      description: description || "CSV Import",
      counterparty: counterparty || undefined,
    });
  }

  return transactions;
}

// ─── PDF Text Parser (for AI-extracted text) ─────────────────────────────────
/**
 * Parse transactions from plain text extracted from a PDF bank statement.
 * The text is expected to contain lines with date, description, and amount patterns.
 */
export function parsePDFText(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Pattern: DD.MM.YYYY ... amount (Swiss format)
    // Example: "01.04.2026 Dauerauftrag Miete 1'500.00"
    // Example: "01.04.2026 01.04.2026 Gutschrift 2'500.00"
    const dateAmountMatch = line.match(
      /^(\d{1,2}\.\d{1,2}\.\d{4})\s+(.*?)\s+([-+]?\d[\d'.]*(?:,\d{2})?(?:\.\d{2})?)\s*$/
    );
    if (!dateAmountMatch) continue;

    const transactionDate = normaliseDate(dateAmountMatch[1]);
    if (!transactionDate) continue;

    const description = dateAmountMatch[2].trim();
    let rawAmount = dateAmountMatch[3].replace(/'/g, "").replace(",", ".");
    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) continue;

    transactions.push({
      transactionDate,
      amount: amount.toFixed(2),
      currency: "CHF",
      description: description || "PDF Import",
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
  } else if (lower.endsWith(".pdf")) {
    // PDF text content (pre-extracted by server)
    return parsePDFText(content);
  } else {
    return parseCSV(content);
  }
}
