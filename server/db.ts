import { eq, and, desc, asc, sql, gte, lte, lt, inArray, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, accounts, journalEntries, journalLines,
  journalEntrySequences,
  invoiceSequences,
  bankAccounts, bankTransactions, employees, payrollEntries,
  vatPeriods, openingBalances, fiscalYears, creditCardStatements,
  bookingRules, documents, organizations,
  type Account, type JournalEntry, type JournalLine, type BankTransaction,
  type Employee, type PayrollEntry, type BookingRule, type Document,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { logger } from "./_core/logger";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn({ err: error }, "Database initialization failed");
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { logger.warn("Cannot upsert user because the database is unavailable"); return; }
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
  } catch (error) { logger.error({ err: error, openId: user.openId }, "Failed to upsert user"); throw error; }
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
 * Leitet das Geschäftsjahr zuverlässig aus einem ISO-Buchungsdatum ab.
 * Ein vom Client übermitteltes Geschäftsjahr wird nie als Buchungsgrundlage
 * verwendet, damit die zeitliche Zuordnung nicht manipuliert werden kann.
 */
export function deriveFiscalYearFromBookingDate(bookingDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bookingDate);
  if (!match) {
    throw new Error("Buchungsdatum muss im Format JJJJ-MM-TT angegeben werden.");
  }

  const parsed = new Date(`${bookingDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== bookingDate) {
    throw new Error("Buchungsdatum ist ungültig.");
  }

  return Number(match[1]);
}

/** Verhindert Buchungen in nicht eröffnete oder bereits geschlossene Jahre. */
export async function assertFiscalYearOpen(organizationId: number, bookingDate: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const fiscalYear = deriveFiscalYearFromBookingDate(bookingDate);
  const [year] = await db.select({ isClosed: fiscalYears.isClosed, status: fiscalYears.status })
    .from(fiscalYears)
    .where(and(
      eq(fiscalYears.organizationId, organizationId),
      eq(fiscalYears.year, fiscalYear),
    ))
    .limit(1);

  if (!year) {
    throw new Error(`Geschäftsjahr ${fiscalYear} ist nicht eröffnet. Bitte eröffnen Sie es zuerst.`);
  }
  if (year.isClosed || year.status === "closed") {
    throw new Error(`Geschäftsjahr ${fiscalYear} ist geschlossen. In geschlossene Geschäftsjahre können keine Buchungen erstellt werden.`);
  }

  return fiscalYear;
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
  createdBy?: number;
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

  // Validate double-entry: sum of debits = sum of credits
  const debitTotal = data.lines.filter(l => l.side === "debit").reduce((s, l) => s + parseFloat(l.amount), 0);
  const creditTotal = data.lines.filter(l => l.side === "credit").reduce((s, l) => s + parseFloat(l.amount), 0);
  if (Math.abs(debitTotal - creditTotal) > 0.01) {
    throw new Error(`Double-Entry-Fehler: Soll (${debitTotal.toFixed(2)}) ≠ Haben (${creditTotal.toFixed(2)})`);
  }

  // Das Geschäftsjahr wird immer aus dem Buchungsdatum abgeleitet. Ein optional
  // übermitteltes data.fiscalYear wird absichtlich ignoriert.
  const year = await assertFiscalYearOpen(data.organizationId, data.bookingDate);

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
    createdBy: data.createdBy,
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

/** Builds the debit/credit mirror required for a GeBüV-compliant reversal. */
export function buildReversalLines(lines: Array<{
  accountId: number;
  side: "debit" | "credit";
  amount: string;
  description?: string | null;
  vatAmount?: string | null;
  vatRate?: string | null;
}>) {
  return lines.map((line) => ({
    accountId: line.accountId,
    side: (line.side === "debit" ? "credit" : "debit") as "debit" | "credit",
    amount: line.amount,
    description: line.description ?? undefined,
    vatAmount: line.vatAmount ?? undefined,
    vatRate: line.vatRate ?? undefined,
  }));
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
  await db.execute(sql`
    INSERT INTO journal_entry_sequences (organizationId, fiscalYear, nextSequence)
    VALUES (${orgId}, ${fiscalYear}, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE nextSequence = LAST_INSERT_ID(nextSequence + 1)
  `);
  const result = await db.execute(sql`SELECT LAST_INSERT_ID() AS seq`);
  // mysql2 gibt bei execute() ein [rows, fields]-Tupel zurück
  const rows = (Array.isArray(result) ? result[0] : result) as unknown as Array<{ seq: number | bigint }>;
  const seqRaw = rows[0]?.seq ?? 0;
  const seq = typeof seqRaw === "bigint" ? Number(seqRaw) : seqRaw;
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
  await db.execute(sql`
    INSERT INTO invoice_sequences (organizationId, fiscalYear, nextSequence)
    VALUES (${orgId}, ${fiscalYear}, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE nextSequence = LAST_INSERT_ID(nextSequence + 1)
  `);
  const result = await db.execute(sql`SELECT LAST_INSERT_ID() AS seq`);
  const rows = (Array.isArray(result) ? result[0] : result) as unknown as Array<{ seq: number | bigint }>;
  const seqRaw = rows[0]?.seq ?? 0;
  const seq = typeof seqRaw === "bigint" ? Number(seqRaw) : seqRaw;
  if (!seq || seq < 1) {
    throw new Error(`Rechnungsnummern-Allokation fehlgeschlagen für Org ${orgId}, Geschäftsjahr ${fiscalYear}`);
  }
  const year = String(fiscalYear).padStart(4, "0");
  const seqPadded = String(seq).padStart(5, "0");
  return `R-${year}-${seqPadded}`;
}

export function canApproveJournalEntry(input: {
  requiresDualApproval: boolean;
  createdBy: number | null;
  approverId: number;
}): boolean {
  return !input.requiresDualApproval || input.createdBy == null || input.createdBy !== input.approverId;
}

export async function approveJournalEntry(entryId: number, userId: number) {
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
      organizationId: journalEntries.organizationId,
      status: journalEntries.status,
      createdBy: journalEntries.createdBy,
    })
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .limit(1);
  if (!existing) throw new Error(`Journal-Eintrag #${entryId} nicht gefunden`);
  if (existing.organizationId == null) {
    throw new Error(`Journal-Eintrag #${entryId} hat keine organizationId`);
  }
  if (existing.status !== "pending") {
    throw new Error(`Journal-Eintrag #${entryId} ist nicht mehr ausstehend und kann nicht freigegeben werden.`);
  }
  const [organization] = await db.select({ requiresDualApproval: organizations.requiresDualApproval })
    .from(organizations)
    .where(eq(organizations.id, existing.organizationId))
    .limit(1);
  if (!organization) throw new Error(`Organisation ${existing.organizationId} wurde nicht gefunden.`);
  if (!canApproveJournalEntry({
    requiresDualApproval: organization.requiresDualApproval,
    createdBy: existing.createdBy,
    approverId: userId,
  })) {
    throw new Error("Vier-Augen-Freigabe aktiv: Ersteller und Freigebender müssen unterschiedliche Personen sein.");
  }
  const bookingFiscalYear = await assertFiscalYearOpen(existing.organizationId, existing.bookingDate);

  const updateSet: Record<string, unknown> = {
    status: "approved",
    approvedBy: userId,
    approvedAt: new Date(),
  };
  if (!existing.entryNumber) {
    updateSet.entryNumber = await allocateEntryNumber(existing.organizationId, bookingFiscalYear);
  }
  updateSet.fiscalYear = bookingFiscalYear;
  await db.update(journalEntries).set(updateSet).where(eq(journalEntries.id, entryId));
}

export async function rejectJournalEntry(entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(journalEntries).set({ status: "rejected" }).where(eq(journalEntries.id, entryId));
}

/**
 * GeBüV-Schutz: stellt sicher, dass ein Journal-Eintrag bearbeitet oder
 * gelöscht werden darf. Nur Entries mit Status "pending" sind veränderbar.
 * Approved/rejected Entries sind unveränderlich (Art. 957d OR, GeBüV).
 * Für approved Entries muss eine Storno-/Gegenbuchung erstellt werden.
 */
export async function assertJournalEntryEditable(entryId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [entry] = await db.select({ status: journalEntries.status })
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .limit(1);
  if (!entry) {
    throw new Error(`Journal-Eintrag #${entryId} nicht gefunden`);
  }
  if (entry.status !== "pending") {
    throw new Error(
      `Journal-Eintrag #${entryId} ist bereits ${entry.status === "approved" ? "verbucht" : "abgelehnt"} und kann nicht mehr geändert werden (GeBüV-Immutabilität). Erstellen Sie eine Stornobuchung.`
    );
  }
}

export async function updateJournalEntryLines(entryId: number, lines: Array<{
  accountId: number;
  side: "debit" | "credit";
  amount: string;
  description?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // GeBüV: nur pending Entries dürfen geändert werden
  await assertJournalEntryEditable(entryId);

  // Validate
  const debitTotal = lines.filter(l => l.side === "debit").reduce((s, l) => s + parseFloat(l.amount), 0);
  const creditTotal = lines.filter(l => l.side === "credit").reduce((s, l) => s + parseFloat(l.amount), 0);
  if (Math.abs(debitTotal - creditTotal) > 0.01) {
    throw new Error(`Double-Entry-Fehler: Soll (${debitTotal.toFixed(2)}) ≠ Haben (${creditTotal.toFixed(2)})`);
  }

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
    .where(
      eq(bankAccounts.organizationId, orgId),
    );
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

export async function approveBankTransaction(txId: number, journalEntryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bankTransactions).set({ status: "matched", journalEntryId }).where(eq(bankTransactions.id, txId));
}

export async function updateBankTransaction(txId: number, data: {
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
  await db.update(bankTransactions).set(updateSet).where(eq(bankTransactions.id, txId));
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

export const AUTO_MATCH_THRESHOLD = 50;

/** Normalizes supplier/customer names before identity comparisons. */
function normalizeMatchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ag|gmbh|sa|sarl|ltd|inc|co|kg|llc|cie|und|and|&)\b/g, '')
    .replace(/[^a-zäöüéèàâ0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match score calculation between a document and a bank transaction.
 * Returns 0-100 score based on amount, counterparty, date, reference and IBAN.
 */
export function calculateMatchScore(
  doc: { totalAmount?: number; counterparty?: string; documentDate?: string; counterpartyIban?: string; referenceNumber?: string },
  txn: { amount: string; counterparty: string | null; transactionDate: string; counterpartyIban: string | null; reference: string | null }
): number {
  let score = 0;

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
    const docVendor = normalizeMatchName(doc.counterparty);
    const txnVendor = normalizeMatchName(txn.counterparty);
    if (docVendor === txnVendor) {
      score += 30;
    } else if (docVendor.includes(txnVendor) || txnVendor.includes(docVendor)) {
      score += 25;
    } else {
      // Check if any significant word matches (min 4 chars to avoid false positives)
      const docWords = docVendor.split(' ').filter(w => w.length >= 4);
      const txnWords = txnVendor.split(' ').filter(w => w.length >= 4);
      const commonWords = docWords.filter(w => txnWords.some(tw => tw.includes(w) || w.includes(tw)));
      if (commonWords.length >= 2) {
        score += Math.min(25, commonWords.length * 12);
      } else if (commonWords.length === 1) {
        score += 12;
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
    if (docIban === txnIban) score += 10;
  }
  if (doc.referenceNumber && txn.reference) {
    const docRef = doc.referenceNumber.replace(/\s/g, '');
    const txnRef = txn.reference.replace(/\s/g, '');
    if (docRef === txnRef || docRef.includes(txnRef) || txnRef.includes(docRef)) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

type AutoMatchDocument = {
  totalAmount?: number;
  counterparty?: string;
  documentDate?: string;
  counterpartyIban?: string;
  referenceNumber?: string;
  documentType?: string | null;
};

type AutoMatchTransaction = {
  amount: string;
  counterparty: string | null;
  transactionDate: string;
  counterpartyIban: string | null;
  reference: string | null;
};

function hasStrongIdentitySignal(doc: AutoMatchDocument, txn: AutoMatchTransaction): boolean {
  if (doc.counterpartyIban && txn.counterpartyIban) {
    const docIban = doc.counterpartyIban.replace(/\s/g, '').toUpperCase();
    const txnIban = txn.counterpartyIban.replace(/\s/g, '').toUpperCase();
    if (docIban === txnIban) return true;
  }

  if (doc.referenceNumber && txn.reference) {
    const docReference = doc.referenceNumber.replace(/\s/g, '');
    const txnReference = txn.reference.replace(/\s/g, '');
    if (docReference === txnReference) return true;
  }

  if (!doc.counterparty || !txn.counterparty) return false;
  const docVendor = normalizeMatchName(doc.counterparty);
  const txnVendor = normalizeMatchName(txn.counterparty);
  return docVendor.length >= 3 && txnVendor.length >= 3 && (
    docVendor === txnVendor || docVendor.includes(txnVendor) || txnVendor.includes(docVendor)
  );
}

function hasCompatiblePaymentDirection(documentType: string | null | undefined, transactionAmount: number): boolean {
  // Unclassified documents and bank statements are not sufficiently meaningful
  // for automatic matching. They remain available for explicit manual matching.
  switch (documentType) {
    case "invoice_in":
    case "receipt":
    case "credit_card_statement":
      return transactionAmount < 0;
    case "invoice_out":
      return transactionAmount > 0;
    default:
      return false;
  }
}

/**
 * Strict automatic-matching guard. A candidate needs all of the following:
 * a score of at least 50, an independent identity signal, and a payment
 * direction compatible with the document type. Matching on the amount alone
 * is deliberately impossible.
 */
export function isSafeAutoMatch(
  doc: AutoMatchDocument,
  txn: AutoMatchTransaction,
  threshold: number = AUTO_MATCH_THRESHOLD,
): boolean {
  const transactionAmount = Number.parseFloat(txn.amount);
  if (!Number.isFinite(transactionAmount) || transactionAmount === 0) return false;
  if (!hasCompatiblePaymentDirection(doc.documentType, transactionAmount)) return false;
  if (!hasStrongIdentitySignal(doc, txn)) return false;

  return calculateMatchScore(doc, txn) >= Math.max(AUTO_MATCH_THRESHOLD, threshold);
}

/**
 * Run auto-matching: find best matches between unmatched documents and pending transactions.
 * Returns array of matches with scores >= threshold.
 */
export async function autoMatchDocuments(orgId: number, threshold: number = AUTO_MATCH_THRESHOLD): Promise<{
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
        },
        {
          amount: txn.amount,
          counterparty: txn.counterparty,
          transactionDate: txn.transactionDate,
          counterpartyIban: txn.counterpartyIban,
          reference: txn.reference,
        }
      );

      const candidate = {
        totalAmount: meta.totalAmount,
        counterparty: meta.counterparty,
        documentDate: meta.documentDate,
        counterpartyIban: meta.counterpartyIban,
        referenceNumber: meta.referenceNumber,
        documentType: doc.documentType,
      };
      const transaction = {
        amount: txn.amount,
        counterparty: txn.counterparty,
        transactionDate: txn.transactionDate,
        counterpartyIban: txn.counterpartyIban,
        reference: txn.reference,
      };

      if (score >= Math.max(AUTO_MATCH_THRESHOLD, threshold) && isSafeAutoMatch(candidate, transaction, threshold) && (!bestMatch || score > bestMatch.score)) {
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
export async function applyMatches(matches: { documentId: number; transactionId: number; score: number }[]): Promise<number> {
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
      .where(eq(bankTransactions.id, match.transactionId))
      .limit(1);
    if (existingTxn?.matchedDocumentId && existingTxn.matchedDocumentId !== match.documentId) {
      usedTransactionIds.add(match.transactionId);
    }
    const [existingDoc] = await db.select({ bankTransactionId: documents.bankTransactionId })
      .from(documents)
      .where(eq(documents.id, match.documentId))
      .limit(1);
    if (existingDoc?.bankTransactionId && existingDoc.bankTransactionId !== match.transactionId) {
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
      .where(eq(documents.id, match.documentId));

    // Update bank transaction
    await db.update(bankTransactions)
      .set({
        matchedDocumentId: match.documentId,
        matchScore: match.score,
      })
      .where(eq(bankTransactions.id, match.transactionId));

    applied++;
  }

  return applied;
}

/**
 * Get matched document info for a bank transaction.
 */
export async function getMatchedDocument(transactionId: number): Promise<Document | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(documents)
    .where(eq(documents.bankTransactionId, transactionId))
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
export async function unmatchDocument(documentId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get the document to find linked transaction
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) return;

  // Clear document match
  await db.update(documents)
    .set({ bankTransactionId: null, matchStatus: 'unmatched', matchScore: null })
    .where(eq(documents.id, documentId));

  // Clear transaction match if linked
  if (doc.bankTransactionId) {
    await db.update(bankTransactions)
      .set({ matchedDocumentId: null, matchScore: null })
      .where(eq(bankTransactions.id, doc.bankTransactionId));
  }
}

// ─── Delete Journal Entry (nur für pending Entries – GeBüV-konform) ──────────
export async function deleteJournalEntry(entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // GeBüV: approved Entries dürfen nicht gelöscht werden – Storno erforderlich.
  await assertJournalEntryEditable(entryId);
  // Delete lines first (FK), then entry
  await db.delete(journalLines).where(eq(journalLines.entryId, entryId));
  await db.delete(journalEntries).where(eq(journalEntries.id, entryId));
}

// ─── Revert bank transaction to pending ──────────────────────────────────────
export async function revertBankTransaction(txId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bankTransactions).set({
    status: "pending",
    journalEntryId: null,
  }).where(eq(bankTransactions.id, txId));
}

// ─── Delete CC statement and its items ───────────────────────────────────────
export async function deleteCcStatement(statementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(creditCardStatements).where(eq(creditCardStatements.id, statementId));
}

// ─── Revert CC statement to pending ──────────────────────────────────────────
export async function revertCcStatement(statementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(creditCardStatements).set({
    status: "pending",
    journalEntryId: null,
  }).where(eq(creditCardStatements.id, statementId));
}
