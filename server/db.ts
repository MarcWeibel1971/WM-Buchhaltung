import { eq, and, desc, asc, sql, gte, lte, inArray, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, accounts, journalEntries, journalLines,
  bankAccounts, bankTransactions, employees, payrollEntries,
  vatPeriods, openingBalances, fiscalYears, creditCardStatements,
  bookingRules, documents,
  type Account, type JournalEntry, type JournalLine, type BankTransaction,
  type Employee, type PayrollEntry, type BookingRule, type Document,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
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
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Accounts (Kontenplan) ────────────────────────────────────────────────────
export async function getAllAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.sortOrder));
}

export async function getAccountByNumber(number: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accounts).where(eq(accounts.number, number)).limit(1);
  return result[0];
}

export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return result[0];
}

// ─── Account Balances ─────────────────────────────────────────────────────────
export async function getAccountBalance(accountId: number, fiscalYear?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get opening balance
  let openingBalance = 0;
  if (fiscalYear) {
    const ob = await db.select().from(openingBalances)
      .where(and(eq(openingBalances.accountId, accountId), eq(openingBalances.fiscalYear, fiscalYear)))
      .limit(1);
    if (ob[0]) openingBalance = parseFloat(ob[0].balance as string);
  }

  // Get account info for normal balance
  const account = await getAccountById(accountId);
  if (!account) return openingBalance;

  // Sum approved journal lines
  const lines = await db.select({
    side: journalLines.side,
    amount: sql<string>`SUM(${journalLines.amount})`,
  }).from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(
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
export async function getJournalEntries(filters: {
  status?: "pending" | "approved" | "rejected";
  source?: string;
  fiscalYear?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { entries: [], total: 0 };

  const conditions = [];
  if (filters.status) conditions.push(eq(journalEntries.status, filters.status));
  if (filters.source) conditions.push(eq(journalEntries.source, filters.source as any));
  if (filters.fiscalYear) conditions.push(eq(journalEntries.fiscalYear, filters.fiscalYear));
  if (filters.search) conditions.push(like(journalEntries.description, `%${filters.search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

export async function getJournalEntryWithLines(entryId: number) {
  const db = await getDb();
  if (!db) return null;

  const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, entryId)).limit(1);
  if (!entry) return null;

  const lines = await db.select({
    line: journalLines,
    account: accounts,
  }).from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(eq(journalLines.entryId, entryId));

  return { entry, lines };
}

export async function createJournalEntry(data: {
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

  // Validate double-entry: sum of debits = sum of credits
  const debitTotal = data.lines.filter(l => l.side === "debit").reduce((s, l) => s + parseFloat(l.amount), 0);
  const creditTotal = data.lines.filter(l => l.side === "credit").reduce((s, l) => s + parseFloat(l.amount), 0);
  if (Math.abs(debitTotal - creditTotal) > 0.01) {
    throw new Error(`Double-Entry-Fehler: Soll (${debitTotal.toFixed(2)}) ≠ Haben (${creditTotal.toFixed(2)})`);
  }

  // Generate entry number
  const year = data.fiscalYear ?? new Date().getFullYear();
  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(journalEntries)
    .where(eq(journalEntries.fiscalYear, year));
  const count = (countResult[0]?.count ?? 0) + 1;
  const entryNumber = `${year}-${String(count).padStart(5, "0")}`;

  const [result] = await db.insert(journalEntries).values({
    entryNumber,
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

export async function approveJournalEntry(entryId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(journalEntries).set({
    status: "approved",
    approvedBy: userId,
    approvedAt: new Date(),
  }).where(eq(journalEntries.id, entryId));
}

export async function rejectJournalEntry(entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(journalEntries).set({ status: "rejected" }).where(eq(journalEntries.id, entryId));
}

export async function updateJournalEntryLines(entryId: number, lines: Array<{
  accountId: number;
  side: "debit" | "credit";
  amount: string;
  description?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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
export async function getBankAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    bankAccount: bankAccounts,
    account: accounts,
  }).from(bankAccounts)
    .innerJoin(accounts, eq(bankAccounts.accountId, accounts.id))
    .where(eq(bankAccounts.isActive, true));
}

export async function getPendingBankTransactions(bankAccountId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(bankTransactions.status, "pending")];
  if (bankAccountId) conditions.push(eq(bankTransactions.bankAccountId, bankAccountId));
  return db.select().from(bankTransactions)
    .where(and(...conditions))
    .orderBy(desc(bankTransactions.transactionDate));
}

export async function getBankTransactionsByStatus(status: "pending" | "matched" | "all", bankAccountId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (status === "pending") conditions.push(eq(bankTransactions.status, "pending"));
  else if (status === "matched") conditions.push(eq(bankTransactions.status, "matched"));
  // "all" = no status filter
  if (bankAccountId) conditions.push(eq(bankTransactions.bankAccountId, bankAccountId));
  return db.select().from(bankTransactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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

export async function getBankTransactionsByIds(ids: number[]) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bankTransactions).where(inArray(bankTransactions.id, ids));
}

// ─── Employees ────────────────────────────────────────────────────────────────
export async function getEmployees() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employees).where(eq(employees.isActive, true)).orderBy(asc(employees.code));
}

export async function getPayrollEntries(year?: number, employeeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
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
export async function getBalanceSheet(fiscalYear: number) {
  const db = await getDb();
  if (!db) return { assets: [], liabilities: [], equity: [] };

  const allAccounts = await db.select().from(accounts)
    .where(and(eq(accounts.isActive, true), inArray(accounts.accountType, ["asset", "liability", "equity"])))
    .orderBy(asc(accounts.sortOrder));

  const balances = await Promise.all(allAccounts.map(async (acc) => ({
    account: acc,
    balance: await getAccountBalance(acc.id, fiscalYear),
  })));

  return {
    assets: balances.filter(b => b.account.accountType === "asset"),
    liabilities: balances.filter(b => b.account.accountType === "liability"),
    equity: balances.filter(b => b.account.accountType === "equity"),
  };
}

export async function getIncomeStatement(fiscalYear: number) {
  const db = await getDb();
  if (!db) return { expenses: [], revenues: [] };

  const allAccounts = await db.select().from(accounts)
    .where(and(eq(accounts.isActive, true), inArray(accounts.accountType, ["expense", "revenue"])))
    .orderBy(asc(accounts.sortOrder));

  const balances = await Promise.all(allAccounts.map(async (acc) => ({
    account: acc,
    balance: await getAccountBalance(acc.id, fiscalYear),
  })));

  return {
    expenses: balances.filter(b => b.account.accountType === "expense"),
    revenues: balances.filter(b => b.account.accountType === "revenue"),
  };
}

// ─── VAT ──────────────────────────────────────────────────────────────────────
export async function getVatPeriods(year?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = year ? [eq(vatPeriods.year, year)] : [];
  return db.select().from(vatPeriods)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vatPeriods.year), asc(vatPeriods.period));
}

// ─── Credit Card ──────────────────────────────────────────────────────────────
export async function getCreditCardStatements() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditCardStatements).orderBy(desc(creditCardStatements.statementDate));
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats(fiscalYear: number) {
  const db = await getDb();
  if (!db) return null;

  const [pendingCount, approvedCount] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(journalEntries).where(eq(journalEntries.status, "pending")),
    db.select({ count: sql<number>`COUNT(*)` }).from(journalEntries)
      .where(and(eq(journalEntries.status, "approved"), eq(journalEntries.fiscalYear, fiscalYear))),
  ]);

  const [pendingTxCount] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(bankTransactions).where(eq(bankTransactions.status, "pending"));

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
export async function findMatchingRule(counterpartyName: string): Promise<BookingRule | null> {
  const db = await getDb();
  if (!db || !counterpartyName) return null;
  
  const rules = await db.select().from(bookingRules)
    .where(eq(bookingRules.isActive, true))
    .orderBy(desc(bookingRules.priority), desc(bookingRules.usageCount));
  
  const cpLower = counterpartyName.toLowerCase();
  for (const rule of rules) {
    if (cpLower.includes(rule.counterpartyPattern.toLowerCase())) {
      return rule;
    }
  }
  return null;
}

/**
 * Get all active booking rules.
 */
export async function getAllBookingRules(): Promise<BookingRule[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookingRules)
    .where(eq(bookingRules.isActive, true))
    .orderBy(desc(bookingRules.priority), desc(bookingRules.usageCount));
}

/**
 * Create or update a booking rule based on counterparty pattern.
 * If a rule with the same counterpartyPattern already exists, update it.
 * Otherwise, create a new one.
 */
export async function upsertBookingRule(data: {
  counterpartyPattern: string;
  bookingTextTemplate?: string;
  debitAccountId?: number;
  creditAccountId?: number;
  vatRate?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Check if a rule with this pattern already exists (case-insensitive)
  const existing = await db.select().from(bookingRules)
    .where(eq(bookingRules.counterpartyPattern, data.counterpartyPattern))
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
  doc: { totalAmount?: number; counterparty?: string; documentDate?: string; counterpartyIban?: string; referenceNumber?: string },
  txn: { amount: string; counterparty: string | null; transactionDate: string; counterpartyIban: string | null; reference: string | null }
): number {
  let score = 0;

  // 1. Amount match (40 points)
  if (doc.totalAmount != null) {
    const docAmount = Math.abs(doc.totalAmount);
    const txnAmount = Math.abs(parseFloat(txn.amount));
    if (docAmount > 0 && txnAmount > 0) {
      const diff = Math.abs(docAmount - txnAmount);
      const pctDiff = diff / Math.max(docAmount, txnAmount);
      if (pctDiff === 0) score += 40;           // exact match
      else if (pctDiff < 0.001) score += 38;    // rounding diff
      else if (pctDiff < 0.01) score += 30;     // <1% off
      else if (pctDiff < 0.05) score += 15;     // <5% off (partial payment?)
    }
  }

  // 2. Counterparty match (30 points)
  if (doc.counterparty && txn.counterparty) {
    const docVendor = doc.counterparty.toLowerCase().replace(/[^a-zäöüéèà0-9]/g, '');
    const txnVendor = txn.counterparty.toLowerCase().replace(/[^a-zäöüéèà0-9]/g, '');
    if (docVendor === txnVendor) {
      score += 30;
    } else if (docVendor.includes(txnVendor) || txnVendor.includes(docVendor)) {
      score += 25;
    } else {
      // Check if any significant word matches
      const docWords = docVendor.match(/[a-zäöüéèà]{3,}/g) || [];
      const txnWords = txnVendor.match(/[a-zäöüéèà]{3,}/g) || [];
      const commonWords = docWords.filter(w => txnWords.some(tw => tw.includes(w) || w.includes(tw)));
      if (commonWords.length > 0) {
        score += Math.min(20, commonWords.length * 10);
      }
    }
  }

  // 3. Date proximity (20 points)
  if (doc.documentDate && txn.transactionDate) {
    const docDate = new Date(doc.documentDate);
    const txnDate = new Date(txn.transactionDate);
    const daysDiff = Math.abs((docDate.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 3) score += 20;
    else if (daysDiff <= 7) score += 15;
    else if (daysDiff <= 14) score += 10;
    else if (daysDiff <= 30) score += 5;
    else if (daysDiff <= 60) score += 2;
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

/**
 * Run auto-matching: find best matches between unmatched documents and pending transactions.
 * Returns array of matches with scores >= threshold.
 */
export async function autoMatchDocuments(threshold: number = 50): Promise<{
  documentId: number;
  transactionId: number;
  score: number;
  docFilename: string;
  txnDescription: string;
}[]> {
  const db = await getDb();
  if (!db) return [];

  // Get unmatched documents with AI metadata
  const unmatchedDocs = await db.select().from(documents)
    .where(and(
      eq(documents.matchStatus, 'unmatched'),
      sql`${documents.aiMetadata} IS NOT NULL`
    ));

  // Get pending (unmatched) bank transactions
  const pendingTxns = await db.select().from(bankTransactions)
    .where(eq(bankTransactions.status, 'pending'));

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
export async function applyMatches(matches: { documentId: number; transactionId: number; score: number }[]): Promise<number> {
  const db = await getDb();
  if (!db || matches.length === 0) return 0;

  let applied = 0;
  for (const match of matches) {
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

// ─── Delete Journal Entry (for reverting bookings) ───────────────────────────
export async function deleteJournalEntry(entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
