import { eq, and, desc, asc, sql, gte, lte, lt, inArray, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, accounts, journalEntries, journalLines,
  journalEntrySequences,
  invoiceSequences,
  bankAccounts, bankTransactions, employees, payrollEntries,
  vatPeriods, openingBalances, fiscalYears, creditCardStatements,
  bookingRules, documents, invoices,
  type Account, type JournalEntry, type JournalLine, type BankTransaction,
  type Employee, type PayrollEntry, type BookingRule, type Document,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { createLogger } from "./_core/logger";

const logger = createLogger("db");

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { logger.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { logger.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Accounts (Kontenplan) ────────────────────────────────────────────────────
export async function getAllAccounts(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accounts)
    .where(and(eq(accounts.organizationId, orgId), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.sortOrder));
}

export async function getAccountByNumber(orgId: number, number: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accounts)
    .where(and(eq(accounts.organizationId, orgId), eq(accounts.number, number)))
    .limit(1);
  return result[0];
}

export async function getAccountById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accounts)
    .where(and(eq(accounts.organizationId, orgId), eq(accounts.id, id)))
    .limit(1);
  return result[0];
}

// ─── Account Balances ─────────────────────────────────────────────────────────
export async function getAccountBalance(orgId: number, accountId: number, fiscalYear?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get opening balance
  let openingBalance = 0;
  if (fiscalYear) {
    const ob = await db.select().from(openingBalances)
      .where(and(
        eq(openingBalances.organizationId, orgId),
        eq(openingBalances.accountId, accountId),
        eq(openingBalances.fiscalYear, fiscalYear),
      ))
      .limit(1);
    if (ob[0]) openingBalance = parseFloat(ob[0].balance as string);
  }

  // Get account info for normal balance
  const account = await getAccountById(orgId, accountId);
  if (!account) return openingBalance;

  // Sum approved journal lines
  const lines = await db.select({
    side: journalLines.side,
    amount: sql<string>`SUM(${journalLines.amount})`,
  }).from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(
      eq(journalEntries.organizationId, orgId),
      eq(journalLines.accountId, accountId),
      eq(journalEntries.status, "approved"),
      fiscalYear ? eq(journalEntries.fiscalYear, fiscalYear) : sql`1=1`
    ))
    .groupBy(journalLines.side);

  let debitSum = 0, creditSum = 0;
  for (const line of lines) {
    if (line.side === "debit") debitSum = parseFloat(line.amount || "0");
    else creditSum = parseFloat(line.amount || "0");
  }

  // Calculate balance based on normal balance side
  if (account.normalBalance === "debit") {
    return openingBalance + debitSum - creditSum;
  } else {
    return openingBalance + creditSum - debitSum;
  }
}

// ─── Journal ──────────────────────────────────────────────────────────────────
export async function getJournalEntries(orgId: number, filters: {
  status?: "pending" | "approved" | "rejected";
  source?: string;
  fiscalYear?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { entries: [], total: 0 };

  const conditions = [eq(journalEntries.organizationId, orgId)];
  if (filters.status) conditions.push(eq(journalEntries.status, filters.status));
  if (filters.source) conditions.push(eq(journalEntries.source, filters.source as any));
  if (filters.fiscalYear) conditions.push(eq(journalEntries.fiscalYear, filters.fiscalYear));
  if (filters.search) conditions.push(like(journalEntries.description, `%${filters.search}%`));

  const whereClause = and(...conditions);

  const [entriesResult, countResult] = await Promise.all([
    db.select().from(journalEntries)
      .where(whereClause)
      .orderBy(desc(journalEntries.bookingDate), desc(journalEntries.id))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0),
    db.select({ count: sql<number>`COUNT(*)` }).from(journalEntries).where(whereClause),
  ]);

  // Enrich entries with line summaries (debit/credit accounts, total amount, type)
  const entryIds = entriesResult.map(e => e.id);
  let lineSummaries: Record<number, { debitAccounts: Array<{id: number; number: string; name: string}>; creditAccounts: Array<{id: number; number: string; name: string}>; totalDebit: number; totalCredit: number; lineCount: number }> = {};
  
  if (entryIds.length > 0) {
    const allLines = await db.select({
      entryId: journalLines.entryId,
      side: journalLines.side,
      amount: journalLines.amount,
      accountId: accounts.id,
      accountNumber: accounts.number,
      accountName: accounts.name,
    }).from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(inArray(journalLines.entryId, entryIds));
    
    for (const line of allLines) {
      if (!lineSummaries[line.entryId]) {
        lineSummaries[line.entryId] = { debitAccounts: [], creditAccounts: [], totalDebit: 0, totalCredit: 0, lineCount: 0 };
      }
      const s = lineSummaries[line.entryId];
      s.lineCount++;
      const amt = parseFloat(line.amount as string);
      if (line.side === 'debit') {
        s.totalDebit += amt;
        if (!s.debitAccounts.find(a => a.id === line.accountId)) {
          s.debitAccounts.push({ id: line.accountId, number: line.accountNumber, name: line.accountName });
        }
      } else {
        s.totalCredit += amt;
        if (!s.creditAccounts.find(a => a.id === line.accountId)) {
          s.creditAccounts.push({ id: line.accountId, number: line.accountNumber, name: line.accountName });
        }
      }
    }
  }

  const enrichedEntries = entriesResult.map(e => {
    const summary = lineSummaries[e.id] || { debitAccounts: [], creditAccounts: [], totalDebit: 0, totalCredit: 0, lineCount: 0 };
    const isCollective = summary.debitAccounts.length > 1 || summary.creditAccounts.length > 1;
    return {
      ...e,
      isCollective,
      debitAccountLabel: summary.debitAccounts.length > 1 ? 'Diverse' : summary.debitAccounts[0] ? `${summary.debitAccounts[0].number} ${summary.debitAccounts[0].name}` : '–',
      creditAccountLabel: summary.creditAccounts.length > 1 ? 'Diverse' : summary.creditAccounts[0] ? `${summary.creditAccounts[0].number} ${summary.creditAccounts[0].name}` : '–',
      totalAmount: summary.totalDebit,
      lineCount: summary.lineCount,
    };
  });

  return { entries: enrichedEntries, total: countResult[0]?.count ?? 0 };
}

export async function getJournalEntryWithLines(orgId: number, entryId: number) {
  const db = await getDb();
  if (!db) return null;

  const [entry] = await db.select().from(journalEntries)
    .where(and(eq(journalEntries.organizationId, orgId), eq(journalEntries.id, entryId)))
    .limit(1);
  if (!entry) return null;

  const lines = await db.select({
    line: journalLines,
    account: accounts,
  }).from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(eq(journalLines.entryId, entryId));

  return { entry, lines };
}

/**
 * Audit: Reine (DB-freie) Prüfung der Buchungszeilen-Beträge:
 * - jeder Betrag muss eine endliche Zahl > 0 sein (Number.isFinite)
 * - Soll- und Haben-Total müssen in Rappen (Math.round(x*100)) exakt übereinstimmen
 * Wirft einen deutschen Error, sonst kehrt sie still zurück.
 */
