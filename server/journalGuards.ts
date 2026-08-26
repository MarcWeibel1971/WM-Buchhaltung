import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { journalEntries } from "../drizzle/schema";
import { getDb } from "./db";

export async function assertPendingJournalEntry(entryId: number, organizationId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [entry] = await db.select({ status: journalEntries.status })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, entryId), eq(journalEntries.organizationId, organizationId)))
    .limit(1);
  if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Journal-Eintrag nicht gefunden" });
  if (entry.status !== "pending") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Verbuchte Einträge sind unveränderlich (GeBüV). Erstellen Sie eine Stornobuchung." });
  }
}
