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

// Audit: Echte Kalenderprüfung – 31.02., 31.04., 29.02. in Nicht-Schaltjahren usw.
// wurden bisher akzeptiert (nur Bereichsprüfung 1–31). Date.UTC rollt ungültige
// Tage in den Folgemonat über; der Komponentenvergleich deckt das auf.
function isValidDate(y: string, m: string, d: string): boolean {
  const year = parseInt(y), month = parseInt(m), day = parseInt(d);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

// ─── CAMT.053 XML Parser ──────────────────────────────────────────────────────
/**
 * Extract the account IBAN from a CAMT.053 file (the statement account, not counterparty IBANs).
 * Returns null if not found.
 */
export function extractCAMT053AccountIban(xmlContent: string): string | null {
  // Try <Stmt><Acct><Id><IBAN>...
  const stmtMatch = xmlContent.match(/<Stmt[^>]*>[\s\S]*?<Acct>[\s\S]*?<Id>[\s\S]*?<IBAN>([^<]+)<\/IBAN>/);
  if (stmtMatch) return stmtMatch[1].replace(/\s/g, '').toUpperCase();
  // Fallback: first <IBAN> in the file (usually the statement account)
  const firstIban = xmlContent.match(/<IBAN>([^<]+)<\/IBAN>/);
  if (firstIban) return firstIban[1].replace(/\s/g, '').toUpperCase();
  return null;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Inhalt des ersten <Tag>…</Tag>-Blocks (ohne Attribute) oder undefined. */
function xmlBlock(scope: string, tag: string): string | undefined {
  const m = scope.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return m?.[1];
}

/** Text des ersten <Tag>…</Tag> (einzeilig) oder undefined. */
function xmlText(scope: string | undefined, tag: string): string | undefined {
  if (!scope) return undefined;
  const m = scope.match(new RegExp(`<${tag}(?:\\s[^>]*)?>(.*?)<\\/${tag}>`));
  return m?.[1];
}

interface CamtAmount { currency: string; amount: number }

function parseCamtAmount(scope: string | undefined): CamtAmount | undefined {
  if (!scope) return undefined;
  const m = scope.match(/<Amt Ccy="([^"]+)">\s*([\d.]+)\s*<\/Amt>/);
  if (!m) return undefined;
  const amount = parseFloat(m[2]);
  if (isNaN(amount)) return undefined;
  return { currency: m[1], amount };
}

interface CamtPartyInfo {
  reference?: string;
  counterparty?: string;
  counterpartyIban?: string;
  ustrd?: string;
}

// Audit: Gegenpartei richtungsabhängig bestimmen. Bei CRDT (Eingang) ist der
// <Cdtr> der Kontoinhaber selbst – die Gegenpartei ist der <Dbtr> (+ DbtrAcct).
// Bei DBIT (Ausgang) ist es umgekehrt der <Cdtr> (+ CdtrAcct). Bisher wurde
// immer zuerst der Cdtr genommen, d.h. bei Eingängen der eigene Name.
function extractCamtPartyInfo(scope: string, cdtDbtInd: "CRDT" | "DBIT" | undefined): CamtPartyInfo {
  const endToEndId = xmlText(scope, "EndToEndId");
  // Strukturierte Referenz (QR-Referenz aus QR-Rechnung) hat Priorität vor
  // der EndToEndId – nur sie erlaubt den automatischen Debitoren-Abgleich.
  const strdRef = xmlText(xmlBlock(scope, "CdtrRefInf"), "Ref");
  const reference = strdRef?.trim() ?? endToEndId;

  // Audit: Blöcke zuerst isolieren, damit <Dbtr> ohne <Nm> nicht versehentlich
  // den <Nm> des nachfolgenden <Cdtr> erwischt (lazy [\s\S]*? über Blockgrenzen).
  const cdtrName = xmlText(xmlBlock(scope, "Cdtr"), "Nm");
  const dbtrName = xmlText(xmlBlock(scope, "Dbtr"), "Nm");
  const cdtrIban = xmlText(xmlBlock(scope, "CdtrAcct"), "IBAN");
  const dbtrIban = xmlText(xmlBlock(scope, "DbtrAcct"), "IBAN");

  let counterparty: string | undefined;
  let counterpartyIban: string | undefined;
  if (cdtDbtInd === "CRDT") {
    counterparty = dbtrName;
    counterpartyIban = dbtrIban;
  } else if (cdtDbtInd === "DBIT") {
    counterparty = cdtrName;
    counterpartyIban = cdtrIban;
  } else {
    // Richtung unbekannt: bisheriges Verhalten (Cdtr vor Dbtr) beibehalten
    counterparty = cdtrName ?? dbtrName;
    counterpartyIban = cdtrIban ?? dbtrIban;
  }

  return {
    reference,
    counterparty: counterparty ? decodeXmlEntities(counterparty).trim() || undefined : undefined,
    counterpartyIban: counterpartyIban?.replace(/\s/g, "").trim() || undefined,
    ustrd: xmlText(scope, "Ustrd"),
  };
}

export function parseCAMT053(xmlContent: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  const entryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xmlContent)) !== null) {
    const entry = entryMatch[1];

    // Audit: Status prüfen – nur gebuchte Einträge (BOOK) importieren. PDNG/INFO
    // sind noch nicht auf dem Konto und würden sonst als Buchung landen.
    // Unterstützt <Sts>BOOK</Sts> (camt.053 v2) und <Sts><Cd>BOOK</Cd></Sts> (v8).
    const stsMatch = entry.match(/<Sts>\s*(?:<Cd>\s*)?([A-Za-z]+)\s*(?:<\/Cd>\s*)?<\/Sts>/);
    if (stsMatch && stsMatch[1].toUpperCase() !== "BOOK") continue;

    const entryAmt = parseCamtAmount(entry);
    if (!entryAmt) continue;

    const cdtDbtMatch = entry.match(/<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/);
    const entryCdtDbt = cdtDbtMatch?.[1] === "CRDT" || cdtDbtMatch?.[1] === "DBIT" ? cdtDbtMatch[1] : undefined;

    const bookingDateMatch = entry.match(/<BookgDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);
    const valueDateMatch = entry.match(/<ValDt>[\s\S]*?<Dt>([\d-]+)<\/Dt>/);

    if (!bookingDateMatch) continue;
    const transactionDate = normaliseDate(bookingDateMatch[1]);
    if (!transactionDate) continue; // Skip if date is invalid
    const valueDate = normaliseDate(valueDateMatch?.[1]) ?? undefined;

    const addtlNtryInf = xmlText(entry, "AddtlNtryInf");

    // Audit: Sammelbuchungen – ein <Ntry> kann mehrere <TxDtls> enthalten
    // (Sammelgutschrift bei QR-Zahlungen, Standard bei PostFinance/UBS). Bisher
    // wurde nur die erste Referenz mit dem Gesamtbetrag übernommen; die übrigen
    // Zahlungen gingen verloren und der Debitoren-Abgleich schlug fehl.
    const txDtlsBlocks: string[] = [];
    const txDtlsRegex = /<TxDtls>([\s\S]*?)<\/TxDtls>/g;
    let txMatch;
    while ((txMatch = txDtlsRegex.exec(entry)) !== null) txDtlsBlocks.push(txMatch[1]);

    if (txDtlsBlocks.length > 1) {
      const perTx: ParsedTransaction[] = [];
      for (const txDtl of txDtlsBlocks) {
        // Betrag: TxDtls/AmtDtls/TxAmt/Amt bevorzugt, sonst TxDtls/Amt direkt
        const txAmt = parseCamtAmount(xmlBlock(xmlBlock(txDtl, "AmtDtls") ?? "", "TxAmt"))
          ?? parseCamtAmount(txDtl);
        if (!txAmt) { perTx.length = 0; break; } // ohne Einzelbeträge kein Split möglich

        const txCdtDbtMatch = txDtl.match(/<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/);
        const txCdtDbt: "CRDT" | "DBIT" | undefined =
          txCdtDbtMatch?.[1] === "CRDT" || txCdtDbtMatch?.[1] === "DBIT" ? txCdtDbtMatch[1] : entryCdtDbt;
        const amount = txCdtDbt === "DBIT" ? -txAmt.amount : txAmt.amount;

        const info = extractCamtPartyInfo(txDtl, txCdtDbt);
        const description = info.ustrd ?? addtlNtryInf ?? "Bankbuchung";

        perTx.push({
          transactionDate,
          valueDate,
          amount: amount.toFixed(2),
          currency: txAmt.currency,
          description: decodeXmlEntities(description).trim(),
          reference: info.reference,
          counterparty: info.counterparty,
          counterpartyIban: info.counterpartyIban,
        });
      }
      if (perTx.length === txDtlsBlocks.length) {
        transactions.push(...perTx);
        continue;
      }
      // Fallback: Einzelbeträge unvollständig → Eintrag als Ganzes übernehmen
    }

    const amount = entryCdtDbt === "DBIT" ? -entryAmt.amount : entryAmt.amount;
    const info = extractCamtPartyInfo(entry, entryCdtDbt);
    const description = addtlNtryInf ?? info.ustrd ?? "Bankbuchung";

    transactions.push({
      transactionDate,
      valueDate,
      amount: amount.toFixed(2),
      currency: entryAmt.currency,
      description: decodeXmlEntities(description).trim(),
      reference: info.reference,
      counterparty: info.counterparty,
      counterpartyIban: info.counterpartyIban,
    });
  }

  return transactions;
}

