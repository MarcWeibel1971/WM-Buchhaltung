/**
 * Auth Router – Eigenes E-Mail + Passwort Authentifizierungssystem
 *
 * Endpoints:
 * - register:        Neuen Account erstellen (E-Mail + Passwort)
 * - login:           Anmelden mit E-Mail + Passwort
 * - verifyEmail:     E-Mail-Adresse bestätigen (Token aus E-Mail)
 * - forgotPassword:  Passwort-Reset anfordern
 * - resetPassword:   Neues Passwort setzen (Token aus E-Mail)
 * - resendVerification: Verifizierungs-E-Mail erneut senden
 *
 * Koexistiert mit Manus OAuth – bestehende OAuth-User werden nicht beeinträchtigt.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hash, compare } from "bcryptjs";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { publicProcedure, router } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { sendVerificationEmail, sendPasswordResetEmail } from "./emailService";

const BCRYPT_ROUNDS = 12;
const VERIFY_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/**
 * Generates a unique openId for email-registered users.
 * Format: "email_<random>" to distinguish from OAuth openIds.
 */
function generateEmailOpenId(): string {
  return `email_${crypto.randomBytes(16).toString("hex")}`;
}

// ─── Password validation ─────────────────────────────────────────────────────
const passwordSchema = z
  .string()
  .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
  .max(128, "Passwort darf maximal 128 Zeichen lang sein")
  .refine(
    (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw),
    "Passwort muss Gross-/Kleinbuchstaben und eine Zahl enthalten"
  );

