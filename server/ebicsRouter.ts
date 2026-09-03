/**
 * EBICS 3.0 Router
 * Verwaltung von EBICS-Bankverbindungen und Konfigurationen.
 * Unterstützt LUKB, UBS, Raiffeisen, PostFinance, ZKB und alle SIX-Mitglieder.
 */
import { z } from "zod";
import { router, orgProcedure, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { ebicsConfig } from "../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { encryptSecret } from "./secrets";

// Audit: adminProcedure garantiert keine Organisation – explizit prüfen.
function requireOrgId(organizationId: number | null | undefined): number {
  if (organizationId == null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Keine aktive Organisation. Bitte zuerst eine Organisation einrichten oder auswählen.",
    });
  }
  return organizationId;
}

export const ebicsRouter = router({
  // ─── Alle Konfigurationen abrufen ─────────────────────────────────────────
  // Audit: alle Prozeduren mandantenbezogen (orgProcedure + organizationId-Filter)
  getConfigs: orgProcedure.query(async ({ ctx }) => {
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
      .where(eq(ebicsConfig.organizationId, ctx.organizationId))
      .orderBy(desc(ebicsConfig.createdAt));
    return configs;
  }),

  // ─── Konfiguration speichern (erstellen oder aktualisieren) ───────────────
  saveConfig: orgProcedure
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
    .mutation(async ({ input, ctx }) => {
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
          .where(and(eq(ebicsConfig.organizationId, ctx.organizationId), eq(ebicsConfig.id, input.id)));
        return { id: input.id };
      } else {
        // Insert
        const [inserted] = await db
          .insert(ebicsConfig)
          .values({
            organizationId: ctx.organizationId, // Audit: aktive Organisation statt hardcoded 1
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
  // Audit: Löschen nur für Org-Admins, org-scoped
  deleteConfig: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = requireOrgId(ctx.organizationId);
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      await db
        .delete(ebicsConfig)
        .where(and(eq(ebicsConfig.organizationId, orgId), eq(ebicsConfig.id, input.id)));
      return { success: true };
    }),

  // ─── RSA-Schlüsselpaar generieren + INI-Brief erstellen ───────────────────
  // Audit: Schlüsselgenerierung nur für Org-Admins, org-scoped
  generateKeys: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = requireOrgId(ctx.organizationId);
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
        .where(and(eq(ebicsConfig.organizationId, orgId), eq(ebicsConfig.id, input.id)))
        .limit(1);

      if (!cfg) throw new Error("Konfiguration nicht gefunden");

      // Private Schlüssel AES-256-GCM-verschlüsselt speichern (Phase 2.2).
      // Wirft MissingMasterKeyError, wenn SECRETS_MASTER_KEY nicht gesetzt ist.
      await db
        .update(ebicsConfig)
        .set({
          signatureKeyPem: encryptSecret(sigPrivKey),
          authKeyPem: encryptSecret(authPrivKey),
          encKeyPem: encryptSecret(encPrivKey),
          initStatus: "ini_sent",
          updatedAt: new Date(),
        })
        .where(and(eq(ebicsConfig.organizationId, orgId), eq(ebicsConfig.id, input.id)));

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
  fetchNow: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const [cfg] = await db
        .select()
        .from(ebicsConfig)
        .where(and(eq(ebicsConfig.organizationId, ctx.organizationId), eq(ebicsConfig.id, input.id)))
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
        .where(and(eq(ebicsConfig.organizationId, ctx.organizationId), eq(ebicsConfig.id, input.id)));

      return {
        transactionsImported: 0,
        message:
          "EBICS-Verbindung bereit. Für den produktiven Datenabruf wird eine EBICS-Client-Bibliothek benötigt (z.B. ebics-node). Kontaktieren Sie uns für die vollständige Implementierung.",
      };
    }),
});
