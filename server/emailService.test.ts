import { describe, it, expect } from "vitest";

describe("Email Service - Resend API Key Validation", () => {
  it("should have RESEND_API_KEY configured", () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey!.length).toBeGreaterThan(0);
    // Resend API keys start with "re_"
    expect(apiKey!.startsWith("re_")).toBe(true);
  });

  it("should have RESEND_FROM_EMAIL configured", () => {
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    expect(fromEmail).toBeDefined();
    expect(fromEmail!.length).toBeGreaterThan(0);
    expect(fromEmail!).toContain("@");
  });

  it("should be able to reach Resend API", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !apiKey.startsWith("re_")) {
      console.warn("Skipping Resend API test: no valid API key");
      return;
    }

    // Use the /domains endpoint to validate the API key without sending an email
    const response = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // 200 = valid key, 401 = invalid key
    expect(response.status).toBe(200);
  });
});
