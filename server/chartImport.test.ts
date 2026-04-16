/**
 * Tests for Chart of Accounts Import (Excel parsing logic)
 */
import { describe, it, expect } from "vitest";

// ─── Helper functions extracted from Settings.tsx for testing ──────────────────

/** Find column value by trying multiple header variants (with/without *) */
function getCol(r: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null) return String(r[k]).trim();
    if (r[k + "*"] !== undefined && r[k + "*"] !== null) return String(r[k + "*"]).trim();
  }
  return "";
}

/** Map Kontoart from file to internal account type */
function mapAccountType(kontoart: string, num: number): string {
  const lower = kontoart.toLowerCase();
  if (lower === "aktiv" || lower === "aktiva" || lower === "asset") return "asset";
  if (lower === "passiv" || lower === "passiva" || lower === "liability") return "liability";
  if (lower === "aufwand" || lower === "expense") return "expense";
  if (lower === "ertrag" || lower === "revenue" || lower === "income") return "revenue";
  if (lower === "komplett" || lower === "equity" || lower === "eigenkapital") return "equity";
  // Fallback: determine from account number
  if (num >= 1000 && num < 2000) return "asset";
  if (num >= 2000 && num < 2800) return "liability";
  if (num >= 2800 && num < 3000) return "equity";
  if (num >= 3000 && num < 4000) return "revenue";
  if (num >= 4000 && num < 9000) return "expense";
  if (num >= 9000) return "equity";
  return "expense";
}

/** Parse a single row from Excel into an account object (or null if it should be skipped) */
function parseRow(r: Record<string, any>) {
  const num = getCol(r, "Nummer", "Konto", "Nr", "number", "Account", "Kontonummer");
  const name = getCol(r, "Name", "Bezeichnung", "Kontoname", "name", "Description");
  const kontoart = getCol(r, "Kontoart", "Typ", "Type", "accountType", "Art");
  const n = parseInt(num);
  if (isNaN(n) || n < 1000) return null;
  if (kontoart.toLowerCase() === "gruppe" || kontoart.toLowerCase() === "group") return null;
  const accountType = mapAccountType(kontoart, n);
  return { number: num, name, accountType };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getCol – column header matching", () => {
  it("matches exact header names", () => {
    expect(getCol({ Nummer: "1000" }, "Nummer")).toBe("1000");
    expect(getCol({ Name: "Kasse" }, "Name")).toBe("Kasse");
  });

  it("matches headers with asterisk suffix (Nummer*)", () => {
    expect(getCol({ "Nummer*": "1000" }, "Nummer")).toBe("1000");
    expect(getCol({ "Name*": "Kasse" }, "Name")).toBe("Kasse");
    expect(getCol({ "Kontoart*": "Aktiv" }, "Kontoart")).toBe("Aktiv");
  });

  it("tries multiple fallback keys", () => {
    expect(getCol({ Konto: "1000" }, "Nummer", "Konto")).toBe("1000");
    expect(getCol({ Bezeichnung: "Kasse" }, "Name", "Bezeichnung")).toBe("Kasse");
  });

  it("returns empty string when no key matches", () => {
    expect(getCol({ foo: "bar" }, "Nummer", "Konto")).toBe("");
  });

  it("trims whitespace", () => {
    expect(getCol({ "Nummer*": "  1000  " }, "Nummer")).toBe("1000");
  });
});

describe("mapAccountType – Kontoart mapping", () => {
  it("maps German account types correctly", () => {
    expect(mapAccountType("Aktiv", 1000)).toBe("asset");
    expect(mapAccountType("Passiv", 2000)).toBe("liability");
    expect(mapAccountType("Aufwand", 4000)).toBe("expense");
    expect(mapAccountType("Ertrag", 3000)).toBe("revenue");
    expect(mapAccountType("Komplett", 2800)).toBe("equity");
  });

  it("maps English account types correctly", () => {
    expect(mapAccountType("asset", 1000)).toBe("asset");
    expect(mapAccountType("liability", 2000)).toBe("liability");
    expect(mapAccountType("expense", 4000)).toBe("expense");
    expect(mapAccountType("revenue", 3000)).toBe("revenue");
    expect(mapAccountType("equity", 2800)).toBe("equity");
  });

  it("falls back to number-based detection when type is empty", () => {
    expect(mapAccountType("", 1000)).toBe("asset");
    expect(mapAccountType("", 1500)).toBe("asset");
    expect(mapAccountType("", 2000)).toBe("liability");
    expect(mapAccountType("", 2500)).toBe("liability");
    expect(mapAccountType("", 2800)).toBe("equity");
    expect(mapAccountType("", 2950)).toBe("equity");
    expect(mapAccountType("", 3000)).toBe("revenue");
    expect(mapAccountType("", 3500)).toBe("revenue");
    expect(mapAccountType("", 4000)).toBe("expense");
    expect(mapAccountType("", 6000)).toBe("expense");
    expect(mapAccountType("", 9000)).toBe("equity");
  });

  it("is case-insensitive", () => {
    expect(mapAccountType("AKTIV", 1000)).toBe("asset");
    expect(mapAccountType("passiv", 2000)).toBe("liability");
    expect(mapAccountType("Eigenkapital", 2800)).toBe("equity");
  });
});

