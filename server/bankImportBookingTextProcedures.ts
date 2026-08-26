import { eq } from "drizzle-orm";
import { z } from "zod";
import { companySettings } from "../drizzle/schema";
import { getBankTransactionsByIds, getDb, updateBankTransaction } from "./db";
import { invokeLLM } from "./_core/llm";
import { orgProcedure } from "./_core/trpc";

export const bankImportBookingTextProcedures = { generateBookingText: orgProcedure.input(z.object({ transactionIds: z.array(z.number()) })).mutation(async ({ input, ctx }) => {
  const txs = await getBankTransactionsByIds(ctx.organizationId, input.transactionIds); if (!txs.length) return { results: [] };
  const db = await getDb(); const [org] = db ? await db.select({ name: companySettings.companyName }).from(companySettings).where(eq(companySettings.organizationId, ctx.organizationId)).limit(1) : []; const company = org?.name ?? "Ihre Firma"; const results: Array<{ txId: number; success: boolean; bookingText?: string }> = [];
  for (const tx of txs) try { const date = new Date(tx.transactionDate); const months = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]; const month = months[date.getMonth()] ?? ""; const year = date.getFullYear(); const response = await invokeLLM({ messages: [{ role: "user", content: `Du bist Buchhalter der ${company}. Erstelle NUR einen präzisen Buchungstext (maximal 60 Zeichen) für: Datum ${tx.transactionDate}; Betrag CHF ${tx.amount}; Beschreibung ${tx.description}; Gegenpartei ${tx.counterparty ?? "unbekannt"}. Verwende Lieferant und Zeitraum ${month} ${year}; kein CHF und keine Beträge.` }] }); const raw = response.choices[0]?.message?.content; const bookingText = (typeof raw === "string" ? raw : "").trim().replace(/^"|"$/g, ""); if (!bookingText) { results.push({ txId: tx.id, success: false }); continue; } await updateBankTransaction(tx.id, { description: bookingText }); results.push({ txId: tx.id, success: true, bookingText }); } catch { results.push({ txId: tx.id, success: false }); }
  return { results };
}) };
