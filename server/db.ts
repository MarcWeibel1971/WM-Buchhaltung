import { eq, and, desc, asc, sql, gte, lte, inArray, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, accounts, journalEntries, journalLines,
  bankAccounts, bankTransactions, employees, payrollEntries,
  vatPeriods, openingBalances, fiscalYears, creditCardStatements,
  type Account, type JournalEntry, type JournalLine, type BankTransaction,
  type Employee, type PayrollEntry,
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

  return { entries: entriesResult, total: countResult[0]?.count ?? 0 };
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
