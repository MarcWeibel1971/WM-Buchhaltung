import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ────────────────────────────────────────────────────────────────

type CookieSetCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): {
  ctx: TrpcContext;
  setCookies: CookieSetCall[];
} {
  const setCookies: CookieSetCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies };
}

const TEST_ORIGIN = "https://test.example.com";
const TEST_EMAIL = `vitest-${Date.now()}@test-auth.example.com`;
const TEST_PASSWORD = "SecurePass123";
const TEST_NAME = "Vitest Benutzer";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("auth.register", () => {
  it("registers a new user successfully", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.register({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
      origin: TEST_ORIGIN,
    });

    expect(result.success).toBe(true);
    expect(result.requiresVerification).toBe(true);
    expect(result.message).toContain("Registrierung erfolgreich");
  });

  it("rejects duplicate email registration", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
        origin: TEST_ORIGIN,
      })
    ).rejects.toThrow("bereits registriert");
  });

  it("rejects weak passwords", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        email: `weak-pw-${Date.now()}@test.example.com`,
        password: "short",
        name: TEST_NAME,
        origin: TEST_ORIGIN,
      })
    ).rejects.toThrow();
  });

  it("rejects passwords without uppercase", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        email: `no-upper-${Date.now()}@test.example.com`,
        password: "nouppercase123",
        name: TEST_NAME,
        origin: TEST_ORIGIN,
      })
    ).rejects.toThrow();
  });

  it("rejects invalid email format", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        email: "not-an-email",
        password: TEST_PASSWORD,
        name: TEST_NAME,
        origin: TEST_ORIGIN,
      })
    ).rejects.toThrow();
  });

  it("rejects empty name", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        email: `empty-name-${Date.now()}@test.example.com`,
        password: TEST_PASSWORD,
        name: "",
        origin: TEST_ORIGIN,
      })
    ).rejects.toThrow();
  });
});

describe("auth.login", () => {
  it("rejects login for non-existent user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "nonexistent@test.example.com",
        password: TEST_PASSWORD,
      })
    ).rejects.toThrow("E-Mail oder Passwort ist falsch");
  });

  it("rejects login with wrong password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: TEST_EMAIL,
        password: "WrongPassword123",
      })
    ).rejects.toThrow("E-Mail oder Passwort ist falsch");
  });

  it("rejects login for unverified email", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })
    ).rejects.toThrow("bestätigen Sie zuerst Ihre E-Mail-Adresse");
  });
});

describe("auth.verifyEmail", () => {
  it("rejects invalid token", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.verifyEmail({ token: "invalid-token-12345" })
    ).rejects.toThrow("Ungültiger oder abgelaufener");
  });
});

describe("auth.forgotPassword", () => {
  it("returns success even for non-existent email (prevents enumeration)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.forgotPassword({
      email: "nonexistent-user@test.example.com",
      origin: TEST_ORIGIN,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Falls ein Konto mit dieser E-Mail existiert");
  });

  it("returns success for existing email", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.forgotPassword({
      email: TEST_EMAIL,
      origin: TEST_ORIGIN,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Falls ein Konto mit dieser E-Mail existiert");
  });
});

describe("auth.resetPassword", () => {
  it("rejects invalid token", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "invalid-reset-token-12345",
        password: "NewSecurePass456",
      })
    ).rejects.toThrow("Ungültiger oder abgelaufener");
  });

  it("rejects weak new password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "some-token",
        password: "weak",
      })
    ).rejects.toThrow();
  });
});

describe("auth.resendVerification", () => {
  it("returns success for non-existent email (prevents enumeration)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resendVerification({
      email: "nonexistent@test.example.com",
      origin: TEST_ORIGIN,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Falls ein Konto mit dieser E-Mail existiert");
  });

  it("returns success for existing unverified user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resendVerification({
      email: TEST_EMAIL,
      origin: TEST_ORIGIN,
    });

    expect(result.success).toBe(true);
  });
});

describe("auth.login (full flow with verification)", () => {
  const FLOW_EMAIL = `flow-${Date.now()}@test.example.com`;

  it("completes full register → verify → login flow", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // 1. Register
    const regResult = await caller.auth.register({
      email: FLOW_EMAIL,
      password: TEST_PASSWORD,
      name: "Flow Test User",
      origin: TEST_ORIGIN,
    });
    expect(regResult.success).toBe(true);

    // 2. Get verification token from DB directly
    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, FLOW_EMAIL))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.emailVerifyToken).toBeTruthy();

    // 3. Verify email
    const verifyResult = await caller.auth.verifyEmail({
      token: user.emailVerifyToken!,
    });
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.message).toContain("erfolgreich bestätigt");

    // 4. Login should now succeed
    const { ctx: loginCtx, setCookies } = createPublicContext();
    const loginCaller = appRouter.createCaller(loginCtx);

    const loginResult = await loginCaller.auth.login({
      email: FLOW_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(loginResult.success).toBe(true);
    expect(loginResult.user.email).toBe(FLOW_EMAIL);
    expect(loginResult.user.name).toBe("Flow Test User");
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0].name).toBe(COOKIE_NAME);
  });
});