describe("parseRow – row parsing and filtering", () => {
  it("parses a valid account row with Nummer* headers", () => {
    const row = { "Nummer*": "1000", "Name*": "Kassenkonto Kasse CHF", "Kontoart*": "Aktiv", "Gruppe*": "100" };
    const result = parseRow(row);
    expect(result).toEqual({ number: "1000", name: "Kassenkonto Kasse CHF", accountType: "asset" });
  });

  it("skips group rows (Kontoart = Gruppe)", () => {
    const row = { "Nummer*": "100", "Name*": "Flüssige Mittel", "Kontoart*": "Gruppe", "Gruppe*": "10" };
    expect(parseRow(row)).toBeNull();
  });

  it("skips rows with number < 1000 (group headers)", () => {
    const row = { "Nummer*": "1", "Name*": "Aktiven", "Kontoart*": "Gruppe" };
    expect(parseRow(row)).toBeNull();
    const row2 = { "Nummer*": "10", "Name*": "Umlaufvermögen", "Kontoart*": "Gruppe" };
    expect(parseRow(row2)).toBeNull();
  });

  it("parses Passiv accounts correctly", () => {
    const row = { "Nummer*": "2000", "Name*": "Kreditoren", "Kontoart*": "Passiv" };
    const result = parseRow(row);
    expect(result).toEqual({ number: "2000", name: "Kreditoren", accountType: "liability" });
  });

  it("parses Ertrag accounts correctly", () => {
    const row = { "Nummer*": "3200", "Name*": "Bruttoerlöse Barverkäufe", "Kontoart*": "Ertrag" };
    const result = parseRow(row);
    expect(result).toEqual({ number: "3200", name: "Bruttoerlöse Barverkäufe", accountType: "revenue" });
  });

  it("parses Aufwand accounts correctly", () => {
    const row = { "Nummer*": "4000", "Name*": "Materialaufwand", "Kontoart*": "Aufwand" };
    const result = parseRow(row);
    expect(result).toEqual({ number: "4000", name: "Materialaufwand", accountType: "expense" });
  });

  it("parses Komplett (equity) accounts correctly", () => {
    const row = { "Nummer*": "2800", "Name*": "Stammkapital", "Kontoart*": "Komplett" };
    const result = parseRow(row);
    expect(result).toEqual({ number: "2800", name: "Stammkapital", accountType: "equity" });
  });

  it("handles rows without Kontoart by using number fallback", () => {
    const row = { Nummer: "1020", Name: "Bank Raiffeisen CHF" };
    const result = parseRow(row);
    expect(result).toEqual({ number: "1020", name: "Bank Raiffeisen CHF", accountType: "asset" });
  });

  it("handles rows with standard headers (no asterisk)", () => {
    const row = { Nummer: "4740", Name: "Rechts- und Beratungsaufwand", Kontoart: "Aufwand" };
    const result = parseRow(row);
    expect(result).toEqual({ number: "4740", name: "Rechts- und Beratungsaufwand", accountType: "expense" });
  });
});

describe("Full import simulation – Borgas Advisory format", () => {
  const borgasRows = [
    { "Nummer*": "1", "Name*": "Aktiven", "Gruppe*": "", "Kontoart*": "Gruppe" },
    { "Nummer*": "10", "Name*": "Umlaufvermögen", "Gruppe*": "1", "Kontoart*": "Gruppe" },
    { "Nummer*": "100", "Name*": "Flüssige Mittel", "Gruppe*": "10", "Kontoart*": "Gruppe" },
    { "Nummer*": "1000", "Name*": "Kassenkonto Kasse CHF", "Gruppe*": "100", "Kontoart*": "Aktiv" },
    { "Nummer*": "1020", "Name*": "Bank Raiffeisen CHF", "Gruppe*": "100", "Kontoart*": "Aktiv" },
    { "Nummer*": "2000", "Name*": "Kreditoren", "Gruppe*": "200", "Kontoart*": "Passiv" },
    { "Nummer*": "2800", "Name*": "Stammkapital", "Gruppe*": "280", "Kontoart*": "Passiv" },
    { "Nummer*": "3200", "Name*": "Bruttoerlöse", "Gruppe*": "320", "Kontoart*": "Ertrag" },
    { "Nummer*": "4000", "Name*": "Materialaufwand", "Gruppe*": "400", "Kontoart*": "Aufwand" },
    { "Nummer*": "9200", "Name*": "Ausserordentlicher Ertrag", "Gruppe*": "920", "Kontoart*": "Komplett" },
  ];

  it("filters out group rows and keeps only bookable accounts", () => {
    const parsed = borgasRows.map(parseRow).filter(Boolean);
    expect(parsed).toHaveLength(7); // 3 groups filtered out
  });

  it("correctly maps all account types", () => {
    const parsed = borgasRows.map(parseRow).filter(Boolean) as any[];
    expect(parsed.find(a => a.number === "1000")?.accountType).toBe("asset");
    expect(parsed.find(a => a.number === "2000")?.accountType).toBe("liability");
    expect(parsed.find(a => a.number === "2800")?.accountType).toBe("liability"); // 2800 with Passiv type → liability
    expect(parsed.find(a => a.number === "3200")?.accountType).toBe("revenue");
    expect(parsed.find(a => a.number === "4000")?.accountType).toBe("expense");
    expect(parsed.find(a => a.number === "9200")?.accountType).toBe("equity"); // Komplett → equity
  });
});
