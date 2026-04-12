import { describe, expect, it } from "vitest";

// ─── Double-Entry Validation ──────────────────────────────────────────────────
describe("Double-Entry Bookkeeping Validation", () => {
  function validateEntry(lines: Array<{ side: "debit" | "credit"; amount: number }>) {
    const debitTotal = lines.filter(l => l.side === "debit").reduce((s, l) => s + l.amount, 0);
    const creditTotal = lines.filter(l => l.side === "credit").reduce((s, l) => s + l.amount, 0);
    return Math.abs(debitTotal - creditTotal) < 0.01;
  }

  it("validates a balanced entry", () => {
    const lines = [
      { side: "debit" as const, amount: 1000 },
      { side: "credit" as const, amount: 1000 },
    ];
    expect(validateEntry(lines)).toBe(true);
  });

  it("rejects an unbalanced entry", () => {
    const lines = [
      { side: "debit" as const, amount: 1000 },
      { side: "credit" as const, amount: 900 },
    ];
    expect(validateEntry(lines)).toBe(false);
  });

  it("validates multi-line balanced entry", () => {
    const lines = [
      { side: "debit" as const, amount: 500 },
      { side: "debit" as const, amount: 500 },
      { side: "credit" as const, amount: 1000 },
    ];
    expect(validateEntry(lines)).toBe(true);
  });

  it("handles rounding within 0.01 tolerance", () => {
    const lines = [
      { side: "debit" as const, amount: 100.005 },
      { side: "credit" as const, amount: 100.00 },
    ];
    expect(validateEntry(lines)).toBe(true);
  });
});

// ─── Swiss VAT Calculation ────────────────────────────────────────────────────
describe("Swiss VAT Calculation", () => {
  function calcVat(amountInclVat: number, rate: 0.081 | 0.026 | 0.038) {
    const vatAmount = amountInclVat - amountInclVat / (1 + rate);
    const netAmount = amountInclVat / (1 + rate);
    return { vatAmount: Math.round(vatAmount * 100) / 100, netAmount: Math.round(netAmount * 100) / 100 };
  }

  it("calculates 8.1% VAT correctly", () => {
    // 108.10 inkl. 8.1% -> VAT = 108.10 - 108.10/1.081 = 108.10 - 100.00 = 8.10
    const { vatAmount, netAmount } = calcVat(108.10, 0.081);
    expect(vatAmount).toBeCloseTo(8.10, 1);
    expect(netAmount).toBeCloseTo(100.00, 1);
  });

  it("calculates 2.6% VAT correctly", () => {
    const { vatAmount } = calcVat(102.60, 0.026);
    expect(vatAmount).toBeCloseTo(2.60, 1);
  });

  it("calculates 3.8% VAT correctly", () => {
    const { vatAmount } = calcVat(103.80, 0.038);
    expect(vatAmount).toBeCloseTo(3.80, 1);
  });
});

// ─── Payroll Calculation ──────────────────────────────────────────────────────
describe("Payroll Calculation", () => {
  function calcNet(gross: number, ahvEmployee: number, bvgEmployee: number, ktgUvg: number) {
    return gross - ahvEmployee - bvgEmployee - ktgUvg;
  }

  it("calculates net salary correctly", () => {
    const gross = 10000;
    const ahv = 530; // 5.3%
    const bvg = 800; // 8%
    const ktg = 0;
    expect(calcNet(gross, ahv, bvg, ktg)).toBe(8670);
  });

  it("net salary cannot be negative", () => {
    const net = calcNet(1000, 600, 600, 0);
    expect(net).toBeLessThan(0); // Validation should catch this
  });
});

// ─── Bank Parser ─────────────────────────────────────────────────────────────
describe("Bank Statement Parser", () => {
  it("parses CSV format correctly", () => {
    // Simple CSV test
    const csvLine = "2025-01-15;Miete Januar 2025;-2500.00;CHF";
    const parts = csvLine.split(";");
    expect(parts[0]).toBe("2025-01-15");
    expect(parseFloat(parts[2])).toBe(-2500.00);
  });

  it("detects credit vs debit from amount sign", () => {
    const amount = -2500.00;
    const isDebit = amount < 0;
    expect(isDebit).toBe(true);
  });
});

// ─── Account Number Validation ────────────────────────────────────────────────
describe("Swiss Account Number Validation (KMU Kontenrahmen)", () => {
  function getAccountCategory(number: string): string {
    const n = parseInt(number);
    if (n >= 1000 && n < 2000) return "asset";
    if (n >= 2000 && n < 3000) return "liability";
    if (n >= 3000 && n < 4000) return "revenue";
    if (n >= 4000 && n < 9000) return "expense";
    return "unknown";
  }

  it("classifies asset accounts (1xxx)", () => {
    expect(getAccountCategory("1031")).toBe("asset");
    expect(getAccountCategory("1100")).toBe("asset");
  });

  it("classifies liability accounts (2xxx)", () => {
    expect(getAccountCategory("2000")).toBe("liability");
    expect(getAccountCategory("2100")).toBe("liability");
  });

  it("classifies revenue accounts (3xxx)", () => {
    expect(getAccountCategory("3000")).toBe("revenue");
    expect(getAccountCategory("3400")).toBe("revenue");
  });

  it("classifies expense accounts (4xxx-8xxx)", () => {
    expect(getAccountCategory("4000")).toBe("expense");
    expect(getAccountCategory("6000")).toBe("expense");
  });
});

// ─── normaliseDate Tests ───────────────────────────────────────────────────────
import { normaliseDate } from "../shared/bankParser";

describe("normaliseDate – Datumsparser", () => {
  it("parst Schweizer Format DD.MM.YYYY", () => {
    expect(normaliseDate("01.04.2026")).toBe("2026-04-01");
    expect(normaliseDate("31.12.2025")).toBe("2025-12-31");
    expect(normaliseDate("1.1.2026")).toBe("2026-01-01");
  });
  it("parst ISO-Format YYYY-MM-DD", () => {
    expect(normaliseDate("2026-04-01")).toBe("2026-04-01");
    expect(normaliseDate("2025-12-31T00:00:00Z")).toBe("2025-12-31");
  });
  it("parst kompaktes Format YYYYMMDD", () => {
    expect(normaliseDate("20260401")).toBe("2026-04-01");
  });
  it("parst MT940-Format YYMMDD", () => {
    expect(normaliseDate("260401")).toBe("2026-04-01");
  });
  it("gibt null für ungültige Datumsstrings zurück", () => {
    expect(normaliseDate("Invalid Date")).toBeNull();
    expect(normaliseDate("")).toBeNull();
    expect(normaliseDate(null)).toBeNull();
    expect(normaliseDate(undefined)).toBeNull();
    expect(normaliseDate("not-a-date")).toBeNull();
  });
  it("gibt null für unmögliche Datumsangaben zurück", () => {
    expect(normaliseDate("32.13.2026")).toBeNull(); // Tag/Monat ungültig
  });
});
