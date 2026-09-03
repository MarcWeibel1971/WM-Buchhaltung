import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "./_core/trpc";
import { getDb, assertFiscalYearOpen, createJournalEntry, approveJournalEntry } from "./db";
import {
  fiscalYears,
  yearEndBookings,
  depreciationSettings,
  accounts,
  journalEntries,
  journalLines,
  openingBalances,
  documents,
  bankTransactions,
} from "../drizzle/schema";
import { eq, and, sql, gte, lte, like, or, desc, asc, ne, isNull } from "drizzle-orm";

// Audit: Schlüssel für die Idempotenz-Prüfung von Jahresabschluss-Vorschlägen.
// Abschreibungen: ein Vorschlag pro Anlagekonto (Haben-Seite) und Jahr.
// Abgrenzungen/Kreditoren: Typ + Kontenpaar + Betrag + Quelle.
export function suggestionKey(b: {
  bookingType: string;
  debitAccountId: number;
  creditAccountId: number;
  amount: string;
  sourceDocumentId?: number | null;
  sourceJournalEntryId?: number | null;
}): string {
  if (b.bookingType === "abschreibung") {
    return `abschreibung:${b.creditAccountId}`;
  }
  return [
    b.bookingType,
    b.debitAccountId,
    b.creditAccountId,
    Number(b.amount).toFixed(2),
    b.sourceJournalEntryId ?? 0,
    b.sourceDocumentId ?? 0,
  ].join(":");
}

// Audit: Jahresabschluss-Buchung über die zentralen Helfer erstellen
// (Soll=Haben-Check, Periodensperre, lückenlose Belegnummer bei Freigabe).
async function bookYearEndEntry(
  orgId: number,
  userId: number,
  booking: {
    bookingType: string;
    description: string;
    amount: string;
    debitAccountId: number;
    creditAccountId: number;
    aiReasoning?: string | null;
  },
  year: number,
): Promise<number> {
  const bookingDate = `${year}-12-31`;
  await assertFiscalYearOpen(orgId, year, bookingDate);
  const entryId = await createJournalEntry({
    organizationId: orgId,
    bookingDate,
    description: booking.description,
    status: "pending",
    source: "system",
    sourceRef: `yearend-${year}-${booking.bookingType}`,
    fiscalYear: year,
    aiReasoning: booking.aiReasoning ?? undefined,
    lines: [
      { accountId: booking.debitAccountId, side: "debit", amount: booking.amount, description: booking.description },
      { accountId: booking.creditAccountId, side: "credit", amount: booking.amount, description: booking.description },
    ],
  });
  await approveJournalEntry(orgId, entryId, userId);
  return entryId;
}

