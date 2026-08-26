import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { avatarSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure, router } from "./_core/trpc";

export const avatarSettingsRouter = router({
  get: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(avatarSettings)
      .where(eq(avatarSettings.organizationId, ctx.organizationId))
      .limit(1);
    return row ?? null;
  }),

  save: orgProcedure
    .input(z.object({
      language: z.string().max(10).optional(),
      style: z.enum(["concise", "balanced", "detailed"]).optional(),
      maxSentences: z.number().min(1).max(10).optional(),
      customPrompt: z.string().max(2000).optional(),
      voiceId: z.string().max(100).optional(),
      avatarName: z.string().max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Nur Administratoren können die Avatar-Einstellungen ändern." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ id: avatarSettings.id })
        .from(avatarSettings)
        .where(eq(avatarSettings.organizationId, ctx.organizationId))
        .limit(1);
      const data: Record<string, unknown> = { organizationId: ctx.organizationId };
      if (input.language !== undefined) data.language = input.language;
      if (input.style !== undefined) data.style = input.style;
      if (input.maxSentences !== undefined) data.maxSentences = input.maxSentences;
      if (input.customPrompt !== undefined) data.customPrompt = input.customPrompt;
      if (input.voiceId !== undefined) data.voiceId = input.voiceId;
      if (input.avatarName !== undefined) data.avatarName = input.avatarName;
      if (existing) {
        await db.update(avatarSettings).set(data).where(eq(avatarSettings.organizationId, ctx.organizationId));
      } else {
        await db.insert(avatarSettings).values(data as typeof avatarSettings.$inferInsert);
      }
      return { success: true };
    }),
});
