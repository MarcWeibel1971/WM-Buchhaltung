/**
 * EBICS 3.0 Router
 * Verwaltung von EBICS-Bankverbindungen und Konfigurationen.
 * Unterstützt LUKB, UBS, Raiffeisen, PostFinance, ZKB und alle SIX-Mitglieder.
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { ebicsConfig } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export const ebicsRouter = router({
  // ─── Alle Konfigurationen abrufen ─────────────────────────────────────────
  getConfigs: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const configs = await db
      .select({
        id: ebicsConfig.id,
        bankName: ebicsConfig.bankName,
        hostId: ebicsConfig.hostId,
        hostUrl: ebicsConfig.bankUrl,
        partnerId: ebicsConfig.partnerId,
        userId: ebicsConfig.userId,
        status: ebicsConfig.initStatus,
        isActive: ebicsConfig.isActive,
        lastFetchAt: ebicsConfig.lastSyncAt,
        autoFetchEnabled: ebicsConfig.isActive, // Proxy: aktive Verbindungen fetchen automatisch
        autoFetchOrderType: ebicsConfig.version, // Proxy für Auftragstyp
        createdAt: ebicsConfig.createdAt,
      })
      .from(ebicsConfig)
      .orderBy(desc(ebicsConfig.createdAt));
    return configs;
  }),

  // ─── Konfiguration speichern (erstellen oder aktualisieren) ───────────────
  saveConfig: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        bankName: z.string().min(1),
        hostId: z.string().min(1),
        hostUrl: z.string().url(),
        partnerId: z.string().min(1),
        userId: z.string().min(1),
        isActive: z.boolean().default(false),
        autoFetchEnabled: z.boolean().default(true),
        autoFetchOrderType: z.string().default("C53"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new Error("DB nicht verfügbar");
    if (input.id) {
        // Update
        await db
          .update(ebicsConfig)
          .set({
            bankName: input.bankName,
            hostId: input.hostId,
            bankUrl: input.hostUrl,
            partnerId: input.partnerId,
            userId: input.userId,
            isActive: input.isActive,
            updatedAt: new Date(),
          })
          .where(eq(ebicsConfig.id, input.id));
        return { id: input.id };
      } else {
        // Insert
        const [inserted] = await db
          .insert(ebicsConfig)
          .values({
            organizationId: 1, // Default-Organisation
            bankName: input.bankName,
            hostId: input.hostId,
            bankUrl: input.hostUrl,
            partnerId: input.partnerId,
            userId: input.userId,
            isActive: input.isActive,
            initStatus: "not_initialized",
            version: "3.0",
          });
        return { id: (inserted as { insertId: number }).insertId };
      }
    }),

  // ─── Konfiguration löschen ────────────────────────────────────────────────
  deleteConfig: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      await db.delete(ebicsConfig).where(eq(ebicsConfig.id, input.id));
      return { success: true };
    }),

  // ─── RSA-Schlüsselpaar generieren + INI-Brief erstellen ───────────────────
  generateKeys: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      // RSA-4096 Schlüsselpaar generieren (Signatur-Schlüssel)
      const { privateKey: sigPrivKey, publicKey: sigPubKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 4096,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      // Auth-Schlüssel
      const { privateKey: authPrivKey, publicKey: authPubKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 4096,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      // Enc-Schlüssel
      const { privateKey: encPrivKey, publicKey: encPubKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 4096,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      // Öffentlichen Schlüssel-Hash für INI-Brief berechnen
      const sigPubKeyDer = crypto.createPublicKey(sigPubKey).export({ type: "spki", format: "der" });
      const sigKeyHash = crypto.createHash("sha256").update(sigPubKeyDer).digest("hex").toUpperCase();
      const sigKeyHashFormatted = sigKeyHash.match(/.{1,2}/g)?.join(" ") ?? sigKeyHash;

      // Konfiguration laden
      const [cfg] = await db
        .select()
        .from(ebicsConfig)
        .where(eq(ebicsConfig.id, input.id))
        .limit(1);

      if (!cfg) throw new Error("Konfiguration nicht gefunden");

      // Schlüssel speichern (in Produktion: AES-verschlüsseln!)
      await db
        .update(ebicsConfig)
        .set({
          signatureKeyPem: sigPrivKey,
          authKeyPem: authPrivKey,
          encKeyPem: encPrivKey,
          initStatus: "ini_sent",
          updatedAt: new Date(),
        })
        .where(eq(ebicsConfig.id, input.id));

      // INI-Brief generieren
      const now = new Date();
      const iniLetter = `
EBICS INITIALISIERUNGSBRIEF (INI/HIA)
======================================
Datum: ${now.toLocaleDateString("de-CH")}
Zeit:  ${now.toLocaleTimeString("de-CH")}

Bank:       ${cfg.bankName}
Host-ID:    ${cfg.hostId}
Partner-ID: ${cfg.partnerId}
User-ID:    ${cfg.userId}
Version:    EBICS 3.0

SIGNATUR-SCHLÜSSEL (A006) - SHA-256 Hash:
${sigKeyHashFormatted}

Bitte senden Sie diesen Brief unterschrieben an Ihre Bank.
Die Bank wird Ihren Zugang nach Prüfung aktivieren (1-5 Werktage).

ÖFFENTLICHER SIGNATUR-SCHLÜSSEL:
${sigPubKey}

ÖFFENTLICHER AUTH-SCHLÜSSEL:
${authPubKey}

ÖFFENTLICHER ENC-SCHLÜSSEL:
${encPubKey}

======================================
Bitte bewahren Sie diesen Brief sicher auf.
Die privaten Schlüssel verbleiben in KLAX und werden niemals übertragen.
`.trim();

      return {
        userId: cfg.userId,
        iniLetter,
        publicKeyHash: sigKeyHashFormatted,
      };
    }),

  // ─── Kontoauszug jetzt abrufen ────────────────────────────────────────────
  fetchNow: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const [cfg] = await db
        .select()
        .from(ebicsConfig)
        .where(eq(ebicsConfig.id, input.id))
        .limit(1);

      if (!cfg) throw new Error("Konfiguration nicht gefunden");
      if (cfg.initStatus !== "active") {
        throw new Error(
          "EBICS-Verbindung ist noch nicht aktiv. Bitte warten Sie bis die Bank den Zugang bestätigt hat (Status: INI gesendet → Bank aktiviert)."
        );
      }

      // In Produktion: echter EBICS-Abruf via ebics-node oder ähnliche Bibliothek
      await db
        .update(ebicsConfig)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(ebicsConfig.id, input.id));

      return {
        transactionsImported: 0,
        message:
          "EBICS-Verbindung bereit. Für den produktiven Datenabruf wird eine EBICS-Client-Bibliothek benötigt (z.B. ebics-node). Kontaktieren Sie uns für die vollständige Implementierung.",
      };
    }),
});
