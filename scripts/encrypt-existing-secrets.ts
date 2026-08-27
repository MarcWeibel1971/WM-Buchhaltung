/**
 * Einmal-Migration (Phase 2.2): Verschlüsselt bestehende Klartext-Secrets in
 * pos_config (apiKey, webhookSecret) und ebics_config (signatureKeyPem,
 * authKeyPem, encKeyPem) mit AES-256-GCM.
 *
 * Voraussetzung: SECRETS_MASTER_KEY ist gesetzt (64 Hex-Zeichen).
 * Ausführen:   pnpm tsx scripts/encrypt-existing-secrets.ts
 *
 * Idempotent: Bereits verschlüsselte Werte (enc:v1:…) werden übersprungen.
 */
import { getDb } from "../server/db";
import { posConfig, ebicsConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { encryptSecret, isEncryptedSecret, hasSecretsMasterKey } from "../server/secrets";

async function main() {
  if (!hasSecretsMasterKey()) {
    console.error("FEHLER: SECRETS_MASTER_KEY ist nicht gesetzt (64 Hex-Zeichen, `openssl rand -hex 32`).");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("FEHLER: Keine Datenbankverbindung (DATABASE_URL gesetzt?).");
    process.exit(1);
  }

  let updated = 0, skipped = 0;

  // ─── pos_config ───────────────────────────────────────────────────────────
  const posRows = await db.select().from(posConfig);
  for (const row of posRows) {
    const set: Record<string, string> = {};
    if (row.apiKey && !isEncryptedSecret(row.apiKey)) set.apiKey = encryptSecret(row.apiKey);
    if (row.webhookSecret && !isEncryptedSecret(row.webhookSecret)) set.webhookSecret = encryptSecret(row.webhookSecret);
    if (Object.keys(set).length > 0) {
      await db.update(posConfig).set(set).where(eq(posConfig.id, row.id));
      console.log(`pos_config #${row.id}: ${Object.keys(set).join(", ")} verschlüsselt`);
      updated++;
    } else {
      skipped++;
    }
  }

  // ─── ebics_config ─────────────────────────────────────────────────────────
  const ebicsRows = await db.select().from(ebicsConfig);
  for (const row of ebicsRows) {
    const set: Record<string, string> = {};
    if (row.signatureKeyPem && !isEncryptedSecret(row.signatureKeyPem)) set.signatureKeyPem = encryptSecret(row.signatureKeyPem);
    if (row.authKeyPem && !isEncryptedSecret(row.authKeyPem)) set.authKeyPem = encryptSecret(row.authKeyPem);
    if (row.encKeyPem && !isEncryptedSecret(row.encKeyPem)) set.encKeyPem = encryptSecret(row.encKeyPem);
    if (Object.keys(set).length > 0) {
      await db.update(ebicsConfig).set(set).where(eq(ebicsConfig.id, row.id));
      console.log(`ebics_config #${row.id}: ${Object.keys(set).join(", ")} verschlüsselt`);
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\nFertig: ${updated} Datensätze verschlüsselt, ${skipped} bereits verschlüsselt oder leer.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration fehlgeschlagen:", e);
  process.exit(1);
});
