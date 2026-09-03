import type { Request } from "express";
import { ENV } from "./env";

/**
 * Vertrauenswürdige öffentliche Basis-URL für Links, die per E-Mail
 * verschickt werden (E-Mail-Verifizierung, Passwort-Reset, Einladungen).
 *
 * Sicherheits-Hintergrund (Audit): Früher wurde der `origin` ungeprüft aus
 * dem Client-Request übernommen. Damit konnte ein Angreifer für ein fremdes
 * Konto einen Passwort-Reset auslösen und den Link auf eine eigene Domain
 * zeigen lassen – das Opfer klickt, der Reset-Token landet beim Angreifer
 * (Account-Übernahme).
 *
 * Reihenfolge:
 * 1. `APP_URL` aus der Umgebung (empfohlen für Produktion).
 * 2. Der vom Client gewünschte Origin, aber NUR wenn er mit dem Origin des
 *    eingehenden Requests übereinstimmt (Proxy-Header werden wegen
 *    `trust proxy` berücksichtigt).
 * 3. Der Origin des eingehenden Requests.
 */
export function resolvePublicOrigin(req: Request, requestedOrigin?: string | null): string {
  if (ENV.appUrl) return ENV.appUrl;

  const requestOrigin = getRequestOrigin(req);
  if (requestedOrigin) {
    const normalized = normalizeOrigin(requestedOrigin);
    if (normalized && normalized === requestOrigin) return normalized;
  }
  return requestOrigin;
}

/** Origin (`proto://host`) des eingehenden Requests, inkl. Reverse-Proxy-Header. */
export function getRequestOrigin(req: Request): string {
  const forwardedHost = headerValue(req.headers["x-forwarded-host"]);
  const host = (forwardedHost ?? headerValue(req.headers.host) ?? "localhost").split(",")[0].trim();
  const forwardedProto = headerValue(req.headers["x-forwarded-proto"]);
  const proto = (forwardedProto ?? req.protocol ?? "http").split(",")[0].trim().toLowerCase();
  return `${proto === "https" ? "https" : "http"}://${host.toLowerCase()}`;
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
