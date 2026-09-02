/**
 * AP4.1: E-Mail-Versand als konfigurierbarer Provider (Plattform-Entkopplung).
 *
 * Provider-Auswahl über EMAIL_PROVIDER:
 *   resend  – Resend-API (RESEND_API_KEY)
 *   smtp    – beliebiger SMTP-Server (SMTP_HOST, SMTP_PORT, SMTP_USER, ...)
 *   log     – kein Versand, nur Log-Eintrag (Explizit-Deaktivierung)
 * Ohne EMAIL_PROVIDER: resend, falls RESEND_API_KEY gesetzt; sonst smtp, falls
 * SMTP_HOST gesetzt; sonst log (= "nicht konfiguriert").
 */
import nodemailer from "nodemailer";
import { ENV } from "./_core/env";
import { createLogger } from "./_core/logger";

const logger = createLogger("emailProvider");

export interface EmailAttachment {
  filename: string;
  content: string;        // base64-kodiert
  contentType?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  name: "resend" | "smtp" | "log";
  send(message: EmailMessage): Promise<string>;
}

interface ResendResponse {
  id: string;
}

const resendProvider: EmailProvider = {
  name: "resend",
  async send(msg) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.resendApiKey}`,
      },
      body: JSON.stringify({
        from: ENV.resendFromEmail,
        to: [msg.to],
        cc: msg.cc && msg.cc.length > 0 ? msg.cc : undefined,
        reply_to: msg.replyTo,
        subject: msg.subject,
        html: msg.html,
        text: msg.text || undefined,
        attachments: msg.attachments && msg.attachments.length > 0
          ? msg.attachments.map(a => ({ filename: a.filename, content: a.content, content_type: a.contentType }))
          : undefined,
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error(`[Email] Resend API error (${response.status}):`, errorBody);
      throw new Error(`E-Mail konnte nicht gesendet werden (${response.status})`);
    }
    const data = (await response.json()) as ResendResponse;
    logger.info(`[Email] Sent via Resend to ${msg.to}, id: ${data.id}`);
    return data.id;
  },
};

let smtpTransport: nodemailer.Transporter | null = null;
function getSmtpTransport(): nodemailer.Transporter {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true", // true = Port 465/SMTPS
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
  }
  return smtpTransport;
}

const smtpProvider: EmailProvider = {
  name: "smtp",
  async send(msg) {
    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
    if (!from) throw new Error("SMTP_FROM oder SMTP_USER muss gesetzt sein");
    const info = await getSmtpTransport().sendMail({
      from,
      to: msg.to,
      cc: msg.cc && msg.cc.length > 0 ? msg.cc : undefined,
      replyTo: msg.replyTo,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments?.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.contentType,
      })),
    });
    logger.info(`[Email] Sent via SMTP to ${msg.to}, id: ${info.messageId}`);
    return info.messageId ?? "smtp-sent";
  },
};

const logProvider: EmailProvider = {
  name: "log",
  async send(msg) {
    logger.warn("[Email] Kein Versand-Provider konfiguriert – E-Mail wird nicht gesendet. To:", msg.to, "Subject:", msg.subject);
    return "log-provider";
  },
};

/** Löst den aktiven E-Mail-Provider auf (dynamisch, ohne Cache). */
export function resolveEmailProvider(): EmailProvider {
  const pref = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (pref === "resend") return resendProvider;
  if (pref === "smtp") return smtpProvider;
  if (pref === "log") return logProvider;
  if (pref) logger.warn(`[Email] Unbekannter EMAIL_PROVIDER "${pref}" – Auto-Erkennung aktiv`);
  if (ENV.resendApiKey) return resendProvider;
  if (process.env.SMTP_HOST) return smtpProvider;
  return logProvider;
}

/** true, wenn ein echter Versand-Provider konfiguriert ist (nicht log). */
export function isEmailProviderConfigured(): boolean {
  return resolveEmailProvider().name !== "log";
}
