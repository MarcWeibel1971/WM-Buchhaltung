import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import { ENV } from "./_core/env";
import { getRequestOrigin, resolvePublicOrigin } from "./_core/publicUrl";

function fakeReq(headers: Record<string, string | string[]>, protocol = "http"): Request {
  return { headers, protocol } as unknown as Request;
}

describe("resolvePublicOrigin (Audit: E-Mail-Link-Origin)", () => {
  let originalAppUrl: string;
  beforeEach(() => { originalAppUrl = ENV.appUrl; ENV.appUrl = ""; });
  afterEach(() => { ENV.appUrl = originalAppUrl; });

  it("bevorzugt APP_URL, auch wenn der Client einen anderen Origin schickt", () => {
    ENV.appUrl = "https://buchhaltung.example.ch";
    const req = fakeReq({ host: "buchhaltung.example.ch" }, "https");
    expect(resolvePublicOrigin(req, "https://evil.example")).toBe("https://buchhaltung.example.ch");
  });

  it("verwirft einen fremden Client-Origin und nutzt den Request-Origin", () => {
    const req = fakeReq({ host: "buchhaltung.example.ch" }, "https");
    expect(resolvePublicOrigin(req, "https://evil.example")).toBe("https://buchhaltung.example.ch");
  });

  it("akzeptiert den Client-Origin, wenn er dem Request-Origin entspricht", () => {
    const req = fakeReq({ host: "localhost:3000" }, "http");
    expect(resolvePublicOrigin(req, "http://localhost:3000/")).toBe("http://localhost:3000");
  });

  it("berücksichtigt Reverse-Proxy-Header", () => {
    const req = fakeReq({
      host: "127.0.0.1:3000",
      "x-forwarded-host": "app.example.ch",
      "x-forwarded-proto": "https",
    });
    expect(getRequestOrigin(req)).toBe("https://app.example.ch");
    expect(resolvePublicOrigin(req, "https://app.example.ch")).toBe("https://app.example.ch");
  });

  it("lehnt Nicht-HTTP-Schemata ab", () => {
    const req = fakeReq({ host: "app.example.ch" }, "https");
    expect(resolvePublicOrigin(req, "javascript:alert(1)")).toBe("https://app.example.ch");
  });
});
