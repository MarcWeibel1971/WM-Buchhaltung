import { and, asc, eq, lte } from "drizzle-orm";
import { invoiceItems, invoices, recurringInvoices } from "../drizzle/schema";
import { getDb } from "./db";
import { nextRecurringRunDate } from "./recurringInvoiceSchedule";

export type RecurringInvoiceDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function processDueRecurringInvoices(db: RecurringInvoiceDb, organizationId: number, asOf: string, templateId?: number) {
  const dueTemplates = await db.select().from(recurringInvoices).where(and(eq(recurringInvoices.organizationId, organizationId), eq(recurringInvoices.isActive, true), lte(recurringInvoices.nextRunDate, asOf), templateId == null ? undefined : eq(recurringInvoices.id, templateId))).orderBy(asc(recurringInvoices.nextRunDate));
  const createdInvoiceIds: number[] = [];
  for (const template of dueTemplates) {
    const invoiceDate = template.nextRunDate;
    const dueDate = new Date(`${invoiceDate}T00:00:00Z`); dueDate.setUTCDate(dueDate.getUTCDate() + template.paymentTermDays);
    const [result] = await db.insert(invoices).values({ organizationId, customerId: template.customerId, invoiceDate, dueDate: dueDate.toISOString().slice(0, 10), paymentTermDays: template.paymentTermDays, status: "draft", subject: template.subject, currency: template.currency, subtotal: template.amount, vatTotal: "0.00", total: template.amount, fiscalYear: new Date(`${invoiceDate}T00:00:00Z`).getUTCFullYear(), notes: `Automatisch aus Vorlage #${template.id} erstellt` });
    const invoiceId = Number(result.insertId);
    await db.insert(invoiceItems).values({ invoiceId, position: 1, description: template.subject, quantity: "1", unit: "Pauschal", unitPrice: template.amount, vatRate: "0.00", lineSubtotal: template.amount, lineVat: "0.00", lineTotal: template.amount });
    await db.update(recurringInvoices).set({ lastInvoiceId: invoiceId, nextRunDate: nextRecurringRunDate(template.nextRunDate, template.interval) }).where(and(eq(recurringInvoices.id, template.id), eq(recurringInvoices.organizationId, organizationId), eq(recurringInvoices.nextRunDate, template.nextRunDate)));
    createdInvoiceIds.push(invoiceId);
  }
  return { createdInvoiceIds, processed: createdInvoiceIds.length };
}
