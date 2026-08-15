/**
 * Zentrale Secret-Verschlüsselung für at-rest gespeicherte Zugangsdaten
 * (Phase 2.2 / Techn. K3): EBICS-Private-Keys, POS-API-Keys, Webhook-Secrets.
 *
 * - AES-256-GCM (authentifizierte Verschlüsselung, Manipulation wird erkannt)
 * - Master-Key via Env `SECRETS_MASTER_KEY` (64 Hex-Zeichen = 32 Bytes,
 *   generieren mit `openssl rand -hex 32`)
 * - Speicherformat: `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 * - Rückwärtskompatibilität: `decryptSecret` gibt Legacy-Klartext unverändert
 *   zurück (erkennbar am fehlenden `enc:v1:`-Präfix). So funktionieren
 *   bestehende Datensätze weiter, bis sie per Migrationsskript
 *   (`scripts/encrypt-existing-secrets.ts`) oder beim nächsten Update
 *   verschlüsselt werden.
 */
import crypto from "crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12; // GCM-Standard

export class MissingMasterKeyError extends Error {
  constructor() {
    super(
      "SECRETS_MASTER_KEY ist nicht gesetzt oder ungültig. " +
      "Erwartet werden 64 Hex-Zeichen (32 Bytes), z. B. via `openssl rand -hex 32`. " +
      "Secrets können ohne Master-Key nicht verschlüsselt werden."
    );
    this.name = "MissingMasterKeyError";
  }
}

function getMasterKey(): Buffer {
  const hex = process.env.SECRETS_MASTER_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new MissingMasterKeyError();
  return Buffer.from(hex, "hex");
}

/** true, wenn ein gültiger Master-Key konfiguriert ist. */
export function hasSecretsMasterKey(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(process.env.SECRETS_MASTER_KEY?.trim() ?? "");
}

/** true, wenn der Wert bereits verschlüsselt ist (enc:v1-Präfix). */
export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Verschlüsselt einen Klartext-Secret. Wirft MissingMasterKeyError ohne Key. */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Entschlüsselt einen Wert. Legacy-Klartext (ohne enc:v1-Präfix) wird
 * unverändert durchgereicht. Wirft bei manipuliertem/ungültigem Ciphertext.
 */
export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) return value;
  const body = value.slice(PREFIX.length);
  const [ivB64, tagB64, ctB64] = body.split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Ungültiges Secret-Format (enc:v1 erwartet iv:tag:ciphertext)");
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/**
 * Maskiert ein Secret für API-Antworten an den Client: "••••" + letzte 4
 * Zeichen. Verschlüsselte Werte werden dafür kurz entschlüsselt.
 * Gibt null zurück für leere Werte.
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  let plain: string;
  try {
    plain = decryptSecret(value);
  } catch {
    // Nicht entschlüsselbar (z. B. fehlender Key) → nichts preisgeben
    return "••••";
  }
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}

/** true, wenn der Wert ein Masken-Platzhalter aus dem Client ist (nicht speichern!). */
export function isMaskedPlaceholder(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("••••");
}

/**
 * Bereitet ein Secret-Feld für den DB-Write vor:
 * - undefined/null/leer → wird vom Aufrufer als "kein Update" behandelt
 * - Masken-Platzhalter → null (Aufrufer behält bestehenden Wert)
 * - bereits verschlüsselt → unverändert
 * - Klartext → verschlüsselt
 */
export function prepareSecretForWrite(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null || value === "") return value;
  if (isMaskedPlaceholder(value)) return undefined;
  if (isEncryptedSecret(value)) return value;
  return encryptSecret(value);
}
