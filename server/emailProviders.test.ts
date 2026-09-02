/**
 * AP4.1: E-Mail-Provider-Auflösung (Plattform-Entkopplung).
 * Auswahl via EMAIL_PROVIDER mit Auto-Fallback resend → smtp → log.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { isEmailProviderConfigured, resolveEmailProvider } from "./emailProviders";

const saved = {
  pref: process.env.EMAIL_PROVIDER,
  smtpHost: process.env.SMTP_HOST,
  resendKey: ENV.resendApiKey,
};

beforeEach(() => {
  delete process.env.EMAIL_PROVIDER;
  delete process.env.SMTP_HOST;
  (ENV as any).resendApiKey = "";
});

afterEach(() => {
  if (saved.pref === undefined) delete process.env.EMAIL_PROVIDER;
  else process.env.EMAIL_PROVIDER = saved.pref;
  if (saved.smtpHost === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = saved.smtpHost;
  (ENV as any).resendApiKey = saved.resendKey;
});

describe("AP4.1 E-Mail-Provider-Auflösung", () => {
  it("Auto: RESEND_API_KEY → resend", () => {
    (ENV as any).resendApiKey = "re_test";
    expect(resolveEmailProvider().name).toBe("resend");
    expect(isEmailProviderConfigured()).toBe(true);
  });

  it("Auto: nur SMTP_HOST → smtp", () => {
    process.env.SMTP_HOST = "mail.example.ch";
    expect(resolveEmailProvider().name).toBe("smtp");
    expect(isEmailProviderConfigured()).toBe(true);
  });

  it("Auto: nichts konfiguriert → log (nicht konfiguriert)", () => {
    expect(resolveEmailProvider().name).toBe("log");
    expect(isEmailProviderConfigured()).toBe(false);
  });

  it("Explizit: EMAIL_PROVIDER=log überstimmt konfigurierte Keys", () => {
    (ENV as any).resendApiKey = "re_test";
    process.env.EMAIL_PROVIDER = "log";
    expect(resolveEmailProvider().name).toBe("log");
    expect(isEmailProviderConfigured()).toBe(false);
  });

  it("Explizit: EMAIL_PROVIDER=smtp erzwingt smtp", () => {
    (ENV as any).resendApiKey = "re_test";
    process.env.EMAIL_PROVIDER = "smtp";
    expect(resolveEmailProvider().name).toBe("smtp");
  });

  it("Explizit: EMAIL_PROVIDER=resend erzwingt resend", () => {
    process.env.SMTP_HOST = "mail.example.ch";
    process.env.EMAIL_PROVIDER = "resend";
    expect(resolveEmailProvider().name).toBe("resend");
  });
});
