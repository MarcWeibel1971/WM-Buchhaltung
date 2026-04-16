/**
 * E-Mail-Service via Resend API
 * Verwendet für: Registrierungs-Bestätigung, Passwort-Reset
 */
import { ENV } from "./_core/env";

/**
 * Resend-Attachment. `content` ist immer base64-kodiert (egal ob Text oder
 * Binary – z.B. PDF). Max-Größe pro Attachment: 40 MB (Resend-Limit).
 */
export interface EmailAttachment {
  filename: string;
  content: string;        // base64-encoded
  contentType?: string;   // z.B. "application/pdf"; Resend rät Content-Type aus Dateiendung
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Optional: CC-Empfänger (z.B. Treuhänder). */
  cc?: string[];
  /** Optional: Antwort-an-Adresse (wenn abweichend vom Absender). */
  replyTo?: string;
  /** Optional: PDF/Bild-Anhänge (Rechnungen, Mahnungen etc.). */
  attachments?: EmailAttachment[];
}

interface ResendResponse {
  id: string;
}

/**
 * Sends an email via the Resend API.
 * Returns the message ID on success, throws on failure.
 */
export async function sendEmail(params: SendEmailParams): Promise<string> {
  const { to, subject, html, text, cc, replyTo, attachments } = params;

  if (!ENV.resendApiKey) {
    console.warn("[Email] RESEND_API_KEY not configured – email not sent");
    // In development, log the email content for debugging
    console.log("[Email] Would send to:", to);
    console.log("[Email] Subject:", subject);
    console.log("[Email] HTML:", html.substring(0, 200) + "...");
    if (attachments?.length) console.log("[Email] Attachments:", attachments.map(a => a.filename).join(", "));
    return "dev-no-api-key";
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.resendApiKey}`,
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [to],
      cc: cc && cc.length > 0 ? cc : undefined,
      reply_to: replyTo,
      subject,
      html,
      text: text || undefined,
      attachments: attachments && attachments.length > 0
        ? attachments.map(a => ({ filename: a.filename, content: a.content, content_type: a.contentType }))
        : undefined,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(`[Email] Resend API error (${response.status}):`, errorBody);
    throw new Error(`E-Mail konnte nicht gesendet werden (${response.status})`);
  }

  const data = (await response.json()) as ResendResponse;
  console.log(`[Email] Sent successfully to ${to}, id: ${data.id}`);
  return data.id;
}

/**
 * Sends a verification email to a newly registered user.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  origin: string,
  userName?: string
): Promise<string> {
  const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
  const greeting = userName ? `Hallo ${userName}` : "Hallo";

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">WM-Buchhaltung</h1>
    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Schweizer KMU-Buchhaltung</p>
  </div>
  
  <h2 style="font-size: 20px; margin-bottom: 16px;">${greeting},</h2>
  
  <p style="line-height: 1.6;">Vielen Dank für Ihre Registrierung bei WM-Buchhaltung. Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Button klicken:</p>
  
  <div style="text-align: center; margin: 32px 0;">
    <a href="${verifyUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
      E-Mail bestätigen
    </a>
  </div>
  
  <p style="line-height: 1.6; color: #64748b; font-size: 14px;">
    Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
    <a href="${verifyUrl}" style="color: #2563eb; word-break: break-all;">${verifyUrl}</a>
  </p>
  
  <p style="line-height: 1.6; color: #64748b; font-size: 14px;">
    Dieser Link ist 24 Stunden gültig. Falls Sie sich nicht registriert haben, können Sie diese E-Mail ignorieren.
  </p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
  
  <p style="color: #94a3b8; font-size: 12px; text-align: center;">
    WM-Buchhaltung &middot; Schweizer KMU-Buchhaltungssoftware
  </p>
</body>
</html>`;

  const text = `${greeting},\n\nVielen Dank für Ihre Registrierung bei WM-Buchhaltung.\n\nBitte bestätigen Sie Ihre E-Mail-Adresse:\n${verifyUrl}\n\nDieser Link ist 24 Stunden gültig.\n\nWM-Buchhaltung`;

  return sendEmail({ to, subject: "E-Mail-Adresse bestätigen – WM-Buchhaltung", html, text });
}

/**
 * Sends a password reset email.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  origin: string,
  userName?: string
): Promise<string> {
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const greeting = userName ? `Hallo ${userName}` : "Hallo";

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">WM-Buchhaltung</h1>
    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Schweizer KMU-Buchhaltung</p>
  </div>
  
  <h2 style="font-size: 20px; margin-bottom: 16px;">${greeting},</h2>
  
  <p style="line-height: 1.6;">Sie haben ein neues Passwort für Ihr WM-Buchhaltung-Konto angefordert. Klicken Sie auf den folgenden Button, um Ihr Passwort zurückzusetzen:</p>
  
  <div style="text-align: center; margin: 32px 0;">
    <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
      Passwort zurücksetzen
    </a>
  </div>
  
  <p style="line-height: 1.6; color: #64748b; font-size: 14px;">
    Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
    <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
  </p>
  
  <p style="line-height: 1.6; color: #64748b; font-size: 14px;">
    Dieser Link ist 1 Stunde gültig. Falls Sie kein neues Passwort angefordert haben, können Sie diese E-Mail ignorieren – Ihr Passwort bleibt unverändert.
  </p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
  
  <p style="color: #94a3b8; font-size: 12px; text-align: center;">
    WM-Buchhaltung &middot; Schweizer KMU-Buchhaltungssoftware
  </p>
</body>
</html>`;

  const text = `${greeting},\n\nSie haben ein neues Passwort angefordert.\n\nPasswort zurücksetzen:\n${resetUrl}\n\nDieser Link ist 1 Stunde gültig.\n\nWM-Buchhaltung`;

  return sendEmail({ to, subject: "Passwort zurücksetzen – WM-Buchhaltung", html, text });
}
