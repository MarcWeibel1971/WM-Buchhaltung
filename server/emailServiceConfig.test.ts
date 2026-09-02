/**
 * AP4.6: Ohne RESEND_API_KEY muss der E-Mail-Versand sichtbar fehlschlagen
 * (EmailNotConfiguredError), statt still "dev-no-api-key" zurückzugeben,
 * während die UI einen Erfolg anzeigt.
 */
import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import {
  EMAIL_NOT_CONFIGURED_MESSAGE,
  EmailNotConfiguredError,
  isEmailConfigured,
  sendEmail,
} from "./emailService";

const originalKey = ENV.resendApiKey;

afterEach(() => {
  (ENV as any).resendApiKey = originalKey;
});

describe("Email Service – Versand nicht konfiguriert (AP4.6)", () => {
  it("isEmailConfigured() ist false ohne API-Key", () => {
    (ENV as any).resendApiKey = "";
    expect(isEmailConfigured()).toBe(false);
  });

  it("isEmailConfigured() ist true mit API-Key", () => {
    (ENV as any).resendApiKey = "re_test_key";
    expect(isEmailConfigured()).toBe(true);
  });

  it("sendEmail wirft EmailNotConfiguredError mit deutscher Meldung", async () => {
    (ENV as any).resendApiKey = "";
    await expect(
      sendEmail({ to: "kunde@example.ch", subject: "Test", html: "<p>Test</p>" })
    ).rejects.toThrow(EMAIL_NOT_CONFIGURED_MESSAGE);
    await expect(
      sendEmail({ to: "kunde@example.ch", subject: "Test", html: "<p>Test</p>" })
    ).rejects.toBeInstanceOf(EmailNotConfiguredError);
  });

  it("Meldung nennt Ursache und Lösung (RESEND_API_KEY)", () => {
    expect(EMAIL_NOT_CONFIGURED_MESSAGE).toContain("RESEND_API_KEY");
    expect(EMAIL_NOT_CONFIGURED_MESSAGE).toContain("nicht konfiguriert");
  });
});
