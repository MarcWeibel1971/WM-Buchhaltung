import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { invitations, userOrganizations, users, organizations } from "../drizzle/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import crypto from "crypto";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  bookkeeper: "Buchhalter",
  viewer: "Betrachter",
};

export const invitationsRouter = router({
  // Alle Einladungen der aktuellen Organisation auflisten
  list: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, ctx.organizationId))
      .orderBy(invitations.createdAt);
    return rows;
  }),

  // Alle Mitglieder der aktuellen Organisation auflisten
  listMembers: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db
      .select({
        id: userOrganizations.id,
        userId: userOrganizations.userId,
        role: userOrganizations.role,
        createdAt: userOrganizations.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(userOrganizations)
      .innerJoin(users, eq(users.id, userOrganizations.userId))
      .where(eq(userOrganizations.organizationId, ctx.organizationId));
    return rows;
  }),

  // Neue Einladung erstellen
  create: orgProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        role: z.enum(["admin", "bookkeeper", "viewer"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Token generieren (UUID)
      const token = crypto.randomUUID();
      // 7 Tage gültig
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(invitations).values({
        organizationId: ctx.organizationId,
        invitedByUserId: ctx.user.id,
        email: input.email,
        name: input.name ?? null,
        role: input.role,
        token,
        expiresAt,
      });

      const inviteUrl = `${input.origin}/einladung/${token}`;
      return { token, inviteUrl, expiresAt };
    }),

  // Einladung widerrufen
  revoke: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(invitations)
        .where(
          and(
            eq(invitations.id, input.id),
            eq(invitations.organizationId, ctx.organizationId)
          )
        );
      return { success: true };
    }),

  // Einladung per Token abrufen (öffentlich)
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [inv] = await db
        .select({
          id: invitations.id,
          email: invitations.email,
          name: invitations.name,
          role: invitations.role,
          expiresAt: invitations.expiresAt,
          usedAt: invitations.usedAt,
          organizationId: invitations.organizationId,
          orgName: organizations.name,
        })
        .from(invitations)
        .leftJoin(organizations, eq(organizations.id, invitations.organizationId))
        .where(eq(invitations.token, input.token))
        .limit(1);

      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Einladung nicht gefunden" });
      if (inv.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Einladung wurde bereits verwendet" });
      if (new Date() > inv.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Einladung ist abgelaufen" });

      return inv;
    }),
});
