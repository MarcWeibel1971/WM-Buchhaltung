import { createHash } from "node:crypto";

export type PaymentReferenceSource = {
  reference?: string;
  remittanceInfo?: string;
};

/** Removes visual grouping characters while retaining the actual reference. */
export function normalizePaymentReference(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Identifies whether a CAMT payment contains the QR or SCOR reference of an
 * outgoing invoice. Exact normalized reference equality is required.
 */
export function matchesInvoiceQrReference(
  invoiceQrReference: string | null | undefined,
  payment: PaymentReferenceSource,
): boolean {
  const invoiceReference = normalizePaymentReference(invoiceQrReference);
  if (!invoiceReference) return false;

  return [payment.reference, payment.remittanceInfo]
    .map(normalizePaymentReference)
    .some(candidate => candidate === invoiceReference);
}

export function calculateReconciledPayment(
  total: number,
  paidSoFar: number,
  receivedAmount: number,
): { paidAmount: number; openAmount: number; status: "partially_paid" | "paid" } {
  const paidAmount = Math.round((paidSoFar + receivedAmount) * 100) / 100;
  const openAmount = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
  return {
    paidAmount,
    openAmount,
    status: openAmount <= 0.01 ? "paid" : "partially_paid",
  };
}

/**
 * Produces a stable, database-safe idempotency key for a single CAMT credit
 * entry. The digest protects uniqueness even when a long bank message ID must
 * be shortened to the 100-character journal source-reference limit.
 */
export function buildCamtReceiptSourceRef(messageId: string, entryIndex: number, reference: string): string {
  const fingerprint = createHash("sha256")
    .update(`${messageId}|${entryIndex}|${reference}`)
    .digest("hex")
    .slice(0, 20);
  const readableMessageId = normalizePaymentReference(messageId).slice(0, 48) || "UNKNOWN";
  return `camt054-receipt-${readableMessageId}-${entryIndex}-${fingerprint}`;
}
