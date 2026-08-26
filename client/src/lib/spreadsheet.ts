import ExcelJS from "exceljs";

export async function readSpreadsheetRows(file: File): Promise<string[][]> {
  const data = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(data);
    const delimiter = text.split("\n").find((line) => line.trim())?.includes(";") ? ";" : ",";
    return text.split(/\r?\n/).filter(Boolean).map((line) => line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, "")));
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Die Datei enthält kein Tabellenblatt.");
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(values.map((value) => value == null ? "" : String(value)));
  });
  return rows;
}

export async function readSpreadsheetRecords(file: File): Promise<Record<string, string>[]> {
  const rows = await readSpreadsheetRows(file);
  const [header = [], ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((value) => value.trim() !== ""))
    .map((row) => Object.fromEntries(header.map((key, index) => [key.trim(), row[index] ?? ""])));
}
