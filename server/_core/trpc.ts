import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * orgProcedure erzwingt, dass der aufrufende User eine aktive Organisation
 * hat. `ctx.organizationId` ist nach dieser Middleware garantiert eine
 * Zahl – alle tRPC-Prozeduren, die auf organizations-bezogene Daten
 * zugreifen, MÜSSEN diese Middleware verwenden und `ctx.organizationId`
 * in jedem WHERE-Filter einsetzen (Phase 1 Multi-Tenancy).
 */
const requireOrganization = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.organizationId == null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Keine aktive Organisation. Bitte zuerst eine Organisation einrichten oder auswählen.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      organizationId: ctx.organizationId,
    },
  });
});

export const orgProcedure = t.procedure.use(requireOrganization);

/**
 * adminProcedure (Audit P1-5): Zugriff für globale Admins (users.role = 'admin')
 * ODER Benutzer mit Rolle owner/admin in der aktuell aktiven Organisation.
 */
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role === 'admin') {
      return next({ ctx: { ...ctx, user: ctx.user } });
    }

    if (ctx.organizationId != null) {
      const { getDb } = await import("../db");
      const { userOrganizations } = await import("../../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      const membership = db
        ? await db
            .select()
            .from(userOrganizations)
            .where(
              and(
                eq(userOrganizations.userId, ctx.user.id),
                eq(userOrganizations.organizationId, ctx.organizationId),
              ),
            )
            .limit(1)
        : [];
      const orgRole = membership[0]?.role;
      if (orgRole === "owner" || orgRole === "admin") {
        return next({ ctx: { ...ctx, user: ctx.user } });
      }
    }

    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }),
);