export function assertJournalLinesBalanced(
  lines: Array<{ accountId: number; side: "debit" | "credit"; amount: string }>,
): void {
  let debitRappen = 0;
  let creditRappen = 0;
  for (const line of lines) {
    const amount = Number(line.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Ungültiger Betrag "${line.amount}" in Buchungszeile (Konto-ID ${line.accountId}) – erwartet wird eine Zahl grösser 0.`);
    }
    const rappen = Math.round(amount * 100);
    if (line.side === "debit") debitRappen += rappen;
    else creditRappen += rappen;
  }
  if (debitRappen !== creditRappen) {
    throw new Error(`Double-Entry-Fehler: Soll (${(debitRappen / 100).toFixed(2)}) ≠ Haben (${(creditRappen / 100).toFixed(2)})`);
  }
}

/**
 * Audit: Validiert Buchungszeilen vor dem Schreiben (createJournalEntry,
 * updateJournalEntryLines).
 * - jeder Betrag muss eine endliche Zahl > 0 sein (Number.isFinite)
 * - Soll- und Haben-Total müssen in Rappen exakt übereinstimmen
 * - jedes Konto muss zur Organisation gehören (Mandantentrennung)
 */
export async function validateJournalLines(
  orgId: number,
  lines: Array<{ accountId: number; side: "debit" | "credit"; amount: string }>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  assertJournalLinesBalanced(lines);

  const accountIds = Array.from(new Set(lines.map(l => l.accountId)));
  if (accountIds.length === 0) return;
  const found = await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.organizationId, orgId), inArray(accounts.id, accountIds)));
  const foundIds = new Set(found.map(a => a.id));
  const missing = accountIds.filter(id => !foundIds.has(id));
  if (missing.length > 0) {
    throw new Error(`Konto(s) mit ID ${missing.join(", ")} gehören nicht zur aktiven Organisation.`);
  }
}

export async function createJournalEntry(data: {
  organizationId: number;
  bookingDate: string;
  valueDate?: string;
  description: string;
  status?: "pending" | "approved";
  source?: "manual" | "bank_import" | "credit_card" | "payroll" | "vat" | "system";
  sourceRef?: string;
  fiscalYear?: number;
  aiConfidence?: number;
  aiReasoning?: string;
  lines: Array<{
    accountId: number;
    side: "debit" | "credit";
    amount: string;
    description?: string;
    vatAmount?: string;
    vatRate?: string;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Audit: Beträge, Soll/Haben-Gleichheit (in Rappen) und Konto-Zugehörigkeit
  // zur Organisation prüfen, bevor irgendetwas geschrieben wird.
  await validateJournalLines(data.organizationId, data.lines);

  // Geschäftsjahr konsistent aus dem Buchungsdatum ableiten (niemals still
  // das Kalenderjahr annehmen) und Periodensperre durchsetzen (GeBüV).
  const derivedYear = new Date(data.bookingDate).getFullYear();
  if (data.fiscalYear != null && data.fiscalYear !== derivedYear) {
    throw new Error(`Buchungsdatum (${data.bookingDate}) liegt nicht im Geschäftsjahr ${data.fiscalYear}.`);
  }
  const year = derivedYear;
  await assertFiscalYearOpen(data.organizationId, year, data.bookingDate);

  // Belegnummer wird erst bei approve vergeben (GeBüV: lückenlos, siehe
  // approveJournalEntry). Drafts bleiben ohne entryNumber.
  const [result] = await db.insert(journalEntries).values({
    organizationId: data.organizationId,
    bookingDate: data.bookingDate,
    valueDate: data.valueDate,
    description: data.description,
    status: data.status ?? "pending",
    source: data.source ?? "manual",
    sourceRef: data.sourceRef,
    fiscalYear: year,
    aiConfidence: data.aiConfidence,
    aiReasoning: data.aiReasoning,
  });

  const entryId = (result as any).insertId;

  for (const line of data.lines) {
    await db.insert(journalLines).values({
      entryId,
      accountId: line.accountId,
      side: line.side,
      amount: line.amount,
      description: line.description,
      vatAmount: line.vatAmount,
      vatRate: line.vatRate,
    });
  }

  return entryId;
}

/**
 * GeBüV-Periodensperre: Buchungen sind nur in ein eröffnetes, noch nicht
 * abgeschlossenes Geschäftsjahr zulässig. Wirft einen Fehler, wenn das
 * Geschäftsjahr fehlt, abgeschlossen ist oder das Buchungsdatum ausserhalb
 * der Periode liegt.
 */
export async function assertFiscalYearOpen(orgId: number, year: number, bookingDate?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [fy] = await db.select().from(fiscalYears)
    .where(and(eq(fiscalYears.organizationId, orgId), eq(fiscalYears.year, year)))
    .limit(1);
  if (!fy) {
    throw new Error(`Geschäftsjahr ${year} ist für diese Organisation nicht eröffnet. Bitte zuerst in den Einstellungen eröffnen.`);
  }
  if (fy.isClosed || fy.status === "closed") {
    throw new Error(`Geschäftsjahr ${year} ist abgeschlossen – Buchungen sind gesperrt (GeBüV). Korrekturen bitte als Stornobuchung im aktuellen Geschäftsjahr erfassen.`);
  }
  if (bookingDate && (bookingDate < fy.startDate || bookingDate > fy.endDate)) {
    throw new Error(`Buchungsdatum ${bookingDate} liegt ausserhalb der Periode des Geschäftsjahrs ${year} (${fy.startDate} bis ${fy.endDate}).`);
  }
}

/**
 * Audit: Liest `insertId` aus dem mysql2-ResultSetHeader eines INSERT-Statements.
 * mysql2 liefert je nach Treiber-Konfiguration number oder bigint.
 * Exportiert für Unit-Tests (server/tenancy.test.ts).
 */
export function readInsertId(header: unknown): number {
  if (!header || typeof header !== "object") return 0;
  const raw = (header as { insertId?: unknown }).insertId;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "number") return raw;
  return 0;
}

/**
 * Allokiert eine fortlaufende Belegnummer im Format BL-YYYY-NNNNN für
 * (Organisation, Geschäftsjahr). Atomar dank MySQL's LAST_INSERT_ID()-Trick –
 * funktioniert auch unter Concurrent Inserts ohne explizites FOR UPDATE.
 *
 * Die Nummer wird erst beim Approval vergeben (nicht beim Create), damit
 * gelöschte Drafts keine Lücken in der Sequenz hinterlassen (GeBüV Art. 957d).
 */
export async function allocateEntryNumber(orgId: number, fiscalYear: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Atomarer Upsert: beim ersten Aufruf pro (Org, Jahr) LAST_INSERT_ID(1),
  // danach LAST_INSERT_ID(nextSequence + 1). Der zurückgelieferte Wert ist
  // die allokierte Sequenz für diesen Aufruf.
  // Audit: Der allokierte Wert wird direkt aus dem ResultSetHeader (insertId)
  // desselben INSERT-Statements gelesen. Ein separates `SELECT LAST_INSERT_ID()`
  // könnte auf einem mysql2-Pool auf einer ANDEREN Verbindung laufen und damit
  // eine fremde/alte Nummer liefern (doppelte Belegnummern).
  const [header] = await db.execute(sql`
    INSERT INTO journal_entry_sequences (organizationId, fiscalYear, nextSequence)
    VALUES (${orgId}, ${fiscalYear}, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE nextSequence = LAST_INSERT_ID(nextSequence + 1)
  `);
  const seq = readInsertId(header);
  if (!seq || seq < 1) {
    throw new Error(`Belegnummern-Allokation fehlgeschlagen für Org ${orgId}, Geschäftsjahr ${fiscalYear}`);
  }
  const year = String(fiscalYear).padStart(4, "0");
  const seqPadded = String(seq).padStart(5, "0");
  return `BL-${year}-${seqPadded}`;
}

/**
 * Allokiert eine fortlaufende Rechnungsnummer im Format R-YYYY-NNNNN für
 * (Organisation, Geschäftsjahr). Gleicher atomare LAST_INSERT_ID()-Trick
 * wie allocateEntryNumber – siehe dort.
 *
 * Die Nummer wird erst bei `issue` vergeben (nicht bei `create`), damit
 * gelöschte/verworfene Drafts keine Lücken in der Rechnungssequenz
 * hinterlassen.
 */
export async function allocateInvoiceNumber(orgId: number, fiscalYear: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Audit: insertId aus dem ResultSetHeader lesen (siehe allocateEntryNumber).
  const [header] = await db.execute(sql`
    INSERT INTO invoice_sequences (organizationId, fiscalYear, nextSequence)
    VALUES (${orgId}, ${fiscalYear}, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE nextSequence = LAST_INSERT_ID(nextSequence + 1)
  `);
  const seq = readInsertId(header);
  if (!seq || seq < 1) {
    throw new Error(`Rechnungsnummern-Allokation fehlgeschlagen für Org ${orgId}, Geschäftsjahr ${fiscalYear}`);
  }
  const year = String(fiscalYear).padStart(4, "0");
  const seqPadded = String(seq).padStart(5, "0");
  return `R-${year}-${seqPadded}`;
}

// Audit: orgId ist Pflicht-Erstparameter – Eintrag wird nur innerhalb der
// Organisation gesucht/verändert (Mandantentrennung).
export async function approveJournalEntry(orgId: number, entryId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Belegnummer allokieren, falls der Eintrag noch keine hat. Wird nur beim
  // ersten Approval vergeben, damit ein späteres revert → re-approve die
  // bereits vergebene Nummer nicht doppelt allokiert.
  const [existing] = await db
    .select({
      entryNumber: journalEntries.entryNumber,
      fiscalYear: journalEntries.fiscalYear,
      bookingDate: journalEntries.bookingDate,
    })
    .from(journalEntries)
    .where(and(eq(journalEntries.organizationId, orgId), eq(journalEntries.id, entryId)))
    .limit(1);
  if (!existing) throw new Error(`Journal-Eintrag #${entryId} nicht gefunden (Organisation ${orgId})`);

  // GeBüV-Periodensperre: kein Approval in ein abgeschlossenes Geschäftsjahr
  const fyYear = existing.fiscalYear ?? new Date(existing.bookingDate).getFullYear();
  await assertFiscalYearOpen(orgId, fyYear);

  const updateSet: Record<string, unknown> = {
    status: "approved",
    approvedBy: userId,
    approvedAt: new Date(),
  };
  if (!existing.entryNumber) {
    updateSet.entryNumber = await allocateEntryNumber(orgId, fyYear);
  }
  await db.update(journalEntries).set(updateSet)
    .where(and(eq(journalEntries.organizationId, orgId), eq(journalEntries.id, entryId)));
}

// Audit: Nur pending-Einträge dürfen abgelehnt werden. Verbuchte Einträge
// (mit Belegnummer) sind unveränderlich (GeBüV) – assertJournalEntryEditable
// wirft in diesem Fall.
export async function rejectJournalEntry(orgId: number, entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await assertJournalEntryEditable(orgId, entryId);
  await db.update(journalEntries).set({ status: "rejected" })
    .where(and(eq(journalEntries.organizationId, orgId), eq(journalEntries.id, entryId)));
}

/**
 * GeBüV-Schutz: stellt sicher, dass ein Journal-Eintrag bearbeitet oder
 * gelöscht werden darf. Nur Entries mit Status "pending" sind veränderbar.
 * Approved/rejected Entries sind unveränderlich (Art. 957d OR, GeBüV).
 * Für approved Entries muss eine Storno-/Gegenbuchung erstellt werden.
 */
export async function assertJournalEntryEditable(orgId: number, entryId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Audit: org-gefiltert – fremde Einträge gelten als "nicht gefunden".
  const [entry] = await db.select({ status: journalEntries.status })
    .from(journalEntries)
    .where(and(eq(journalEntries.organizationId, orgId), eq(journalEntries.id, entryId)))
    .limit(1);
  if (!entry) {
    throw new Error(`Journal-Eintrag #${entryId} nicht gefunden (Organisation ${orgId})`);
  }
  if (entry.status !== "pending") {
    throw new Error(
      `Journal-Eintrag #${entryId} ist bereits ${entry.status === "approved" ? "verbucht" : "abgelehnt"} und kann nicht mehr geändert werden (GeBüV-Immutabilität). Erstellen Sie eine Stornobuchung.`
    );
  }
}

export async function updateJournalEntryLines(orgId: number, entryId: number, lines: Array<{
  accountId: number;
  side: "debit" | "credit";
  amount: string;
  description?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // GeBüV: nur pending Entries dürfen geändert werden (org-gefiltert)
  await assertJournalEntryEditable(orgId, entryId);

  // Audit: Beträge, Soll/Haben in Rappen und Konto-Zugehörigkeit prüfen
  await validateJournalLines(orgId, lines);

  // Delete old lines and insert new ones
  await db.delete(journalLines).where(eq(journalLines.entryId, entryId));
  for (const line of lines) {
    await db.insert(journalLines).values({ entryId, ...line });
  }
}

// ─── Bank Transactions ────────────────────────────────────────────────────────
export async function getBankAccounts(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  // Note: LEFT JOIN used so bank accounts without a linked account entry still appear.
  // INNER JOIN would silently drop bank accounts if the linked account was deleted.
  return db.select({
    bankAccount: bankAccounts,
    account: accounts,
  }).from(bankAccounts)
    .leftJoin(accounts, eq(bankAccounts.accountId, accounts.id))
    .where(and(
      eq(bankAccounts.organizationId, orgId),
      eq(bankAccounts.isActive, true),
    ));
}

export async function getPendingBankTransactions(orgId: number, bankAccountId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(bankTransactions.organizationId, orgId),
    eq(bankTransactions.status, "pending"),
  ];
  if (bankAccountId) conditions.push(eq(bankTransactions.bankAccountId, bankAccountId));
  return db.select().from(bankTransactions)
    .where(and(...conditions))
    .orderBy(desc(bankTransactions.transactionDate));
}

export async function getBankTransactionsByStatus(orgId: number, status: "pending" | "matched" | "all", bankAccountId?: number, fiscalYear?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(bankTransactions.organizationId, orgId)];
  if (status === "pending") conditions.push(eq(bankTransactions.status, "pending"));
  else if (status === "matched") conditions.push(eq(bankTransactions.status, "matched"));
  // "all" = no status filter
  if (bankAccountId) conditions.push(eq(bankTransactions.bankAccountId, bankAccountId));
  // Filter by fiscal year:
  // - "matched": only show transactions within the fiscal year
  // - "all": show ALL pending (regardless of date) + matched/ignored within fiscal year
  // - "pending": no date filter (always show all pending)
  if (fiscalYear && status === "matched") {
    const yearStartStr = `${fiscalYear}-01-01`;
    const yearEndStr = `${fiscalYear + 1}-01-01`;
    conditions.push(gte(bankTransactions.transactionDate, yearStartStr));
    conditions.push(lt(bankTransactions.transactionDate, yearEndStr));
  } else if (fiscalYear && status === "all") {
    // Include ALL pending + matched/ignored within fiscal year
    const yearStartStr = `${fiscalYear}-01-01`;
    const yearEndStr = `${fiscalYear + 1}-01-01`;
    conditions.push(
      or(
        eq(bankTransactions.status, "pending"),
        and(
          gte(bankTransactions.transactionDate, yearStartStr),
          lt(bankTransactions.transactionDate, yearEndStr)
        )!
      )!
    );
  }
  return db.select().from(bankTransactions)
    .where(and(...conditions))
    .orderBy(desc(bankTransactions.transactionDate));
}

export async function saveBankTransaction(data: Omit<typeof bankTransactions.$inferInsert, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(bankTransactions).values(data);
    return true;
  } catch (e: any) {
    if (e.code === "ER_DUP_ENTRY") return false; // Duplicate
    throw e;
  }
}

// Audit: orgId als Pflicht-Erstparameter; Transaktion muss zur Organisation gehören.
export async function approveBankTransaction(orgId: number, txId: number, journalEntryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [tx] = await db.select({ id: bankTransactions.id }).from(bankTransactions)
    .where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, txId)))
    .limit(1);
  if (!tx) throw new Error(`Banktransaktion #${txId} nicht gefunden (Organisation ${orgId})`);
  await db.update(bankTransactions).set({ status: "matched", journalEntryId })
    .where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, txId)));
}

