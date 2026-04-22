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
  primaryKey,
  unique,
} from "drizzle-orm/mysql-core";

// ─── Users (Auth) ────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Phase 1 Multi-Tenancy: die aktuell "aktive" Organisation des Users.
  // Wird beim Login auf die Default-Membership gesetzt und kann über einen
  // Org-Switcher geändert werden.
  currentOrganizationId: int("currentOrganizationId"),
  // ─── Own Auth (Migration 0024+) ───────────────────────────────────────────
  // Password hash (bcrypt). NULL = user only uses OAuth (Manus/Google etc.)
  passwordHash: varchar("passwordHash", { length: 255 }),
  // Email verification status
  emailVerified: boolean("emailVerified").default(false).notNull(),
  // Token for email verification (sent on registration)
  emailVerifyToken: varchar("emailVerifyToken", { length: 128 }),
  // Token + expiry for password reset
  passwordResetToken: varchar("passwordResetToken", { length: 128 }),
  passwordResetExpiry: timestamp("passwordResetExpiry"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Organizations (Mandanten / Tenants) ────────────────────────────────────
// Phase 1 Multi-Tenancy: jede Firma, die die App nutzt, ist eine eigene
// Organization. Alle Domain-Tabellen (accounts, journal_entries, documents,
// bank_transactions, employees, ...) referenzieren organizationId und werden
// durch die orgProcedure-Middleware auf die aktive Organisation gefiltert.
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  // URL-tauglicher Slug für Deep-Links und mögliche Subdomain-Routing.
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  legalForm: varchar("legalForm", { length: 50 }),
  // Adresse
  street: varchar("street", { length: 200 }),
  zipCode: varchar("zipCode", { length: 10 }),
  city: varchar("city", { length: 100 }),
  canton: varchar("canton", { length: 50 }),
  country: varchar("country", { length: 50 }).default("Schweiz"),
  // UID / Handelsregister
  uid: varchar("uid", { length: 20 }),
  hrNumber: varchar("hrNumber", { length: 50 }),
  // MWST
  vatNumber: varchar("vatNumber", { length: 30 }),
  vatMethod: mysqlEnum("vatMethod", ["effective", "saldo", "pauschal"]).default("effective"),
  vatSaldoRate: decimal("vatSaldoRate", { precision: 5, scale: 2 }).default("0"),
  vatPeriod: mysqlEnum("vatPeriod", ["quarterly", "semi-annual"]).default("quarterly"),
  // Fiscal year
  fiscalYearStartMonth: int("fiscalYearStartMonth").default(1),
  // Kontakt
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 200 }),
  website: varchar("website", { length: 200 }),
  logoUrl: text("logoUrl"),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── User ↔ Organization Memberships ────────────────────────────────────────
// Ein User kann Mitglied mehrerer Organisationen sein (z.B. Treuhänder der
// mehrere Mandanten betreut). Die Rolle bestimmt die Rechte innerhalb der Org.
export const userOrganizations = mysqlTable("user_organizations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId").notNull(),
  // Rolle innerhalb der Organisation (hierarchisch):
  // - owner:       Voller Zugriff, inkl. Löschen der Organisation
  // - admin:       Voller Zugriff auf Daten und Einstellungen
  // - bookkeeper:  Buchen, Berichte, Lohn – keine Org-Einstellungen
  // - viewer:      Nur Lesezugriff
  role: mysqlEnum("role", ["owner", "admin", "bookkeeper", "viewer"]).default("viewer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserOrganization = typeof userOrganizations.$inferSelect;
export type InsertUserOrganization = typeof userOrganizations.$inferInsert;

// ─── Subscriptions (Stripe Abo) ──────────────────────────────────────────────
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  // Stripe IDs
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  // Plan: starter | professional | enterprise
  plan: mysqlEnum("plan", ["starter", "professional", "enterprise"]).default("starter").notNull(),
  // Status: trialing | active | past_due | canceled | unpaid
  status: mysqlEnum("status", ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete"]).default("trialing").notNull(),
  // Billing period
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  // Trial
  trialEnd: timestamp("trialEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ─── Accounts (Kontenplan) ────────────────────────────────────────────────────
export const accounts = mysqlTable(
  "accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    // Phase 1 Multi-Tenancy: Kontenplan ist pro Organisation.
    organizationId: int("organizationId").notNull(),
    number: varchar("number", { length: 10 }).notNull(),
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
  },
  (table) => ({
    // Kontonummer ist pro Organisation eindeutig (nicht mehr global)
    orgNumberUnique: unique("accounts_org_number_unique").on(table.organizationId, table.number),
  }),
);
export type Account = typeof accounts.$inferSelect;

// ─── Fiscal Years ─────────────────────────────────────────────────────────────
export const fiscalYears = mysqlTable(
  "fiscal_years",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    year: int("year").notNull(),
    startDate: date("startDate", { mode: 'string' }).notNull(),
    endDate: date("endDate", { mode: 'string' }).notNull(),
    // Status: open = aktiv, closing = Abschluss läuft, closed = abgeschlossen
    status: mysqlEnum("status", ["open", "closing", "closed"]).default("open").notNull(),
    isClosed: boolean("isClosed").default(false).notNull(),
    // Saldovortrag completed?
    balanceCarriedForward: boolean("balanceCarriedForward").default(false).notNull(),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    // Geschäftsjahr ist pro Organisation eindeutig
    orgYearUnique: unique("fiscal_years_org_year_unique").on(table.organizationId, table.year),
  }),
);

