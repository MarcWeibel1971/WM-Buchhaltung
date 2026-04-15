import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /**
   * Die aktuell aktive Organisation des Users.
   *
   * Phase 1 Multi-Tenancy: jeder authentifizierte User ist mindestens in
   * einer Organisation Mitglied und hat diese als `user.currentOrganizationId`
   * gesetzt. `organizationId` wird hier aus dem User-Datensatz extrahiert,
   * damit die `orgProcedure`-Middleware die Isolation durchsetzen kann, ohne
   * bei jedem Request eine DB-Query zu machen.
   *
   * Kann `null` sein, wenn der User noch keine Org-Zuweisung hat (Brand-new
   * Signup vor Onboarding). `orgProcedure` lehnt solche Requests ab.
   */
  organizationId: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    organizationId: user?.currentOrganizationId ?? null,
  };
}