// ─── Debitoren-Zahlungsabgleich via QR-Referenz (Phase 2.1) ─────────────────

/**
 * Findet eine offene Debitoren-Rechnung anhand ihrer (bereits normalisierten)
 * QR-Referenz. Berücksichtigt nur bezahlbare Stati (sent/partially_paid).
 */
export async function findOpenInvoiceByQRReference(orgId: number, qrReference: string) {
  const db = await getDb();
  if (!db) return null;
  const [inv] = await db.select().from(invoices)
    .where(and(
      eq(invoices.organizationId, orgId),
      eq(invoices.qrReference, qrReference),
      inArray(invoices.status, ["sent", "partially_paid"]),
    ))
    .limit(1);
  return inv ?? null;
}

export type InvoicePaymentResult = {
  status: "sent" | "partially_paid" | "paid";
  openAmount: number;
  paidAmount: number;
};

/**
 * Reine Statuslogik für einen Zahlungseingang auf einer Debitoren-Rechnung.
 * Vollzahlung (Rest ≤ 1 Rappen) → paid + paidDate; sonst Teilzahlung.
 * Ausgelagert für testbare Einheit (kein DB-Zugriff).
 */
export function computeInvoicePaymentState(
  total: number,
  paidSoFar: number,
  amount: number,
  paidDate: string,
  currentPaidDate: string | null,
): { status: "sent" | "partially_paid" | "paid"; openAmount: number; paidAmount: number; paidDate: string | null } {
  const newPaid = Math.round((paidSoFar + amount) * 100) / 100;
  const openAmount = Math.round((total - newPaid) * 100) / 100;

  // Epsilon für Fliesskomma-Toleranz (1 Rappen)
  let status: "sent" | "partially_paid" | "paid" = "sent";
  let newPaidDate = currentPaidDate;
  if (openAmount <= 0.01) {
    status = "paid";
    newPaidDate = paidDate;
  } else if (newPaid > 0.01) {
    status = "partially_paid";
  }
  return { status, openAmount, paidAmount: newPaid, paidDate: newPaidDate };
}

