/**
 * Datums-Helfer (Audit): `new Date().toISOString().slice(0, 10)` liefert das
 * UTC-Datum. In der Schweiz ergibt das zwischen Mitternacht und 01:00 (Winter)
 * bzw. 02:00 (Sommer) den VORTAG – buchhalterisch relevant (Periodenabgrenzung,
 * Jahreswechsel). Diese Helfer arbeiten mit der lokalen Zeit des Browsers.
 */

/** Lokales Datum als `YYYY-MM-DD`. */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Heutiges lokales Datum als `YYYY-MM-DD`. */
export function todayISO(): string {
  return toLocalISODate(new Date());
}