// ─── Depreciation Settings (Abschreibungssätze) ─────────────────────────────
export const depreciationSettings = mysqlTable("depreciation_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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
  organizationId: int("organizationId").notNull(),
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
export const journalEntries = mysqlTable(
  "journal_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    // Entry number (Belegnummer) – pro Organisation eindeutig; NULL bei drafts
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
  },
  (table) => ({
    // Belegnummer ist pro Organisation eindeutig. NULL wird in MySQL
    // mehrfach erlaubt → pending/rejected Drafts ohne Nummer sind ok.
    orgEntryNumberUnique: unique("journal_entries_org_entryNumber_unique").on(
      table.organizationId,
      table.entryNumber,
    ),
  }),
);
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

// ─── Journal Entry Sequences (fortlaufende Belegnummern pro Geschäftsjahr) ───
// GeBüV (Art. 957d OR): Belegnummern müssen fortlaufend und lückenlos sein.
// Sequenzen werden atomar via MySQL LAST_INSERT_ID()-Trick allokiert – siehe
// allocateEntryNumber() in server/db.ts. Die Nummer wird erst beim Approval
// vergeben, damit gelöschte Drafts keine Lücken hinterlassen.
// Phase 1: Sequenz ist pro (Organisation, Geschäftsjahr) eindeutig.
export const journalEntrySequences = mysqlTable(
  "journal_entry_sequences",
  {
    organizationId: int("organizationId").notNull(),
    fiscalYear: int("fiscalYear").notNull(),
    nextSequence: int("nextSequence").default(1).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.fiscalYear] }),
  }),
);
export type JournalEntrySequence = typeof journalEntrySequences.$inferSelect;

