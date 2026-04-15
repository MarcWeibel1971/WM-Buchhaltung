import pino from "pino";
import crypto from "crypto";
import type { RequestHandler } from "express";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Zentraler strukturierter Logger (pino).
 *
 * - Im Development pretty-printed und mit Farben (pino-pretty).
 * - In Production JSON-Lines, gedacht für stdout → Docker/K8s → Log-Aggregator.
 * - Redaction entfernt sensible Felder aus jedem geloggten Objekt (Cookies,
 *   Auth-Header, Passwörter, API-Keys).
 * - Level via LOG_LEVEL env (fatal | error | warn | info | debug | trace).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: {
    service: "wm-buchhaltung",
    env: process.env.NODE_ENV ?? "development",
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname,service,env",
        },
      }
    : undefined,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["set-cookie"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.secret',
      '*.apiKey',
      '*.api_key',
      '*.jwtSecret',
      '*.JWT_SECRET',
      '*.BUILT_IN_FORGE_API_KEY',
      '*.AWS_SECRET_ACCESS_KEY',
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Express-Middleware, die jedem Request eine `x-request-id` zuweist und einen
 * Child-Logger mit requestId, method, url auf `req.log` hängt. Logs einer
 * einzelnen Anfrage lassen sich dadurch im Log-Aggregator zusammenführen.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const incomingId = req.headers["x-request-id"];
  const requestId =
    (Array.isArray(incomingId) ? incomingId[0] : incomingId) ??
    crypto.randomUUID();

  // Response-Header zurückgeben, damit Clients requestId im Network-Tab sehen.
  res.setHeader("x-request-id", requestId);

  const startedAt = Date.now();
  const reqLogger = logger.child({
    requestId,
    method: req.method,
    url: req.originalUrl ?? req.url,
  });

  // Für späteren Zugriff aus Handlers / Middlewares.
  (req as any).log = reqLogger;
  (req as any).requestId = requestId;

  // Healthcheck-Pings nicht in den Access-Log spammen.
  const isHealthCheck = req.url === "/api/health";

  if (!isHealthCheck) {
    reqLogger.debug("request started");
  }

  res.on("finish", () => {
    if (isHealthCheck) return;
    const duration = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    reqLogger[level](
      { statusCode: res.statusCode, durationMs: duration },
      "request completed",
    );
  });

  next();
};

/**
 * Zentrale Express-Error-Middleware. Protokolliert den Fehler mit vollem
 * Stack und antwortet dem Client mit einer generischen Meldung (damit keine
 * internen Details durchsickern).
 */
export const errorLogger: import("express").ErrorRequestHandler = (err, req, res, next) => {
  const log = (req as any).log ?? logger;
  log.error({ err }, "unhandled error");
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: "Internal Server Error",
    requestId: (req as any).requestId,
  });
};

/**
 * Registriert globale Handler für unbehandelte Exceptions. Wird beim
 * Server-Start aufgerufen – sorgt dafür, dass Crashes strukturiert geloggt
 * werden statt als roher Stacktrace im stdout.
 */
export function installCrashHandlers() {
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaughtException");
    // Im Production crashen und vom Orchestrator neu starten lassen.
    if (!isDev) process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandledRejection");
  });
}
