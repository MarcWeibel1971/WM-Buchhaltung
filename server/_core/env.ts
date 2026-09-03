export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  /**
   * Öffentliche Basis-URL der Installation (z. B. https://buchhaltung.example.ch).
   * Wird für Links in E-Mails (Verifizierung, Passwort-Reset, Einladungen)
   * verwendet. Ohne Wert wird auf den Host des eingehenden Requests
   * zurückgegriffen – siehe server/_core/publicUrl.ts.
   */
  appUrl: (process.env.APP_URL ?? "").replace(/\/+$/, ""),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};
