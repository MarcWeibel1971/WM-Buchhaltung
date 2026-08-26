import { z } from "zod";

export const journalLineSchema = z.object({
  accountId: z.number(),
  side: z.enum(["debit", "credit"]),
  amount: z.string(),
  description: z.string().optional(),
  vatAmount: z.string().optional(),
  vatRate: z.string().optional(),
});

export const journalEditableLineSchema = z.object({
  accountId: z.number(),
  side: z.enum(["debit", "credit"]),
  amount: z.string(),
  description: z.string().optional(),
});

export const journalExportInputSchema = z.object({
  fiscalYear: z.number(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  statusFilter: z.enum(["approved", "all"]).default("approved"),
});

export const journalListInputSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  source: z.string().optional(),
  fiscalYear: z.number().optional(),
  search: z.string().optional(),
  limit: z.number().default(50),
  offset: z.number().default(0),
});

export const journalEntryIdSchema = z.object({ entryId: z.number() });

export const journalBulkEntryIdsSchema = z.object({ entryIds: z.array(z.number()) });

export const journalCreateInputSchema = z.object({
  bookingDate: z.string(),
  valueDate: z.string().optional(),
  description: z.string().min(1),
  source: z.enum(["manual", "bank_import", "credit_card", "payroll", "vat", "system"]).default("manual"),
  fiscalYear: z.number().optional(),
  lines: z.array(journalLineSchema).min(2),
});

export const journalReverseInputSchema = z.object({
  entryId: z.number(),
  bookingDate: z.string(),
  reason: z.string().trim().max(300).optional(),
});

export const journalUpdateInputSchema = z.object({
  entryId: z.number(),
  description: z.string().optional(),
  bookingDate: z.string().optional(),
  lines: z.array(journalEditableLineSchema).optional(),
});

export const journalIdFilterInputSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  fiscalYear: z.number().optional(),
  search: z.string().optional(),
});
