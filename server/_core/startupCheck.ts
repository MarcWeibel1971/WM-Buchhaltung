/**
 * AP4.1: Startup-Selbstcheck (Plattform-Entkopplung).
 * Protokolliert beim Serverstart einmalig, welche optionalen Features aktiv
 * sind – mit hilfreichen Warnungen statt stillem Ausfall oder Crash.
 * Die App startet bewusst auch ohne optionale Keys; nur DATABASE_URL und
 * JWT_SECRET sind Pflicht.
 */
import { ENV } from "./env";
import { createLogger } from "./logger";
import { resolveEmailProvider } from "../emailProviders";
import { getLocalStorageDir } from "../storage";

export function logStartupFeatureSummary(): void {
  const logger = createLogger("startup");

  // Pflicht-Konfiguration (App funktioniert ohne diese Werte nicht sinnvoll)
  if (!ENV.databaseUrl) {
    logger.error("DATABASE_URL ist nicht gesetzt – die App kann keine Daten lesen oder schreiben.");
  }
  if (!ENV.cookieSecret) {
    logger.error("JWT_SECRET ist nicht gesetzt – Login/Sessions funktionieren nicht. Bitte generieren: openssl rand -hex 64");
  }
  if (!process.env.SECRETS_MASTER_KEY) {
    logger.warn("SECRETS_MASTER_KEY fehlt – EBICS-/POS-Secrets können nicht verschlüsselt gespeichert werden (openssl rand -hex 32).");
  }

  // E-Mail (AP4.1 Provider)
  const mail = resolveEmailProvider();
  if (mail.name === "log") {
    logger.warn("E-Mail-Versand: deaktiviert (weder RESEND_API_KEY noch SMTP_HOST gesetzt) – Registrierungs-, Rechnungs- und Mahn-E-Mails werden nicht versendet. Konfiguration: EMAIL_PROVIDER=resend|smtp, siehe .env.example.");
  } else {
    logger.info(`E-Mail-Versand: Provider "${mail.name}" aktiv.`);
  }

  // KI (Forge oder OpenRouter)
  if (ENV.forgeApiKey) {
    logger.info("KI-Features: Forge-LLM konfiguriert.");
  } else if (process.env.OPENROUTER_API_KEY) {
    logger.info("KI-Features: OpenRouter (Nemotron) konfiguriert.");
  } else {
    logger.warn("KI-Features: deaktiviert (weder BUILT_IN_FORGE_API_KEY noch OPENROUTER_API_KEY) – KI-Funktionen werden im UI ausgeblendet.");
  }

  // Datei-Storage (AP2.2 Provider)
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    logger.info("Datei-Storage: Forge-Storage (Remote).");
  } else {
    logger.info(`Datei-Storage: lokal (${getLocalStorageDir()}). Für S3-kompatibles Hosting LOCAL_STORAGE_DIR auf ein persistentes Volume setzen.`);
  }

  // Manus-OAuth (optional – E-Mail/Passwort-Login funktioniert immer)
  if (!ENV.appId || !ENV.oAuthServerUrl) {
    logger.info("Manus-OAuth: nicht konfiguriert – E-Mail/Passwort-Login ist aktiv (ausreichend für Self-Hosting).");
  }
}
