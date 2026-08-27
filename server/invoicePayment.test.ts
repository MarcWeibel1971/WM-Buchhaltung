import { describe, it, expect } from "vitest";
import { computeInvoicePaymentState } from "./db";

describe("computeInvoicePaymentState (Debitoren-Zahlungsabgleich)", () => {
  it("Vollzahlung → paid mit paidDate", () => {
    const r = computeInvoicePaymentState(1250.00, 0, 1250.00, "2026-07-15", null);
    expect(r.status).toBe("paid");
    expect(r.paidAmount).toBe(1250.00);
    expect(r.openAmount).toBe(0);
    expect(r.paidDate).toBe("2026-07-15");
  });

  it("Teilzahlung → partially_paid ohne paidDate", () => {
    const r = computeInvoicePaymentState(1250.00, 0, 500.00, "2026-07-15", null);
    expect(r.status).toBe("partially_paid");
    expect(r.paidAmount).toBe(500.00);
    expect(r.openAmount).toBe(750.00);
    expect(r.paidDate).toBeNull();
  });

  it("Restzahlung nach Teilzahlung → paid", () => {
    const r = computeInvoicePaymentState(1250.00, 500.00, 750.00, "2026-08-01", null);
    expect(r.status).toBe("paid");
    expect(r.openAmount).toBe(0);
    expect(r.paidDate).toBe("2026-08-01");
  });

  it("Rappen-Toleranz: 1 Rp Differenz gilt als Vollzahlung", () => {
    const r = computeInvoicePaymentState(100.00, 0, 99.99, "2026-07-15", null);
    expect(r.status).toBe("paid");
  });

  it("Überzahlung → paid mit negativem Restbetrag", () => {
    const r = computeInvoicePaymentState(100.00, 0, 120.00, "2026-07-15", null);
    expect(r.status).toBe("paid");
    expect(r.openAmount).toBe(-20.00);
  });

  it("Fliesskomma-sicher bei Rappenbeträgen", () => {
    const r = computeInvoicePaymentState(23.80, 0, 23.80, "2026-07-15", null);
    expect(r.status).toBe("paid");
    expect(r.openAmount).toBe(0);
  });
});
