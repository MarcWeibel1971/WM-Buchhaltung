import { z } from "zod";
import { ENV } from "./env";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  // AP3.3: KI-Verfügbarkeit (Forge-LLM oder OpenRouter/Nemotron) –
  // der Client blendet KI-Features ohne konfigurierten Key aus.
  aiStatus: publicProcedure.query(() => ({
    available: Boolean(ENV.forgeApiKey || process.env.OPENROUTER_API_KEY),
  })),

  // AP4.6: E-Mail-Versand-Status – der Client zeigt eine ehrliche Meldung,
  // statt Versand-Erfolge vorzutäuschen.
  emailStatus: publicProcedure.query(() => ({
    configured: Boolean(ENV.resendApiKey),
  })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
