import { z } from "zod";
import { getBalanceSheet, getDashboardStats, getIncomeStatement } from "./db";
import { orgProcedure, router } from "./_core/trpc";

export const reportsRouter = router({
  balanceSheet: orgProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input, ctx }) => getBalanceSheet(ctx.organizationId, input.fiscalYear)),

  incomeStatement: orgProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input, ctx }) => getIncomeStatement(ctx.organizationId, input.fiscalYear)),

  dashboard: orgProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(({ input, ctx }) => getDashboardStats(ctx.organizationId, input.fiscalYear)),
});
