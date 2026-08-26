/**
 * Creates a Swiss QR reference from a stable numeric identifier.
 * The 26-digit body is followed by its recursive Modulo-10 check digit.
 */
export function generateQrReference(id: number, year: number): string {
  const numericId = Math.max(0, Math.trunc(id));
  const base = String(year).slice(-2) + "0000" + String(numericId).padStart(20, "0");
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const character of base) {
    carry = table[(carry + Number.parseInt(character, 10)) % 10];
  }
  return `${base}${(10 - carry) % 10}`;
}

/** Accepts a 27-digit QRR with optional visual spaces and validates its check digit. */
export function isValidQrReference(reference: string): boolean {
  const digits = reference.replace(/\s/g, "");
  if (!/^\d{27}$/.test(digits)) return false;
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const character of digits) {
    carry = table[(carry + Number.parseInt(character, 10)) % 10];
  }
  return carry === 0;
}
