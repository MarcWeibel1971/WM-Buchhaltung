import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { recurringInvoices } from "../drizzle/schema";
import { getDb } from "./db";
import { orgProcedure, router } from "./_core/trpc";
import { processDueRecurringInvoices } from "./recurringInvoiceProcessor";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";

const recurringInvoiceInput = z.object({ customerId: z.number(), subject: z.string().min(1).max(300), amount: z.number().positive(), currency: z.enum(["CHF", "EUR"]).default("CHF"), interval: z.enum(["monthly", "quarterly", "yearly"]), nextRunDate: z.string().date(), paymentTermDays: z.number().int().min(1).max(365).default(30) });

export const recurringInvoicesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(recurringInvoices).where(eq(recurringInvoices.organizationId, ctx.organizationId)).orderBy(asc(recurringInvoices.nextRunDate));
  }),
  create: orgProcedure.input(recurringInvoiceInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result = await db.insert(recurringInvoices).values({ ...input, amount: input.amount.toFixed(2), organizationId: ctx.organizationId });
    const id = Number(result[0].insertId);
    const session = decodeURIComponent(ctx.req.headers.cookie?.match(/app_session_id=([^;]+)/)?.[1] ?? "");
    const job = await createHeartbeatJob({ name: `recurring-invoice-${id}`, cron: "0 0 5 * * *", path: "/api/scheduled/recurring-invoice", method: "POST", description: `Tägliche Fälligkeitsprüfung für Rechnungsvorlage ${id}` }, session);
    await db.update(recurringInvoices).set({ scheduleCronTaskUid: job.taskUid }).where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.organizationId, ctx.organizationId)));
    return { id, scheduleCronTaskUid: job.taskUid };
  }),
  setActive: orgProcedure.input(z.object({ id: z.number(), isActive: z.boolean() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [template] = await db.select().from(recurringInvoices).where(and(eq(recurringInvoices.id, input.id), eq(recurringInvoices.organizationId, ctx.organizationId))).limit(1);
    if (!template) throw new TRPCError({ code: "NOT_FOUND" });
    const session = decodeURIComponent(ctx.req.headers.cookie?.match(/app_session_id=([^;]+)/)?.[1] ?? "");
    if (template.scheduleCronTaskUid) await updateHeartbeatJob(template.scheduleCronTaskUid, { enable: input.isActive }, session);
    const result = await db.update(recurringInvoices).set({ isActive: input.isActive }).where(and(eq(recurringInvoices.id, input.id), eq(recurringInvoices.organizationId, ctx.organizationId)));
    if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND" });
    return { success: true };
  }),
  delete: orgProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [template] = await db.select().from(recurringInvoices).where(and(eq(recurringInvoices.id, input.id), eq(recurringInvoices.organizationId, ctx.organizationId))).limit(1);
    if (!template) throw new TRPCError({ code: "NOT_FOUND" });
    const session = decodeURIComponent(ctx.req.headers.cookie?.match(/app_session_id=([^;]+)/)?.[1] ?? "");
    if (template.scheduleCronTaskUid) await deleteHeartbeatJob(template.scheduleCronTaskUid, session);
    await db.delete(recurringInvoices).where(and(eq(recurringInvoices.id, input.id), eq(recurringInvoices.organizationId, ctx.organizationId)));
    return { success: true };
  }),
  runDue: orgProcedure.input(z.object({ asOf: z.string().date().optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
    return processDueRecurringInvoices(db, ctx.organizationId, asOf);
  }),
});
