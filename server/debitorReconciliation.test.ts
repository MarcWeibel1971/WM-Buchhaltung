import { describe, expect, it } from "vitest";
import { buildCamtReceiptSourceRef, calculateReconciledPayment, matchesInvoiceQrReference } from "../shared/paymentReconciliation";

describe("CAMT-Debitorenabgleich", () => {
  it("gleicht QR-Referenzen trotz Leerzeichen und Satzzeichen exakt ab", () => {
    expect(matchesInvoiceQrReference(
      "00 00000 00000 00000 00000 00017",
      { reference: "000000000000000000000000017" },
    )).toBe(true);
  });

  it("gleicht SCOR-Referenzen aus der unstrukturierten Zahlungsinformation ab", () => {
    expect(matchesInvoiceQrReference(
      "RF18 5390 0754 7034",
      { remittanceInfo: "Zahlung RF18539007547034" },
    )).toBe(false);
    expect(matchesInvoiceQrReference(
      "RF18 5390 0754 7034",
      { remittanceInfo: "RF18539007547034" },
    )).toBe(true);
  });

  it("führt Teilzahlungen und Vollzahlungen rappenpräzise", () => {
    expect(calculateReconciledPayment(100, 20, 30)).toEqual({
      paidAmount: 50,
      openAmount: 50,
      status: "partially_paid",
    });
    expect(calculateReconciledPayment(100, 99.99, 0.01)).toEqual({
      paidAmount: 100,
      openAmount: 0,
      status: "paid",
    });
  });

  it("erzeugt eine idempotente Quellreferenz innerhalb der Datenbanklänge", () => {
    const messageId = "M".repeat(200);
    const reference = "0".repeat(27);
    const first = buildCamtReceiptSourceRef(messageId, 0, reference);
    const second = buildCamtReceiptSourceRef(messageId, 1, reference);

    expect(first.length).toBeLessThanOrEqual(100);
    expect(first).not.toBe(second);
  });
});
