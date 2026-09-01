/**
 * Storage-Abstraktion (Audit P1-6 / AP2.2).
 *
 * Zwei Provider, Auswahl über Umgebungsvariablen:
 * 1. Forge-Proxy (BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY) – Manus-Plattform
 * 2. Lokaler Dateispeicher (Fallback, optional LOCAL_STORAGE_DIR, Default
 *    ./data/uploads) – Self-Hosting ohne Plattform-Keys; Auslieferung über
 *    die bestehende Route /manus-storage/* (siehe _core/storageProxy.ts)
 *
 * Fehlermeldungen enthalten Ursache und Lösungshinweis.
 */
import { ENV } from "./_core/env";
import { promises as fs } from "fs";
import path from "path";

export type StorageConfig = { baseUrl: string; apiKey: string };

interface StorageProvider {
  put(
    relKey: string,
    data: Buffer | Uint8Array | string,
    contentType: string,
  ): Promise<{ key: string; url: string }>;
  get(relKey: string): Promise<{ key: string; url: string }>;
  delete(relKey: string): Promise<void>;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

// ─── Forge-Proxy (Manus-Plattform) ───────────────────────────────────────────

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

const forgeProvider: StorageProvider = {
  async put(relKey, data, contentType) {
    const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
    const apiKey = ENV.forgeApiKey;
    const key = normalizeKey(relKey);
    const uploadUrl = buildUploadUrl(baseUrl, key);
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: "POST",
        headers: buildAuthHeaders(apiKey),
        body: formData,
      });
    } catch (e: any) {
      throw new Error(
        `Beleg-Upload fehlgeschlagen: Storage-Proxy nicht erreichbar (${e?.message ?? e}). ` +
        `Ursache: BUILT_IN_FORGE_API_URL ist falsch oder der Dienst ist ausgefallen. ` +
        `Lösung: URL/Key prüfen oder LOCAL_STORAGE_DIR für den lokalen Modus setzen.`
      );
    }
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `Beleg-Upload fehlgeschlagen (${response.status} ${response.statusText}): ${message}. ` +
        `Ursache: Der Storage-Proxy hat den Upload abgelehnt. ` +
        `Lösung: BUILT_IN_FORGE_API_KEY prüfen oder LOCAL_STORAGE_DIR für den lokalen Modus setzen.`
      );
    }
    const url = (await response.json()).url;
    return { key, url };
  },

  async get(relKey) {
    const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
    const apiKey = ENV.forgeApiKey;
    const key = normalizeKey(relKey);
    const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
    downloadApiUrl.searchParams.set("path", key);
    const response = await fetch(downloadApiUrl, {
      method: "GET",
      headers: buildAuthHeaders(apiKey),
    });
    if (!response.ok) {
      throw new Error(
        `Download-URL konnte nicht erzeugt werden (${response.status}). ` +
        `Ursache: Storage-Proxy-Fehler. Lösung: BUILT_IN_FORGE_API_KEY prüfen.`
      );
    }
    return { key, url: (await response.json()).url };
  },

  async delete(relKey) {
    const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
    const apiKey = ENV.forgeApiKey;
    const key = normalizeKey(relKey);
    const deleteUrl = new URL("v1/storage/delete", ensureTrailingSlash(baseUrl));
    deleteUrl.searchParams.set("path", key);
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: buildAuthHeaders(apiKey),
    });
  },
};

// ─── Lokaler Dateispeicher (Self-Hosting-Fallback) ───────────────────────────

export function getLocalStorageDir(): string {
  return process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "data", "uploads");
}

/** Pfad innerhalb des Storage-Roots auflösen (mit Traversal-Schutz). */
export function resolveLocalKey(key: string): string {
  const root = path.resolve(getLocalStorageDir());
  const abs = path.resolve(root, normalizeKey(key));
  if (!abs.startsWith(root + path.sep)) {
    throw new Error(`Ungültiger Storage-Key: ${key}`);
  }
  return abs;
}

const localProvider: StorageProvider = {
  async put(relKey, data, contentType) {
    const key = normalizeKey(relKey);
    const abs = resolveLocalKey(key);
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, typeof data === "string" ? Buffer.from(data) : Buffer.from(data));
    } catch (e: any) {
      throw new Error(
        `Beleg-Upload fehlgeschlagen: lokales Storage-Verzeichnis nicht beschreibbar (${e?.message ?? e}). ` +
        `Ursache: fehlende Schreibrechte auf ${getLocalStorageDir()}. ` +
        `Lösung: Verzeichnis anlegen/Rechte setzen oder LOCAL_STORAGE_DIR anpassen.`
      );
    }
    // Auslieferung über /manus-storage/* (storageProxy serviert lokal, wenn
    // kein Forge-Proxy konfiguriert ist)
    return { key, url: `/manus-storage/${key.split("/").map(encodeURIComponent).join("/")}` };
  },

  async get(relKey) {
    const key = normalizeKey(relKey);
    return { key, url: `/manus-storage/${key.split("/").map(encodeURIComponent).join("/")}` };
  },

  async delete(relKey) {
    const abs = resolveLocalKey(relKey);
    await fs.unlink(abs).catch(() => undefined);
  },
};

// ─── Provider-Auswahl ────────────────────────────────────────────────────────

export function getActiveStorageProvider(): "forge" | "local" {
  return ENV.forgeApiUrl && ENV.forgeApiKey ? "forge" : "local";
}

function getProvider(): StorageProvider {
  return getActiveStorageProvider() === "forge" ? forgeProvider : localProvider;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  return getProvider().put(relKey, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  return getProvider().get(relKey);
}

export async function storageDelete(relKey: string): Promise<void> {
  return getProvider().delete(relKey);
}