/**
 * Verbucht einen Zahlungseingang auf einer Debitoren-Rechnung:
 * paidAmount += amount, Status paid/partially_paid, paidDate bei Vollzahlung.
 * Gibt null zurück, wenn die Rechnung nicht (mehr) zahlbar ist
 * (z. B. zwischenzeitlich storniert) – Aufrufer behandelt das als Warnung,
 * nicht als Fehler.
 */
export async function applyInvoicePayment(
  orgId: number,
  invoiceId: number,
  amount: number,
  paidDate: string,
): Promise<InvoicePaymentResult | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [inv] = await db.select().from(invoices)
    .where(and(eq(invoices.organizationId, orgId), eq(invoices.id, invoiceId)))
    .limit(1);
  if (!inv) return null;
  if (inv.status !== "sent" && inv.status !== "partially_paid") return null;

  const result = computeInvoicePaymentState(
    parseFloat(inv.total as string),
    parseFloat(inv.paidAmount as string),
    amount,
    paidDate,
    inv.paidDate,
  );

  await db.update(invoices).set({
    paidAmount: result.paidAmount.toFixed(2),
    status: result.status,
    paidDate: result.paidDate,
  }).where(and(eq(invoices.organizationId, orgId), eq(invoices.id, invoiceId)));

  return { status: result.status, openAmount: result.openAmount, paidAmount: result.paidAmount };
}

// Audit: orgId als Pflicht-Erstparameter; Transaktion muss zur Organisation gehören.
export async function updateBankTransaction(orgId: number, txId: number, data: {
  description?: string;
  counterparty?: string;
  counterpartyIban?: string;
  reference?: string;
  suggestedDebitAccountId?: number | null;
  suggestedCreditAccountId?: number | null;
  aiReasoning?: string;
  manuallyEdited?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.description !== undefined) updateSet.description = data.description;
  if (data.counterparty !== undefined) updateSet.counterparty = data.counterparty;
  if (data.counterpartyIban !== undefined) updateSet.counterpartyIban = data.counterpartyIban;
  if (data.reference !== undefined) updateSet.reference = data.reference;
  if (data.suggestedDebitAccountId !== undefined) updateSet.suggestedDebitAccountId = data.suggestedDebitAccountId;
  if (data.suggestedCreditAccountId !== undefined) updateSet.suggestedCreditAccountId = data.suggestedCreditAccountId;
  if (data.aiReasoning !== undefined) updateSet.aiReasoning = data.aiReasoning;
  if (data.manuallyEdited !== undefined) updateSet.manuallyEdited = data.manuallyEdited;
  if (Object.keys(updateSet).length === 0) return;
  const [tx] = await db.select({ id: bankTransactions.id }).from(bankTransactions)
    .where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, txId)))
    .limit(1);
  if (!tx) throw new Error(`Banktransaktion #${txId} nicht gefunden (Organisation ${orgId})`);
  await db.update(bankTransactions).set(updateSet)
    .where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, txId)));
}

