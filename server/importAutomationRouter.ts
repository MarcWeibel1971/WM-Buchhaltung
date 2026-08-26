import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { importAutomationSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure, router } from "./_core/trpc";

const importAutomationInput = z.object({
  autoKiCategorize: z.boolean(),
  autoGenerateBookingTexts: z.boolean(),
  autoRefreshLearned: z.boolean(),
  autoDetectTransfers: z.boolean(),
  autoMatchDocuments: z.boolean(),
});

export const importAutomationRouter = router({
  get: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(importAutomationSettings)
      .where(eq(importAutomationSettings.organizationId, ctx.organizationId))
      .limit(1);
    return row ?? {
      autoKiCategorize: true,
      autoGenerateBookingTexts: true,
      autoRefreshLearned: true,
      autoDetectTransfers: true,
      autoMatchDocuments: false,
    };
  }),

  save: orgProcedure
    .input(importAutomationInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ id: importAutomationSettings.id })
        .from(importAutomationSettings)
        .where(eq(importAutomationSettings.organizationId, ctx.organizationId))
        .limit(1);
      const data = { ...input, organizationId: ctx.organizationId };
      if (existing) {
        await db.update(importAutomationSettings).set(data)
          .where(eq(importAutomationSettings.organizationId, ctx.organizationId));
      } else {
        await db.insert(importAutomationSettings).values(data);
      }
      return { success: true };
    }),
});
