/**
 * Audit: Tests für die SumUp-Signaturprüfung (HMAC-SHA256 über den Raw-Body).
 * Keine Datenbank nötig.
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifySumUpSignature } from "./posWebhook";

const secret = "sumup-webhook-secret-123";
const rawBody = Buffer.from(JSON.stringify({ id: "tx_1", event_type: "SUCCESSFUL", amount: "12.50" }));
const validSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

describe("verifySumUpSignature", () => {
  it("akzeptiert eine korrekte Signatur", () => {
    expect(verifySumUpSignature(rawBody, validSig, secret)).toBe(true);
  });

  it("akzeptiert die Signatur unabhängig von Gross-/Kleinschreibung und Whitespace", () => {
    expect(verifySumUpSignature(rawBody, `  ${validSig.toUpperCase()}  `, secret)).toBe(true);
  });

  it("lehnt eine Signatur mit falschem Secret ab", () => {
    expect(verifySumUpSignature(rawBody, validSig, "anderes-secret")).toBe(false);
  });

  it("lehnt eine Signatur ab, wenn der Body manipuliert wurde", () => {
    const tampered = Buffer.from(JSON.stringify({ id: "tx_1", event_type: "SUCCESSFUL", amount: "999.00" }));
    expect(verifySumUpSignature(tampered, validSig, secret)).toBe(false);
  });

  it("wirft bei abweichender Signaturlänge nicht, sondern liefert false", () => {
    expect(verifySumUpSignature(rawBody, "abc", secret)).toBe(false);
    expect(verifySumUpSignature(rawBody, "", secret)).toBe(false);
  });

  it("ist gegen Re-Serialisierung robust (Raw-Body statt JSON.stringify)", () => {
    // Anderer Whitespace im Raw-Body → andere Signatur
    const prettyBody = Buffer.from(JSON.stringify({ id: "tx_1", event_type: "SUCCESSFUL", amount: "12.50" }, null, 2));
    expect(verifySumUpSignature(prettyBody, validSig, secret)).toBe(false);
    const prettySig = crypto.createHmac("sha256", secret).update(prettyBody).digest("hex");
    expect(verifySumUpSignature(prettyBody, prettySig, secret)).toBe(true);
  });
});