export async function getBankTransactionsByIds(orgId: number, ids: number[]) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bankTransactions)
    .where(and(eq(bankTransactions.organizationId, orgId), inArray(bankTransactions.id, ids)));
}

// ─── Employees ────────────────────────────────────────────────────────────────
export async function getEmployees(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employees)
    .where(and(eq(employees.organizationId, orgId), eq(employees.isActive, true)))
    .orderBy(asc(employees.code));
}

export async function getPayrollEntries(orgId: number, year?: number, employeeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(payrollEntries.organizationId, orgId)];
  if (year) conditions.push(eq(payrollEntries.year, year));
  if (employeeId) conditions.push(eq(payrollEntries.employeeId, employeeId));
  return db.select({
    payroll: payrollEntries,
    employee: employees,
  }).from(payrollEntries)
    .innerJoin(employees, eq(payrollEntries.employeeId, employees.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(payrollEntries.year), desc(payrollEntries.month));
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export async function getBalanceSheet(orgId: number, fiscalYear: number) {
  const db = await getDb();
  if (!db) return { assets: [], liabilities: [], equity: [] };

  const allAccounts = await db.select().from(accounts)
    .where(and(
      eq(accounts.organizationId, orgId),
      eq(accounts.isActive, true),
      inArray(accounts.accountType, ["asset", "liability", "equity"]),
    ))
    .orderBy(asc(accounts.sortOrder));

  const balances = await Promise.all(allAccounts.map(async (acc) => ({
    account: acc,
    balance: await getAccountBalance(orgId, acc.id, fiscalYear),
  })));

  return {
    assets: balances.filter(b => b.account.accountType === "asset"),
    liabilities: balances.filter(b => b.account.accountType === "liability"),
    equity: balances.filter(b => b.account.accountType === "equity"),
  };
}

export async function getIncomeStatement(orgId: number, fiscalYear: number) {
  const db = await getDb();
  if (!db) return { expenses: [], revenues: [] };

  const allAccounts = await db.select().from(accounts)
    .where(and(
      eq(accounts.organizationId, orgId),
      eq(accounts.isActive, true),
      inArray(accounts.accountType, ["expense", "revenue"]),
    ))
    .orderBy(asc(accounts.sortOrder));

  const balances = await Promise.all(allAccounts.map(async (acc) => ({
    account: acc,
    balance: await getAccountBalance(orgId, acc.id, fiscalYear),
  })));

  return {
    expenses: balances.filter(b => b.account.accountType === "expense"),
    revenues: balances.filter(b => b.account.accountType === "revenue"),
  };
}

// ─── VAT ──────────────────────────────────────────────────────────────────────
export async function getVatPeriods(orgId: number, year?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(vatPeriods.organizationId, orgId)];
  if (year) conditions.push(eq(vatPeriods.year, year));
  return db.select().from(vatPeriods)
    .where(and(...conditions))
    .orderBy(desc(vatPeriods.year), asc(vatPeriods.period));
}

// ─── Credit Card ──────────────────────────────────────────────────────────────
export async function getCreditCardStatements(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditCardStatements)
    .where(eq(creditCardStatements.organizationId, orgId))
    .orderBy(desc(creditCardStatements.statementDate));
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats(orgId: number, fiscalYear: number) {
  const db = await getDb();
  if (!db) return null;

  const [pendingCount, approvedCount] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(journalEntries)
      .where(and(
        eq(journalEntries.organizationId, orgId),
        eq(journalEntries.status, "pending"),
      )),
    db.select({ count: sql<number>`COUNT(*)` }).from(journalEntries)
      .where(and(
        eq(journalEntries.organizationId, orgId),
        eq(journalEntries.status, "approved"),
        eq(journalEntries.fiscalYear, fiscalYear),
      )),
  ]);

  const [pendingTxCount] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(bankTransactions)
    .where(and(
      eq(bankTransactions.organizationId, orgId),
      eq(bankTransactions.status, "pending"),
    ));

  return {
    pendingEntries: pendingCount[0]?.count ?? 0,
    approvedEntries: approvedCount[0]?.count ?? 0,
    pendingBankTransactions: pendingTxCount?.count ?? 0,
  };
}


/**
 * Returns monthly revenue/expense/profit aggregates for the last N months.
 * Used for sparkline charts on the dashboard.
 */
export async function getMonthlyAggregates(orgId: number, months = 6) {
  const db = await getDb();
  if (!db) return [];

  // Build list of last N months (YYYY-MM format)
  const result: Array<{ month: string; revenue: number; expenses: number; profit: number }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const yearStart = `${monthStr}-01`;
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    // Get all approved journal lines for this month
    const lines = await db
      .select({
        amount: journalLines.amount,
        side: journalLines.side,
        accountNumber: accounts.number,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(
        eq(journalEntries.organizationId, orgId),
        eq(journalEntries.status, 'approved'),
        sql`${journalEntries.bookingDate} >= ${yearStart}`,
        sql`${journalEntries.bookingDate} < ${monthEnd}`,
      ));

    let revenue = 0;
    let expenses = 0;
    for (const line of lines) {
      const num = line.accountNumber;
      const amt = parseFloat(String(line.amount)) || 0;
      // Revenue accounts: 3xxx (Ertrag)
      if (num.startsWith('3')) {
        if (line.side === 'credit') revenue += amt;
        else revenue -= amt;
      }
      // Expense accounts: 4xxx-6xxx (Aufwand)
      if (num.startsWith('4') || num.startsWith('5') || num.startsWith('6')) {
        if (line.side === 'debit') expenses += amt;
        else expenses -= amt;
      }
    }

    result.push({
      month: monthStr,
      revenue: Math.max(0, revenue),
      expenses: Math.max(0, expenses),
      profit: revenue - expenses,
    });
  }
  return result;
}

// ─── Booking Rules (Gelernte Buchungsregeln) ─────────────────────────────────

/**
 * Find a matching booking rule for a given counterparty name.
 * Returns the best matching rule (highest priority, then highest usageCount).
 */
export async function findMatchingRule(orgId: number, counterpartyName: string): Promise<BookingRule | null> {
  const db = await getDb();
  if (!db || !counterpartyName) return null;

  // Step 1: Try org-specific rules first (highest priority)
  const orgRules = await db.select().from(bookingRules)
    .where(and(
      eq(bookingRules.organizationId, orgId),
      eq(bookingRules.scope, "org"),
      eq(bookingRules.isActive, true),
    ))
    .orderBy(desc(bookingRules.priority), desc(bookingRules.usageCount));

  const cpLower = counterpartyName.toLowerCase();
  for (const rule of orgRules) {
    if (cpLower.includes(rule.counterpartyPattern.toLowerCase())) {
      return rule;
    }
  }

  // Step 2: Fallback to global rules (trained by admin, applies to all orgs)
  const globalRules = await db.select().from(bookingRules)
    .where(and(
      eq(bookingRules.scope, "global"),
      eq(bookingRules.isActive, true),
    ))
    .orderBy(desc(bookingRules.priority), desc(bookingRules.usageCount));

  for (const rule of globalRules) {
    if (cpLower.includes(rule.counterpartyPattern.toLowerCase())) {
      // For global rules, resolve account numbers to org-specific account IDs
      if (rule.globalDebitAccountNumber || rule.globalCreditAccountNumber) {
        const resolved = await resolveGlobalRuleAccounts(orgId, rule);
        return resolved;
      }
      return rule;
    }
  }

  return null;
}