// ─── MT940 Parser ─────────────────────────────────────────────────────────────
export function parseMT940(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = content.split("\n").map(l => l.trim());

  // Audit: Währung aus dem Eröffnungssaldo (:60F:/:60M:) übernehmen statt fix "CHF".
  // Format: [CD]YYMMDD<CCY>Betrag, z.B. C240101EUR1234,56
  let currency = "CHF";

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const balanceMatch = line.match(/^:60[FM]:[CD]\d{6}([A-Z]{3})/);
    if (balanceMatch) currency = balanceMatch[1];

    if (line.startsWith(":61:")) {
      const txLine = line.substring(4);
      // Format: YYMMDD[MMDD]<D|C|RD|RC>[Funds-Code]Betrag[N]TRN
      // Audit: SWIFT-gültige Varianten abdecken – RC/RD (Storno → Vorzeichen
      // umkehren), optionaler Funds-Code-Buchstabe (CF1234,56) und Beträge ohne
      // Nachkommastellen (1234,). "[CD]R?" bleibt für Funds-Code R erhalten.
      const dateMatch = txLine.match(/^(\d{6})(\d{4})?(R?[CD]|[CD]R?)([A-Z])?(\d+,\d*)/);
      if (dateMatch) {
        const transactionDate = normaliseDate(dateMatch[1]); // YYMMDD
        if (!transactionDate) { i++; continue; }

        const indicator = dateMatch[3];
        const isDebit = indicator.startsWith("D") || indicator === "RD";
        const isReversal = indicator.startsWith("R");
        const amountStr = dateMatch[5].replace(",", ".");
        let amount = parseFloat(amountStr);
        if (isNaN(amount)) { i++; continue; }
        if (isDebit) amount = -amount;
        if (isReversal) amount = -amount;

        let description = "MT940 Buchung";
        let reference = "";
        let counterparty = "";
        if (i + 1 < lines.length && lines[i + 1].startsWith(":86:")) {
          let descLine = lines[i + 1].substring(4);
          // Audit: :86: darf sich über mehrere Zeilen erstrecken (bis zum nächsten Tag).
          let k = i + 2;
          while (k < lines.length && lines[k] && !lines[k].startsWith(":") && lines[k] !== "-") {
            descLine += lines[k];
            k++;
          }
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
          currency,
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

// Audit: Minimaler RFC-4180-Splitter (Logik analog client/src/lib/readSpreadsheet.ts,
// bewusst nicht importiert – shared/ darf nicht von client/ oder server/ abhängen).
// Felder in doppelten Anführungszeichen dürfen das Trennzeichen, verdoppelte
// Anführungszeichen und Zeilenumbrüche enthalten.
export function splitCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some(c => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

// Audit: Robuste Betragserkennung. Akzeptiert "1'234.50", "1 234,50", "1.234,50",
// "-1234.50", "1234.50-", "CHF 1'234.50", "(1234.50)", Unicode-Minus und
// geschützte Leerzeichen. Gibt null zurück, wenn kein Betrag erkennbar ist
// (bisher parseFloat("") → NaN und die Zeile wurde stillschweigend verworfen).
export function parseAmount(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  let negative = false;
  // Klammern als Negativ-Notation
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  // Währungskürzel/-symbole und Buchstaben entfernen
  s = s.replace(/[A-Za-z]{3}\.?/g, "").replace(/[€$£]/g, "");
  // Unicode-Minus normalisieren, Leerzeichen (inkl. NBSP, schmales NBSP) und
  // Apostrophe (Schweizer Tausendertrennzeichen, inkl. typografische) entfernen
  s = s.replace(/[\u2212\u2013]/g, "-").replace(/[\s\u00A0\u202F]/g, "").replace(/['\u2019\u2018´`]/g, "");
  // Vorzeichen vorne oder hinten (SAP/Bank-Export "1234.50-")
  if (s.startsWith("-")) { negative = !negative; s = s.slice(1); }
  else if (s.startsWith("+")) { s = s.slice(1); }
  if (s.endsWith("-")) { negative = !negative; s = s.slice(0, -1); }
  else if (s.endsWith("+")) { s = s.slice(0, -1); }

  const hasDot = s.includes("."), hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // Das letzte Trennzeichen ist das Dezimaltrennzeichen, das andere Tausender
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    const commas = s.split(",").length - 1;
    const afterLast = s.length - s.lastIndexOf(",") - 1;
    // Einzelnes Komma mit 1–2 Nachkommastellen → Dezimalkomma, sonst Tausender
    if (commas === 1 && afterLast > 0 && afterLast <= 2) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasDot) {
    const dots = s.split(".").length - 1;
    // Mehrere Punkte → Tausendertrennzeichen (1.234.567)
    if (dots > 1) s = s.replace(/\./g, "");
  }

  s = s.replace(/[^\d.]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const value = parseFloat(s);
  if (isNaN(value)) return null;
  return negative ? -value : value;
}

export function parseCSV(content: string, options?: {
  delimiter?: string;
  dateColumn?: string | number;
  amountColumn?: string | number;
  descriptionColumn?: string | number;
  currencyColumn?: string | number;
  counterpartyColumn?: string | number;
}): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  const trimmed = content.replace(/^\uFEFF/, "");
  const firstLine = trimmed.split(/\r?\n/).find(l => l.trim()) ?? "";
  if (!firstLine) return [];

  // Auto-detect delimiter (Semikolon, Komma oder Tabulator)
  const delimiter = options?.delimiter ?? (() => {
    const counts: Array<[string, number]> = [
      [";", firstLine.split(";").length],
      [",", firstLine.split(",").length],
      ["\t", firstLine.split("\t").length],
    ];
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 1 ? counts[0][0] : ";";
  })();

  // Audit: RFC-4180-konform aufteilen statt naivem split(delimiter)
  const rows = splitCsvRows(trimmed, delimiter);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());

  const findCol = (names: string[], exclude?: RegExp): number => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name) && !(exclude && exclude.test(h)));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateCol = typeof options?.dateColumn === "number" ? options.dateColumn :
    findCol(["buchungsdatum", "datum", "date", "valuta", "buchung"]);

  // Audit: Layouts mit getrennten Gutschrift-/Belastungs-Spalten erkennen
  // (Raiffeisen, ZKB, PostFinance "Gutschrift in CHF"/"Lastschrift in CHF", UBS,
  // englische Exporte "Credit"/"Debit", "Haben"/"Soll", "Eingang"/"Ausgang").
  // Bisher wurde nur eine Spalte gefunden und alle Zeilen mit leerem Wert
  // (d.h. die jeweils andere Richtung) verworfen.
  const partyExclude = /creditor|debtor|kreditor|debitor|gläubiger|glaeubiger|schuldner/;
  let creditCol = -1, debitCol = -1;
  if (typeof options?.amountColumn !== "number") {
    creditCol = findCol(["gutschrift", "credit", "haben", "eingang"], partyExclude);
    debitCol = findCol(["belastung", "lastschrift", "debit", "soll", "ausgang"], partyExclude);
    if (creditCol === debitCol) { creditCol = -1; debitCol = -1; }
  }
  const twoColumn = creditCol >= 0 && debitCol >= 0;

  const amountCol = typeof options?.amountColumn === "number" ? options.amountColumn :
    twoColumn ? -1 : findCol(["betrag", "amount", "umsatz", "gutschrift", "belastung"]);
  const descCol = typeof options?.descriptionColumn === "number" ? options.descriptionColumn :
    findCol(["verwendungszweck", "buchungstext", "beschreibung", "description", "text", "zahlungsgrund", "mitteilung"]);
  const currencyCol = typeof options?.currencyColumn === "number" ? options.currencyColumn :
    findCol(["währung", "currency", "wahrung", "whrg"]);
  const counterpartyCol = typeof options?.counterpartyColumn === "number" ? options.counterpartyColumn :
    findCol(["auftraggeber", "empfänger", "beguenstigter", "counterparty", "name", "gegenpartei"]);

  if (dateCol < 0 || (amountCol < 0 && !twoColumn)) return [];

  const requiredCols = twoColumn ? Math.max(dateCol, creditCol, debitCol) : Math.max(dateCol, amountCol);

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].map(c => c.trim());
    if (cols.length < requiredCols + 1) continue;

    // Parse and validate date
    const transactionDate = normaliseDate(cols[dateCol]);
    if (!transactionDate) continue; // Skip rows with invalid dates

    let amount: number;
    if (twoColumn) {
      const credit = parseAmount(cols[creditCol]);
      const debit = parseAmount(cols[debitCol]);
      if (credit === null && debit === null) continue; // z.B. Saldo-/Infozeile
      // Belastung immer als Abgang werten – auch wenn die Bank sie bereits negativ exportiert
      amount = (credit ?? 0) - Math.abs(debit ?? 0);
    } else {
      const parsed = parseAmount(cols[amountCol]);
      if (parsed === null) continue;
      amount = parsed;
    }

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
    const amount = parseAmount(dateAmountMatch[3]);
    if (amount === null) continue;

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
