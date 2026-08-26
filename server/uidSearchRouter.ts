import { z } from "zod";
import { logger } from "./_core/logger";
import { publicProcedure, router } from "./_core/trpc";
import { searchCompanies } from "./uidSearch";

export const uidSearchRouter = router({
  search: publicProcedure
    .input(z.object({ name: z.string().min(2).max(200) }))
    .query(async ({ input }) => {
      try {
        return await searchCompanies(input.name, 10);
      } catch (err) {
        logger.error({ err }, "UID company search failed");
        return [];
      }
    }),
});