/**
 * Resolve global rule account numbers to org-specific account IDs.
 * Global rules store generic account numbers (e.g., "6300") instead of org-specific IDs.
 * This function maps those numbers to the actual account IDs in the target org.
 */
async function resolveGlobalRuleAccounts(orgId: number, rule: BookingRule): Promise<BookingRule> {
  const db = await getDb();
  if (!db) return rule;

  const orgAccounts = await db.select({ id: accounts.id, number: accounts.number })
    .from(accounts)
    .where(eq(accounts.organizationId, orgId));

  let debitId = rule.debitAccountId;
  let creditId = rule.creditAccountId;

  if (rule.globalDebitAccountNumber) {
    const match = orgAccounts.find(a => a.number === rule.globalDebitAccountNumber);
    if (match) debitId = match.id;
  }
  if (rule.globalCreditAccountNumber) {
    const match = orgAccounts.find(a => a.number === rule.globalCreditAccountNumber);
    if (match) creditId = match.id;
  }

  return { ...rule, debitAccountId: debitId, creditAccountId: creditId };
}

/**
 * Get all active booking rules.
 */
export async function getAllBookingRules(orgId: number, includeGlobal = true): Promise<BookingRule[]> {
  const db = await getDb();
  if (!db) return [];

  // Get org-specific rules
  const orgRules = await db.select().from(bookingRules)
    .where(and(
      eq(bookingRules.organizationId, orgId),
      eq(bookingRules.scope, "org"),
      eq(bookingRules.isActive, true),
    ))
    .orderBy(desc(bookingRules.priority), desc(bookingRules.usageCount));

  if (!includeGlobal) return orgRules;

  // Get global rules and resolve their account numbers for this org
  const globalRules = await db.select().from(bookingRules)
    .where(and(
      eq(bookingRules.scope, "global"),
      eq(bookingRules.isActive, true),
    ))
    .orderBy(desc(bookingRules.priority), desc(bookingRules.usageCount));

  // Resolve global account numbers to org-specific IDs
  const resolvedGlobal = await Promise.all(
    globalRules.map(r => resolveGlobalRuleAccounts(orgId, r))
  );

  // Org rules first (higher priority), then global
  return [...orgRules, ...resolvedGlobal];
}

/**
 * Create or update a booking rule based on counterparty pattern.
 * If a rule with the same counterpartyPattern already exists, update it.
 * Otherwise, create a new one.
 */
