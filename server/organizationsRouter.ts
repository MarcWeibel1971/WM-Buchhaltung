import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, orgProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  organizations,
  userOrganizations,
  users,
  accounts,
  companySettings,
  fiscalYears,
} from "../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

/**
 * Helper: turns a company name into a URL-friendly slug.
 * Collisions are resolved by appending "-2", "-3" etc.
 */
async function generateUniqueSlug(db: any, baseName: string): Promise<string> {
  const base = baseName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "org";

  let slug = base;
  let suffix = 2;
  while (true) {
    const existing = await db.select({ id: organizations.id }).from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (existing.length === 0) return slug;
    slug = `${base}-${suffix++}`;
    if (suffix > 100) return `${base}-${Date.now()}`;
  }
}

// Default KMU-Kontenplan template – very small subset, the full template lives
// in settingsRouter.getKmuTemplate and can be imported after onboarding.
const MINIMAL_KMU_ACCOUNTS: Array<{
  number: string;
  name: string;
  accountType: "asset" | "liability" | "expense" | "revenue" | "equity";
  normalBalance: "debit" | "credit";
  category?: string;
  subCategory?: string;
  sortOrder?: number;
}> = [
  { number: "1000", name: "Kasse", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", sortOrder: 100 },
  { number: "1020", name: "Bank", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Flüssige Mittel", sortOrder: 200 },
  { number: "1100", name: "Debitoren", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", sortOrder: 300 },
  { number: "1170", name: "Vorsteuer", accountType: "asset", normalBalance: "debit", category: "Umlaufvermögen", subCategory: "Forderungen", sortOrder: 350 },
  { number: "2000", name: "Kreditoren", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristig", sortOrder: 400 },
  { number: "2200", name: "Geschuldete MWST", accountType: "liability", normalBalance: "credit", category: "Fremdkapital", subCategory: "Kurzfristig", sortOrder: 450 },
  { number: "2800", name: "Eigenkapital", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Eigenkapital", sortOrder: 500 },
  { number: "3000", name: "Dienstleistungsertrag", accountType: "revenue", normalBalance: "credit", category: "Betriebsertrag", subCategory: "Dienstleistungen", sortOrder: 600 },
  { number: "4000", name: "Materialaufwand", accountType: "expense", normalBalance: "debit", category: "Drittaufwand", subCategory: "Material", sortOrder: 700 },
  { number: "5000", name: "Lohnaufwand", accountType: "expense", normalBalance: "debit", category: "Personalaufwand", subCategory: "Löhne", sortOrder: 750 },
  { number: "6000", name: "Raumaufwand / Miete", accountType: "expense", normalBalance: "debit", category: "Mietaufwand", subCategory: "Raumaufwand", sortOrder: 800 },
  { number: "6500", name: "Verwaltungsaufwand", accountType: "expense", normalBalance: "debit", category: "Verwaltungsaufwand", subCategory: "Büroaufwand", sortOrder: 850 },
  { number: "6900", name: "Finanzaufwand", accountType: "expense", normalBalance: "debit", category: "Zinsaufwand", subCategory: "Finanzaufwand", sortOrder: 900 },
  { number: "9000", name: "Eröffnungsbilanz", accountType: "equity", normalBalance: "credit", category: "Eigenkapital", subCategory: "Eröffnung", sortOrder: 999 },
];

export const organizationsRouter = router({
  /**
   * Liefert die aktuell aktive Organisation (aus user.currentOrganizationId).
   * Wird von Frontend aufgerufen, um den Firmennamen im Layout anzuzeigen.
   */
  getCurrent: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [org] = await db.select().from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1);
    if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Aktive Organisation nicht gefunden." });
    return org;
  }),

  /**
   * Alle Organisationen, in denen der eingeloggte User Mitglied ist
   * (für den Org-Switcher im Layout).
   */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db.select({
      organization: organizations,
      role: userOrganizations.role,
    }).from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(and(
        eq(userOrganizations.userId, ctx.user.id),
        eq(organizations.isActive, true),
      ))
      .orderBy(asc(organizations.name));
    return rows.map(r => ({
      ...r.organization,
      role: r.role,
      isCurrent: r.organization.id === ctx.user.currentOrganizationId,
    }));
  }),

  /**
   * Wechselt die aktuell aktive Organisation. Der User muss Mitglied der
   * Zielorganisation sein. Setzt `users.currentOrganizationId` – beim
   * nächsten Request liefert der Context-Middleware die neue Org.
   */
  setCurrent: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Mitgliedschaft prüfen – sonst Forbidden.
      const [membership] = await db.select({ id: userOrganizations.id }).from(userOrganizations)
        .where(and(
          eq(userOrganizations.userId, ctx.user.id),
          eq(userOrganizations.organizationId, input.organizationId),
        ))
        .limit(1);
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diese Organisation." });
      }

      await db.update(users)
        .set({ currentOrganizationId: input.organizationId })
        .where(eq(users.id, ctx.user.id));
      return { success: true, organizationId: input.organizationId };
    }),

  /**
   * Onboarding: legt eine neue Organisation an, macht den aufrufenden User
   * zum Owner, setzt sie als aktive Org, und seedet optional einen
   * Minimal-KMU-Kontenplan und ein Geschäftsjahr.
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      legalForm: z.string().max(50).optional(),
      street: z.string().max(200).optional(),
      zipCode: z.string().max(10).optional(),
      city: z.string().max(100).optional(),
      canton: z.string().max(50).optional(),
      country: z.string().max(50).optional().default("Schweiz"),
      uid: z.string().max(20).optional(),
      vatNumber: z.string().max(30).optional(),
      vatMethod: z.enum(["effective", "saldo", "pauschal"]).optional().default("effective"),
      vatSaldoRate: z.string().optional(),
      vatPeriod: z.enum(["quarterly", "semi-annual"]).optional().default("quarterly"),
      fiscalYearStartMonth: z.number().int().min(1).max(12).optional().default(1),
      phone: z.string().max(30).optional(),
      email: z.string().max(200).optional(),
      website: z.string().max(200).optional(),
      // Onboarding-Optionen
      seedKmuKontenplan: z.boolean().default(true),
      initialFiscalYear: z.number().int().optional(),
      makeCurrent: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const slug = await generateUniqueSlug(db, input.name);

      // 1. Organisation anlegen
      const [orgResult] = await db.insert(organizations).values({
        name: input.name,
        slug,
        legalForm: input.legalForm,
        street: input.street,
        zipCode: input.zipCode,
        city: input.city,
        canton: input.canton,
        country: input.country ?? "Schweiz",
        uid: input.uid,
        vatNumber: input.vatNumber,
        vatMethod: input.vatMethod,
        vatSaldoRate: input.vatSaldoRate,
        vatPeriod: input.vatPeriod,
        fiscalYearStartMonth: input.fiscalYearStartMonth,
        phone: input.phone,
        email: input.email,
        website: input.website,
        isActive: true,
      }).$returningId();

      const newOrgId = orgResult.id;

      // 2. User als Owner verknüpfen
      await db.insert(userOrganizations).values({
        userId: ctx.user.id,
        organizationId: newOrgId,
        role: "owner",
      });

      // 3. companySettings-Eintrag anlegen (Legacy: wird von manchem UI-Code
      //    erwartet, liefert weiterhin name/address/vat etc.)
      await db.insert(companySettings).values({
        organizationId: newOrgId,
        companyName: input.name,
        legalForm: input.legalForm,
        street: input.street,
        zipCode: input.zipCode,
        city: input.city,
        canton: input.canton,
        country: input.country ?? "Schweiz",
        uid: input.uid,
        vatNumber: input.vatNumber,
        vatMethod: input.vatMethod,
        vatSaldoRate: input.vatSaldoRate,
        vatPeriod: input.vatPeriod,
        fiscalYearStartMonth: input.fiscalYearStartMonth,
        phone: input.phone,
        email: input.email,
        website: input.website,
      });

      // 4. Optional: Minimal-Kontenplan seeden
      let accountsCreated = 0;
      if (input.seedKmuKontenplan) {
        for (const acc of MINIMAL_KMU_ACCOUNTS) {
          await db.insert(accounts).values({
            organizationId: newOrgId,
            number: acc.number,
            name: acc.name,
            accountType: acc.accountType,
            normalBalance: acc.normalBalance,
            category: acc.category ?? null,
            subCategory: acc.subCategory ?? null,
            sortOrder: acc.sortOrder ?? 0,
            isActive: true,
          });
          accountsCreated++;
        }
      }

      // 5. Optional: Erstes Geschäftsjahr anlegen
      if (input.initialFiscalYear) {
        const year = input.initialFiscalYear;
        await db.insert(fiscalYears).values({
          organizationId: newOrgId,
          year,
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
          status: "open",
          isClosed: false,
          balanceCarriedForward: false,
        });
      }

      // 6. Optional: neue Org als aktuelle setzen
      if (input.makeCurrent) {
        await db.update(users)
          .set({ currentOrganizationId: newOrgId })
          .where(eq(users.id, ctx.user.id));
      }

      return {
        id: newOrgId,
        slug,
        name: input.name,
        accountsCreated,
        fiscalYearCreated: !!input.initialFiscalYear,
        isCurrent: input.makeCurrent,
      };
    }),

  /**
   * Update (Umbenennen, Adressdaten anpassen). Schreibt in organizations UND
   * synchronisiert companySettings, damit Legacy-Code weiterhin konsistent ist.
   */
  update: orgProcedure
    .input(z.object({
      name: z.string().min(1).max(200).optional(),
      legalForm: z.string().max(50).optional(),
      street: z.string().max(200).optional(),
      zipCode: z.string().max(10).optional(),
      city: z.string().max(100).optional(),
      canton: z.string().max(50).optional(),
      country: z.string().max(50).optional(),
      uid: z.string().max(20).optional(),
      vatNumber: z.string().max(30).optional(),
      vatMethod: z.enum(["effective", "saldo", "pauschal"]).optional(),
      vatSaldoRate: z.string().optional(),
      vatPeriod: z.enum(["quarterly", "semi-annual"]).optional(),
      fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
      phone: z.string().max(30).optional(),
      email: z.string().max(200).optional(),
      website: z.string().max(200).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Muss Owner oder Admin der Org sein.
      const [mem] = await db.select({ role: userOrganizations.role }).from(userOrganizations)
        .where(and(
          eq(userOrganizations.userId, ctx.user.id),
          eq(userOrganizations.organizationId, ctx.organizationId),
        ))
        .limit(1);
      if (!mem || (mem.role !== "owner" && mem.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Nur Owner/Admin kann die Organisation bearbeiten." });
      }

      const updateData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) updateData[k] = v;
      }
      if (Object.keys(updateData).length === 0) return { success: true };

      await db.update(organizations).set(updateData).where(eq(organizations.id, ctx.organizationId));

      // Legacy-Sync: companySettings mitziehen (falls vorhanden)
      const legacyUpdate: Record<string, unknown> = {};
      if (input.name !== undefined) legacyUpdate.companyName = input.name;
      for (const k of ["legalForm", "street", "zipCode", "city", "canton", "country", "uid", "vatNumber", "vatMethod", "vatSaldoRate", "vatPeriod", "fiscalYearStartMonth", "phone", "email", "website"] as const) {
        if ((input as any)[k] !== undefined) legacyUpdate[k] = (input as any)[k];
      }
      if (Object.keys(legacyUpdate).length > 0) {
        await db.update(companySettings)
          .set(legacyUpdate)
          .where(eq(companySettings.organizationId, ctx.organizationId));
      }

      return { success: true };
    }),
});
