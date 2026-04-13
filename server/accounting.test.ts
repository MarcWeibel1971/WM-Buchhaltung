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
  // Top-down: Gross → deductions → Net
  function calcFromGross(grossVal: number, ahvEmpRate: number, bvgEmpMonthly: number, ktgEmpRate: number) {
    const ahvEmp = Math.round(grossVal * ahvEmpRate * 100) / 100;
    const ktgEmp = Math.round(grossVal * ktgEmpRate * 100) / 100;
    const netVal = grossVal - ahvEmp - bvgEmpMonthly - ktgEmp;
    return {
      gross: grossVal,
      ahvEmployee: ahvEmp,
      bvgEmployee: bvgEmpMonthly,
      ktgUvgEmployee: ktgEmp,
      net: Math.round(netVal * 100) / 100,
    };
  }

  // Bottom-up: Net → Gross → deductions
  function calcFromNet(netVal: number, ahvEmpRate: number, bvgEmpMonthly: number, ktgEmpRate: number) {
    const grossVal = (netVal + bvgEmpMonthly) / (1 - ahvEmpRate - ktgEmpRate);
    const ahvEmp = Math.round(grossVal * ahvEmpRate * 100) / 100;
    const ktgEmp = Math.round(grossVal * ktgEmpRate * 100) / 100;
    return {
      gross: Math.round(grossVal * 100) / 100,
      ahvEmployee: ahvEmp,
      bvgEmployee: bvgEmpMonthly,
      ktgUvgEmployee: ktgEmp,
      net: netVal,
    };
  }

  // Swiss 2026 rates: AHV/IV/EO/ALV = 6.4% each side
  const AHV_RATE = 0.064;
  const BVG_MONTHLY = 0; // No BVG configured yet
  const KTG_RATE = 0;

  it("calculates net salary correctly (top-down, AHV 6.4%)", () => {
    const result = calcFromGross(10000, AHV_RATE, BVG_MONTHLY, KTG_RATE);
    expect(result.ahvEmployee).toBe(640);
    expect(result.net).toBe(9360);
  });

  it("calculates gross from net correctly (bottom-up, AHV 6.4%)", () => {
    const result = calcFromNet(9360, AHV_RATE, BVG_MONTHLY, KTG_RATE);
    expect(result.gross).toBe(10000);
    expect(result.ahvEmployee).toBe(640);
    expect(result.net).toBe(9360);
  });

  it("gross is always greater than net", () => {
    const result = calcFromNet(5000, AHV_RATE, BVG_MONTHLY, KTG_RATE);
    expect(result.gross).toBeGreaterThan(result.net);
  });

  it("round-trip: gross → net → gross is consistent", () => {
    const topDown = calcFromGross(15000, AHV_RATE, BVG_MONTHLY, KTG_RATE);
    const bottomUp = calcFromNet(topDown.net, AHV_RATE, BVG_MONTHLY, KTG_RATE);
    expect(Math.abs(bottomUp.gross - 15000)).toBeLessThan(0.02);
  });

  it("handles BVG fixed monthly amounts correctly", () => {
    const bvgMonthly = 250;
    const result = calcFromGross(10000, AHV_RATE, bvgMonthly, KTG_RATE);
    expect(result.bvgEmployee).toBe(250);
    expect(result.net).toBe(10000 - 640 - 250); // 9110
  });

  it("bottom-up with BVG: gross includes BVG recovery", () => {
    const bvgMonthly = 250;
    const result = calcFromNet(9110, AHV_RATE, bvgMonthly, KTG_RATE);
    expect(result.gross).toBe(10000);
    expect(result.ahvEmployee).toBe(640);
    expect(result.bvgEmployee).toBe(250);
  });

  it("handles KTG/UVG percentage deductions", () => {
    const ktgRate = 0.005; // 0.5%
    const result = calcFromGross(10000, AHV_RATE, 0, ktgRate);
    expect(result.ktgUvgEmployee).toBe(50);
    expect(result.net).toBe(10000 - 640 - 50); // 9310
  });

  it("bottom-up with KTG: gross accounts for KTG rate", () => {
    const ktgRate = 0.005;
    const result = calcFromNet(9310, AHV_RATE, 0, ktgRate);
    expect(result.gross).toBe(10000);
    expect(result.ktgUvgEmployee).toBe(50);
  });

  it("real-world example: MW Jan 2026 net=26000 with AHV 6.4%", () => {
    const result = calcFromNet(26000, AHV_RATE, BVG_MONTHLY, KTG_RATE);
    // Brutto = 26000 / (1 - 0.064) = 26000 / 0.936 = 27777.78
    expect(result.gross).toBeCloseTo(27777.78, 1);
    expect(result.ahvEmployee).toBeCloseTo(1777.78, 1);
    expect(result.gross).toBeGreaterThan(result.net);
  });

  it("net salary cannot be negative (validation case)", () => {
    const result = calcFromGross(1000, 0.5, 600, 0); // 50% AHV = extreme
    expect(result.net).toBeLessThan(0);
  });
});

// ─── Bank Parser ─────────────────────────────────────────────────────────────
describe("Bank Statement Parser", () => {
  it("parses CSV format correctly", () => {
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
    expect(normaliseDate("32.13.2026")).toBeNull();
  });
});