export const authRouter = router({
  // ─── Session ──────────────────────────────────────────────────────────────
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  // ─── Register ─────────────────────────────────────────────────────────────
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("Ungültige E-Mail-Adresse").max(320),
        password: passwordSchema,
        name: z.string().min(1, "Name ist erforderlich").max(200),
        origin: z.string().url(), // Frontend origin for email links
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Datenbank nicht verfügbar" });

      const normalizedEmail = input.email.toLowerCase().trim();

      // Check if email already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existing.length > 0) {
        const user = existing[0];
        // If user exists with password → already registered
        if (user.passwordHash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an.",
          });
        }
        // If user exists via OAuth but no password → allow adding password
        const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
        const verifyToken = generateToken();

        await db
          .update(users)
          .set({
            passwordHash,
            name: input.name,
            emailVerifyToken: verifyToken,
            emailVerified: false,
            loginMethod: "email",
          })
          .where(eq(users.id, user.id));

        // Send verification email
        try {
          await sendVerificationEmail(normalizedEmail, verifyToken, input.origin, input.name);
        } catch (e) {
          console.error("[Auth] Failed to send verification email:", e);
        }

        return {
          success: true,
          message: "Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse.",
          requiresVerification: true,
        };
      }

      // New user registration
      const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
      const verifyToken = generateToken();
      const openId = generateEmailOpenId();

      await db.insert(users).values({
        openId,
        email: normalizedEmail,
        name: input.name,
        passwordHash,
        emailVerified: false,
        emailVerifyToken: verifyToken,
        loginMethod: "email",
        role: "user",
        lastSignedIn: new Date(),
      });

      // Send verification email
      try {
        await sendVerificationEmail(normalizedEmail, verifyToken, input.origin, input.name);
      } catch (e) {
        console.error("[Auth] Failed to send verification email:", e);
      }

      return {
        success: true,
        message: "Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse.",
        requiresVerification: true,
      };
    }),

  // ─── Login ────────────────────────────────────────────────────────────────
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Ungültige E-Mail-Adresse"),
        password: z.string().min(1, "Passwort ist erforderlich"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Datenbank nicht verfügbar" });

      const normalizedEmail = input.email.toLowerCase().trim();

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (result.length === 0 || !result[0].passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "E-Mail oder Passwort ist falsch.",
        });
      }

      const user = result[0];

      const isValid = await compare(input.password, user.passwordHash!);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "E-Mail oder Passwort ist falsch.",
        });
      }

      // Check email verification
      if (!user.emailVerified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Prüfen Sie Ihren Posteingang.",
        });
      }

      // Update last sign-in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // Create session token (same mechanism as OAuth)
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }),

  // ─── Verify Email ─────────────────────────────────────────────────────────
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Datenbank nicht verfügbar" });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.emailVerifyToken, input.token))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ungültiger oder abgelaufener Verifizierungslink.",
        });
      }

      const user = result[0];

      if (user.emailVerified) {
        return {
          success: true,
          message: "Ihre E-Mail-Adresse wurde bereits bestätigt.",
          alreadyVerified: true,
        };
      }

      await db
        .update(users)
        .set({
          emailVerified: true,
          emailVerifyToken: null,
        })
        .where(eq(users.id, user.id));

      return {
        success: true,
        message: "E-Mail-Adresse erfolgreich bestätigt. Sie können sich jetzt anmelden.",
        alreadyVerified: false,
      };
    }),

  // ─── Forgot Password ─────────────────────────────────────────────────────
  forgotPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email("Ungültige E-Mail-Adresse"),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Datenbank nicht verfügbar" });

      const normalizedEmail = input.email.toLowerCase().trim();

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      // Always return success to prevent email enumeration
      if (result.length === 0 || !result[0].passwordHash) {
        return {
          success: true,
          message: "Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kürze eine E-Mail mit Anweisungen zum Zurücksetzen Ihres Passworts.",
        };
      }

      const user = result[0];
      const resetToken = generateToken();
      const resetExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

      await db
        .update(users)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpiry: resetExpiry,
        })
        .where(eq(users.id, user.id));

      try {
        await sendPasswordResetEmail(normalizedEmail, resetToken, input.origin, user.name || undefined);
      } catch (e) {
        console.error("[Auth] Failed to send password reset email:", e);
      }

      return {
        success: true,
        message: "Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kürze eine E-Mail mit Anweisungen zum Zurücksetzen Ihres Passworts.",
      };
    }),

  // ─── Reset Password ───────────────────────────────────────────────────────
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: passwordSchema,
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Datenbank nicht verfügbar" });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.passwordResetToken, input.token))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ungültiger oder abgelaufener Reset-Link.",
        });
      }

      const user = result[0];

      // Check expiry
      if (user.passwordResetExpiry && new Date() > user.passwordResetExpiry) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Der Reset-Link ist abgelaufen. Bitte fordern Sie einen neuen an.",
        });
      }

      const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

      await db
        .update(users)
        .set({
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
          // Also verify email if not yet verified (user proved email ownership)
          emailVerified: true,
          emailVerifyToken: null,
        })
        .where(eq(users.id, user.id));

      return {
        success: true,
        message: "Passwort erfolgreich zurückgesetzt. Sie können sich jetzt mit Ihrem neuen Passwort anmelden.",
      };
    }),

  // ─── Resend Verification ──────────────────────────────────────────────────
  resendVerification: publicProcedure
    .input(
      z.object({
        email: z.string().email("Ungültige E-Mail-Adresse"),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Datenbank nicht verfügbar" });

      const normalizedEmail = input.email.toLowerCase().trim();

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      // Always return success to prevent email enumeration
      if (result.length === 0 || !result[0].passwordHash) {
        return {
          success: true,
          message: "Falls ein Konto mit dieser E-Mail existiert, erhalten Sie eine neue Bestätigungs-E-Mail.",
        };
      }

      const user = result[0];

      if (user.emailVerified) {
        return {
          success: true,
          message: "Ihre E-Mail-Adresse ist bereits bestätigt. Sie können sich anmelden.",
        };
      }

      const verifyToken = generateToken();

      await db
        .update(users)
        .set({ emailVerifyToken: verifyToken })
        .where(eq(users.id, user.id));

      try {
        await sendVerificationEmail(normalizedEmail, verifyToken, input.origin, user.name || undefined);
      } catch (e) {
        console.error("[Auth] Failed to resend verification email:", e);
      }

      return {
        success: true,
        message: "Falls ein Konto mit dieser E-Mail existiert, erhalten Sie eine neue Bestätigungs-E-Mail.",
      };
    }),
});