export async function upsertBookingRule(data: {
  organizationId: number;
  counterpartyPattern: string;
  bookingTextTemplate?: string;
  debitAccountId?: number;
  creditAccountId?: number;
  vatRate?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Check if a rule with this pattern already exists (case-insensitive) within this org
  const existing = await db.select().from(bookingRules)
    .where(and(
      eq(bookingRules.organizationId, data.organizationId),
      eq(bookingRules.counterpartyPattern, data.counterpartyPattern),
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update existing rule and increment usage count
    await db.update(bookingRules).set({
      bookingTextTemplate: data.bookingTextTemplate ?? existing[0].bookingTextTemplate,
      debitAccountId: data.debitAccountId ?? existing[0].debitAccountId,
      creditAccountId: data.creditAccountId ?? existing[0].creditAccountId,
      vatRate: data.vatRate ?? existing[0].vatRate,
      usageCount: sql`${bookingRules.usageCount} + 1`,
      source: "manual",
    }).where(eq(bookingRules.id, existing[0].id));
  } else {
    // Create new rule
    await db.insert(bookingRules).values({
      organizationId: data.organizationId,
      counterpartyPattern: data.counterpartyPattern,
      bookingTextTemplate: data.bookingTextTemplate,
      debitAccountId: data.debitAccountId,
      creditAccountId: data.creditAccountId,
      vatRate: data.vatRate,
      usageCount: 1,
      priority: 20, // Manual rules get higher priority than AI
      source: "manual",
    });
  }
}

/**
 * Increment usage count for a rule.
 */
export async function incrementRuleUsage(ruleId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(bookingRules).set({
    usageCount: sql`${bookingRules.usageCount} + 1`,
  }).where(eq(bookingRules.id, ruleId));
}


// ─── Document-Transaction Matching ──────────────────────────────────────────

/**
 * Match score calculation between a document and a bank transaction.
 * Returns 0-100 score based on:
 * - Amount match (exact or close): 40 points
 * - Counterparty/vendor match: 30 points
 * - Date proximity: 20 points
 * - Reference/IBAN match: 10 points
 */
export function calculateMatchScore(
  doc: { totalAmount?: number; counterparty?: string; documentDate?: string; counterpartyIban?: string; referenceNumber?: string; documentType?: string },
  txn: { amount: string; counterparty: string | null; transactionDate: string; counterpartyIban: string | null; reference: string | null },
  opts?: { requireIdentity?: boolean }
): number {
  let score = 0;

  // 0. Richtungs-Check: Kreditoren-Belege/Quittungen/KK-Abrechnungen matchen
  // nur Ausgaben (Betrag < 0), Ausgangsrechnungen nur Zahlungseingänge (> 0).
  // Ohne Richtungsprüfung matchen sich gleich hohe Ein-/Ausgänge gegenseitig.
  const rawAmount = parseFloat(txn.amount);
  if (doc.documentType === "invoice_in" || doc.documentType === "receipt" || doc.documentType === "credit_card_statement") {
    if (rawAmount >= 0) return 0;
  } else if (doc.documentType === "invoice_out") {
    if (rawAmount <= 0) return 0;
  }

  // Identitätssignal: Punkte aus Gegenpartei, IBAN oder Referenz. Ein
  // identischer Betrag ALLEIN darf nie zum Auto-Match führen (Miete, Abos,
  // Löhne haben oft identische Beträge).
  let identityPoints = 0;

  // Helper: normalize company name for comparison
  // Removes legal suffixes (AG, GmbH, SA, etc.), punctuation, extra spaces
  function normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(ag|gmbh|sa|sarl|ltd|inc|co|kg|llc|cie|und|and|&)\b/g, '')
      .replace(/[^a-zäöüéèàâ0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 1. Amount match (45 points)
  let amountScore = 0;
  if (doc.totalAmount != null) {
    const docAmount = Math.abs(doc.totalAmount);
    const txnAmount = Math.abs(parseFloat(txn.amount));
    if (docAmount > 0 && txnAmount > 0) {
      const diff = Math.abs(docAmount - txnAmount);
      const pctDiff = diff / Math.max(docAmount, txnAmount);
      if (pctDiff === 0) amountScore = 45;           // exact match
      else if (pctDiff < 0.001) amountScore = 43;    // rounding diff
      else if (pctDiff < 0.01) amountScore = 35;     // <1% off
      else if (pctDiff < 0.05) amountScore = 18;     // <5% off (partial payment?)
    }
  }
  score += amountScore;

  // 2. Counterparty match (30 points)
  if (doc.counterparty && txn.counterparty) {
    const docVendor = normalizeName(doc.counterparty);
    const txnVendor = normalizeName(txn.counterparty);
    if (docVendor === txnVendor) {
      score += 30; identityPoints += 30;
    } else if (docVendor.includes(txnVendor) || txnVendor.includes(docVendor)) {
      score += 25; identityPoints += 25;
    } else {
      // Check if any significant word matches (min 4 chars to avoid false positives)
      const docWords = docVendor.split(' ').filter(w => w.length >= 4);
      const txnWords = txnVendor.split(' ').filter(w => w.length >= 4);
      const commonWords = docWords.filter(w => txnWords.some(tw => tw.includes(w) || w.includes(tw)));
      if (commonWords.length >= 2) {
        const pts = Math.min(25, commonWords.length * 12);
        score += pts; identityPoints += pts;
      } else if (commonWords.length === 1) {
        score += 12; identityPoints += 12;
      }
    }
  }

  // 3. Date proximity (15 points) – extended tolerance for invoices paid later
  if (doc.documentDate && txn.transactionDate) {
    const docDate = new Date(doc.documentDate);
    const txnDate = new Date(txn.transactionDate);
    const daysDiff = Math.abs((docDate.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 3) score += 15;
    else if (daysDiff <= 7) score += 12;
    else if (daysDiff <= 14) score += 9;
    else if (daysDiff <= 30) score += 6;
    else if (daysDiff <= 60) score += 3;
    else if (daysDiff <= 120) score += 1;  // invoices often paid 1-4 months later
  }

  // 4. Reference/IBAN match (10 points)
  if (doc.counterpartyIban && txn.counterpartyIban) {
    const docIban = doc.counterpartyIban.replace(/\s/g, '').toUpperCase();
    const txnIban = txn.counterpartyIban.replace(/\s/g, '').toUpperCase();
    if (docIban === txnIban) { score += 10; identityPoints += 10; }
  }
  if (doc.referenceNumber && txn.reference) {
    const docRef = doc.referenceNumber.replace(/\s/g, '');
    const txnRef = txn.reference.replace(/\s/g, '');
    if (docRef === txnRef || docRef.includes(txnRef) || txnRef.includes(docRef)) {
      score += 10; identityPoints += 10;
    }
  }

  // Regel «Betrag allein reicht nie» – nur für Auto-Match (requireIdentity):
  // ohne Identitätssignal (Gegenpartei, IBAN oder Referenz) bleibt der Score
  // unter dem Auto-Match-Schwellenwert. Für die Score-ANZEIGE (manuelles
  // Matching) bleibt der volle Score erhalten.
  if (opts?.requireIdentity && identityPoints === 0) return Math.min(score, 39);

  return Math.min(100, score);
}

/**
 * Run auto-matching: find best matches between unmatched documents and pending transactions.
 * Returns array of matches with scores >= threshold.
 */
export async function autoMatchDocuments(orgId: number, threshold: number = 50): Promise<{
  documentId: number;
  transactionId: number;
  score: number;
  docFilename: string;
  txnDescription: string;
}[]> {
  const db = await getDb();
  if (!db) return [];

  // Get unmatched documents with AI metadata (org-scoped)
  const unmatchedDocs = await db.select().from(documents)
    .where(and(
      eq(documents.organizationId, orgId),
      eq(documents.matchStatus, 'unmatched'),
      sql`${documents.aiMetadata} IS NOT NULL`,
    ));

  // Get pending (unmatched) bank transactions (org-scoped)
  const pendingTxns = await db.select().from(bankTransactions)
    .where(and(
      eq(bankTransactions.organizationId, orgId),
      eq(bankTransactions.status, 'pending'),
    ));

  if (unmatchedDocs.length === 0 || pendingTxns.length === 0) return [];

  const matches: { documentId: number; transactionId: number; score: number; docFilename: string; txnDescription: string }[] = [];

  for (const doc of unmatchedDocs) {
    let meta: any;
    try {
      meta = JSON.parse(doc.aiMetadata || '{}');
    } catch { continue; }

    let bestMatch: { txnId: number; score: number; desc: string } | null = null;

    for (const txn of pendingTxns) {
      const score = calculateMatchScore(
        {
          totalAmount: meta.totalAmount,
          counterparty: meta.counterparty,
          documentDate: meta.documentDate,
          counterpartyIban: meta.counterpartyIban,
          referenceNumber: meta.referenceNumber,
          documentType: meta.documentType,
        },
        {
          amount: txn.amount,
          counterparty: txn.counterparty,
          transactionDate: txn.transactionDate,
          counterpartyIban: txn.counterpartyIban,
          reference: txn.reference,
        },
        { requireIdentity: true }
      );

      if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { txnId: txn.id, score, desc: txn.description || '' };
      }
    }

    if (bestMatch) {
      matches.push({
        documentId: doc.id,
        transactionId: bestMatch.txnId,
        score: bestMatch.score,
        docFilename: doc.filename,
        txnDescription: bestMatch.desc,
      });
    }
  }

  return matches;
}

/**
 * Apply matches: update both documents and bank_transactions with match links.
 */
// Audit: orgId als Pflicht-Erstparameter – alle Lese-/Schreibzugriffe auf
// documents und bank_transactions sind org-gefiltert.
export async function applyMatches(orgId: number, matches: { documentId: number; transactionId: number; score: number }[]): Promise<number> {
  const db = await getDb();
  if (!db || matches.length === 0) return 0;

  // Enforce 1:1 constraint: each transaction can only be matched to ONE document
  // and each document can only be matched to ONE transaction.
  // Process matches in order of score (highest first) and skip already-used IDs.
  const sortedMatches = [...matches].sort((a, b) => b.score - a.score);
  const usedTransactionIds = new Set<number>();
  const usedDocumentIds = new Set<number>();

  // Pre-check: skip transactions that are already matched to another document
  for (const match of sortedMatches) {
    const [existingTxn] = await db.select({ matchedDocumentId: bankTransactions.matchedDocumentId })
      .from(bankTransactions)
      .where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, match.transactionId)))
      .limit(1);
    // Audit: Transaktion ausserhalb der Organisation → nie zuordnen
    if (!existingTxn || (existingTxn.matchedDocumentId && existingTxn.matchedDocumentId !== match.documentId)) {
      usedTransactionIds.add(match.transactionId);
    }
    const [existingDoc] = await db.select({ bankTransactionId: documents.bankTransactionId })
      .from(documents)
      .where(and(eq(documents.organizationId, orgId), eq(documents.id, match.documentId)))
      .limit(1);
    if (!existingDoc || (existingDoc.bankTransactionId && existingDoc.bankTransactionId !== match.transactionId)) {
      usedDocumentIds.add(match.documentId);
    }
  }

  let applied = 0;
  for (const match of sortedMatches) {
    // Skip if transaction or document already used in this batch or pre-existing
    if (usedTransactionIds.has(match.transactionId)) continue;
    if (usedDocumentIds.has(match.documentId)) continue;

    // Mark as used
    usedTransactionIds.add(match.transactionId);
    usedDocumentIds.add(match.documentId);

    // Update document
    await db.update(documents)
      .set({
        bankTransactionId: match.transactionId,
        matchStatus: 'matched',
        matchScore: match.score,
      })
      .where(and(eq(documents.organizationId, orgId), eq(documents.id, match.documentId)));

    // Update bank transaction
    await db.update(bankTransactions)
      .set({
        matchedDocumentId: match.documentId,
        matchScore: match.score,
      })
      .where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, match.transactionId)));

    applied++;
  }

  return applied;
}

