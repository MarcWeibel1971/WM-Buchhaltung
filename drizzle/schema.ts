import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  date,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users (Auth) ────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Accounts (Kontenplan) ────────────────────────────────────────────────────
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  // Account type for balance sheet / P&L classification
  accountType: mysqlEnum("accountType", [
    "asset",        // Aktiven (1xxx)
    "liability",    // Passiven (2xxx)
    "expense",      // Aufwand (3xxx, 4xxx)
    "revenue",      // Ertrag (6xxx)
    "equity",       // Eigenkapital (2200, 2220, 2290)
  ]).notNull(),
  // Normal balance side
  normalBalance: mysqlEnum("normalBalance", ["debit", "credit"]).notNull(),
  // Category for grouping in reports
  category: varchar("category", { length: 100 }),
  // Sub-category for grouping
  subCategory: varchar("subCategory", { length: 100 }),
  // Is this a bank account?
  isBankAccount: boolean("isBankAccount").default(false),
  // Is MWST relevant?
  isVatRelevant: boolean("isVatRelevant").default(false),
  // Default VAT rate (8.1, 2.6, 3.8, 0)
  defaultVatRate: decimal("defaultVatRate", { precision: 5, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Account = typeof accounts.$inferSelect;

// ─── Fiscal Years ─────────────────────────────────────────────────────────────
export const fiscalYears = mysqlTable("fiscal_years", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull().unique(),
  startDate: date("startDate", { mode: 'string' }).notNull(),
  endDate: date("endDate", { mode: 'string' }).notNull(),
  // Status: open = aktiv, closing = Abschluss läuft, closed = abgeschlossen
  status: mysqlEnum("status", ["open", "closing", "closed"]).default("open").notNull(),
  isClosed: boolean("isClosed").default(false).notNull(),
  // Saldovortrag completed?
  balanceCarriedForward: boolean("balanceCarriedForward").default(false).notNull(),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Depreciation Settings (Abschreibungssätze) ─────────────────────────────
export const depreciationSettings = mysqlTable("depreciation_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Linked asset account (e.g., 1500 Mobiliar, 1510 Fahrzeuge)
  accountId: int("accountId").notNull(),
  // Depreciation rate in percent (e.g., 25.00 for 25%)
  depreciationRate: decimal("depreciationRate", { precision: 5, scale: 2 }).notNull(),
  // Method: linear or degressive (degressiv)
  method: mysqlEnum("method", ["linear", "degressive"]).default("degressive").notNull(),
  // Useful life in years (optional, for linear method)
  usefulLifeYears: int("usefulLifeYears"),
  // Contra account for depreciation expense (e.g., 4800 Abschreibungen)
  depreciationExpenseAccountId: int("depreciationExpenseAccountId"),
  // Notes
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DepreciationSetting = typeof depreciationSettings.$inferSelect;

// ─── Year-End Bookings (Jahresabschluss-Buchungen) ──────────────────────────
export const yearEndBookings = mysqlTable("year_end_bookings", {
  id: int("id").autoincrement().primaryKey(),
  // Fiscal year being closed
  fiscalYear: int("fiscalYear").notNull(),
  // Type of year-end booking
  bookingType: mysqlEnum("bookingType", [
    "transitorische_aktiven",   // TA: Vorauszahlungen/Rückerstattungen (Kto 1300)
    "transitorische_passiven",  // TP: Aufwand im alten GJ, Rechnung im neuen (Kto 2300)
    "kreditoren",               // Offene Lieferantenrechnungen (Kto 2000)
    "debitoren",                // Offene Forderungen (Kto 1100)
    "abschreibung",             // Abschreibungen auf Anlagevermögen
    "rueckbuchung",             // Automatische Rückbuchung im neuen GJ
  ]).notNull(),
  // Description of the booking
  description: text("description").notNull(),
  // Amount
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  // Debit account
  debitAccountId: int("debitAccountId").notNull(),
  // Credit account
  creditAccountId: int("creditAccountId").notNull(),
  // Source document that triggered this suggestion
  sourceDocumentId: int("sourceDocumentId"),
  // Source journal entry (for TA/TP based on existing bookings)
  sourceJournalEntryId: int("sourceJournalEntryId"),
  // Created journal entry (after approval)
  journalEntryId: int("journalEntryId"),
  // Reversal entry in new fiscal year
  reversalEntryId: int("reversalEntryId"),
  // Status
  status: mysqlEnum("status", ["suggested", "approved", "rejected"]).default("suggested").notNull(),
  // AI reasoning for the suggestion
  aiReasoning: text("aiReasoning"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type YearEndBooking = typeof yearEndBookings.$inferSelect;

// ─── Journal Entries (Buchungssätze) ─────────────────────────────────────────
export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  // Entry number (Belegnummer)
  entryNumber: varchar("entryNumber", { length: 20 }),
  // Booking date
  bookingDate: date("bookingDate", { mode: 'string' }).notNull(),
  // Value date
  valueDate: date("valueDate", { mode: 'string' }),
  // Description
  description: text("description").notNull(),
  // Status: pending = Vorschlag, approved = freigegeben, rejected = abgelehnt
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  // Source of the entry
  source: mysqlEnum("source", [
    "manual",       // Manuelle Eingabe
    "bank_import",  // Bankimport
    "credit_card",  // Kreditkartenimport
    "payroll",      // Lohnbuchhaltung
    "vat",          // MWST
    "system",       // System (Abschluss etc.)
  ]).default("manual").notNull(),
  // Reference to source document
  sourceRef: varchar("sourceRef", { length: 100 }),
  // AI confidence score (0-100)
  aiConfidence: int("aiConfidence"),
  // AI reasoning
  aiReasoning: text("aiReasoning"),
  // Fiscal year
  fiscalYear: int("fiscalYear"),
  // Who approved
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

// ─── Journal Lines (Buchungszeilen – Soll/Haben) ──────────────────────────────
export const journalLines = mysqlTable("journal_lines", {
  id: int("id").autoincrement().primaryKey(),
  entryId: int("entryId").notNull(),
  accountId: int("accountId").notNull(),
  // Debit or credit
  side: mysqlEnum("side", ["debit", "credit"]).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  // VAT amount (if applicable)
  vatAmount: decimal("vatAmount", { precision: 15, scale: 2 }),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type JournalLine = typeof journalLines.$inferSelect;

// ─── Bank Accounts ────────────────────────────────────────────────────────────
export const bankAccounts = mysqlTable("bank_accounts", {
  id: int("id").autoincrement().primaryKey(),
  // Linked account in chart of accounts
  accountId: int("accountId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  iban: varchar("iban", { length: 34 }),
  bank: varchar("bank", { length: 100 }),
  currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
  // Owner: wm, mw, jm
  owner: varchar("owner", { length: 10 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Bank Transactions (Rohdaten aus Import) ──────────────────────────────────
export const bankTransactions = mysqlTable("bank_transactions", {
  id: int("id").autoincrement().primaryKey(),
  bankAccountId: int("bankAccountId").notNull(),
  // Transaction date
  transactionDate: date("transactionDate", { mode: 'string' }).notNull(),
  valueDate: date("valueDate", { mode: 'string' }),
  // Amount (positive = credit, negative = debit)
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
  // Description from bank
  description: text("description"),
  // Reference number
  reference: varchar("reference", { length: 100 }),
  // Counterparty name
  counterparty: varchar("counterparty", { length: 200 }),
  // IBAN of counterparty
  counterpartyIban: varchar("counterpartyIban", { length: 34 }),
  // Import batch ID
  importBatchId: varchar("importBatchId", { length: 50 }),
  // Status
  status: mysqlEnum("status", ["pending", "matched", "ignored"]).default("pending").notNull(),
  // Linked journal entry (after approval)
  journalEntryId: int("journalEntryId"),
  // AI suggestion
  suggestedDebitAccountId: int("suggestedDebitAccountId"),
  suggestedCreditAccountId: int("suggestedCreditAccountId"),
  aiConfidence: int("aiConfidence"),
  aiReasoning: text("aiReasoning"),
  // Matched document ID (if a document/invoice was matched)
  matchedDocumentId: int("matchedDocumentId"),
  // Match confidence score (0-100)
  matchScore: int("matchScore"),
  // Suggested booking text (from AI or matched document)
  suggestedBookingText: varchar("suggestedBookingText", { length: 500 }),
  // Duplicate check hash
  txHash: varchar("txHash", { length: 64 }).unique(),
  // Transfer partner (for internal account transfers)
  transferPartnerId: int("transferPartnerId"),
  // Is this an internal transfer between bank accounts?
  isTransfer: boolean("isTransfer").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BankTransaction = typeof bankTransactions.$inferSelect;

// ─── Credit Card Statements ───────────────────────────────────────────────────
export const creditCardStatements = mysqlTable("credit_card_statements", {
  id: int("id").autoincrement().primaryKey(),
  // Statement period
  statementDate: date("statementDate", { mode: 'string' }).notNull(),
  // Total amount
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
  // Owner: mw
  owner: varchar("owner", { length: 10 }).default("mw"),
  // Status
  status: mysqlEnum("status", ["pending", "approved"]).default("pending").notNull(),
  // Linked journal entry (Sammelbelastung)
  journalEntryId: int("journalEntryId"),
  // Raw PDF text
  rawText: text("rawText"),
  // Parsed items as JSON
  parsedItems: json("parsedItems"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Employees (Lohnbezüger) ──────────────────────────────────────────────────
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  // Short code: mw, jm
  code: varchar("code", { length: 10 }).notNull().unique(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  // AHV number
  ahvNumber: varchar("ahvNumber", { length: 20 }),
  // Address (legacy single field)
  address: text("address"),
  // Structured address fields for official documents
  street: varchar("street", { length: 200 }),
  zipCode: varchar("zipCode", { length: 10 }),
  city: varchar("city", { length: 100 }),
  // Date of birth
  dateOfBirth: date("dateOfBirth", { mode: 'string' }),
  // Employment start
  employmentStart: date("employmentStart", { mode: 'string' }),
  // Employment end (for partial year)
  employmentEnd: date("employmentEnd", { mode: 'string' }),
  // Linked salary account (Kontokorrent)
  salaryAccountId: int("salaryAccountId"),
  // Linked gross salary account
  grossSalaryAccountId: int("grossSalaryAccountId"),
  // Lohnausweis Ziffer 15: Bemerkungen
  lohnausweisRemarks: text("lohnausweisRemarks"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Employee = typeof employees.$inferSelect;

// ─── Payroll (Lohnabrechnung) ─────────────────────────────────────────────────
export const payrollEntries = mysqlTable("payroll_entries", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  // Pay period
  year: int("year").notNull(),
  month: int("month").notNull(),
  // Gross salary
  grossSalary: decimal("grossSalary", { precision: 15, scale: 2 }).notNull(),
  // Deductions
  ahvEmployee: decimal("ahvEmployee", { precision: 15, scale: 2 }).default("0"),
  ahvEmployer: decimal("ahvEmployer", { precision: 15, scale: 2 }).default("0"),
  bvgEmployee: decimal("bvgEmployee", { precision: 15, scale: 2 }).default("0"),
  bvgEmployer: decimal("bvgEmployer", { precision: 15, scale: 2 }).default("0"),
  ktgUvgEmployee: decimal("ktgUvgEmployee", { precision: 15, scale: 2 }).default("0"),
  ktgUvgEmployer: decimal("ktgUvgEmployer", { precision: 15, scale: 2 }).default("0"),
  // Net salary
  netSalary: decimal("netSalary", { precision: 15, scale: 2 }).notNull(),
  // Total employer cost
  totalEmployerCost: decimal("totalEmployerCost", { precision: 15, scale: 2 }).notNull(),
  // Status
  status: mysqlEnum("status", ["draft", "approved", "paid"]).default("draft").notNull(),
  // Linked journal entry
  journalEntryId: int("journalEntryId"),
  // Notes
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PayrollEntry = typeof payrollEntries.$inferSelect;

// ─── VAT Periods (MWST-Perioden) ──────────────────────────────────────────────
export const vatPeriods = mysqlTable("vat_periods", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  // Period: Q1, Q2, Q3, Q4, S1, S2
  period: varchar("period", { length: 5 }).notNull(),
  startDate: date("startDate", { mode: 'string' }).notNull(),
  endDate: date("endDate", { mode: 'string' }).notNull(),
  // Turnover amounts per rate
  turnover81: decimal("turnover81", { precision: 15, scale: 2 }).default("0"),
  turnover26: decimal("turnover26", { precision: 15, scale: 2 }).default("0"),
  turnover38: decimal("turnover38", { precision: 15, scale: 2 }).default("0"),
  turnoverExempt: decimal("turnoverExempt", { precision: 15, scale: 2 }).default("0"),
  // VAT due
  vatDue81: decimal("vatDue81", { precision: 15, scale: 2 }).default("0"),
  vatDue26: decimal("vatDue26", { precision: 15, scale: 2 }).default("0"),
  vatDue38: decimal("vatDue38", { precision: 15, scale: 2 }).default("0"),
  // Input tax (Vorsteuer)
  inputTax: decimal("inputTax", { precision: 15, scale: 2 }).default("0"),
  // Net VAT payable
  netVatPayable: decimal("netVatPayable", { precision: 15, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["open", "submitted", "paid"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Opening Balances (Eröffnungssalden) ──────────────────────────────────────
export const openingBalances = mysqlTable("opening_balances", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  fiscalYear: int("fiscalYear").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Documents (Belege / Rechnungen) ──────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  // Original filename
  filename: varchar("filename", { length: 255 }).notNull(),
  // S3 storage key
  s3Key: varchar("s3Key", { length: 500 }).notNull(),
  // Public S3 URL
  s3Url: text("s3Url").notNull(),
  // MIME type (application/pdf, image/jpeg, image/png)
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  // File size in bytes
  fileSize: int("fileSize").notNull(),
  // Document type
  documentType: mysqlEnum("documentType", ["invoice_in", "invoice_out", "receipt", "bank_statement", "other"]).default("other").notNull(),
  // Optional link to journal entry
  journalEntryId: int("journalEntryId"),
  // Optional link to bank transaction
  bankTransactionId: int("bankTransactionId"),
  // Extracted text content (via LLM/OCR for AI categorization)
  extractedText: text("extractedText"),
  // AI-extracted metadata (JSON: amount, counterparty, date, vatAmount, etc.)
  aiMetadata: text("aiMetadata"),
  // Notes
  notes: text("notes"),
  // Match status: unmatched, matched, manual
  matchStatus: mysqlEnum("matchStatus", ["unmatched", "matched", "manual"]).default("unmatched").notNull(),
  // Match confidence score (0-100)
  matchScore: int("matchScore"),
  // Uploader
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── Booking Rules (Gelernte Buchungsregeln) ─────────────────────────────────
// When a user manually edits and approves a transaction, the system learns a rule
// that maps counterparty patterns to booking text templates and account assignments.
export const bookingRules = mysqlTable("booking_rules", {
  id: int("id").autoincrement().primaryKey(),
  // Pattern to match counterparty name (case-insensitive substring match)
  counterpartyPattern: varchar("counterpartyPattern", { length: 300 }).notNull(),
  // Optional: pattern to match description text
  descriptionPattern: varchar("descriptionPattern", { length: 500 }),
  // Template for booking text (e.g., "SBB GA {month} {year}" or "Swisscom {quarter}. Quartal {year}")
  bookingTextTemplate: varchar("bookingTextTemplate", { length: 500 }),
  // Learned account assignments
  debitAccountId: int("debitAccountId"),
  creditAccountId: int("creditAccountId"),
  // Default VAT rate for this type of transaction
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }),
  // How many times this rule has been applied
  usageCount: int("usageCount").default(0).notNull(),
  // Priority: higher = checked first. Manual rules > AI rules
  priority: int("priority").default(10).notNull(),
  // Source: "manual" (user edited), "ai" (AI-generated)
  source: mysqlEnum("source", ["manual", "ai"]).default("manual").notNull(),
  // Is this rule active?
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BookingRule = typeof bookingRules.$inferSelect;
export type InsertBookingRule = typeof bookingRules.$inferInsert;

// ─── Company Settings (Unternehmensdaten) ────────────────────────────────────
export const companySettings = mysqlTable("company_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Company name
  companyName: varchar("companyName", { length: 200 }).notNull().default("WM Weibel Mueller AG"),
  // Legal form
  legalForm: varchar("legalForm", { length: 50 }).default("AG"),
  // Address
  street: varchar("street", { length: 200 }),
  zipCode: varchar("zipCode", { length: 10 }),
  city: varchar("city", { length: 100 }),
  canton: varchar("canton", { length: 50 }),
  country: varchar("country", { length: 50 }).default("Schweiz"),
  // UID / Handelsregisternummer
  uid: varchar("uid", { length: 20 }),
  // MWST number
  vatNumber: varchar("vatNumber", { length: 30 }),
  // MWST method: effective, saldo, pauschal
  vatMethod: mysqlEnum("vatMethod", ["effective", "saldo", "pauschal"]).default("effective"),
  // MWST period: quarterly, semi-annual
  vatPeriod: mysqlEnum("vatPeriod", ["quarterly", "semi-annual"]).default("quarterly"),
  // Fiscal year start (month: 1-12)
  fiscalYearStartMonth: int("fiscalYearStartMonth").default(1),
  // Phone
  phone: varchar("phone", { length: 30 }),
  // Email
  email: varchar("email", { length: 200 }),
  // Website
  website: varchar("website", { length: 200 }),
  // HR number
  hrNumber: varchar("hrNumber", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompanySettings = typeof companySettings.$inferSelect;

// ─── Insurance Settings (Versicherungsparameter) ─────────────────────────────
export const insuranceSettings = mysqlTable("insurance_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Insurance type: uvg, ktg, bvg, ahv
  insuranceType: mysqlEnum("insuranceType", ["uvg", "ktg", "bvg", "ahv", "fak"]).notNull(),
  // Insurance company name
  insurerName: varchar("insurerName", { length: 200 }),
  // Policy number
  policyNumber: varchar("policyNumber", { length: 100 }),
  // Employee contribution rate (%)
  employeeRate: decimal("employeeRate", { precision: 6, scale: 4 }).default("0"),
  // Employer contribution rate (%)
  employerRate: decimal("employerRate", { precision: 6, scale: 4 }).default("0"),
  // Maximum insured salary (UVG: 148'200 CHF)
  maxInsuredSalary: decimal("maxInsuredSalary", { precision: 15, scale: 2 }),
  // Minimum insured salary
  minInsuredSalary: decimal("minInsuredSalary", { precision: 15, scale: 2 }),
  // BVG: fixed monthly CHF amounts (not percentage-based)
  bvgEmployeeMonthly: decimal("bvgEmployeeMonthly", { precision: 15, scale: 2 }),
  bvgEmployerMonthly: decimal("bvgEmployerMonthly", { precision: 15, scale: 2 }),
  // Valid from date
  validFrom: date("validFrom", { mode: 'string' }),
  // Valid to date (null = current)
  validTo: date("validTo", { mode: 'string' }),
  // Notes
  notes: text("notes"),
  // Is active?
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InsuranceSetting = typeof insuranceSettings.$inferSelect;
export type InsertDepreciationSetting = typeof depreciationSettings.$inferInsert;
export type InsertYearEndBooking = typeof yearEndBookings.$inferInsert;

