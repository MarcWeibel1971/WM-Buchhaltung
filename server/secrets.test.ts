import { describe, it, expect, beforeAll } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  isEncryptedSecret,
  maskSecret,
  isMaskedPlaceholder,
  prepareSecretForWrite,
  hasSecretsMasterKey,
  MissingMasterKeyError,
} from "./secrets";

const TEST_KEY = "a".repeat(64); // 32 Bytes, nur für Tests

beforeAll(() => {
  process.env.SECRETS_MASTER_KEY = TEST_KEY;
});

describe("Secret-Verschlüsselung (AES-256-GCM)", () => {
  it("Roundtrip: encrypt → decrypt liefert Klartext", () => {
    const secret = "sk_live_51abc123def456";
    const enc = encryptSecret(secret);
    expect(isEncryptedSecret(enc)).toBe(true);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("jede Verschlüsselung erzeugt eigenen IV (kein deterministisches Muster)", () => {
    const a = encryptSecret("gleiches-geheimnis");
    const b = encryptSecret("gleiches-geheimnis");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("PEM-Keys (mehrzeilig) überstehen den Roundtrip", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBg\n-----END PRIVATE KEY-----";
    expect(decryptSecret(encryptSecret(pem))).toBe(pem);
  });

  it("Manipulation am Ciphertext wird erkannt (GCM-Tag)", () => {
    const enc = encryptSecret("geheim");
    const parts = enc.split(":");
    // Ein Zeichen im Ciphertext kippen
    const ct = parts[4];
    parts[4] = (ct[0] === "A" ? "B" : "A") + ct.slice(1);
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("Legacy-Klartext wird unverändert durchgereicht (Rückwärtskompatibilität)", () => {
    expect(decryptSecret("sk_live_plaintext")).toBe("sk_live_plaintext");
    expect(isEncryptedSecret("sk_live_plaintext")).toBe(false);
  });

  it("wirft MissingMasterKeyError ohne konfigurierten Key", () => {
    const original = process.env.SECRETS_MASTER_KEY;
    delete process.env.SECRETS_MASTER_KEY;
    expect(hasSecretsMasterKey()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(MissingMasterKeyError);
    process.env.SECRETS_MASTER_KEY = original;
    expect(hasSecretsMasterKey()).toBe(true);
  });

  it("wirft bei ungültigem Key-Format", () => {
    const original = process.env.SECRETS_MASTER_KEY;
    process.env.SECRETS_MASTER_KEY = "zu-kurz";
    expect(() => encryptSecret("x")).toThrow(MissingMasterKeyError);
    process.env.SECRETS_MASTER_KEY = original;
  });
});

describe("maskSecret", () => {
  it("maskiert Klartext mit letzten 4 Zeichen", () => {
    expect(maskSecret("sk_live_51abc123def456")).toBe("••••f456");
  });

  it("maskiert verschlüsselte Werte korrekt", () => {
    expect(maskSecret(encryptSecret("whsec_9876543210"))).toBe("••••3210");
  });

  it("gibt null für leere Werte und •••• für Kurze", () => {
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret("")).toBeNull();
    expect(maskSecret("abc")).toBe("••••");
  });
});

describe("prepareSecretForWrite", () => {
  it("verschlüsselt Klartext", () => {
    const out = prepareSecretForWrite("sk_live_new");
    expect(isEncryptedSecret(out as string)).toBe(true);
    expect(decryptSecret(out as string)).toBe("sk_live_new");
  });

  it("Masken-Platzhalter → undefined (bestehenden Wert behalten)", () => {
    expect(prepareSecretForWrite("••••f456")).toBeUndefined();
    expect(isMaskedPlaceholder("••••f456")).toBe(true);
  });

  it("bereits verschlüsselte Werte bleiben unverändert", () => {
    const enc = encryptSecret("bereits-verschluesselt");
    expect(prepareSecretForWrite(enc)).toBe(enc);
  });

  it("undefined/leer wird durchgereicht", () => {
    expect(prepareSecretForWrite(undefined)).toBeUndefined();
    expect(prepareSecretForWrite("")).toBe("");
  });
});
