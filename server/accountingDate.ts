/**
 * Normalisiert importierte oder manuell eingegebene Datumswerte für Drizzle-Date-Spalten.
 */
export function toDateStr(value: string | Date | undefined | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString().substring(0, 10);
  }
  const normalized = String(value).trim();
  const dmy = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.substring(0, 10);
  const mdy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  if (/^\d{8}$/.test(normalized)) return `${normalized.substring(0, 4)}-${normalized.substring(4, 6)}-${normalized.substring(6, 8)}`;
  return undefined;
}