export const yearEndRouter = router({
  // ─── Fiscal Year Management ──────────────────────────────────────────────────

  listFiscalYears: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    // Audit: org-scoped
    return db.select().from(fiscalYears)
      .where(eq(fiscalYears.organizationId, ctx.organizationId))
      .orderBy(desc(fiscalYears.year));
  }),

  createFiscalYear: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await db.select().from(fiscalYears)
        .where(and(
          eq(fiscalYears.organizationId, ctx.organizationId),
          eq(fiscalYears.year, input.year),
        ))
        .limit(1);
      if (existing.length > 0) throw new Error(`Geschäftsjahr ${input.year} existiert bereits`);
      await db.insert(fiscalYears).values({
        organizationId: ctx.organizationId,
        year: input.year, startDate: `${input.year}-01-01`, endDate: `${input.year}-12-31`,
        status: "open", isClosed: false, balanceCarriedForward: false,
      });
      return { success: true };
    }),

  startClosing: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(fiscalYears).set({ status: "closing" })
        .where(and(
          eq(fiscalYears.organizationId, ctx.organizationId),
          eq(fiscalYears.year, input.year),
        ));
      return { success: true };
    }),

  // ─── Year-End Booking Suggestions ────────────────────────────────────────────

  generateSuggestions: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const closingYear = input.year;
      const nextYear = closingYear + 1;
      const closingStart = `${closingYear}-01-01`;
      const closingEnd = `${closingYear}-12-31`;
      const nextStart = `${nextYear}-01-01`;

      // Delete existing unapproved suggestions (Audit: org-scoped)
      await db.delete(yearEndBookings).where(
        and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.fiscalYear, closingYear),
          eq(yearEndBookings.status, "suggested"),
        )
      );

      // Audit: Idempotenz – bereits freigegebene Jahresabschluss-Buchungen
      // desselben Typs/Kontos dürfen nicht erneut vorgeschlagen werden.
      const approvedExisting = await db.select({
        bookingType: yearEndBookings.bookingType,
        debitAccountId: yearEndBookings.debitAccountId,
        creditAccountId: yearEndBookings.creditAccountId,
        amount: yearEndBookings.amount,
        sourceDocumentId: yearEndBookings.sourceDocumentId,
        sourceJournalEntryId: yearEndBookings.sourceJournalEntryId,
      }).from(yearEndBookings).where(
        and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.fiscalYear, closingYear),
          eq(yearEndBookings.status, "approved"),
        )
      );
      const approvedKeys = new Set(approvedExisting.map(b => suggestionKey(b)));
      const alreadyApproved = (b: Parameters<typeof suggestionKey>[0]) => approvedKeys.has(suggestionKey(b));

      const suggestions: Array<{
        fiscalYear: number;
        bookingType: "transitorische_aktiven" | "transitorische_passiven" | "kreditoren" | "debitoren" | "abschreibung" | "rueckbuchung";
        description: string;
        amount: string;
        debitAccountId: number;
        creditAccountId: number;
        sourceDocumentId?: number;
        sourceJournalEntryId?: number;
        aiReasoning?: string;
      }> = [];
      const pushSuggestion = (sg: (typeof suggestions)[number]) => {
        if (alreadyApproved(sg)) return;
        suggestions.push(sg);
      };

      // Helper: get account by number (db is guaranteed non-null at this point; Audit: org-scoped)
      async function getAccByNum(num: string) {
        const [acc] = await db!.select().from(accounts)
          .where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.number, num)))
          .limit(1);
        return acc;
      }

      // ── 1. Transitorische Passiven ──
      // Payments in the new year that reference the closing year (services rendered in closing year)
      const tpTransactions = await db.select({
        id: bankTransactions.id, description: bankTransactions.description,
        amount: bankTransactions.amount, counterparty: bankTransactions.counterparty,
        transactionDate: bankTransactions.transactionDate, journalEntryId: bankTransactions.journalEntryId,
      }).from(bankTransactions).where(
        and(
          eq(bankTransactions.organizationId, ctx.organizationId),
          gte(bankTransactions.transactionDate, nextStart),
          lte(bankTransactions.transactionDate, `${nextYear}-03-31`),
          sql`${bankTransactions.amount} < 0`,
          or(
            like(bankTransactions.description, `%${closingYear}%`),
            like(bankTransactions.suggestedBookingText, `%${closingYear}%`),
          ),
        )
      );

      const tpAccount = await getAccByNum("2300");
      for (const txn of tpTransactions) {
        if (!tpAccount) continue;
        const absAmount = Math.abs(Number(txn.amount));
        if (absAmount < 10) continue;

        let expenseAccountId = tpAccount.id;
        if (txn.journalEntryId) {
          const lines = await db.select().from(journalLines)
            .where(and(eq(journalLines.entryId, txn.journalEntryId), eq(journalLines.side, "debit")));
          if (lines.length > 0) {
            const [expAcc] = await db.select().from(accounts)
              .where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.id, lines[0].accountId)))
              .limit(1);
            if (expAcc && (expAcc.accountType === "expense" || expAcc.accountType === "revenue")) {
              expenseAccountId = expAcc.id;
            }
          }
        }

        pushSuggestion({
          fiscalYear: closingYear, bookingType: "transitorische_passiven",
          description: `TP: ${txn.counterparty || txn.description || 'Unbekannt'} – Leistung ${closingYear}, Zahlung ${nextYear}`,
          amount: absAmount.toFixed(2), debitAccountId: expenseAccountId, creditAccountId: tpAccount.id,
          sourceJournalEntryId: txn.journalEntryId || undefined,
          aiReasoning: `Zahlung am ${txn.transactionDate} (${nextYear}) für "${txn.description}" referenziert ${closingYear}. CHF ${absAmount.toFixed(2)} als transitorische Passiven abgrenzen.`,
        });
      }

      // ── 2. Kreditoren ──
      // Unmatched invoices from the closing year
      const kredDocs = await db.select().from(documents).where(
        and(
          eq(documents.organizationId, ctx.organizationId),
          eq(documents.documentType, "invoice_in"),
          eq(documents.matchStatus, "unmatched"),
          sql`JSON_EXTRACT(${documents.aiMetadata}, '$.date') >= ${closingStart}`,
          sql`JSON_EXTRACT(${documents.aiMetadata}, '$.date') <= ${closingEnd}`,
        )
      );

      const kredAccount = await getAccByNum("2000");
      const defaultExpense = await getAccByNum("4799");
      for (const doc of kredDocs) {
        if (!kredAccount) continue;
        let metadata: any = {};
        try { metadata = typeof doc.aiMetadata === 'string' ? JSON.parse(doc.aiMetadata) : doc.aiMetadata || {}; } catch {}
        const amount = Number(metadata.amount || metadata.totalAmount || 0);
        if (amount <= 0) continue;

        pushSuggestion({
          fiscalYear: closingYear, bookingType: "kreditoren",
          description: `Kreditoren: ${metadata.counterparty || doc.filename} – Rechnung ${closingYear}, unbezahlt`,
          amount: amount.toFixed(2),
          debitAccountId: defaultExpense?.id || kredAccount.id,
          creditAccountId: kredAccount.id,
          sourceDocumentId: doc.id,
          aiReasoning: `Rechnung "${doc.filename}" vom ${metadata.date || 'unbekannt'} (CHF ${amount.toFixed(2)}) ist noch nicht mit einer Bankzahlung verknüpft.`,
        });
      }

      // ── 3. Transitorische Aktiven ──
      // Payments in Q4 of closing year that reference the next year
      const taTransactions = await db.select({
        id: bankTransactions.id, description: bankTransactions.description,
        amount: bankTransactions.amount, counterparty: bankTransactions.counterparty,
        transactionDate: bankTransactions.transactionDate, journalEntryId: bankTransactions.journalEntryId,
      }).from(bankTransactions).where(
        and(
          eq(bankTransactions.organizationId, ctx.organizationId),
          gte(bankTransactions.transactionDate, `${closingYear}-10-01`),
          lte(bankTransactions.transactionDate, closingEnd),
          sql`${bankTransactions.amount} < 0`,
          or(
            like(bankTransactions.description, `%${nextYear}%`),
            like(bankTransactions.suggestedBookingText, `%${nextYear}%`),
          ),
        )
      );

      const taAccount = await getAccByNum("1300");
      for (const txn of taTransactions) {
        if (!taAccount) continue;
        const absAmount = Math.abs(Number(txn.amount));
        if (absAmount < 10) continue;

        let expenseAccountId = taAccount.id;
        if (txn.journalEntryId) {
          const lines = await db.select().from(journalLines)
            .where(and(eq(journalLines.entryId, txn.journalEntryId), eq(journalLines.side, "debit")));
          if (lines.length > 0) {
            const [expAcc] = await db.select().from(accounts)
              .where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.id, lines[0].accountId)))
              .limit(1);
            if (expAcc && (expAcc.accountType === "expense" || expAcc.accountType === "revenue")) {
              expenseAccountId = expAcc.id;
            }
          }
        }

        pushSuggestion({
          fiscalYear: closingYear, bookingType: "transitorische_aktiven",
          description: `TA: ${txn.counterparty || txn.description || 'Unbekannt'} – Zahlung ${closingYear}, Leistung ${nextYear}`,
          amount: absAmount.toFixed(2), debitAccountId: taAccount.id, creditAccountId: expenseAccountId,
          sourceJournalEntryId: txn.journalEntryId || undefined,
          aiReasoning: `Zahlung am ${txn.transactionDate} (${closingYear}) für "${txn.description}" referenziert ${nextYear}. CHF ${absAmount.toFixed(2)} als transitorische Aktiven abgrenzen.`,
        });
      }

      // ── 4. Abschreibungen ──
      const depSettings = await db.select().from(depreciationSettings).where(
        and(eq(depreciationSettings.organizationId, ctx.organizationId), eq(depreciationSettings.isActive, true))
      );

      for (const setting of depSettings) {
        const [accountData] = await db.select().from(accounts)
          .where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.id, setting.accountId)))
          .limit(1);
        if (!accountData) continue;

        const [ob] = await db.select().from(openingBalances).where(
          and(
            eq(openingBalances.organizationId, ctx.organizationId),
            eq(openingBalances.accountId, setting.accountId),
            eq(openingBalances.fiscalYear, closingYear),
          )
        ).limit(1);
        const openingBal = Number(ob?.balance || 0);

        const movements = await db.select({
          side: journalLines.side,
          totalAmount: sql<string>`SUM(${journalLines.amount})`,
        }).from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(and(
            eq(journalEntries.organizationId, ctx.organizationId),
            eq(journalLines.accountId, setting.accountId),
            gte(journalEntries.bookingDate, closingStart),
            lte(journalEntries.bookingDate, closingEnd),
            ne(journalEntries.status, "rejected"),
          ))
          .groupBy(journalLines.side);

        let debitTotal = 0, creditTotal = 0;
        for (const m of movements) {
          if (m.side === "debit") debitTotal = Number(m.totalAmount);
          if (m.side === "credit") creditTotal = Number(m.totalAmount);
        }

        const bookValue = openingBal + debitTotal - creditTotal;
        if (bookValue <= 0) continue;

        const rate = Number(setting.depreciationRate) / 100;
        const depAmount = Math.round(bookValue * rate * 100) / 100;
        if (depAmount < 1) continue;

        let expenseAccId = setting.depreciationExpenseAccountId;
        if (!expenseAccId) {
          const defaultDepExp = await getAccByNum("4800");
          if (defaultDepExp) expenseAccId = defaultDepExp.id;
        }
        if (!expenseAccId) continue;

        pushSuggestion({
          fiscalYear: closingYear, bookingType: "abschreibung",
          description: `Abschreibung ${accountData.number} ${accountData.name} (${setting.method === 'degressive' ? 'degressiv' : 'linear'} ${setting.depreciationRate}%)`,
          amount: depAmount.toFixed(2), debitAccountId: expenseAccId, creditAccountId: setting.accountId,
          aiReasoning: `Buchwert CHF ${bookValue.toFixed(2)} × ${setting.depreciationRate}% (${setting.method}) = CHF ${depAmount.toFixed(2)} Abschreibung.`,
        });
      }

      // Insert all suggestions
      if (suggestions.length > 0) {
        await db.insert(yearEndBookings).values(
          suggestions.map(s => ({ ...s, organizationId: ctx.organizationId, status: "suggested" as const }))
        );
      }

      return { count: suggestions.length, suggestions: suggestions.map(s => ({ ...s, status: "suggested" })) };
    }),

  // List year-end bookings
  listBookings: orgProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const bookings = await db.select({
        booking: yearEndBookings,
        debitAccount: { number: accounts.number, name: accounts.name },
      }).from(yearEndBookings)
        .leftJoin(accounts, eq(yearEndBookings.debitAccountId, accounts.id))
        .where(and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.fiscalYear, input.year),
        ))
        .orderBy(asc(yearEndBookings.bookingType), asc(yearEndBookings.id));

      const result = [];
      for (const row of bookings) {
        const [creditAcc] = await db.select({ number: accounts.number, name: accounts.name })
          .from(accounts)
          .where(and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.id, row.booking.creditAccountId)))
          .limit(1);
        result.push({
          ...row.booking,
          debitAccountNumber: row.debitAccount?.number || '',
          debitAccountName: row.debitAccount?.name || '',
          creditAccountNumber: creditAcc?.number || '',
          creditAccountName: creditAcc?.name || '',
        });
      }
      return result;
    }),

  // Approve a single booking
  approveBooking: orgProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [booking] = await db.select().from(yearEndBookings)
        .where(and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.id, input.bookingId),
        ))
        .limit(1);
      if (!booking) throw new Error("Buchung nicht gefunden");
      if (booking.status !== "suggested") throw new Error("Buchung bereits verarbeitet");

      // Audit: Periodensperre + Buchung über die zentralen Helfer
      const entryId = await bookYearEndEntry(ctx.organizationId, ctx.user.id, booking, booking.fiscalYear);

      await db.update(yearEndBookings)
        .set({ status: "approved", journalEntryId: entryId })
        .where(and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.id, input.bookingId),
        ));

      return { success: true, journalEntryId: entryId };
    }),

  // Reject a booking
  rejectBooking: orgProcedure
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(yearEndBookings).set({ status: "rejected" })
        .where(and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.id, input.bookingId),
        ));
      return { success: true };
    }),

  // Approve all suggested bookings
  approveAll: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const pending = await db.select().from(yearEndBookings).where(
        and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.fiscalYear, input.year),
          eq(yearEndBookings.status, "suggested"),
        )
      );

      // Audit: Periodensperre einmal vorab prüfen, dann über die zentralen Helfer buchen
      await assertFiscalYearOpen(ctx.organizationId, input.year, `${input.year}-12-31`);

      let approved = 0;
      for (const booking of pending) {
        const entryId = await bookYearEndEntry(ctx.organizationId, ctx.user.id, booking, input.year);

        await db.update(yearEndBookings)
          .set({ status: "approved", journalEntryId: entryId })
          .where(and(
            eq(yearEndBookings.organizationId, ctx.organizationId),
            eq(yearEndBookings.id, booking.id),
          ));
        approved++;
      }
      return { approved };
    }),

  // ─── Automatic Reversals ─────────────────────────────────────────────────────

  generateReversals: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const closingYear = input.year;
      const nextYear = closingYear + 1;

      const approvedBookings = await db.select().from(yearEndBookings).where(
        and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.fiscalYear, closingYear),
          eq(yearEndBookings.status, "approved"),
          or(
            eq(yearEndBookings.bookingType, "transitorische_aktiven"),
            eq(yearEndBookings.bookingType, "transitorische_passiven"),
          ),
          isNull(yearEndBookings.reversalEntryId),
        )
      );

      // Audit: Rückbuchungen landen im Folgejahr – dieses muss eröffnet und offen
      // sein. Fehlt es noch, wird es (wie beim Saldovortrag) angelegt.
      if (approvedBookings.length > 0) {
        const [existingNext] = await db.select({ id: fiscalYears.id }).from(fiscalYears)
          .where(and(
            eq(fiscalYears.organizationId, ctx.organizationId),
            eq(fiscalYears.year, nextYear),
          ))
          .limit(1);
        if (!existingNext) {
          await db.insert(fiscalYears).values({
            organizationId: ctx.organizationId,
            year: nextYear, startDate: `${nextYear}-01-01`, endDate: `${nextYear}-12-31`,
            status: "open", isClosed: false, balanceCarriedForward: false,
          });
        }
        await assertFiscalYearOpen(ctx.organizationId, nextYear, `${nextYear}-01-01`);
      }

      let reversed = 0;
      for (const booking of approvedBookings) {
        const reversalDescription = `Rückbuchung: ${booking.description}`;
        const entryId = await createJournalEntry({
          organizationId: ctx.organizationId,
          bookingDate: `${nextYear}-01-01`,
          description: reversalDescription,
          status: "pending",
          source: "system",
          sourceRef: `yearend-reversal-${closingYear}`,
          fiscalYear: nextYear,
          aiReasoning: `Automatische Rückbuchung der Jahresabschluss-Buchung #${booking.id} vom ${closingYear}.`,
          lines: [
            { accountId: booking.creditAccountId, side: "debit", amount: booking.amount, description: reversalDescription },
            { accountId: booking.debitAccountId, side: "credit", amount: booking.amount, description: reversalDescription },
          ],
        });
        await approveJournalEntry(ctx.organizationId, entryId, ctx.user.id);
        const entry = { id: entryId };

        await db.insert(yearEndBookings).values({
          organizationId: ctx.organizationId,
          fiscalYear: closingYear, bookingType: "rueckbuchung",
          description: `Rückbuchung: ${booking.description}`,
          amount: booking.amount,
          debitAccountId: booking.creditAccountId, creditAccountId: booking.debitAccountId,
          sourceJournalEntryId: booking.journalEntryId,
          journalEntryId: entry.id, status: "approved",
          aiReasoning: `Automatische Rückbuchung am 01.01.${nextYear} für transitorische Buchung vom 31.12.${closingYear}.`,
        });

        await db.update(yearEndBookings)
          .set({ reversalEntryId: entry.id })
          .where(and(
            eq(yearEndBookings.organizationId, ctx.organizationId),
            eq(yearEndBookings.id, booking.id),
          ));
        reversed++;
      }
      return { reversed };
    }),

  // ─── Saldovortrag ────────────────────────────────────────────────────────────

  carryForwardBalances: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const closingYear = input.year;
      const nextYear = closingYear + 1;
      const closingStart = `${closingYear}-01-01`;
      const closingEnd = `${closingYear}-12-31`;

      // Ensure next fiscal year exists (scoped to this org)
      const [existingNext] = await db.select().from(fiscalYears)
        .where(and(
          eq(fiscalYears.organizationId, ctx.organizationId),
          eq(fiscalYears.year, nextYear),
        ))
        .limit(1);
      if (!existingNext) {
        await db.insert(fiscalYears).values({
          organizationId: ctx.organizationId,
          year: nextYear, startDate: `${nextYear}-01-01`, endDate: `${nextYear}-12-31`,
          status: "open", isClosed: false, balanceCarriedForward: false,
        });
      }

      // Delete existing opening balances for next year (scoped)
      await db.delete(openingBalances)
        .where(and(
          eq(openingBalances.organizationId, ctx.organizationId),
          eq(openingBalances.fiscalYear, nextYear),
        ));

      const allAccounts = await db.select().from(accounts)
        .where(and(
          eq(accounts.organizationId, ctx.organizationId),
          eq(accounts.isActive, true),
        ));
      const newBalances: Array<{ organizationId: number; accountId: number; fiscalYear: number; balance: string }> = [];
      let totalRevenue = 0, totalExpense = 0;

      for (const acc of allAccounts) {
        const [ob] = await db.select().from(openingBalances).where(
          and(
            eq(openingBalances.organizationId, ctx.organizationId),
            eq(openingBalances.accountId, acc.id),
            eq(openingBalances.fiscalYear, closingYear),
          )
        ).limit(1);
        const openingBal = Number(ob?.balance || 0);

        const movements = await db.select({
          side: journalLines.side,
          totalAmount: sql<string>`SUM(${journalLines.amount})`,
        }).from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(and(
            eq(journalEntries.organizationId, ctx.organizationId),
            eq(journalLines.accountId, acc.id),
            gte(journalEntries.bookingDate, closingStart),
            lte(journalEntries.bookingDate, closingEnd),
            eq(journalEntries.status, "approved"),
          ))
          .groupBy(journalLines.side);

        let debitTotal = 0, creditTotal = 0;
        for (const m of movements) {
          if (m.side === "debit") debitTotal = Number(m.totalAmount);
          if (m.side === "credit") creditTotal = Number(m.totalAmount);
        }

        let closingBalance: number;
        if (acc.normalBalance === "debit") {
          closingBalance = openingBal + debitTotal - creditTotal;
        } else {
          closingBalance = openingBal + creditTotal - debitTotal;
        }

        // P&L accounts: accumulate for net result, don't carry forward
        if (acc.accountType === "revenue") {
          totalRevenue += closingBalance;
          continue;
        }
        if (acc.accountType === "expense") {
          totalExpense += closingBalance;
          continue;
        }

        if (Math.abs(closingBalance) >= 0.01) {
          newBalances.push({ organizationId: ctx.organizationId, accountId: acc.id, fiscalYear: nextYear, balance: closingBalance.toFixed(2) });
        }
      }

      // Net result → Gewinnvortrag (scoped)
      // Audit: Jahresergebnis gehört auf 2950 (Gewinn-/Verlustvortrag), ersatzweise
      // 2979 (Jahresgewinn/-verlust) – NIE auf 2800 (Aktienkapital).
      const netResult = totalRevenue - totalExpense;
      let gewinnvortragAcc: (typeof allAccounts)[number] | undefined;
      for (const num of ["2950", "2979"]) {
        const [acc] = await db.select().from(accounts).where(
          and(eq(accounts.organizationId, ctx.organizationId), eq(accounts.number, num))
        ).limit(1);
        if (acc) { gewinnvortragAcc = acc; break; }
      }
      if (!gewinnvortragAcc) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Kein Konto für den Gewinn-/Verlustvortrag gefunden. Bitte zuerst das Konto 2950 (Gewinnvortrag / Verlustvortrag) im Kontenplan anlegen.",
        });
      }

      {
        const existing = newBalances.find(b => b.accountId === gewinnvortragAcc.id);
        if (existing) {
          existing.balance = (Number(existing.balance) + netResult).toFixed(2);
        } else if (Math.abs(netResult) >= 0.01) {
          newBalances.push({ organizationId: ctx.organizationId, accountId: gewinnvortragAcc.id, fiscalYear: nextYear, balance: netResult.toFixed(2) });
        }
      }

      if (newBalances.length > 0) {
        await db.insert(openingBalances).values(newBalances);
      }

      await db.update(fiscalYears).set({ balanceCarriedForward: true })
        .where(and(
          eq(fiscalYears.organizationId, ctx.organizationId),
          eq(fiscalYears.year, closingYear),
        ));

      return {
        accountsCarriedForward: newBalances.length,
        netResult: netResult.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        totalExpense: totalExpense.toFixed(2),
      };
    }),

  // ─── Close Fiscal Year ───────────────────────────────────────────────────────

  closeFiscalYear: orgProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const pending = await db.select().from(yearEndBookings).where(
        and(
          eq(yearEndBookings.organizationId, ctx.organizationId),
          eq(yearEndBookings.fiscalYear, input.year),
          eq(yearEndBookings.status, "suggested"),
        )
      );
      if (pending.length > 0) throw new Error(`Es gibt noch ${pending.length} offene Buchungsvorschläge.`);

      const [fy] = await db.select().from(fiscalYears)
        .where(and(
          eq(fiscalYears.organizationId, ctx.organizationId),
          eq(fiscalYears.year, input.year),
        ))
        .limit(1);
      if (!fy?.balanceCarriedForward) throw new Error("Saldovortrag wurde noch nicht durchgeführt.");

      await db.update(fiscalYears)
        .set({ status: "closed", isClosed: true, closedAt: new Date() })
        .where(and(
          eq(fiscalYears.organizationId, ctx.organizationId),
          eq(fiscalYears.year, input.year),
        ));
      return { success: true };
    }),

  // ─── Depreciation Settings ───────────────────────────────────────────────────

  listDepreciationSettings: orgProcedure.query(async ({ ctx }) => {
    const db = await getDb();
      if (!db) throw new Error("Database not available");
    const settings = await db.select({
      setting: depreciationSettings,
      accountNumber: accounts.number,
      accountName: accounts.name,
    }).from(depreciationSettings)
      .leftJoin(accounts, eq(depreciationSettings.accountId, accounts.id))
      .where(eq(depreciationSettings.organizationId, ctx.organizationId))
      .orderBy(asc(depreciationSettings.accountId));

    const result = [];
    for (const row of settings) {
      let expenseAccountInfo = null;
      if (row.setting.depreciationExpenseAccountId) {
        const [expAcc] = await db.select({ number: accounts.number, name: accounts.name })
          .from(accounts)
          .where(and(
            eq(accounts.organizationId, ctx.organizationId),
            eq(accounts.id, row.setting.depreciationExpenseAccountId),
          ))
          .limit(1);
        expenseAccountInfo = expAcc || null;
      }
      result.push({
        ...row.setting,
        accountNumber: row.accountNumber || '',
        accountName: row.accountName || '',
        expenseAccountNumber: expenseAccountInfo?.number || '',
        expenseAccountName: expenseAccountInfo?.name || '',
      });
    }
    return result;
  }),

  createDepreciationSetting: orgProcedure
    .input(z.object({
      accountId: z.number(), depreciationRate: z.string(),
      method: z.enum(["linear", "degressive"]),
      usefulLifeYears: z.number().optional(),
      depreciationExpenseAccountId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(depreciationSettings).values({
        organizationId: ctx.organizationId,
        accountId: input.accountId, depreciationRate: input.depreciationRate,
        method: input.method, usefulLifeYears: input.usefulLifeYears,
        depreciationExpenseAccountId: input.depreciationExpenseAccountId,
        notes: input.notes, isActive: true,
      });
      return { success: true };
    }),

  updateDepreciationSetting: orgProcedure
    .input(z.object({
      id: z.number(), depreciationRate: z.string().optional(),
      method: z.enum(["linear", "degressive"]).optional(),
      usefulLifeYears: z.number().optional().nullable(),
      depreciationExpenseAccountId: z.number().optional().nullable(),
      notes: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updates } = input;
      const cleanUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      // Audit: org-scoped
      await db.update(depreciationSettings).set(cleanUpdates)
        .where(and(eq(depreciationSettings.organizationId, ctx.organizationId), eq(depreciationSettings.id, id)));
      return { success: true };
    }),

  deleteDepreciationSetting: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Audit: org-scoped
      await db.delete(depreciationSettings)
        .where(and(eq(depreciationSettings.organizationId, ctx.organizationId), eq(depreciationSettings.id, input.id)));
      return { success: true };
    }),

  // ─── Summary ─────────────────────────────────────────────────────────────────

  getSummary: orgProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Audit: org-scoped
      const [fy] = await db.select().from(fiscalYears)
        .where(and(eq(fiscalYears.organizationId, ctx.organizationId), eq(fiscalYears.year, input.year)))
        .limit(1);

      const bookings = await db.select({
        bookingType: yearEndBookings.bookingType,
        status: yearEndBookings.status,
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`SUM(${yearEndBookings.amount})`,
      }).from(yearEndBookings)
        .where(and(eq(yearEndBookings.organizationId, ctx.organizationId), eq(yearEndBookings.fiscalYear, input.year)))
        .groupBy(yearEndBookings.bookingType, yearEndBookings.status);

      return { fiscalYear: fy || null, bookingSummary: bookings };
    }),
});