// ─── Bank Accounts ────────────────────────────────────────────────────────────
export const bankAccounts = mysqlTable("bank_accounts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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
  organizationId: int("organizationId").notNull(),
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
  // Was this transaction manually edited by the user? (protects from refresh overwrite)
  manuallyEdited: boolean("manuallyEdited").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BankTransaction = typeof bankTransactions.$inferSelect;

// ─── Credit Card Statements ───────────────────────────────────────────────────
export const creditCardStatements = mysqlTable("credit_card_statements", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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
export const employees = mysqlTable(
  "employees",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    // Short code (pro Organisation eindeutig, z.B. "mw", "jm", "max")
    code: varchar("code", { length: 10 }).notNull(),
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
  },
  (table) => ({
    // Employee-Code ist pro Organisation eindeutig
    orgCodeUnique: unique("employees_org_code_unique").on(table.organizationId, table.code),
  }),
);
export type Employee = typeof employees.$inferSelect;

// ─── Payroll (Lohnabrechnung) ─────────────────────────────────────────────────
export const payrollEntries = mysqlTable("payroll_entries", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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
  organizationId: int("organizationId").notNull(),
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
  organizationId: int("organizationId").notNull(),
  accountId: int("accountId").notNull(),
  fiscalYear: int("fiscalYear").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Documents (Belege / Rechnungen) ──────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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
  documentType: mysqlEnum("documentType", ["invoice_in", "invoice_out", "receipt", "bank_statement", "credit_card_statement", "other"]).default("other").notNull(),
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
  matchStatus: mysqlEnum("matchStatus", ["unmatched", "matched", "manual", "pain001"]).default("unmatched").notNull(),
  // Match confidence score (0-100)
  matchScore: int("matchScore"),
  // Fiscal year this document belongs to
  fiscalYear: int("fiscalYear"),
  // Linked supplier (auto-created from invoice AI extraction)
  supplierId: int("supplierId"),
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
  organizationId: int("organizationId").notNull(),
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
  // ─── Two-Level Rule System ────────────────────────────────────────────────
  // Scope: "global" = system-wide base rule (trained by admin, applies to all orgs)
  //        "org"    = org-specific rule (learned from this org's corrections, has priority)
  scope: mysqlEnum("scope", ["global", "org"]).default("org").notNull(),
  // Global account mapping: for global rules, store generic account NUMBER (not org-specific ID)
  // When matching, the system resolves the number to the org's actual account ID
  globalDebitAccountNumber: varchar("globalDebitAccountNumber", { length: 20 }),
  globalCreditAccountNumber: varchar("globalCreditAccountNumber", { length: 20 }),
  // Optional: category hint for global rules (e.g., "Versicherungen", "Telekommunikation")
  categoryHint: varchar("categoryHint", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BookingRule = typeof bookingRules.$inferSelect;
export type InsertBookingRule = typeof bookingRules.$inferInsert;

// ─── Company Settings (Unternehmensdaten) ────────────────────────────────────
// DEPRECATED in Phase 1: Daten wandern nach `organizations`. Tabelle bleibt
// vorerst bestehen für Backward-Compat, wird in Phase 1c komplett entfernt.
// organizationId wird in der Migration auf die passende Org-Zeile gemappt.
export const companySettings = mysqlTable("company_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  // Company name
  companyName: varchar("companyName", { length: 200 }).notNull().default("Meine Firma"),
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
  // Saldosteuersatz (for saldo method, e.g. 6.2%)
  vatSaldoRate: decimal("vatSaldoRate", { precision: 5, scale: 2 }).default("6.20"),
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
  // Company logo URL (stored in S3)
  logoUrl: varchar("logoUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompanySettings = typeof companySettings.$inferSelect;

// ─── Insurance Settings (Versicherungsparameter) ─────────────────────────────
export const insuranceSettings = mysqlTable("insurance_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
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


// ─── Import History ──────────────────────────────────────────────────────────
export const importHistory = mysqlTable("import_history", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  bankAccountId: int("bankAccountId").notNull(),
  filename: varchar("filename", { length: 500 }).notNull(),
  fileType: varchar("fileType", { length: 50 }).notNull(), // camt, mt940, csv, pdf
  s3Key: varchar("s3Key", { length: 500 }),
  s3Url: varchar("s3Url", { length: 1000 }),
  importBatchId: varchar("importBatchId", { length: 100 }),
  transactionsTotal: int("transactionsTotal").default(0).notNull(),
  transactionsImported: int("transactionsImported").default(0).notNull(),
  transactionsDuplicate: int("transactionsDuplicate").default(0).notNull(),
  transactionsSkipped: int("transactionsSkipped").default(0).notNull(),
  dateRangeFrom: date("dateRangeFrom", { mode: 'string' }),
  dateRangeTo: date("dateRangeTo", { mode: 'string' }),
  importedBy: varchar("importedBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ImportHistoryEntry = typeof importHistory.$inferSelect;

// ─── Audit Log (DSG-Konformität) ─────────────────────────────────────────────
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: varchar("userId", { length: 64 }).notNull(),
  userName: varchar("userName", { length: 200 }),
  action: mysqlEnum("action", ["create", "read", "update", "delete", "export", "login", "logout"]).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(), // e.g. "journal_entry", "employee", "bank_transaction"
  entityId: varchar("entityId", { length: 100 }), // ID of the affected record
  details: text("details"), // JSON with changed fields / additional info
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLogEntry = typeof auditLog.$inferSelect;

// ─── QR-Rechnung Einstellungen ───────────────────────────────────────────────
export const qrSettings = mysqlTable("qr_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  // Creditor IBAN (QR-IBAN for QR-Referenz or normal IBAN for SCOR)
  iban: varchar("iban", { length: 34 }).notNull(),
  // Reference type: QRR (QR-Referenz), SCOR (Structured Creditor Reference), NON (none)
  referenceType: mysqlEnum("referenceType", ["QRR", "SCOR", "NON"]).default("QRR").notNull(),
  // Default currency
  currency: mysqlEnum("currency", ["CHF", "EUR"]).default("CHF").notNull(),
  // Additional info on payment slip
  additionalInfo: varchar("additionalInfo", { length: 140 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QrSettings = typeof qrSettings.$inferSelect;

// ─── Suppliers (Lieferanten-Stammdaten) ──────────────────────────────────────
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  street: varchar("street", { length: 200 }),
  zipCode: varchar("zipCode", { length: 10 }),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 50 }).default("Schweiz"),
  iban: varchar("iban", { length: 34 }),
  bic: varchar("bic", { length: 11 }),
  // Payment terms in days (e.g., 30)
  paymentTermDays: int("paymentTermDays").default(30),
  contactPerson: varchar("contactPerson", { length: 200 }),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 30 }),
  notes: text("notes"),
  // Default debit account for this supplier (e.g., 4xxx Aufwandkonto)
  defaultDebitAccountId: int("defaultDebitAccountId"),
  // Pattern for matching in bank import (counterparty name)
  matchPattern: varchar("matchPattern", { length: 300 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ─── Customers (Kunden-Stammdaten / CRM) ────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  // Customer number from legacy system
  customerNumber: varchar("customerNumber", { length: 20 }),
  // Name (kept for backward compat / display name / company name)
  name: varchar("name", { length: 200 }).notNull(),
  // Split name fields
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  company: varchar("company", { length: 200 }),
  // Spouse / partner
  spouseFirstName: varchar("spouseFirstName", { length: 100 }),
  spouseLastName: varchar("spouseLastName", { length: 100 }),
  // Marital status
  maritalStatus: varchar("maritalStatus", { length: 30 }),
  // Birth dates
  birthDate: varchar("birthDate", { length: 10 }),
  spouseBirthDate: varchar("spouseBirthDate", { length: 10 }),
  // Address
  street: varchar("street", { length: 200 }),
  zipCode: varchar("zipCode", { length: 10 }),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 50 }).default("Schweiz"),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 30 }),
  // Salutation for letters/invoices (e.g., "Sehr geehrter Herr Meier")
  salutation: varchar("salutation", { length: 200 }),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Customer Services (Dienstleistungen pro Kunde mit Ertragskonto) ────────
export const customerServices = mysqlTable("customer_services", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  // Description of the service
  description: varchar("description", { length: 300 }).notNull(),
  // Revenue account (Ertragskonto, e.g., 6000, 6100)
  revenueAccountId: int("revenueAccountId").notNull(),
  // Hourly rate for this service
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }),
  // Is this the default/primary service? (first = most used)
  isDefault: boolean("isDefault").default(false),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CustomerService = typeof customerServices.$inferSelect;

// ─── Services (Dienstleistungs-Kategorien für Zeiterfassung) ────────────────
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  // Default hourly rate
  defaultHourlyRate: decimal("defaultHourlyRate", { precision: 10, scale: 2 }).notNull(),
  // Revenue account for this service category
  revenueAccountId: int("revenueAccountId"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// ─── Time Entries (Zeiterfassung) ───────────────────────────────────────────
export const timeEntries = mysqlTable("time_entries", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  // Customer
  customerId: int("customerId").notNull(),
  // Service category
  serviceId: int("serviceId").notNull(),
  // Date of work
  date: date("date", { mode: 'string' }).notNull(),
  // Hours worked (e.g., 2.5)
  hours: decimal("hours", { precision: 6, scale: 2 }).notNull(),
  // Description of work done
  description: text("description"),
  // Hourly rate (can override service default)
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }).notNull(),
  // Status: open = not yet invoiced, invoiced = on an invoice
  status: mysqlEnum("status", ["open", "invoiced"]).default("open").notNull(),
  // Link to invoice (journal entry) when invoiced
  invoiceEntryId: int("invoiceEntryId"),
  // User who created this entry
  userId: int("userId"),
  // Fiscal year
  fiscalYear: int("fiscalYear"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;

// ─── Pain.001 Exports (für CAMT.054 Abgleich) ──────────────────────────────
export const pain001Exports = mysqlTable("pain001_exports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  // Filename of the exported pain.001 file
  filename: varchar("filename", { length: 255 }).notNull(),
  // Message ID from the pain.001 XML
  messageId: varchar("messageId", { length: 100 }).notNull(),
  // Total amount
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  // Number of payments
  paymentCount: int("paymentCount").notNull(),
  // Status: exported, partially_confirmed, confirmed
  status: mysqlEnum("status", ["exported", "partially_confirmed", "confirmed"]).default("exported").notNull(),
  // S3 URL of the pain.001 file
  s3Url: text("s3Url"),
  // Export date
  exportDate: date("exportDate", { mode: 'string' }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Pain001Export = typeof pain001Exports.$inferSelect;

// ─── Pain.001 Payment Items (Einzelzahlungen in pain.001) ───────────────────
export const pain001Payments = mysqlTable("pain001_payments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  exportId: int("exportId").notNull(),
  // End-to-end ID for matching with CAMT.054
  endToEndId: varchar("endToEndId", { length: 100 }).notNull(),
  // Creditor (supplier) name
  creditorName: varchar("creditorName", { length: 200 }).notNull(),
  // Creditor IBAN
  creditorIban: varchar("creditorIban", { length: 34 }),
  // Amount
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
  // Reference
  reference: varchar("reference", { length: 100 }),
  // Status: pending, confirmed, rejected
  status: mysqlEnum("status", ["pending", "confirmed", "rejected"]).default("pending").notNull(),
  // CAMT.054 confirmation date
  confirmedAt: timestamp("confirmedAt"),
  // Linked journal entry
  journalEntryId: int("journalEntryId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Pain001Payment = typeof pain001Payments.$inferSelect;

// ─── Templates (Vorlagen für Rechnungen etc.) ───────────────────────────────
export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  // Template type
  templateType: mysqlEnum("templateType", ["invoice", "letter", "contract", "other"]).default("invoice").notNull(),
  // Description
  description: text("description"),
  // S3 storage
  s3Key: varchar("s3Key", { length: 500 }).notNull(),
  s3Url: text("s3Url").notNull(),
  // MIME type
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  // File size in bytes
  fileSize: int("fileSize").notNull(),
  // Is this the active/default template for its type?
  isDefault: boolean("isDefault").default(false),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

// ─── Invoices (Ausgangsrechnungen / Debitorenbuchhaltung) ───────────────────
// Vollständiges Rechnungsmodul mit Nummernkreis, Positionen, MWST,
// Zahlungsstatus und Anbindung an QR-Rechnung/Journal.
//
// Lifecycle:
//   draft            → Entwurf, noch keine Belegnummer, kein Journal-Entry
//   sent             → Versendet, Nummer vergeben, Debitoren-Buchung ausgelöst
//   partially_paid   → Teilzahlung eingegangen
//   paid             → Vollständig bezahlt
//   overdue          → Fällig + Zahlungsziel überschritten (abgeleitet)
//   cancelled        → Storniert (Gegenbuchung im Journal)
//   written_off      → Abschreibung (Debitorenverlust)
export const invoices = mysqlTable(
  "invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    // Fortlaufende Rechnungsnummer pro Org, Format "R-YYYY-NNNNN".
    // NULL während Draft-Phase, wird bei `issue` vergeben.
    invoiceNumber: varchar("invoiceNumber", { length: 30 }),
    // Kunde (FK auf customers – nur eingeloggt innerhalb der Org)
    // NULL erlaubt für Entwürfe aus QrBillGenerator ohne Kundenzuordnung
    customerId: int("customerId"),
    // Rechnungsdatum (Ausstellungsdatum)
    invoiceDate: date("invoiceDate", { mode: "string" }).notNull(),
    // Fälligkeitsdatum – wird bei `issue` aus payment_terms_days berechnet,
    // kann aber überschrieben werden.
    dueDate: date("dueDate", { mode: "string" }).notNull(),
    // Überweisungsdatum (für Status paid)
    paidDate: date("paidDate", { mode: "string" }),
    // Zahlungsziel in Tagen (Default aus Org oder 30)
    paymentTermDays: int("paymentTermDays").default(30).notNull(),
    // Status im Lifecycle
    status: mysqlEnum("status", [
      "draft",
      "sent",
      "partially_paid",
      "paid",
      "cancelled",
      "written_off",
    ]).default("draft").notNull(),
    // Betreff / Kurzbeschreibung (z.B. "Beratung März 2026")
    subject: varchar("subject", { length: 300 }),
    // Einleitungstext (erscheint im PDF vor der Positionsliste)
    introText: text("introText"),
    // Fusszeile / Dankestext
    footerText: text("footerText"),
    // Beträge (werden aus invoice_items berechnet, aber gecacht für Filter)
    subtotal: decimal("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
    vatTotal: decimal("vatTotal", { precision: 15, scale: 2 }).default("0").notNull(),
    total: decimal("total", { precision: 15, scale: 2 }).default("0").notNull(),
    // Eingegangene Zahlungen (für partial-paid Tracking)
    paidAmount: decimal("paidAmount", { precision: 15, scale: 2 }).default("0").notNull(),
    currency: mysqlEnum("currency", ["CHF", "EUR"]).default("CHF").notNull(),
    // QR-Referenz (für QR-Rechnung); wird bei `issue` generiert
    qrReference: varchar("qrReference", { length: 50 }),
    // Verknüpfte Buchhaltung
    journalEntryId: int("journalEntryId"),            // Debitorenbuchung bei `sent`
    cancelJournalEntryId: int("cancelJournalEntryId"),// Gegenbuchung bei `cancelled`/`written_off`
    // Status-Zeitstempel (für Audit)
    sentAt: timestamp("sentAt"),
    cancelledAt: timestamp("cancelledAt"),
    // Fiscal year (für Filter)
    fiscalYear: int("fiscalYear"),
    // PDF-Cache (nach erstem generatePdf)
    pdfS3Key: varchar("pdfS3Key", { length: 500 }),
    pdfS3Url: text("pdfS3Url"),
    // Notizen (nur intern, nicht im PDF)
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    // Rechnungsnummer pro Org eindeutig. NULL für Drafts ist erlaubt
    // (mehrere Drafts können parallel existieren).
    orgInvoiceNumberUnique: unique("invoices_org_invoiceNumber_unique").on(
      table.organizationId,
      table.invoiceNumber,
    ),
  }),
);
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─── Invoice Line Items ─────────────────────────────────────────────────────
export const invoiceItems = mysqlTable("invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  // Reihenfolge in der Rechnung (1-basiert)
  position: int("position").notNull(),
  // Optional: FK auf services/customer_services für Templates
  serviceId: int("serviceId"),
  // Text (Pflicht – Beschreibung der Leistung)
  description: text("description").notNull(),
  // Menge (z.B. Stunden, Stück)
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1").notNull(),
  // Einheit (z.B. "h", "Stk", "Pauschal")
  unit: varchar("unit", { length: 20 }).default("Stk"),
  // Einzelpreis netto
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  // MWST-Satz (0, 2.6, 3.8, 8.1)
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("0").notNull(),
  // Konto für Ertragsbuchung (Credit bei sent) – überschreibt Default aus Service
  revenueAccountId: int("revenueAccountId"),
  // Berechnet (gecacht für Summen-Queries)
  lineSubtotal: decimal("lineSubtotal", { precision: 15, scale: 2 }).notNull(),
  lineVat: decimal("lineVat", { precision: 15, scale: 2 }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

// ─── Invoice Sequences (fortlaufende Rechnungsnummern pro Org+Jahr) ─────────
// Analog zu journal_entry_sequences: atomare Allokation über MySQL
// LAST_INSERT_ID()-Trick, Format "R-YYYY-NNNNN".
export const invoiceSequences = mysqlTable(
  "invoice_sequences",
  {
    organizationId: int("organizationId").notNull(),
    fiscalYear: int("fiscalYear").notNull(),
    nextSequence: int("nextSequence").default(1).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.fiscalYear] }),
  }),
);
export type InvoiceSequence = typeof invoiceSequences.$inferSelect;

// ─── Invoice Reminders (Zahlungserinnerungen + Mahnungen) ───────────────────
// Drei-stufiges Mahnwesen pro Rechnung:
//   Level 1: Zahlungserinnerung (freundlich, ohne Gebühr)
//   Level 2: 1. Mahnung (mit Mahngebühr)
//   Level 3: 2. Mahnung / letzte Mahnung (Hinweis auf Inkasso)
// Pro Invoice darf jedes Level nur einmal vergeben werden – verhindert
// Duplikat-Mahnungen bei versehentlichem Doppelklick.
export const invoiceReminders = mysqlTable(
  "invoice_reminders",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    invoiceId: int("invoiceId").notNull(),
    // 1 = Zahlungserinnerung, 2 = 1. Mahnung, 3 = 2./letzte Mahnung
    level: int("level").notNull(),
    // Datum der Mahnung (= sentAt wenn bereits raus)
    reminderDate: date("reminderDate", { mode: "string" }).notNull(),
    // Neues Fälligkeitsdatum (typisch reminderDate + 10/14 Tage)
    newDueDate: date("newDueDate", { mode: "string" }).notNull(),
    // Mahngebühr (CHF). Wird nur bei Zahlung mitberücksichtigt wenn der
    // Kunde sie anerkennt – im Journal ist sie separat zu buchen.
    feeAmount: decimal("feeAmount", { precision: 15, scale: 2 }).default("0").notNull(),
    // Freitexte für das PDF
    subject: varchar("subject", { length: 200 }),
    introText: text("introText"),
    footerText: text("footerText"),
    // PDF-Cache (generateReminderPdf)
    pdfS3Key: varchar("pdfS3Key", { length: 500 }),
    pdfS3Url: text("pdfS3Url"),
    // Versand-Zeitstempel (null = noch nicht versandt)
    sentAt: timestamp("sentAt"),
    // Wer hat die Mahnung ausgelöst
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    // Pro Rechnung darf jedes Mahn-Level nur einmal existieren.
    orgInvoiceLevelUnique: unique("invoice_reminders_org_invoice_level_unique").on(
      table.organizationId,
      table.invoiceId,
      table.level,
    ),
  }),
);
export type InvoiceReminder = typeof invoiceReminders.$inferSelect;
export type InsertInvoiceReminder = typeof invoiceReminders.$inferInsert;

// ─── Avatar Chatbot Settings ──────────────────────────────────────────────────
export const avatarSettings = mysqlTable("avatar_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().unique(),
  // Response language: de-CH, de-DE, en-US, fr-CH, it-CH
  language: varchar("language", { length: 10 }).default("de-CH").notNull(),
  // Response style: concise (1-2 Sätze), balanced (3-4 Sätze), detailed (ausführlich)
  style: mysqlEnum("style", ["concise", "balanced", "detailed"]).default("concise").notNull(),
  // Max sentences override (1-10)
  maxSentences: int("maxSentences").default(2).notNull(),
  // Custom system prompt addition (appended after base prompt)
  customPrompt: text("customPrompt"),
  // ElevenLabs voice ID override
  voiceId: varchar("voiceId", { length: 100 }),
  // Avatar name shown in widget
  avatarName: varchar("avatarName", { length: 100 }).default("Berater").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AvatarSettings = typeof avatarSettings.$inferSelect;
export type InsertAvatarSettings = typeof avatarSettings.$inferInsert;

// ─── Import Automation Settings ───────────────────────────────────────────────
// Konfiguriert, welche KI-Aktionen beim Bankimport automatisch ausgeführt werden.
export const importAutomationSettings = mysqlTable("import_automation_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().unique(),
  // KI-Kategorisierung: Soll/Haben-Konten automatisch vorschlagen
  autoKiCategorize: boolean("autoKiCategorize").default(true).notNull(),
  // Buchungstexte: Lesbare Buchungstexte automatisch generieren
  autoGenerateBookingTexts: boolean("autoGenerateBookingTexts").default(true).notNull(),
  // Refresh (gelernt): Gelernte Buchungsregeln auf neue Transaktionen anwenden
  autoRefreshLearned: boolean("autoRefreshLearned").default(true).notNull(),
  // Kontoüberträge erkennen: Interne Transfers zwischen eigenen Konten erkennen
  autoDetectTransfers: boolean("autoDetectTransfers").default(true).notNull(),
  // Dokument-Matching: Hochgeladene Belege automatisch mit Transaktionen matchen
  autoMatchDocuments: boolean("autoMatchDocuments").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ImportAutomationSettings = typeof importAutomationSettings.$inferSelect;
export type InsertImportAutomationSettings = typeof importAutomationSettings.$inferInsert;

// ─── Invitations (Treuhänder-Einladungen) ─────────────────────────────────────
// Zeitlich begrenzte Einladungen für externe Benutzer (z.B. Treuhänder).
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 200 }),
  role: mysqlEnum("role", ["admin", "bookkeeper", "viewer"]).default("viewer").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  acceptedByUserId: int("acceptedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;
