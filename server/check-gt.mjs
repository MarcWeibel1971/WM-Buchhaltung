import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { like } from 'drizzle-orm';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

// Raw SQL to check Gewerbe-Treuhand transactions
const [rows] = await conn.execute(
  "SELECT id, description, counterparty, amount, suggestedBookingText, matchedDocumentId FROM bank_transactions WHERE counterparty LIKE '%Gewerbe%' ORDER BY id"
);
console.log("=== Gewerbe-Treuhand Transactions ===");
for (const r of rows) {
  console.log(`ID: ${r.id}, Amount: ${r.amount}`);
  console.log(`  Counterparty: ${r.counterparty}`);
  console.log(`  Description: ${r.description}`);
  console.log(`  SuggestedBookingText: ${r.suggestedBookingText}`);
  console.log(`  MatchedDocId: ${r.matchedDocumentId}`);
  console.log();
}

// Also check matched documents for customer names
const [docs] = await conn.execute(
  "SELECT id, filename, aiMetadata FROM documents WHERE filename LIKE '%Gewerbe%' OR filename LIKE '%Treuhand%'"
);
console.log("=== Matched Documents ===");
for (const d of docs) {
  console.log(`Doc ID: ${d.id}, Filename: ${d.filename}`);
  if (d.aiMetadata) {
    try {
      const meta = JSON.parse(d.aiMetadata);
      console.log(`  Description: ${meta.description}`);
      console.log(`  Counterparty: ${meta.counterparty}`);
    } catch {}
  }
  console.log();
}

// Check booking rules for Gewerbe-Treuhand
const [rules] = await conn.execute(
  "SELECT * FROM booking_rules WHERE counterpartyPattern LIKE '%Gewerbe%'"
);
console.log("=== Booking Rules ===");
for (const r of rules) {
  console.log(`Rule ID: ${r.id}, Pattern: ${r.counterpartyPattern}`);
  console.log(`  BookingTextTemplate: ${r.bookingTextTemplate}`);
  console.log(`  DescriptionPattern: ${r.descriptionPattern}`);
  console.log(`  Debit: ${r.debitAccountId}, Credit: ${r.creditAccountId}`);
  console.log();
}

await conn.end();