/**
 * Get matched document info for a bank transaction.
 */
export async function getMatchedDocument(orgId: number, transactionId: number): Promise<Document | null> {
  const db = await getDb();
  if (!db) return null;

  // Audit: org-gefiltert
  const result = await db.select().from(documents)
    .where(and(eq(documents.organizationId, orgId), eq(documents.bankTransactionId, transactionId)))
    .limit(1);

  return result[0] || null;
}

/**
 * Improve booking suggestion using matched document metadata.
 * Returns enhanced suggestion or null if no improvement possible.
 */
export function improveBookingSuggestionFromDocument(
  docMetadata: any,
  currentSuggestion: { bookingText?: string; debitAccountId?: number; creditAccountId?: number }
): { bookingText?: string; suggestedAccount?: string; vatRate?: number; vatAmount?: number; description?: string } | null {
  if (!docMetadata) return null;

  const improvements: any = {};

  // Use document description for better booking text
  if (docMetadata.description) {
    improvements.description = docMetadata.description;
  }

  // Special handling for Gewerbe-Treuhand: extract customer name from description
  // Description format: "Finanzbuchhaltung 2024 für Urs Manser" or "...für AESKULAP International AG"
  if (docMetadata.counterparty && docMetadata.counterparty.includes('Gewerbe-Treuhand')) {
    const desc = docMetadata.description || '';
    const match = desc.match(/f[üu]r\s+(.+?)(?:\s+(?:Phase|Betrag|$))/i) ||
                  desc.match(/betreffend\s+(.+?)(?:\s+(?:in Rechnung|$))/i) ||
                  desc.match(/(.+?)(?:\s+Finanzbuchhaltung)/i);
    const customerName = match ? match[1].trim() : null;
    if (customerName) {
      // Extract period from description or use current date
      const periodMatch = desc.match(/(Jan(?:uar)?|Feb(?:ruar)?|M[äa]rz|Apr(?:il)?|Mai|Jun(?:i)?|Jul(?:i)?|Aug(?:ust)?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Dez(?:ember)?)\s*(\d{4})/i) ||
                          desc.match(/(\d{4})/g);
      const period = periodMatch ? periodMatch[0] : '';
      improvements.bookingText = `Fremdhonorar Gewerbe-Treuhand – ${customerName}${period ? ' ' + period : ''}`;
      improvements.suggestedAccount = '3000'; // Fremdhonorar
    }
  }

  // Use suggested account from document
  if (!improvements.suggestedAccount && docMetadata.suggestedAccount) {
    improvements.suggestedAccount = docMetadata.suggestedAccount;
  }

  // Use VAT info from document
  if (docMetadata.vatRate != null) {
    improvements.vatRate = docMetadata.vatRate;
  }
  if (docMetadata.vatAmount != null) {
    improvements.vatAmount = docMetadata.vatAmount;
  }

  return Object.keys(improvements).length > 0 ? improvements : null;
}

/**
 * Unmatch a document from a transaction.
 */
export async function unmatchDocument(orgId: number, documentId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Audit: Dokument nur innerhalb der Organisation suchen
  const [doc] = await db.select().from(documents)
    .where(and(eq(documents.organizationId, orgId), eq(documents.id, documentId)))
    .limit(1);
  if (!doc) throw new Error(`Dokument #${documentId} nicht gefunden (Organisation ${orgId})`);

  // Clear document match
  await db.update(documents)
    .set({ bankTransactionId: null, matchStatus: 'unmatched', matchScore: null })
    .where(and(eq(documents.organizationId, orgId), eq(documents.id, documentId)));

  // Clear transaction match if linked
  if (doc.bankTransactionId) {
    await db.update(bankTransactions)
      .set({ matchedDocumentId: null, matchScore: null })
      .where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, doc.bankTransactionId)));
  }
}

// ─── Delete Journal Entry (nur für pending Entries – GeBüV-konform) ──────────
// Audit: orgId als Pflicht-Erstparameter (Mandantentrennung).
export async function deleteJournalEntry(orgId: number, entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // GeBüV: approved Entries dürfen nicht gelöscht werden – Storno erforderlich.
  // Wirft auch, wenn der Eintrag nicht zur Organisation gehört.
  await assertJournalEntryEditable(orgId, entryId);
  // Delete lines first (FK), then entry
  await db.delete(journalLines).where(eq(journalLines.entryId, entryId));
  await db.delete(journalEntries)
    .where(and(eq(journalEntries.organizationId, orgId), eq(journalEntries.id, entryId)));
}

// ─── Revert bank transaction to pending ──────────────────────────────────────
// Audit: orgId als Pflicht-Erstparameter; Transaktion muss zur Organisation gehören.
export async function revertBankTransaction(orgId: number, txId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [tx] = await db.select({ id: bankTransactions.id }).from(bankTransactions)
    .where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, txId)))
    .limit(1);
  if (!tx) throw new Error(`Banktransaktion #${txId} nicht gefunden (Organisation ${orgId})`);
  await db.update(bankTransactions).set({
    status: "pending",
    journalEntryId: null,
  }).where(and(eq(bankTransactions.organizationId, orgId), eq(bankTransactions.id, txId)));
}

// ─── Delete CC statement and its items ───────────────────────────────────────
// Audit: orgId als Pflicht-Erstparameter; Abrechnung muss zur Organisation gehören.
export async function deleteCcStatement(orgId: number, statementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [stmt] = await db.select({ id: creditCardStatements.id }).from(creditCardStatements)
    .where(and(eq(creditCardStatements.organizationId, orgId), eq(creditCardStatements.id, statementId)))
    .limit(1);
  if (!stmt) throw new Error(`Kreditkartenabrechnung #${statementId} nicht gefunden (Organisation ${orgId})`);
  await db.delete(creditCardStatements)
    .where(and(eq(creditCardStatements.organizationId, orgId), eq(creditCardStatements.id, statementId)));
}

// ─── Revert CC statement to pending ──────────────────────────────────────────
// Audit: orgId als Pflicht-Erstparameter; Abrechnung muss zur Organisation gehören.
export async function revertCcStatement(orgId: number, statementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [stmt] = await db.select({ id: creditCardStatements.id }).from(creditCardStatements)
    .where(and(eq(creditCardStatements.organizationId, orgId), eq(creditCardStatements.id, statementId)))
    .limit(1);
  if (!stmt) throw new Error(`Kreditkartenabrechnung #${statementId} nicht gefunden (Organisation ${orgId})`);
  await db.update(creditCardStatements).set({
    status: "pending",
    journalEntryId: null,
  }).where(and(eq(creditCardStatements.organizationId, orgId), eq(creditCardStatements.id, statementId)));
}
