/**
 * Einheitlicher Reader für Import-Dateien (.xlsx / .csv).
 * Ersetzt das SheetJS-`xlsx`-Paket (bekannte, ungepatchte CVEs) durch ExcelJS
 * plus einen kleinen CSV-Parser mit UTF-8/Latin-1-Fallback für Umlaute.
 *
 * Das veraltete binäre .xls-Format wird nicht unterstützt – klare Fehlermeldung.
 */

function cellToValue(v: unknown): unknown {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if ("result" in o) return o.result ?? "";
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text: string }>).map(t => t.text).join("");
    }
    if (typeof o.hyperlink === "string") return o.text ?? o.hyperlink;
    return String(v);
  }
  return v;
}

/** Minimaler CSV-Parser (RFC-4180-ähnlich, Delimiter-Autodetect ; , Tab). */
export function parseCsvText(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = [";", ",", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best, ";");

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
    } else if (ch === delim) {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some(c => c !== "")) rows.push(row);
  }
  return rows;
}

async function readCsv(data: ArrayBuffer): Promise<string[][]> {
  let text: string;
  try {
    // fatal: true erzwingt einen Fehler bei ungültigem UTF-8 → Latin-1-Fallback
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    text = new TextDecoder("iso-8859-1").decode(data);
  }
  return parseCsvText(text);
}

/**
 * Liest eine .xlsx- oder .csv-Datei und liefert alle Zeilen als Matrix
 * (erste Zeile = Header). Entspricht XLSX.utils.sheet_to_json(ws, {header: 1}).
 */
export async function readSpreadsheetRows(file: File): Promise<unknown[][]> {
  const data = await file.arrayBuffer();
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) return readCsv(data);
  if (name.endsWith(".xls")) {
    throw new Error("Das veraltete .xls-Format wird nicht mehr unterstützt. Bitte die Datei in Excel als .xlsx oder .csv neu speichern.");
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    // ExcelJS-Zeilen sind 1-basiert (Index 0 = undefined)
    const values = (row.values as unknown[]).slice(1);
    rows.push(values.map(cellToValue));
  });
  return rows;
}

/**
 * Wie readSpreadsheetRows, aber als Objekte: erste Zeile = Header-Keys.
 * Entspricht XLSX.utils.sheet_to_json(ws).
 */
export async function readSpreadsheetObjects(file: File): Promise<Record<string, unknown>[]> {
  const rows = await readSpreadsheetRows(file);
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => String(h ?? "").trim());
  return rows.slice(1)
    .map(r => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { if (h) obj[h] = r[i] ?? ""; });
      return obj;
    })
    .filter(o => Object.values(o).some(v => v !== "" && v != null));
}
