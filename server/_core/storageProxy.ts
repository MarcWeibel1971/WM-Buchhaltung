import type { Express } from "express";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { ENV } from "./env";
import { createLogger } from "./logger";
import { resolveLocalKey } from "../storage";
import { sdk } from "./sdk";

const logger = createLogger("storageProxy");

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    // Audit: Belege, Rechnungs-PDFs und Vorlagen sind vertrauliche
    // Finanzdaten – Auslieferung nur mit gültiger Session. Der Schlüssel
    // allein (nanoid) ist kein Zugriffsschutz, sobald ein Link geteilt oder
    // in Logs/Verlauf sichtbar wird.
    try {
      await sdk.authenticateRequest(req);
    } catch {
      res.status(401).send("Nicht authentifiziert");
      return;
    }
    const key = decodeURIComponent(req.path.replace(/^\/manus-storage\//, ""));
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    // Audit P1-6/AP2.2: ohne Forge-Konfiguration aus dem lokalen
    // Storage-Verzeichnis ausliefern (Self-Hosting-Fallback).
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      try {
        const abs = resolveLocalKey(key);
        const info = await stat(abs);
        if (!info.isFile()) throw new Error("not a file");
        res.set("Content-Type", CONTENT_TYPES[path.extname(abs).toLowerCase()] ?? "application/octet-stream");
        res.set("Content-Length", String(info.size));
        res.set("Cache-Control", "private, max-age=3600");
        createReadStream(abs).pipe(res);
      } catch {
        res.status(404).send("Datei nicht gefunden");
      }
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        logger.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      logger.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
